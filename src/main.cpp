#include "core/window.hpp"
#include "core/vulkan_context.hpp"
#include "renderer/acceleration.hpp"
#include "renderer/rt_pipeline.hpp"
#include "ipc/ipc_server.hpp"

#ifdef _WIN32
#include <windows.h>
#endif

#include <spdlog/spdlog.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <cstdlib>
#include <cmath>
#include <cstring>
#include <exception>
#include <fstream>
#include <vector>
#include <thread>
#include <chrono>

// Command line options
struct LaunchOptions {
    bool test_mode = false;      // Tiny window for AI testing
    int width = 1280;
    int height = 720;
    int max_frames = 0;          // 0 = unlimited, >0 = exit after N frames
    bool screenshot = false;     // Capture screenshot in test mode
    std::string screenshot_path = "screenshot.ppm";
    int ipc_port = 0;            // 0 = disabled, >0 = enable IPC server on this port
    bool editor_mode = false;    // If true, don't capture mouse (for use with editor)
    uint64_t parent_hwnd = 0;    // Parent window handle for embedding (0 = standalone)
    bool no_vulkan = false;      // Disable Vulkan, just test window embedding with GDI
};

// Simple PPM image writer (no external dependencies)
void save_screenshot_ppm(const std::string& filename, const std::vector<uint8_t>& pixels,
                         uint32_t width, uint32_t height) {
    std::ofstream file(filename, std::ios::binary);
    if (!file) {
        spdlog::error("Failed to open screenshot file: {}", filename);
        return;
    }

    // PPM header
    file << "P6\n" << width << " " << height << "\n255\n";

    // Write RGB pixels (skip alpha)
    for (uint32_t y = 0; y < height; y++) {
        for (uint32_t x = 0; x < width; x++) {
            size_t idx = (y * width + x) * 4;  // RGBA
            file.put(static_cast<char>(pixels[idx + 0]));  // R
            file.put(static_cast<char>(pixels[idx + 1]));  // G
            file.put(static_cast<char>(pixels[idx + 2]));  // B
        }
    }

    spdlog::info("Screenshot saved: {} ({}x{})", filename, width, height);
}

LaunchOptions parse_args(int argc, char* argv[]) {
    LaunchOptions opts;
    for (int i = 1; i < argc; i++) {
        if (std::strcmp(argv[i], "--test") == 0) {
            opts.test_mode = true;
            opts.width = 640;      // Larger for better screenshot
            opts.height = 480;
            opts.max_frames = 5;   // Run a few frames then exit
            opts.screenshot = true; // Auto-screenshot in test mode
        } else if (std::strcmp(argv[i], "--frames") == 0 && i + 1 < argc) {
            opts.max_frames = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--width") == 0 && i + 1 < argc) {
            opts.width = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--height") == 0 && i + 1 < argc) {
            opts.height = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--screenshot") == 0) {
            opts.screenshot = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                opts.screenshot_path = argv[++i];
            }
        } else if (std::strcmp(argv[i], "--ipc-port") == 0 && i + 1 < argc) {
            opts.ipc_port = std::atoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--editor-mode") == 0) {
            opts.editor_mode = true;
        } else if (std::strcmp(argv[i], "--parent-hwnd") == 0 && i + 1 < argc) {
            opts.parent_hwnd = std::strtoull(argv[++i], nullptr, 10);
        } else if (std::strcmp(argv[i], "--no-vulkan") == 0) {
            opts.no_vulkan = true;
        }
    }
    return opts;
}

namespace {

// Helper to insert image memory barrier
void transition_image(VkCommandBuffer cmd, VkImage image,
                      VkImageLayout old_layout, VkImageLayout new_layout,
                      VkPipelineStageFlags2 src_stage, VkAccessFlags2 src_access,
                      VkPipelineStageFlags2 dst_stage, VkAccessFlags2 dst_access)
{
    VkImageMemoryBarrier2 barrier{};
    barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER_2;
    barrier.srcStageMask = src_stage;
    barrier.srcAccessMask = src_access;
    barrier.dstStageMask = dst_stage;
    barrier.dstAccessMask = dst_access;
    barrier.oldLayout = old_layout;
    barrier.newLayout = new_layout;
    barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.image = image;
    barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    barrier.subresourceRange.baseMipLevel = 0;
    barrier.subresourceRange.levelCount = 1;
    barrier.subresourceRange.baseArrayLayer = 0;
    barrier.subresourceRange.layerCount = 1;

    VkDependencyInfo dependency{};
    dependency.sType = VK_STRUCTURE_TYPE_DEPENDENCY_INFO;
    dependency.imageMemoryBarrierCount = 1;
    dependency.pImageMemoryBarriers = &barrier;

    vkCmdPipelineBarrier2(cmd, &dependency);
}

// Helper to add a letter "A" composed of cube instances
// This ensures proper normals since each cube is axis-aligned in local space
void add_letter_a(uint32_t cube_blas,
                  std::vector<ascii::Instance>& instances,
                  std::vector<ascii::GlyphInstance>& glyph_data,
                  const glm::vec3& position,
                  float scale,
                  float yRotation,
                  const glm::vec4& color,
                  const glm::vec4& emission)
{
    // Letter A dimensions (in local space, will be scaled)
    const float width = 1.0f;
    const float height = 1.5f;
    const float depth = 0.3f;
    const float leg_width = 0.15f;
    const float crossbar_height = 0.5f;

    // Rotation matrix for the whole letter
    glm::mat4 base_transform = glm::translate(glm::mat4(1.0f), position);
    base_transform = glm::rotate(base_transform, yRotation, glm::vec3(0, 1, 0));
    base_transform = glm::scale(base_transform, glm::vec3(scale));

    // Left leg - angled outward
    {
        ascii::Instance inst;
        inst.transform = base_transform;
        inst.transform = glm::translate(inst.transform, glm::vec3(-width * 0.22f, 0.0f, 0.0f));
        inst.transform = glm::rotate(inst.transform, glm::radians(-12.0f), glm::vec3(0, 0, 1));
        inst.transform = glm::scale(inst.transform, glm::vec3(leg_width, height * 0.9f, depth));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = color;
        glyph.emission = emission;
        glyph_data.push_back(glyph);
    }

    // Right leg - angled outward (mirrored)
    {
        ascii::Instance inst;
        inst.transform = base_transform;
        inst.transform = glm::translate(inst.transform, glm::vec3(width * 0.22f, 0.0f, 0.0f));
        inst.transform = glm::rotate(inst.transform, glm::radians(12.0f), glm::vec3(0, 0, 1));
        inst.transform = glm::scale(inst.transform, glm::vec3(leg_width, height * 0.9f, depth));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = color;
        glyph.emission = emission;
        glyph_data.push_back(glyph);
    }

    // Crossbar
    {
        ascii::Instance inst;
        inst.transform = base_transform;
        inst.transform = glm::translate(inst.transform, glm::vec3(0.0f, -height * 0.15f, 0.0f));
        inst.transform = glm::scale(inst.transform, glm::vec3(width * 0.5f, leg_width * 0.8f, depth));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = color;
        glyph.emission = emission;
        glyph_data.push_back(glyph);
    }

    // Top cap (apex of A)
    {
        ascii::Instance inst;
        inst.transform = base_transform;
        inst.transform = glm::translate(inst.transform, glm::vec3(0.0f, height * 0.4f, 0.0f));
        inst.transform = glm::scale(inst.transform, glm::vec3(leg_width * 1.2f, leg_width * 0.8f, depth));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = color;
        glyph.emission = emission;
        glyph_data.push_back(glyph);
    }
}

// Build a simple dungeon scene
void build_dungeon_scene(ascii::AccelerationStructureManager& accel,
                         ascii::RTPipeline& pipeline,
                         std::vector<ascii::Instance>& instances,
                         std::vector<ascii::GlyphInstance>& glyph_data,
                         std::vector<ascii::Light>& lights)
{
    instances.clear();
    glyph_data.clear();
    lights.clear();

    // Create geometry - just the cube BLAS, letter A is built from cubes
    uint32_t cube_blas = accel.create_cube_blas();

    // Build a simple room: 10x10 floor with walls
    const int room_size = 10;
    const float wall_height = 1.0f;

    // Floor tiles
    for (int z = 0; z < room_size; z++) {
        for (int x = 0; x < room_size; x++) {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(x, -0.5f, z));
            inst.transform = glm::scale(inst.transform, glm::vec3(1.0f, 0.1f, 1.0f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            // Floor is dark gray
            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.15f, 0.15f, 0.15f, 0.95f);  // Dark gray, high roughness
            glyph.emission = glm::vec4(0.0f, 0.0f, 0.0f, 0.0f);
            glyph_data.push_back(glyph);
        }
    }

    // Walls around the perimeter
    for (int i = 0; i < room_size; i++) {
        // North wall (z = 0)
        {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(i, wall_height / 2.0f, -0.5f));
            inst.transform = glm::scale(inst.transform, glm::vec3(1.0f, wall_height, 0.2f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.3f, 0.3f, 0.35f, 0.9f);
            glyph.emission = glm::vec4(0.0f);
            glyph_data.push_back(glyph);
        }

        // South wall (z = room_size)
        {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(i, wall_height / 2.0f, room_size - 0.5f));
            inst.transform = glm::scale(inst.transform, glm::vec3(1.0f, wall_height, 0.2f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.3f, 0.3f, 0.35f, 0.9f);
            glyph.emission = glm::vec4(0.0f);
            glyph_data.push_back(glyph);
        }

        // West wall (x = 0)
        {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(-0.5f, wall_height / 2.0f, i));
            inst.transform = glm::scale(inst.transform, glm::vec3(0.2f, wall_height, 1.0f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.3f, 0.3f, 0.35f, 0.9f);
            glyph.emission = glm::vec4(0.0f);
            glyph_data.push_back(glyph);
        }

        // East wall (x = room_size)
        {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(room_size - 0.5f, wall_height / 2.0f, i));
            inst.transform = glm::scale(inst.transform, glm::vec3(0.2f, wall_height, 1.0f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.3f, 0.3f, 0.35f, 0.9f);
            glyph.emission = glm::vec4(0.0f);
            glyph_data.push_back(glyph);
        }
    }

    // Add a pillar in the middle
    {
        ascii::Instance inst;
        inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(room_size / 2.0f, wall_height / 2.0f, room_size / 2.0f));
        inst.transform = glm::scale(inst.transform, glm::vec3(0.5f, wall_height, 0.5f));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = glm::vec4(0.4f, 0.35f, 0.3f, 0.85f);
        glyph.emission = glm::vec4(0.0f);
        glyph_data.push_back(glyph);
    }

    // Add a glowing torch on the pillar (main light source)
    {
        ascii::Instance inst;
        inst.transform = glm::translate(glm::mat4(1.0f), glm::vec3(room_size / 2.0f, wall_height + 0.2f, room_size / 2.0f));
        inst.transform = glm::scale(inst.transform, glm::vec3(0.2f, 0.35f, 0.2f));
        inst.custom_index = static_cast<uint32_t>(glyph_data.size());
        inst.blas_index = cube_blas;
        instances.push_back(inst);

        ascii::GlyphInstance glyph;
        glyph.color = glm::vec4(1.0f, 0.7f, 0.3f, 0.15f);  // Very smooth
        glyph.emission = glm::vec4(1.0f, 0.55f, 0.15f, 8.0f);  // Bright glow
        glyph_data.push_back(glyph);
    }

    // Add letter "A" instances using the helper function (builds from cubes for correct normals)

    // LEFT: Red letter A
    add_letter_a(cube_blas, instances, glyph_data,
                 glm::vec3(3.0f, 1.0f, 3.0f),
                 1.5f,  // scale
                 glm::radians(30.0f),  // rotation
                 glm::vec4(1.0f, 0.1f, 0.1f, 0.6f),      // Bright red, matte (roughness 0.6)
                 glm::vec4(0.0f));                        // No emission (lit by red accent light)

    // MIDDLE: Green letter A (center of room)
    add_letter_a(cube_blas, instances, glyph_data,
                 glm::vec3(room_size / 2.0f, 1.5f, room_size / 2.0f - 2.0f),
                 2.5f,  // scale
                 0.0f,  // rotation
                 glm::vec4(0.1f, 1.0f, 0.2f, 0.6f),      // Bright green, matte (roughness 0.6)
                 glm::vec4(0.0f));                        // No emission (lit by green accent light)

    // RIGHT: Blue letter A
    add_letter_a(cube_blas, instances, glyph_data,
                 glm::vec3(7.0f, 1.2f, 3.0f),
                 1.8f,  // scale
                 glm::radians(-20.0f),  // rotation
                 glm::vec4(0.1f, 0.3f, 1.0f, 0.6f),      // Bright blue, matte (roughness 0.6)
                 glm::vec4(0.0f));                        // No emission (lit by blue accent light)

    // Add lights
    // Main torch light
    {
        ascii::Light light;
        light.position = glm::vec4(room_size / 2.0f, wall_height + 0.5f, room_size / 2.0f, 12.0f);  // radius = 12
        light.color = glm::vec4(1.0f, 0.6f, 0.3f, 8.0f);  // Warm orange, power = 8
        lights.push_back(light);
    }

    // Corner torches
    float torch_offset = 1.5f;
    std::vector<glm::vec3> torch_positions = {
        {torch_offset, wall_height * 0.7f, torch_offset},
        {room_size - torch_offset - 1, wall_height * 0.7f, torch_offset},
        {torch_offset, wall_height * 0.7f, room_size - torch_offset - 1},
        {room_size - torch_offset - 1, wall_height * 0.7f, room_size - torch_offset - 1},
    };

    for (const auto& pos : torch_positions) {
        // Torch geometry (glowing emissive)
        {
            ascii::Instance inst;
            inst.transform = glm::translate(glm::mat4(1.0f), pos);
            inst.transform = glm::scale(inst.transform, glm::vec3(0.12f, 0.25f, 0.12f));
            inst.custom_index = static_cast<uint32_t>(glyph_data.size());
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(1.0f, 0.6f, 0.2f, 0.2f);  // Smooth, low roughness
            glyph.emission = glm::vec4(1.0f, 0.5f, 0.1f, 5.0f);  // Emission
            glyph_data.push_back(glyph);
        }

        // Light
        ascii::Light light;
        light.position = glm::vec4(pos.x, pos.y + 0.3f, pos.z, 10.0f);  // radius = 10
        light.color = glm::vec4(1.0f, 0.55f, 0.25f, 5.0f);  // power = 5
        lights.push_back(light);
    }

    // RGB accent lights for each letter A
    // RED accent light near the left A
    {
        ascii::Light light;
        light.position = glm::vec4(3.0f, 2.5f, 3.0f, 5.0f);   // Near left A, radius = 5
        light.color = glm::vec4(1.0f, 0.2f, 0.1f, 6.0f);      // Red, power = 6
        lights.push_back(light);
    }

    // GREEN accent light near the middle A
    {
        ascii::Light light;
        light.position = glm::vec4(room_size / 2.0f, 3.5f, room_size / 2.0f - 2.0f, 6.0f);  // Near middle A, radius = 6
        light.color = glm::vec4(0.2f, 1.0f, 0.3f, 6.0f);      // Green, power = 6
        lights.push_back(light);
    }

    // BLUE accent light near the right A
    {
        ascii::Light light;
        light.position = glm::vec4(7.0f, 2.5f, 3.0f, 5.0f);   // Near right A, radius = 5
        light.color = glm::vec4(0.2f, 0.4f, 1.0f, 6.0f);      // Blue, power = 6
        lights.push_back(light);
    }

    // Soft white fill light (overall ambient)
    {
        ascii::Light light;
        light.position = glm::vec4(room_size / 2.0f, wall_height + 2.0f, room_size / 2.0f, 20.0f);  // Overhead, radius = 20
        light.color = glm::vec4(1.0f, 1.0f, 1.0f, 1.5f);      // Neutral white, power = 1.5
        lights.push_back(light);
    }

    // Terminator light (signals end of light array in shader)
    {
        ascii::Light terminator;
        terminator.position = glm::vec4(0.0f);
        terminator.color = glm::vec4(0.0f);  // power = 0 signals end
        lights.push_back(terminator);
    }

    // Build TLAS
    accel.build_tlas(instances);

    // Update pipeline buffers
    pipeline.set_instances(glyph_data);
    pipeline.set_lights(lights);

    spdlog::info("Built dungeon scene: {} instances, {} lights",
                 instances.size(), lights.size() - 1);
}

} // anonymous namespace

int main(int argc, char* argv[]) {
    try {
        // Parse command line
        LaunchOptions opts = parse_args(argc, argv);

        // Setup logging for real-time debug output
        spdlog::set_level(spdlog::level::debug);
        spdlog::set_pattern("[%H:%M:%S.%e] [%^%l%$] %v");
        spdlog::flush_on(spdlog::level::debug);  // Flush immediately for debugging

        // Hide console window in editor mode (Windows only)
#ifdef _WIN32
        if (opts.editor_mode) {
            HWND console = GetConsoleWindow();
            if (console) {
                ShowWindow(console, SW_HIDE);
            }
        }
#endif

        spdlog::info("========================================");
        spdlog::info("Starting ASCII Dungeon Engine");
        if (opts.test_mode) {
            spdlog::info("TEST MODE: {}x{}, {} frames", opts.width, opts.height, opts.max_frames);
        }
        spdlog::info("========================================");

        // Create window
        ascii::Window::Config window_config;
        window_config.width = opts.width;
        window_config.height = opts.height;
        window_config.title = opts.test_mode ? "ASCII Dungeon [TEST]" : "ASCII Dungeon";

        // Pass parent HWND through config so embedding happens BEFORE Vulkan init
        if (opts.parent_hwnd != 0) {
            window_config.parent_hwnd = reinterpret_cast<void*>(opts.parent_hwnd);
            spdlog::info("Will embed in parent HWND: {}", opts.parent_hwnd);
        }

        // Editor overlay mode: start hidden, show after positioned
        if (opts.parent_hwnd == 0 && opts.editor_mode) {
            window_config.start_hidden = true;
        }

        ascii::Window window(window_config);

        // Editor mode without parent HWND = overlay mode (fallback)
        if (opts.parent_hwnd == 0 && opts.editor_mode) {
            window.set_borderless(true);
        }

        // NO-VULKAN MODE: Test window embedding without Vulkan
        // This helps isolate whether issues are from Vulkan or from window hosting
        if (opts.no_vulkan) {
            spdlog::info("NO-VULKAN MODE: Testing window embedding with GDI only");

#ifdef _WIN32
            HWND hwnd = static_cast<HWND>(window.native_handle());
            HDC hdc = GetDC(hwnd);

            // Create IPC server if requested (so editor can still control the window)
            std::unique_ptr<ascii::IPCServer> ipc_server;
            if (opts.ipc_port > 0) {
                ipc_server = std::make_unique<ascii::IPCServer>(static_cast<uint16_t>(opts.ipc_port));

                // Register window control commands
                ipc_server->register_command("window.resize", [&window](const ascii::json& params) -> ascii::json {
                    int width = params.value("width", 0);
                    int height = params.value("height", 0);
                    if (width > 0 && height > 0) {
                        window.resize(width, height);
                        return {{"success", true}, {"width", width}, {"height", height}};
                    }
                    return {{"success", false}, {"error", "Invalid dimensions"}};
                });

                ipc_server->register_command("window.set_bounds", [&window](const ascii::json& params) -> ascii::json {
                    int x = params.value("x", 0);
                    int y = params.value("y", 0);
                    int width = params.value("width", 0);
                    int height = params.value("height", 0);
                    if (width > 0 && height > 0) {
                        window.set_position_and_size(x, y, width, height);
                        return {{"success", true}};
                    }
                    return {{"success", false}, {"error", "Invalid dimensions"}};
                });

                ipc_server->register_command("window.set_owner", [&window](const ascii::json& params) -> ascii::json {
                    uint64_t owner_hwnd = params.value("hwnd", uint64_t(0));
                    if (owner_hwnd != 0) {
                        window.set_owner(reinterpret_cast<void*>(owner_hwnd));
                        return {{"success", true}};
                    }
                    return {{"success", false}, {"error", "Invalid HWND"}};
                });

                ipc_server->register_command("window.set_follow", [&window](const ascii::json& params) -> ascii::json {
                    bool follow = params.value("follow", true);
                    int offset_x = params.value("offset_x", 0);
                    int offset_y = params.value("offset_y", 0);
                    int width = params.value("width", 0);
                    int height = params.value("height", 0);
                    window.set_follow_owner(follow, offset_x, offset_y, width, height);
                    return {{"success", true}};
                });

                ipc_server->register_command("engine.ping", [](const ascii::json& params) -> ascii::json {
                    return {{"pong", true}};
                });

                ipc_server->register_command("window.show", [&window](const ascii::json& params) -> ascii::json {
                    window.show();
                    return {{"success", true}};
                });

                if (!ipc_server->start()) {
                    spdlog::error("Failed to start IPC server on port {}", opts.ipc_port);
                    ipc_server.reset();
                } else {
                    spdlog::info("IPC server started on port {}", opts.ipc_port);
                }
            }

            // Create a solid brush for painting
            HBRUSH brush = CreateSolidBrush(RGB(40, 60, 80));  // Dark blue-gray

            // Animation state
            float hue = 0.0f;
            int frame_count = 0;

            while (!window.should_close()) {
                window.poll_events();
                window.update_follow_owner();

                // Handle escape to quit
                if (window.key_pressed(GLFW_KEY_ESCAPE)) {
                    break;
                }

                // Animate color based on time
                hue = fmodf(window.total_time() * 30.0f, 360.0f);

                // Simple HSV to RGB conversion (S=0.5, V=0.8 for muted colors)
                float h = hue / 60.0f;
                int i = static_cast<int>(h) % 6;
                float f = h - static_cast<int>(h);
                float p = 0.8f * (1.0f - 0.5f);
                float q = 0.8f * (1.0f - 0.5f * f);
                float t = 0.8f * (1.0f - 0.5f * (1.0f - f));

                float r, g, b;
                switch (i) {
                    case 0: r = 0.8f; g = t; b = p; break;
                    case 1: r = q; g = 0.8f; b = p; break;
                    case 2: r = p; g = 0.8f; b = t; break;
                    case 3: r = p; g = q; b = 0.8f; break;
                    case 4: r = t; g = p; b = 0.8f; break;
                    default: r = 0.8f; g = p; b = q; break;
                }

                // Update brush color
                DeleteObject(brush);
                brush = CreateSolidBrush(RGB(
                    static_cast<int>(r * 255),
                    static_cast<int>(g * 255),
                    static_cast<int>(b * 255)
                ));

                // Get current client rect
                RECT client;
                GetClientRect(hwnd, &client);

                // Fill with animated color
                FillRect(hdc, &client, brush);

                // Draw some text to show it's working
                SetBkMode(hdc, TRANSPARENT);
                SetTextColor(hdc, RGB(255, 255, 255));
                char text[128];
                snprintf(text, sizeof(text), "NO-VULKAN MODE - Frame %d - %.1f FPS",
                         frame_count, 1.0f / window.delta_time());
                DrawTextA(hdc, text, -1, &client, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

                // Draw size info
                snprintf(text, sizeof(text), "Size: %dx%d", client.right, client.bottom);
                RECT bottom_rect = client;
                bottom_rect.top = client.bottom - 30;
                DrawTextA(hdc, text, -1, &bottom_rect, DT_CENTER | DT_TOP | DT_SINGLELINE);

                frame_count++;

                // Limit frame rate
                std::this_thread::sleep_for(std::chrono::milliseconds(16));
            }

            // Cleanup
            if (ipc_server) {
                ipc_server->stop();
            }
            DeleteObject(brush);
            ReleaseDC(hwnd, hdc);
            spdlog::info("No-vulkan mode exiting after {} frames", frame_count);
#else
            spdlog::error("No-vulkan mode only supported on Windows");
#endif
            return EXIT_SUCCESS;
        }

        // Create Vulkan context
        ascii::VulkanContext vulkan(window);

        // Create acceleration structure manager
        ascii::AccelerationStructureManager accel(vulkan);

        // Build initial scene (need TLAS before creating pipeline)
        std::vector<ascii::Instance> instances;
        std::vector<ascii::GlyphInstance> glyph_data;
        std::vector<ascii::Light> lights;

        // Create a minimal scene first
        uint32_t cube_blas = accel.create_cube_blas();
        {
            ascii::Instance inst;
            inst.transform = glm::mat4(1.0f);
            inst.custom_index = 0;
            inst.blas_index = cube_blas;
            instances.push_back(inst);

            ascii::GlyphInstance glyph;
            glyph.color = glm::vec4(0.5f, 0.5f, 0.5f, 0.8f);
            glyph.emission = glm::vec4(0.0f);
            glyph_data.push_back(glyph);

            ascii::Light light;
            light.position = glm::vec4(0.0f, 2.0f, 0.0f, 10.0f);
            light.color = glm::vec4(1.0f, 1.0f, 1.0f, 5.0f);
            lights.push_back(light);

            ascii::Light terminator;
            terminator.color = glm::vec4(0.0f);
            lights.push_back(terminator);
        }
        accel.build_tlas(instances);

        // Create RT pipeline (needs TLAS to exist)
        ascii::RTPipeline rt_pipeline(vulkan, accel);

        // Now build the actual dungeon scene
        build_dungeon_scene(accel, rt_pipeline, instances, glyph_data, lights);

        // IMPORTANT: Update TLAS descriptor after rebuilding the acceleration structure
        rt_pipeline.update_tlas_descriptor();

        // Create IPC server if requested
        std::unique_ptr<ascii::IPCServer> ipc_server;
        if (opts.ipc_port > 0) {
            ipc_server = std::make_unique<ascii::IPCServer>(static_cast<uint16_t>(opts.ipc_port));

            // Register command handlers
            // Note: We capture references to mutable state - these handlers run synchronously in poll()

            // stats.get - Return performance stats
            ipc_server->register_command("stats.get", [&](const ascii::json& params) -> ascii::json {
                return {
                    {"fps", 1.0f / window.delta_time()},
                    {"frame_time", window.delta_time()},
                    {"instance_count", instances.size()},
                    {"light_count", lights.size() - 1}  // Exclude terminator
                };
            });

            // scene.get - Return full scene data
            ipc_server->register_command("scene.get", [&](const ascii::json& params) -> ascii::json {
                ascii::json entities = ascii::json::array();
                for (size_t i = 0; i < glyph_data.size(); i++) {
                    const auto& glyph = glyph_data[i];
                    const auto& inst = instances[i];
                    entities.push_back({
                        {"id", i},
                        {"color", {glyph.color.r, glyph.color.g, glyph.color.b, glyph.color.a}},
                        {"emission", {glyph.emission.r, glyph.emission.g, glyph.emission.b, glyph.emission.a}}
                    });
                }

                ascii::json light_array = ascii::json::array();
                for (size_t i = 0; i < lights.size() - 1; i++) {  // Exclude terminator
                    const auto& light = lights[i];
                    light_array.push_back({
                        {"id", i},
                        {"position", {light.position.x, light.position.y, light.position.z}},
                        {"radius", light.position.w},
                        {"color", {light.color.r, light.color.g, light.color.b}},
                        {"power", light.color.a}
                    });
                }

                return {
                    {"entities", entities},
                    {"lights", light_array}
                };
            });

            // camera.get - Return camera state
            // Capture camera variables by reference (they're declared below)
            // We'll re-register this after camera vars are declared

            // engine.pause / engine.resume - Placeholder for future use
            ipc_server->register_command("engine.ping", [](const ascii::json& params) -> ascii::json {
                return {{"pong", true}};
            });

            // window.resize - Resize engine viewport (for editor embedding)
            ipc_server->register_command("window.resize", [&window](const ascii::json& params) -> ascii::json {
                int width = params.value("width", 0);
                int height = params.value("height", 0);
                if (width > 0 && height > 0) {
                    window.resize(width, height);
                    return {{"success", true}, {"width", width}, {"height", height}};
                }
                return {{"success", false}, {"error", "Invalid dimensions"}};
            });

            // window.set_bounds - Set position and size (for overlay mode)
            ipc_server->register_command("window.set_bounds", [&window](const ascii::json& params) -> ascii::json {
                int x = params.value("x", 0);
                int y = params.value("y", 0);
                int width = params.value("width", 0);
                int height = params.value("height", 0);
                if (width > 0 && height > 0) {
                    window.set_position_and_size(x, y, width, height);
                    return {{"success", true}};
                }
                return {{"success", false}, {"error", "Invalid dimensions"}};
            });

            // window.set_owner - Set owner window for z-order (overlay stays above owner)
            ipc_server->register_command("window.set_owner", [&window](const ascii::json& params) -> ascii::json {
                uint64_t owner_hwnd = params.value("hwnd", uint64_t(0));
                if (owner_hwnd != 0) {
                    window.set_owner(reinterpret_cast<void*>(owner_hwnd));
                    return {{"success", true}};
                }
                return {{"success", false}, {"error", "Invalid HWND"}};
            });

            // window.set_follow - Enable low-latency position tracking by polling owner window directly
            ipc_server->register_command("window.set_follow", [&window](const ascii::json& params) -> ascii::json {
                bool follow = params.value("follow", true);
                int offset_x = params.value("offset_x", 0);
                int offset_y = params.value("offset_y", 0);
                int width = params.value("width", 0);
                int height = params.value("height", 0);
                window.set_follow_owner(follow, offset_x, offset_y, width, height);
                return {{"success", true}};
            });

            if (!ipc_server->start()) {
                spdlog::error("Failed to start IPC server on port {}", opts.ipc_port);
                ipc_server.reset();
            }
        }

        // Camera state
        glm::vec3 camera_pos(5.0f, 1.0f, 8.0f);
        float camera_yaw = 0.0f;
        float camera_pitch = 0.0f;
        const float move_speed = 5.0f;
        const float mouse_sensitivity = 0.002f;

        // Register camera commands now that camera vars are declared
        if (ipc_server) {
            ipc_server->register_command("camera.get", [&](const ascii::json& params) -> ascii::json {
                return {
                    {"position", {camera_pos.x, camera_pos.y, camera_pos.z}},
                    {"yaw", camera_yaw},
                    {"pitch", camera_pitch}
                };
            });

            ipc_server->register_command("camera.set", [&](const ascii::json& params) -> ascii::json {
                if (params.contains("position")) {
                    auto pos = params["position"];
                    camera_pos = glm::vec3(pos[0].get<float>(), pos[1].get<float>(), pos[2].get<float>());
                }
                if (params.contains("yaw")) {
                    camera_yaw = params["yaw"].get<float>();
                }
                if (params.contains("pitch")) {
                    camera_pitch = params["pitch"].get<float>();
                }
                return {{"success", true}};
            });
        }

        // Capture mouse for FPS controls (unless in editor mode)
        if (!opts.editor_mode) {
            window.set_cursor_captured(true);
        }

        // Main loop
        spdlog::info("Entering main loop - WASD to move, Mouse to look, ESC to quit");

        int frame_count = 0;
        while (!window.should_close()) {
            // Check frame limit for test mode
            if (opts.max_frames > 0 && frame_count >= opts.max_frames) {
                spdlog::info("Test complete: {} frames rendered successfully", frame_count);
                break;
            }
            window.poll_events();
            window.update_follow_owner();  // Track owner window position (low-latency overlay sync)
            float dt = window.delta_time();

            // Handle escape to quit
            if (window.key_pressed(GLFW_KEY_ESCAPE)) {
                break;
            }

            // Mouse look
            auto [dx, dy] = window.mouse_delta();
            camera_yaw -= static_cast<float>(dx) * mouse_sensitivity;
            camera_pitch -= static_cast<float>(dy) * mouse_sensitivity;

            // Clamp pitch
            camera_pitch = glm::clamp(camera_pitch, -1.5f, 1.5f);

            // Calculate forward/right vectors
            glm::vec3 forward(
                std::sin(camera_yaw) * std::cos(camera_pitch),
                std::sin(camera_pitch),
                std::cos(camera_yaw) * std::cos(camera_pitch)
            );
            glm::vec3 right = glm::normalize(glm::cross(forward, glm::vec3(0, 1, 0)));

            // Movement
            if (window.key_down(GLFW_KEY_W)) {
                camera_pos += forward * move_speed * dt;
            }
            if (window.key_down(GLFW_KEY_S)) {
                camera_pos -= forward * move_speed * dt;
            }
            if (window.key_down(GLFW_KEY_A)) {
                camera_pos -= right * move_speed * dt;
            }
            if (window.key_down(GLFW_KEY_D)) {
                camera_pos += right * move_speed * dt;
            }

            // Begin frame
            vulkan.begin_frame();

            VkCommandBuffer cmd = vulkan.current_command_buffer();
            VkImage swapchain_image = vulkan.current_swapchain_image();
            VkExtent2D extent = vulkan.swapchain_extent();

            // Setup camera matrices
            glm::mat4 view = glm::lookAt(
                camera_pos,
                camera_pos + forward,
                glm::vec3(0, 1, 0)
            );
            glm::mat4 proj = glm::perspective(
                glm::radians(75.0f),
                static_cast<float>(extent.width) / static_cast<float>(extent.height),
                0.1f,
                100.0f
            );
            proj[1][1] *= -1;  // Flip Y for Vulkan

            ascii::CameraPushConstants camera_data;
            camera_data.view_inverse = glm::inverse(view);
            camera_data.proj_inverse = glm::inverse(proj);
            camera_data.camera_pos = glm::vec4(camera_pos, window.total_time());

            // Ensure storage image exists and is the right size
            rt_pipeline.resize_storage_image(extent.width, extent.height);

            // Transition storage image: UNDEFINED -> GENERAL (for RT output)
            VkImage storage_image = rt_pipeline.storage_image();
            transition_image(cmd, storage_image,
                VK_IMAGE_LAYOUT_UNDEFINED,
                VK_IMAGE_LAYOUT_GENERAL,
                VK_PIPELINE_STAGE_2_TOP_OF_PIPE_BIT,
                0,
                VK_PIPELINE_STAGE_2_RAY_TRACING_SHADER_BIT_KHR,
                VK_ACCESS_2_SHADER_STORAGE_WRITE_BIT);

            // Trace rays to storage image
            rt_pipeline.trace_rays(cmd, extent.width, extent.height, camera_data);

            // Transition storage image: GENERAL -> TRANSFER_SRC
            transition_image(cmd, storage_image,
                VK_IMAGE_LAYOUT_GENERAL,
                VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
                VK_PIPELINE_STAGE_2_RAY_TRACING_SHADER_BIT_KHR,
                VK_ACCESS_2_SHADER_STORAGE_WRITE_BIT,
                VK_PIPELINE_STAGE_2_BLIT_BIT,
                VK_ACCESS_2_TRANSFER_READ_BIT);

            // Transition swapchain image: UNDEFINED -> TRANSFER_DST
            transition_image(cmd, swapchain_image,
                VK_IMAGE_LAYOUT_UNDEFINED,
                VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
                VK_PIPELINE_STAGE_2_TOP_OF_PIPE_BIT,
                0,
                VK_PIPELINE_STAGE_2_BLIT_BIT,
                VK_ACCESS_2_TRANSFER_WRITE_BIT);

            // Blit storage image to swapchain (handles UNORM -> SRGB conversion)
            VkImageBlit2 blit_region{};
            blit_region.sType = VK_STRUCTURE_TYPE_IMAGE_BLIT_2;
            blit_region.srcSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            blit_region.srcSubresource.layerCount = 1;
            blit_region.srcOffsets[0] = {0, 0, 0};
            blit_region.srcOffsets[1] = {static_cast<int32_t>(extent.width), static_cast<int32_t>(extent.height), 1};
            blit_region.dstSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            blit_region.dstSubresource.layerCount = 1;
            blit_region.dstOffsets[0] = {0, 0, 0};
            blit_region.dstOffsets[1] = {static_cast<int32_t>(extent.width), static_cast<int32_t>(extent.height), 1};

            VkBlitImageInfo2 blit_info{};
            blit_info.sType = VK_STRUCTURE_TYPE_BLIT_IMAGE_INFO_2;
            blit_info.srcImage = storage_image;
            blit_info.srcImageLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
            blit_info.dstImage = swapchain_image;
            blit_info.dstImageLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
            blit_info.regionCount = 1;
            blit_info.pRegions = &blit_region;
            blit_info.filter = VK_FILTER_NEAREST;

            vkCmdBlitImage2(cmd, &blit_info);

            // Transition swapchain image: TRANSFER_DST -> PRESENT_SRC
            transition_image(cmd, swapchain_image,
                VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
                VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,
                VK_PIPELINE_STAGE_2_BLIT_BIT,
                VK_ACCESS_2_TRANSFER_WRITE_BIT,
                VK_PIPELINE_STAGE_2_BOTTOM_OF_PIPE_BIT,
                0);

            // End frame and present
            vulkan.end_frame();
            frame_count++;

            // Frame rate limiter (target ~60 FPS as safety measure)
            // This prevents GPU from running at 100% if vsync fails or window is hidden
            constexpr float target_frame_time = 1.0f / 60.0f;  // 16.67ms
            if (dt < target_frame_time) {
                auto sleep_ms = static_cast<int>((target_frame_time - dt) * 1000.0f);
                if (sleep_ms > 0) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(sleep_ms));
                }
            }

            // Emit frame event to IPC clients (every 10 frames to avoid flooding)
            if (ipc_server && (frame_count % 10 == 0)) {
                ipc_server->emit_event("frame_rendered", {
                    {"frame", frame_count},
                    {"fps", 1.0f / dt},
                    {"dt", dt},
                    {"time", window.total_time()}
                });
            }
        }

        // Stop IPC server before cleanup
        if (ipc_server) {
            ipc_server->stop();
        }

        spdlog::info("Shutting down after {} frames", frame_count);

        // Wait for GPU to finish before cleanup
        vulkan.wait_idle();

        // Capture screenshot if requested
        if (opts.screenshot && frame_count > 0) {
            auto pixels = rt_pipeline.capture_screenshot();
            if (!pixels.empty()) {
                save_screenshot_ppm(opts.screenshot_path, pixels,
                                    vulkan.swapchain_extent().width,
                                    vulkan.swapchain_extent().height);
            }
        }

    } catch (const std::exception& e) {
        spdlog::error("Fatal error: {}", e.what());
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
