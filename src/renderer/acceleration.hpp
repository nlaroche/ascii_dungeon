#pragma once

#include "buffer.hpp"

#include <vulkan/vulkan.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <vector>
#include <memory>

namespace ascii {

class VulkanContext;

// A single bottom-level acceleration structure (geometry)
struct BLAS {
    VkAccelerationStructureKHR handle = VK_NULL_HANDLE;
    Buffer buffer;
    VkDeviceAddress device_address = 0;
};

// Instance data for TLAS
struct Instance {
    glm::mat4 transform = glm::mat4(1.0f);
    uint32_t custom_index = 0;     // gl_InstanceCustomIndexEXT
    uint32_t mask = 0xFF;
    uint32_t sbt_offset = 0;       // Shader binding table offset
    VkGeometryInstanceFlagsKHR flags = VK_GEOMETRY_INSTANCE_TRIANGLE_FACING_CULL_DISABLE_BIT_KHR;
    uint32_t blas_index = 0;       // Which BLAS to use
};

// Top-level acceleration structure (scene)
struct TLAS {
    VkAccelerationStructureKHR handle = VK_NULL_HANDLE;
    Buffer buffer;
    Buffer instance_buffer;
    uint32_t instance_count = 0;
};

// Manages acceleration structures for raytracing
class AccelerationStructureManager {
public:
    explicit AccelerationStructureManager(VulkanContext& ctx);
    ~AccelerationStructureManager();

    // Create a BLAS from vertex/index data
    // Vertices are vec3 positions, indices are uint32_t
    uint32_t create_blas(const std::vector<glm::vec3>& vertices,
                         const std::vector<uint32_t>& indices);

    // Create a simple unit cube BLAS centered at origin
    uint32_t create_cube_blas();

    // Create a 3D letter "A" BLAS
    uint32_t create_letter_a_blas();

    // Build/rebuild the TLAS with given instances
    void build_tlas(const std::vector<Instance>& instances);

    // Getters
    const BLAS& get_blas(uint32_t index) const { return m_blas_list[index]; }
    const TLAS& get_tlas() const { return m_tlas; }
    VkAccelerationStructureKHR tlas_handle() const { return m_tlas.handle; }

private:
    void create_blas_internal(BLAS& blas,
                              const std::vector<glm::vec3>& vertices,
                              const std::vector<uint32_t>& indices);

    VulkanContext& m_ctx;
    std::vector<BLAS> m_blas_list;
    TLAS m_tlas;

    // Cached function pointers
    PFN_vkCreateAccelerationStructureKHR vkCreateAccelerationStructureKHR = nullptr;
    PFN_vkDestroyAccelerationStructureKHR vkDestroyAccelerationStructureKHR = nullptr;
    PFN_vkGetAccelerationStructureBuildSizesKHR vkGetAccelerationStructureBuildSizesKHR = nullptr;
    PFN_vkCmdBuildAccelerationStructuresKHR vkCmdBuildAccelerationStructuresKHR = nullptr;
    PFN_vkGetAccelerationStructureDeviceAddressKHR vkGetAccelerationStructureDeviceAddressKHR = nullptr;
};

} // namespace ascii
