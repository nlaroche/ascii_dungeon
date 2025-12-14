#pragma once

#include "buffer.hpp"
#include "acceleration.hpp"

#include <vulkan/vulkan.h>
#include <glm/glm.hpp>

#include <vector>
#include <string>
#include <memory>

namespace ascii {

class VulkanContext;

// Push constants for camera data
struct CameraPushConstants {
    glm::mat4 view_inverse;
    glm::mat4 proj_inverse;
    glm::vec4 camera_pos;  // xyz = position, w = time
};

// Instance data stored in SSBO
struct GlyphInstance {
    glm::vec4 color;           // rgb = color, a = roughness
    glm::vec4 emission;        // rgb = emission, a = power
};

// Light data
struct Light {
    glm::vec4 position;        // xyz = pos, w = radius
    glm::vec4 color;           // rgb = color, a = power
};

class RTPipeline {
public:
    RTPipeline(VulkanContext& ctx, AccelerationStructureManager& accel);
    ~RTPipeline();

    // Update instance data
    void set_instances(const std::vector<GlyphInstance>& instances);

    // Update lights
    void set_lights(const std::vector<Light>& lights);

    // Record raytracing commands (uses internal storage image)
    void trace_rays(VkCommandBuffer cmd, uint32_t width, uint32_t height,
                    const CameraPushConstants& camera);

    // Update TLAS descriptor after rebuilding acceleration structure
    void update_tlas_descriptor();

    // Recreate storage image if size changed
    void resize_storage_image(uint32_t width, uint32_t height);

    // Get storage image for blitting to swapchain
    VkImage storage_image() const { return m_storage_image; }
    VkImageView storage_image_view() const { return m_storage_image_view; }

    // Capture screenshot (returns RGBA pixels)
    std::vector<uint8_t> capture_screenshot();

private:
    void load_shaders();
    void create_descriptor_set_layout();
    void create_pipeline_layout();
    void create_pipeline();
    void create_shader_binding_table();
    void create_descriptor_pool();
    void create_descriptor_sets();
    void create_storage_image();
    void create_instance_buffer();
    void create_light_buffer();

    std::vector<char> read_shader_file(const std::string& filename);
    VkShaderModule create_shader_module(const std::vector<char>& code);

    VulkanContext& m_ctx;
    AccelerationStructureManager& m_accel;

    VkDescriptorSetLayout m_descriptor_set_layout = VK_NULL_HANDLE;
    VkPipelineLayout m_pipeline_layout = VK_NULL_HANDLE;
    VkPipeline m_pipeline = VK_NULL_HANDLE;

    VkDescriptorPool m_descriptor_pool = VK_NULL_HANDLE;
    VkDescriptorSet m_descriptor_set = VK_NULL_HANDLE;

    // Shader modules
    VkShaderModule m_raygen_shader = VK_NULL_HANDLE;
    VkShaderModule m_miss_shader = VK_NULL_HANDLE;
    VkShaderModule m_shadow_miss_shader = VK_NULL_HANDLE;
    VkShaderModule m_bounce_miss_shader = VK_NULL_HANDLE;
    VkShaderModule m_closest_hit_shader = VK_NULL_HANDLE;

    // Shader binding table
    Buffer m_sbt_buffer;
    VkStridedDeviceAddressRegionKHR m_raygen_region{};
    VkStridedDeviceAddressRegionKHR m_miss_region{};
    VkStridedDeviceAddressRegionKHR m_hit_region{};
    VkStridedDeviceAddressRegionKHR m_callable_region{};

    // Storage image for output
    VkImage m_storage_image = VK_NULL_HANDLE;
    VkImageView m_storage_image_view = VK_NULL_HANDLE;
    VmaAllocation m_storage_image_allocation = VK_NULL_HANDLE;
    uint32_t m_storage_width = 0;
    uint32_t m_storage_height = 0;

    // Instance data buffer
    Buffer m_instance_buffer;
    uint32_t m_instance_count = 0;

    // Light buffer
    Buffer m_light_buffer;
    uint32_t m_light_count = 0;

    // RT properties
    VkPhysicalDeviceRayTracingPipelinePropertiesKHR m_rt_properties{};

    // Function pointers
    PFN_vkCreateRayTracingPipelinesKHR vkCreateRayTracingPipelinesKHR = nullptr;
    PFN_vkGetRayTracingShaderGroupHandlesKHR vkGetRayTracingShaderGroupHandlesKHR = nullptr;
    PFN_vkCmdTraceRaysKHR vkCmdTraceRaysKHR = nullptr;
};

} // namespace ascii
