#include "acceleration.hpp"
#include "core/vulkan_context.hpp"

#include <spdlog/spdlog.h>
#include <stdexcept>
#include <cstring>

namespace ascii {

AccelerationStructureManager::AccelerationStructureManager(VulkanContext& ctx)
    : m_ctx(ctx)
{
    // Load extension functions
    vkCreateAccelerationStructureKHR = reinterpret_cast<PFN_vkCreateAccelerationStructureKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkCreateAccelerationStructureKHR"));
    vkDestroyAccelerationStructureKHR = reinterpret_cast<PFN_vkDestroyAccelerationStructureKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkDestroyAccelerationStructureKHR"));
    vkGetAccelerationStructureBuildSizesKHR = reinterpret_cast<PFN_vkGetAccelerationStructureBuildSizesKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkGetAccelerationStructureBuildSizesKHR"));
    vkCmdBuildAccelerationStructuresKHR = reinterpret_cast<PFN_vkCmdBuildAccelerationStructuresKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkCmdBuildAccelerationStructuresKHR"));
    vkGetAccelerationStructureDeviceAddressKHR = reinterpret_cast<PFN_vkGetAccelerationStructureDeviceAddressKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkGetAccelerationStructureDeviceAddressKHR"));

    if (!vkCreateAccelerationStructureKHR || !vkCmdBuildAccelerationStructuresKHR) {
        throw std::runtime_error("Failed to load acceleration structure functions");
    }

    spdlog::info("Acceleration structure manager initialized");
}

AccelerationStructureManager::~AccelerationStructureManager() {
    m_ctx.wait_idle();

    // Destroy TLAS
    if (m_tlas.handle != VK_NULL_HANDLE) {
        vkDestroyAccelerationStructureKHR(m_ctx.device(), m_tlas.handle, nullptr);
    }

    // Destroy all BLAS
    for (auto& blas : m_blas_list) {
        if (blas.handle != VK_NULL_HANDLE) {
            vkDestroyAccelerationStructureKHR(m_ctx.device(), blas.handle, nullptr);
        }
    }

    spdlog::info("Acceleration structure manager destroyed");
}

uint32_t AccelerationStructureManager::create_cube_blas() {
    // Unit cube vertices (8 corners)
    std::vector<glm::vec3> vertices = {
        // Front face
        {-0.5f, -0.5f,  0.5f},
        { 0.5f, -0.5f,  0.5f},
        { 0.5f,  0.5f,  0.5f},
        {-0.5f,  0.5f,  0.5f},
        // Back face
        {-0.5f, -0.5f, -0.5f},
        { 0.5f, -0.5f, -0.5f},
        { 0.5f,  0.5f, -0.5f},
        {-0.5f,  0.5f, -0.5f},
    };

    // 12 triangles (2 per face)
    std::vector<uint32_t> indices = {
        // Front
        0, 1, 2, 2, 3, 0,
        // Right
        1, 5, 6, 6, 2, 1,
        // Back
        5, 4, 7, 7, 6, 5,
        // Left
        4, 0, 3, 3, 7, 4,
        // Top
        3, 2, 6, 6, 7, 3,
        // Bottom
        4, 5, 1, 1, 0, 4,
    };

    return create_blas(vertices, indices);
}

uint32_t AccelerationStructureManager::create_letter_a_blas() {
    // Create a 3D extruded letter "A"
    // Each face has its own vertices with proper normals for smooth shading

    std::vector<glm::vec3> vertices;
    std::vector<uint32_t> indices;

    // Helper to add a box with proper normals (each face has unique vertices)
    auto add_box = [&](glm::vec3 center, glm::vec3 size, float rotationZ = 0.0f) {
        glm::vec3 half = size * 0.5f;

        // Rotation matrix
        float c = std::cos(rotationZ);
        float s = std::sin(rotationZ);

        auto rotate_and_translate = [&](glm::vec3 v) -> glm::vec3 {
            float rx = v.x * c - v.y * s;
            float ry = v.x * s + v.y * c;
            return glm::vec3(rx + center.x, ry + center.y, v.z + center.z);
        };

        // Define each face with 4 vertices (24 vertices total per box)
        // This allows proper face normals
        struct Face {
            glm::vec3 corners[4];
        };

        Face faces[6] = {
            // Front face (+Z)
            {{{-half.x, -half.y, half.z}, {half.x, -half.y, half.z}, {half.x, half.y, half.z}, {-half.x, half.y, half.z}}},
            // Back face (-Z)
            {{{half.x, -half.y, -half.z}, {-half.x, -half.y, -half.z}, {-half.x, half.y, -half.z}, {half.x, half.y, -half.z}}},
            // Right face (+X)
            {{{half.x, -half.y, half.z}, {half.x, -half.y, -half.z}, {half.x, half.y, -half.z}, {half.x, half.y, half.z}}},
            // Left face (-X)
            {{{-half.x, -half.y, -half.z}, {-half.x, -half.y, half.z}, {-half.x, half.y, half.z}, {-half.x, half.y, -half.z}}},
            // Top face (+Y)
            {{{-half.x, half.y, half.z}, {half.x, half.y, half.z}, {half.x, half.y, -half.z}, {-half.x, half.y, -half.z}}},
            // Bottom face (-Y)
            {{{-half.x, -half.y, -half.z}, {half.x, -half.y, -half.z}, {half.x, -half.y, half.z}, {-half.x, -half.y, half.z}}},
        };

        for (int f = 0; f < 6; f++) {
            uint32_t base = static_cast<uint32_t>(vertices.size());

            // Add 4 vertices for this face
            for (int v = 0; v < 4; v++) {
                vertices.push_back(rotate_and_translate(faces[f].corners[v]));
            }

            // Two triangles per face
            indices.push_back(base + 0);
            indices.push_back(base + 1);
            indices.push_back(base + 2);
            indices.push_back(base + 2);
            indices.push_back(base + 3);
            indices.push_back(base + 0);
        }
    };

    // Letter "A" dimensions
    float depth = 0.2f;       // Z thickness (chunkier)
    float leg_width = 0.15f;  // Width of the legs
    float height = 1.0f;      // Total height
    float width = 0.8f;       // Total width at base

    // Angle of the legs - FIXED: negative for left leg to point apex UP
    float leg_angle = std::atan2(width * 0.5f, height);
    float leg_length = height / std::cos(leg_angle);

    // Left leg (angled - apex at top, so negative rotation)
    add_box(
        glm::vec3(-width * 0.22f, 0.0f, 0.0f),
        glm::vec3(leg_width, leg_length, depth),
        -leg_angle  // FIXED: negative angle
    );

    // Right leg (angled - positive rotation)
    add_box(
        glm::vec3(width * 0.22f, 0.0f, 0.0f),
        glm::vec3(leg_width, leg_length, depth),
        leg_angle   // FIXED: positive angle
    );

    // Crossbar (horizontal, positioned at ~1/3 from bottom)
    float crossbar_y = -height * 0.12f;
    float crossbar_width = width * 0.38f;
    add_box(
        glm::vec3(0.0f, crossbar_y, 0.0f),
        glm::vec3(crossbar_width, leg_width * 0.9f, depth),
        0.0f
    );

    // Top peak cap
    add_box(
        glm::vec3(0.0f, height * 0.42f, 0.0f),
        glm::vec3(leg_width * 1.8f, leg_width * 1.2f, depth),
        0.0f
    );

    return create_blas(vertices, indices);
}

uint32_t AccelerationStructureManager::create_blas(const std::vector<glm::vec3>& vertices,
                                                    const std::vector<uint32_t>& indices) {
    uint32_t index = static_cast<uint32_t>(m_blas_list.size());
    m_blas_list.emplace_back();
    create_blas_internal(m_blas_list.back(), vertices, indices);
    return index;
}

void AccelerationStructureManager::create_blas_internal(BLAS& blas,
                                                         const std::vector<glm::vec3>& vertices,
                                                         const std::vector<uint32_t>& indices) {
    // Create vertex buffer
    VkDeviceSize vertex_size = vertices.size() * sizeof(glm::vec3);
    Buffer vertex_buffer(m_ctx, vertex_size,
        VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT |
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);
    vertex_buffer.upload(vertices.data(), vertex_size);

    // Create index buffer
    VkDeviceSize index_size = indices.size() * sizeof(uint32_t);
    Buffer index_buffer(m_ctx, index_size,
        VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT |
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);
    index_buffer.upload(indices.data(), index_size);

    // Geometry description
    VkAccelerationStructureGeometryTrianglesDataKHR triangles{};
    triangles.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_TRIANGLES_DATA_KHR;
    triangles.vertexFormat = VK_FORMAT_R32G32B32_SFLOAT;
    triangles.vertexData.deviceAddress = vertex_buffer.device_address();
    triangles.vertexStride = sizeof(glm::vec3);
    triangles.maxVertex = static_cast<uint32_t>(vertices.size() - 1);
    triangles.indexType = VK_INDEX_TYPE_UINT32;
    triangles.indexData.deviceAddress = index_buffer.device_address();

    VkAccelerationStructureGeometryKHR geometry{};
    geometry.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_KHR;
    geometry.geometryType = VK_GEOMETRY_TYPE_TRIANGLES_KHR;
    geometry.flags = VK_GEOMETRY_OPAQUE_BIT_KHR;
    geometry.geometry.triangles = triangles;

    // Build info
    VkAccelerationStructureBuildGeometryInfoKHR build_info{};
    build_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_BUILD_GEOMETRY_INFO_KHR;
    build_info.type = VK_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL_KHR;
    build_info.flags = VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR;
    build_info.geometryCount = 1;
    build_info.pGeometries = &geometry;

    uint32_t primitive_count = static_cast<uint32_t>(indices.size() / 3);

    // Query size requirements
    VkAccelerationStructureBuildSizesInfoKHR size_info{};
    size_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_BUILD_SIZES_INFO_KHR;
    vkGetAccelerationStructureBuildSizesKHR(
        m_ctx.device(),
        VK_ACCELERATION_STRUCTURE_BUILD_TYPE_DEVICE_KHR,
        &build_info,
        &primitive_count,
        &size_info);

    // Create AS buffer
    blas.buffer = Buffer(m_ctx, size_info.accelerationStructureSize,
        VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_GPU_ONLY);

    // Create acceleration structure
    VkAccelerationStructureCreateInfoKHR create_info{};
    create_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_CREATE_INFO_KHR;
    create_info.buffer = blas.buffer.handle();
    create_info.size = size_info.accelerationStructureSize;
    create_info.type = VK_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL_KHR;

    if (vkCreateAccelerationStructureKHR(m_ctx.device(), &create_info, nullptr, &blas.handle) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create BLAS");
    }

    // Create scratch buffer
    Buffer scratch_buffer(m_ctx, size_info.buildScratchSize,
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_GPU_ONLY);

    // Build the AS
    build_info.mode = VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR;
    build_info.dstAccelerationStructure = blas.handle;
    build_info.scratchData.deviceAddress = scratch_buffer.device_address();

    VkAccelerationStructureBuildRangeInfoKHR range_info{};
    range_info.primitiveCount = primitive_count;
    range_info.primitiveOffset = 0;
    range_info.firstVertex = 0;
    range_info.transformOffset = 0;

    const VkAccelerationStructureBuildRangeInfoKHR* p_range_info = &range_info;

    VkCommandBuffer cmd = m_ctx.begin_single_time_commands();
    vkCmdBuildAccelerationStructuresKHR(cmd, 1, &build_info, &p_range_info);
    m_ctx.end_single_time_commands(cmd);

    // Get device address
    VkAccelerationStructureDeviceAddressInfoKHR address_info{};
    address_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_DEVICE_ADDRESS_INFO_KHR;
    address_info.accelerationStructure = blas.handle;
    blas.device_address = vkGetAccelerationStructureDeviceAddressKHR(m_ctx.device(), &address_info);

    spdlog::info("Created BLAS with {} triangles", primitive_count);
}

void AccelerationStructureManager::build_tlas(const std::vector<Instance>& instances) {
    if (instances.empty()) {
        spdlog::warn("build_tlas called with empty instance list");
        return;
    }

    // Destroy old TLAS if exists
    if (m_tlas.handle != VK_NULL_HANDLE) {
        m_ctx.wait_idle();
        vkDestroyAccelerationStructureKHR(m_ctx.device(), m_tlas.handle, nullptr);
        m_tlas.handle = VK_NULL_HANDLE;
    }

    // Create instance data
    std::vector<VkAccelerationStructureInstanceKHR> vk_instances;
    vk_instances.reserve(instances.size());

    for (const auto& inst : instances) {
        VkAccelerationStructureInstanceKHR vk_inst{};

        // Convert glm::mat4 to VkTransformMatrixKHR (3x4 row-major)
        glm::mat4 transposed = glm::transpose(inst.transform);
        std::memcpy(&vk_inst.transform, &transposed, sizeof(VkTransformMatrixKHR));

        vk_inst.instanceCustomIndex = inst.custom_index;
        vk_inst.mask = inst.mask;
        vk_inst.instanceShaderBindingTableRecordOffset = inst.sbt_offset;
        vk_inst.flags = inst.flags;
        vk_inst.accelerationStructureReference = m_blas_list[inst.blas_index].device_address;

        vk_instances.push_back(vk_inst);
    }

    // Create instance buffer
    VkDeviceSize instance_size = vk_instances.size() * sizeof(VkAccelerationStructureInstanceKHR);
    m_tlas.instance_buffer = Buffer(m_ctx, instance_size,
        VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_BUILD_INPUT_READ_ONLY_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);
    m_tlas.instance_buffer.upload(vk_instances.data(), instance_size);
    m_tlas.instance_count = static_cast<uint32_t>(instances.size());

    // Geometry description for instances
    VkAccelerationStructureGeometryInstancesDataKHR instances_data{};
    instances_data.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_INSTANCES_DATA_KHR;
    instances_data.arrayOfPointers = VK_FALSE;
    instances_data.data.deviceAddress = m_tlas.instance_buffer.device_address();

    VkAccelerationStructureGeometryKHR geometry{};
    geometry.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_GEOMETRY_KHR;
    geometry.geometryType = VK_GEOMETRY_TYPE_INSTANCES_KHR;
    geometry.flags = VK_GEOMETRY_OPAQUE_BIT_KHR;
    geometry.geometry.instances = instances_data;

    // Build info
    VkAccelerationStructureBuildGeometryInfoKHR build_info{};
    build_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_BUILD_GEOMETRY_INFO_KHR;
    build_info.type = VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR;
    build_info.flags = VK_BUILD_ACCELERATION_STRUCTURE_PREFER_FAST_TRACE_BIT_KHR;
    build_info.geometryCount = 1;
    build_info.pGeometries = &geometry;

    uint32_t instance_count = static_cast<uint32_t>(instances.size());

    // Query size requirements
    VkAccelerationStructureBuildSizesInfoKHR size_info{};
    size_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_BUILD_SIZES_INFO_KHR;
    vkGetAccelerationStructureBuildSizesKHR(
        m_ctx.device(),
        VK_ACCELERATION_STRUCTURE_BUILD_TYPE_DEVICE_KHR,
        &build_info,
        &instance_count,
        &size_info);

    // Create AS buffer
    m_tlas.buffer = Buffer(m_ctx, size_info.accelerationStructureSize,
        VK_BUFFER_USAGE_ACCELERATION_STRUCTURE_STORAGE_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_GPU_ONLY);

    // Create acceleration structure
    VkAccelerationStructureCreateInfoKHR create_info{};
    create_info.sType = VK_STRUCTURE_TYPE_ACCELERATION_STRUCTURE_CREATE_INFO_KHR;
    create_info.buffer = m_tlas.buffer.handle();
    create_info.size = size_info.accelerationStructureSize;
    create_info.type = VK_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL_KHR;

    if (vkCreateAccelerationStructureKHR(m_ctx.device(), &create_info, nullptr, &m_tlas.handle) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create TLAS");
    }

    // Create scratch buffer
    Buffer scratch_buffer(m_ctx, size_info.buildScratchSize,
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_GPU_ONLY);

    // Build the AS
    build_info.mode = VK_BUILD_ACCELERATION_STRUCTURE_MODE_BUILD_KHR;
    build_info.dstAccelerationStructure = m_tlas.handle;
    build_info.scratchData.deviceAddress = scratch_buffer.device_address();

    VkAccelerationStructureBuildRangeInfoKHR range_info{};
    range_info.primitiveCount = instance_count;
    range_info.primitiveOffset = 0;
    range_info.firstVertex = 0;
    range_info.transformOffset = 0;

    const VkAccelerationStructureBuildRangeInfoKHR* p_range_info = &range_info;

    VkCommandBuffer cmd = m_ctx.begin_single_time_commands();
    vkCmdBuildAccelerationStructuresKHR(cmd, 1, &build_info, &p_range_info);
    m_ctx.end_single_time_commands(cmd);

    spdlog::info("Built TLAS with {} instances", instance_count);
}

} // namespace ascii
