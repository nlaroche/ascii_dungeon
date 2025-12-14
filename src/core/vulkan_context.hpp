#pragma once

#include <vulkan/vulkan.h>
#include <vk_mem_alloc.h>

#include <vector>
#include <optional>
#include <functional>

namespace ascii {

class Window;

struct QueueFamilyIndices {
    std::optional<uint32_t> graphics;
    std::optional<uint32_t> present;
    std::optional<uint32_t> compute;

    bool is_complete() const {
        return graphics.has_value() && present.has_value();
    }
};

struct SwapchainSupportDetails {
    VkSurfaceCapabilitiesKHR capabilities;
    std::vector<VkSurfaceFormatKHR> formats;
    std::vector<VkPresentModeKHR> present_modes;
};

class VulkanContext {
public:
    explicit VulkanContext(Window& window);
    ~VulkanContext();

    // Non-copyable, non-movable
    VulkanContext(const VulkanContext&) = delete;
    VulkanContext& operator=(const VulkanContext&) = delete;
    VulkanContext(VulkanContext&&) = delete;
    VulkanContext& operator=(VulkanContext&&) = delete;

    // Frame management
    void begin_frame();
    void end_frame();
    void wait_idle();

    // Swapchain recreation
    void recreate_swapchain();

    // Getters
    VkInstance instance() const { return m_instance; }
    VkPhysicalDevice physical_device() const { return m_physical_device; }
    VkDevice device() const { return m_device; }
    VmaAllocator allocator() const { return m_allocator; }
    VkQueue graphics_queue() const { return m_graphics_queue; }
    VkQueue present_queue() const { return m_present_queue; }
    VkCommandPool command_pool() const { return m_command_pool; }

    VkSwapchainKHR swapchain() const { return m_swapchain; }
    VkFormat swapchain_format() const { return m_swapchain_format; }
    VkExtent2D swapchain_extent() const { return m_swapchain_extent; }
    const std::vector<VkImage>& swapchain_images() const { return m_swapchain_images; }
    const std::vector<VkImageView>& swapchain_image_views() const { return m_swapchain_image_views; }
    VkImage current_swapchain_image() const { return m_swapchain_images[m_image_index]; }
    VkImageView current_swapchain_image_view() const { return m_swapchain_image_views[m_image_index]; }

    uint32_t current_frame() const { return m_current_frame; }
    uint32_t image_index() const { return m_image_index; }
    VkCommandBuffer current_command_buffer() const { return m_command_buffers[m_current_frame]; }

    const QueueFamilyIndices& queue_families() const { return m_queue_families; }

    // RT support check
    bool supports_raytracing() const { return m_supports_raytracing; }

    // Single-time command buffer helper
    VkCommandBuffer begin_single_time_commands();
    void end_single_time_commands(VkCommandBuffer cmd);

    static constexpr uint32_t MAX_FRAMES_IN_FLIGHT = 2;

private:
    void create_instance();
    void setup_debug_messenger();
    void create_surface();
    void pick_physical_device();
    void create_logical_device();
    void create_allocator();
    void create_swapchain();
    void create_image_views();
    void create_command_pool();
    void create_command_buffers();
    void create_sync_objects();

    void cleanup_swapchain();
    void recreate_surface();

    QueueFamilyIndices find_queue_families(VkPhysicalDevice device);
    SwapchainSupportDetails query_swapchain_support(VkPhysicalDevice device);
    bool is_device_suitable(VkPhysicalDevice device);
    int rate_device_suitability(VkPhysicalDevice device);
    bool check_device_extension_support(VkPhysicalDevice device);

    VkSurfaceFormatKHR choose_swap_surface_format(const std::vector<VkSurfaceFormatKHR>& formats);
    VkPresentModeKHR choose_swap_present_mode(const std::vector<VkPresentModeKHR>& modes);
    VkExtent2D choose_swap_extent(const VkSurfaceCapabilitiesKHR& capabilities);

    Window& m_window;

    VkInstance m_instance = VK_NULL_HANDLE;
    VkDebugUtilsMessengerEXT m_debug_messenger = VK_NULL_HANDLE;
    VkSurfaceKHR m_surface = VK_NULL_HANDLE;
    VkPhysicalDevice m_physical_device = VK_NULL_HANDLE;
    VkDevice m_device = VK_NULL_HANDLE;
    VmaAllocator m_allocator = VK_NULL_HANDLE;

    QueueFamilyIndices m_queue_families;
    VkQueue m_graphics_queue = VK_NULL_HANDLE;
    VkQueue m_present_queue = VK_NULL_HANDLE;

    VkSwapchainKHR m_swapchain = VK_NULL_HANDLE;
    std::vector<VkImage> m_swapchain_images;
    std::vector<VkImageView> m_swapchain_image_views;
    VkFormat m_swapchain_format = VK_FORMAT_UNDEFINED;
    VkExtent2D m_swapchain_extent{};

    VkCommandPool m_command_pool = VK_NULL_HANDLE;
    std::vector<VkCommandBuffer> m_command_buffers;

    std::vector<VkSemaphore> m_image_available_semaphores;
    std::vector<VkSemaphore> m_render_finished_semaphores;
    std::vector<VkFence> m_in_flight_fences;

    uint32_t m_current_frame = 0;
    uint32_t m_image_index = 0;
    bool m_framebuffer_resized = false;

    bool m_supports_raytracing = false;

#ifdef DEBUG_BUILD
    static constexpr bool ENABLE_VALIDATION = true;
#else
    static constexpr bool ENABLE_VALIDATION = false;
#endif

    const std::vector<const char*> m_validation_layers = {
        "VK_LAYER_KHRONOS_validation"
    };

    const std::vector<const char*> m_device_extensions = {
        VK_KHR_SWAPCHAIN_EXTENSION_NAME,
        // Raytracing extensions
        VK_KHR_ACCELERATION_STRUCTURE_EXTENSION_NAME,
        VK_KHR_RAY_TRACING_PIPELINE_EXTENSION_NAME,
        VK_KHR_DEFERRED_HOST_OPERATIONS_EXTENSION_NAME,
        // Required by RT
        VK_KHR_BUFFER_DEVICE_ADDRESS_EXTENSION_NAME,
        VK_EXT_DESCRIPTOR_INDEXING_EXTENSION_NAME,
        VK_KHR_SPIRV_1_4_EXTENSION_NAME,
        VK_KHR_SHADER_FLOAT_CONTROLS_EXTENSION_NAME,
    };
};

} // namespace ascii
