#include "rt_pipeline.hpp"
#include "core/vulkan_context.hpp"

#include <spdlog/spdlog.h>

#include <fstream>
#include <stdexcept>

namespace ascii {

RTPipeline::RTPipeline(VulkanContext& ctx, AccelerationStructureManager& accel)
    : m_ctx(ctx)
    , m_accel(accel)
{
    // Load function pointers
    vkCreateRayTracingPipelinesKHR = reinterpret_cast<PFN_vkCreateRayTracingPipelinesKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkCreateRayTracingPipelinesKHR"));
    vkGetRayTracingShaderGroupHandlesKHR = reinterpret_cast<PFN_vkGetRayTracingShaderGroupHandlesKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkGetRayTracingShaderGroupHandlesKHR"));
    vkCmdTraceRaysKHR = reinterpret_cast<PFN_vkCmdTraceRaysKHR>(
        vkGetDeviceProcAddr(ctx.device(), "vkCmdTraceRaysKHR"));

    if (!vkCreateRayTracingPipelinesKHR || !vkCmdTraceRaysKHR) {
        throw std::runtime_error("Failed to load ray tracing pipeline functions");
    }

    // Get RT properties
    m_rt_properties.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_RAY_TRACING_PIPELINE_PROPERTIES_KHR;
    VkPhysicalDeviceProperties2 props2{};
    props2.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_PROPERTIES_2;
    props2.pNext = &m_rt_properties;
    vkGetPhysicalDeviceProperties2(ctx.physical_device(), &props2);

    spdlog::info("RT shader group handle size: {}", m_rt_properties.shaderGroupHandleSize);
    spdlog::info("RT shader group base alignment: {}", m_rt_properties.shaderGroupBaseAlignment);

    load_shaders();
    create_descriptor_set_layout();
    create_pipeline_layout();
    create_pipeline();
    create_shader_binding_table();
    create_descriptor_pool();
    create_instance_buffer();
    create_light_buffer();
    create_descriptor_sets();

    spdlog::info("RT pipeline initialized");
}

RTPipeline::~RTPipeline() {
    m_ctx.wait_idle();

    if (m_storage_image_view != VK_NULL_HANDLE) {
        vkDestroyImageView(m_ctx.device(), m_storage_image_view, nullptr);
    }
    if (m_storage_image != VK_NULL_HANDLE) {
        vmaDestroyImage(m_ctx.allocator(), m_storage_image, m_storage_image_allocation);
    }

    vkDestroyDescriptorPool(m_ctx.device(), m_descriptor_pool, nullptr);
    vkDestroyPipeline(m_ctx.device(), m_pipeline, nullptr);
    vkDestroyPipelineLayout(m_ctx.device(), m_pipeline_layout, nullptr);
    vkDestroyDescriptorSetLayout(m_ctx.device(), m_descriptor_set_layout, nullptr);

    vkDestroyShaderModule(m_ctx.device(), m_raygen_shader, nullptr);
    vkDestroyShaderModule(m_ctx.device(), m_miss_shader, nullptr);
    vkDestroyShaderModule(m_ctx.device(), m_shadow_miss_shader, nullptr);
    vkDestroyShaderModule(m_ctx.device(), m_bounce_miss_shader, nullptr);
    vkDestroyShaderModule(m_ctx.device(), m_closest_hit_shader, nullptr);

    spdlog::info("RT pipeline destroyed");
}

std::vector<char> RTPipeline::read_shader_file(const std::string& filename) {
    std::ifstream file(filename, std::ios::ate | std::ios::binary);

    if (!file.is_open()) {
        throw std::runtime_error("Failed to open shader file: " + filename);
    }

    size_t file_size = static_cast<size_t>(file.tellg());
    std::vector<char> buffer(file_size);

    file.seekg(0);
    file.read(buffer.data(), file_size);

    return buffer;
}

VkShaderModule RTPipeline::create_shader_module(const std::vector<char>& code) {
    VkShaderModuleCreateInfo create_info{};
    create_info.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
    create_info.codeSize = code.size();
    create_info.pCode = reinterpret_cast<const uint32_t*>(code.data());

    VkShaderModule shader_module;
    if (vkCreateShaderModule(m_ctx.device(), &create_info, nullptr, &shader_module) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create shader module");
    }

    return shader_module;
}

void RTPipeline::load_shaders() {
    m_raygen_shader = create_shader_module(read_shader_file("shaders/rt_raygen.rgen.spv"));
    m_miss_shader = create_shader_module(read_shader_file("shaders/rt_miss.rmiss.spv"));
    m_shadow_miss_shader = create_shader_module(read_shader_file("shaders/rt_shadow.rmiss.spv"));
    m_bounce_miss_shader = create_shader_module(read_shader_file("shaders/rt_bounce_miss.rmiss.spv"));
    m_closest_hit_shader = create_shader_module(read_shader_file("shaders/rt_closesthit.rchit.spv"));

    spdlog::info("RT shaders loaded");
}

void RTPipeline::create_descriptor_set_layout() {
    std::vector<VkDescriptorSetLayoutBinding> bindings = {
        // Binding 0: Acceleration structure
        {0, VK_DESCRIPTOR_TYPE_ACCELERATION_STRUCTURE_KHR, 1, VK_SHADER_STAGE_RAYGEN_BIT_KHR | VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR, nullptr},
        // Binding 1: Output image
        {1, VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, 1, VK_SHADER_STAGE_RAYGEN_BIT_KHR, nullptr},
        // Binding 2: Instance data
        {2, VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, 1, VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR, nullptr},
        // Binding 3: Lights
        {3, VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, 1, VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR, nullptr},
    };

    VkDescriptorSetLayoutCreateInfo layout_info{};
    layout_info.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
    layout_info.bindingCount = static_cast<uint32_t>(bindings.size());
    layout_info.pBindings = bindings.data();

    if (vkCreateDescriptorSetLayout(m_ctx.device(), &layout_info, nullptr, &m_descriptor_set_layout) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create descriptor set layout");
    }
}

void RTPipeline::create_pipeline_layout() {
    VkPushConstantRange push_constant{};
    push_constant.stageFlags = VK_SHADER_STAGE_RAYGEN_BIT_KHR | VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR;
    push_constant.offset = 0;
    push_constant.size = sizeof(CameraPushConstants);

    VkPipelineLayoutCreateInfo layout_info{};
    layout_info.sType = VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;
    layout_info.setLayoutCount = 1;
    layout_info.pSetLayouts = &m_descriptor_set_layout;
    layout_info.pushConstantRangeCount = 1;
    layout_info.pPushConstantRanges = &push_constant;

    if (vkCreatePipelineLayout(m_ctx.device(), &layout_info, nullptr, &m_pipeline_layout) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create pipeline layout");
    }
}

void RTPipeline::create_pipeline() {
    // Shader stages: raygen, miss, shadow miss, bounce miss, closest hit
    std::vector<VkPipelineShaderStageCreateInfo> stages(5);

    stages[0].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[0].stage = VK_SHADER_STAGE_RAYGEN_BIT_KHR;
    stages[0].module = m_raygen_shader;
    stages[0].pName = "main";

    stages[1].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[1].stage = VK_SHADER_STAGE_MISS_BIT_KHR;
    stages[1].module = m_miss_shader;
    stages[1].pName = "main";

    stages[2].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[2].stage = VK_SHADER_STAGE_MISS_BIT_KHR;
    stages[2].module = m_shadow_miss_shader;
    stages[2].pName = "main";

    stages[3].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[3].stage = VK_SHADER_STAGE_MISS_BIT_KHR;
    stages[3].module = m_bounce_miss_shader;
    stages[3].pName = "main";

    stages[4].sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    stages[4].stage = VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR;
    stages[4].module = m_closest_hit_shader;
    stages[4].pName = "main";

    // Shader groups: raygen, miss, shadow miss, bounce miss, hit
    std::vector<VkRayTracingShaderGroupCreateInfoKHR> groups(5);

    // Raygen group (index 0)
    groups[0].sType = VK_STRUCTURE_TYPE_RAY_TRACING_SHADER_GROUP_CREATE_INFO_KHR;
    groups[0].type = VK_RAY_TRACING_SHADER_GROUP_TYPE_GENERAL_KHR;
    groups[0].generalShader = 0;
    groups[0].closestHitShader = VK_SHADER_UNUSED_KHR;
    groups[0].anyHitShader = VK_SHADER_UNUSED_KHR;
    groups[0].intersectionShader = VK_SHADER_UNUSED_KHR;

    // Miss group (index 1) - for primary rays (missIndex 0)
    groups[1].sType = VK_STRUCTURE_TYPE_RAY_TRACING_SHADER_GROUP_CREATE_INFO_KHR;
    groups[1].type = VK_RAY_TRACING_SHADER_GROUP_TYPE_GENERAL_KHR;
    groups[1].generalShader = 1;
    groups[1].closestHitShader = VK_SHADER_UNUSED_KHR;
    groups[1].anyHitShader = VK_SHADER_UNUSED_KHR;
    groups[1].intersectionShader = VK_SHADER_UNUSED_KHR;

    // Shadow miss group (index 2) - for shadow rays (missIndex 1)
    groups[2].sType = VK_STRUCTURE_TYPE_RAY_TRACING_SHADER_GROUP_CREATE_INFO_KHR;
    groups[2].type = VK_RAY_TRACING_SHADER_GROUP_TYPE_GENERAL_KHR;
    groups[2].generalShader = 2;
    groups[2].closestHitShader = VK_SHADER_UNUSED_KHR;
    groups[2].anyHitShader = VK_SHADER_UNUSED_KHR;
    groups[2].intersectionShader = VK_SHADER_UNUSED_KHR;

    // Bounce miss group (index 3) - for bounce rays (missIndex 2)
    groups[3].sType = VK_STRUCTURE_TYPE_RAY_TRACING_SHADER_GROUP_CREATE_INFO_KHR;
    groups[3].type = VK_RAY_TRACING_SHADER_GROUP_TYPE_GENERAL_KHR;
    groups[3].generalShader = 3;
    groups[3].closestHitShader = VK_SHADER_UNUSED_KHR;
    groups[3].anyHitShader = VK_SHADER_UNUSED_KHR;
    groups[3].intersectionShader = VK_SHADER_UNUSED_KHR;

    // Hit group (index 4)
    groups[4].sType = VK_STRUCTURE_TYPE_RAY_TRACING_SHADER_GROUP_CREATE_INFO_KHR;
    groups[4].type = VK_RAY_TRACING_SHADER_GROUP_TYPE_TRIANGLES_HIT_GROUP_KHR;
    groups[4].generalShader = VK_SHADER_UNUSED_KHR;
    groups[4].closestHitShader = 4;
    groups[4].anyHitShader = VK_SHADER_UNUSED_KHR;
    groups[4].intersectionShader = VK_SHADER_UNUSED_KHR;

    VkRayTracingPipelineCreateInfoKHR pipeline_info{};
    pipeline_info.sType = VK_STRUCTURE_TYPE_RAY_TRACING_PIPELINE_CREATE_INFO_KHR;
    pipeline_info.stageCount = static_cast<uint32_t>(stages.size());
    pipeline_info.pStages = stages.data();
    pipeline_info.groupCount = static_cast<uint32_t>(groups.size());
    pipeline_info.pGroups = groups.data();
    pipeline_info.maxPipelineRayRecursionDepth = 4;  // Primary + 2 bounces + shadow rays
    pipeline_info.layout = m_pipeline_layout;

    if (vkCreateRayTracingPipelinesKHR(m_ctx.device(), VK_NULL_HANDLE, VK_NULL_HANDLE,
                                        1, &pipeline_info, nullptr, &m_pipeline) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create ray tracing pipeline");
    }

    spdlog::info("RT pipeline created");
}

void RTPipeline::create_shader_binding_table() {
    const uint32_t handle_size = m_rt_properties.shaderGroupHandleSize;
    const uint32_t handle_alignment = m_rt_properties.shaderGroupHandleAlignment;
    const uint32_t base_alignment = m_rt_properties.shaderGroupBaseAlignment;

    // Aligned handle size
    const uint32_t handle_size_aligned = (handle_size + handle_alignment - 1) & ~(handle_alignment - 1);

    // Get shader group handles
    // Groups: 0=raygen, 1=miss, 2=shadow_miss, 3=bounce_miss, 4=hit
    const uint32_t group_count = 5;

    std::vector<uint8_t> shader_handles(group_count * handle_size);
    if (vkGetRayTracingShaderGroupHandlesKHR(m_ctx.device(), m_pipeline, 0, group_count,
                                              shader_handles.size(), shader_handles.data()) != VK_SUCCESS) {
        throw std::runtime_error("Failed to get shader group handles");
    }

    // Calculate region sizes (each aligned to base_alignment)
    const VkDeviceSize raygen_size = base_alignment;
    // Miss region needs space for 3 miss shaders (primary + shadow + bounce)
    const VkDeviceSize miss_size = 3 * handle_size_aligned;
    const VkDeviceSize miss_region_aligned = ((miss_size + base_alignment - 1) / base_alignment) * base_alignment;
    const VkDeviceSize hit_size = base_alignment;

    const VkDeviceSize total_size = raygen_size + miss_region_aligned + hit_size;

    // Create SBT buffer
    m_sbt_buffer = Buffer(m_ctx, total_size,
        VK_BUFFER_USAGE_SHADER_BINDING_TABLE_BIT_KHR |
        VK_BUFFER_USAGE_SHADER_DEVICE_ADDRESS_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);

    // Copy handles to buffer
    uint8_t* sbt_data = static_cast<uint8_t*>(m_sbt_buffer.map());

    // Raygen at offset 0 (group 0)
    std::memcpy(sbt_data, shader_handles.data(), handle_size);

    // Miss shaders at offset raygen_size (groups 1, 2, 3)
    // Primary miss at index 0 (missIndex 0)
    std::memcpy(sbt_data + raygen_size, shader_handles.data() + handle_size, handle_size);
    // Shadow miss at index 1 (missIndex 1)
    std::memcpy(sbt_data + raygen_size + handle_size_aligned, shader_handles.data() + 2 * handle_size, handle_size);
    // Bounce miss at index 2 (missIndex 2)
    std::memcpy(sbt_data + raygen_size + 2 * handle_size_aligned, shader_handles.data() + 3 * handle_size, handle_size);

    // Hit at offset raygen_size + miss_region_aligned (group 4)
    std::memcpy(sbt_data + raygen_size + miss_region_aligned, shader_handles.data() + 4 * handle_size, handle_size);

    m_sbt_buffer.unmap();

    // Set up regions
    VkDeviceAddress sbt_address = m_sbt_buffer.device_address();

    m_raygen_region.deviceAddress = sbt_address;
    m_raygen_region.stride = raygen_size;
    m_raygen_region.size = raygen_size;

    m_miss_region.deviceAddress = sbt_address + raygen_size;
    m_miss_region.stride = handle_size_aligned;
    m_miss_region.size = miss_region_aligned;

    m_hit_region.deviceAddress = sbt_address + raygen_size + miss_region_aligned;
    m_hit_region.stride = handle_size_aligned;
    m_hit_region.size = hit_size;

    m_callable_region = {};  // No callable shaders

    spdlog::info("Shader binding table created with 3 miss shaders");
}

void RTPipeline::create_descriptor_pool() {
    std::vector<VkDescriptorPoolSize> pool_sizes = {
        {VK_DESCRIPTOR_TYPE_ACCELERATION_STRUCTURE_KHR, 1},
        {VK_DESCRIPTOR_TYPE_STORAGE_IMAGE, 1},
        {VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, 2},
    };

    VkDescriptorPoolCreateInfo pool_info{};
    pool_info.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
    pool_info.poolSizeCount = static_cast<uint32_t>(pool_sizes.size());
    pool_info.pPoolSizes = pool_sizes.data();
    pool_info.maxSets = 1;
    pool_info.flags = VK_DESCRIPTOR_POOL_CREATE_UPDATE_AFTER_BIND_BIT;

    if (vkCreateDescriptorPool(m_ctx.device(), &pool_info, nullptr, &m_descriptor_pool) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create descriptor pool");
    }
}

void RTPipeline::create_instance_buffer() {
    // Create with initial capacity
    const uint32_t initial_capacity = 1024;
    m_instance_buffer = Buffer(m_ctx, initial_capacity * sizeof(GlyphInstance),
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);
}

void RTPipeline::create_light_buffer() {
    // Create with initial capacity
    const uint32_t initial_capacity = 64;
    m_light_buffer = Buffer(m_ctx, initial_capacity * sizeof(Light),
        VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
        VMA_MEMORY_USAGE_CPU_TO_GPU);
}

void RTPipeline::create_descriptor_sets() {
    VkDescriptorSetAllocateInfo alloc_info{};
    alloc_info.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
    alloc_info.descriptorPool = m_descriptor_pool;
    alloc_info.descriptorSetCount = 1;
    alloc_info.pSetLayouts = &m_descriptor_set_layout;

    if (vkAllocateDescriptorSets(m_ctx.device(), &alloc_info, &m_descriptor_set) != VK_SUCCESS) {
        throw std::runtime_error("Failed to allocate descriptor sets");
    }

    // Write acceleration structure
    VkWriteDescriptorSetAccelerationStructureKHR accel_write{};
    accel_write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET_ACCELERATION_STRUCTURE_KHR;
    accel_write.accelerationStructureCount = 1;
    VkAccelerationStructureKHR tlas = m_accel.tlas_handle();
    accel_write.pAccelerationStructures = &tlas;

    // Write instance buffer
    VkDescriptorBufferInfo instance_info{};
    instance_info.buffer = m_instance_buffer.handle();
    instance_info.offset = 0;
    instance_info.range = VK_WHOLE_SIZE;

    // Write light buffer
    VkDescriptorBufferInfo light_info{};
    light_info.buffer = m_light_buffer.handle();
    light_info.offset = 0;
    light_info.range = VK_WHOLE_SIZE;

    std::vector<VkWriteDescriptorSet> writes(3);

    // Binding 0: TLAS
    writes[0].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    writes[0].dstSet = m_descriptor_set;
    writes[0].dstBinding = 0;
    writes[0].descriptorCount = 1;
    writes[0].descriptorType = VK_DESCRIPTOR_TYPE_ACCELERATION_STRUCTURE_KHR;
    writes[0].pNext = &accel_write;

    // Binding 2: Instances
    writes[1].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    writes[1].dstSet = m_descriptor_set;
    writes[1].dstBinding = 2;
    writes[1].descriptorCount = 1;
    writes[1].descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
    writes[1].pBufferInfo = &instance_info;

    // Binding 3: Lights
    writes[2].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    writes[2].dstSet = m_descriptor_set;
    writes[2].dstBinding = 3;
    writes[2].descriptorCount = 1;
    writes[2].descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
    writes[2].pBufferInfo = &light_info;

    vkUpdateDescriptorSets(m_ctx.device(), static_cast<uint32_t>(writes.size()), writes.data(), 0, nullptr);
}

void RTPipeline::update_tlas_descriptor() {
    VkWriteDescriptorSetAccelerationStructureKHR accel_write{};
    accel_write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET_ACCELERATION_STRUCTURE_KHR;
    accel_write.accelerationStructureCount = 1;
    VkAccelerationStructureKHR tlas = m_accel.tlas_handle();
    accel_write.pAccelerationStructures = &tlas;

    VkWriteDescriptorSet write{};
    write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    write.dstSet = m_descriptor_set;
    write.dstBinding = 0;
    write.descriptorCount = 1;
    write.descriptorType = VK_DESCRIPTOR_TYPE_ACCELERATION_STRUCTURE_KHR;
    write.pNext = &accel_write;

    vkUpdateDescriptorSets(m_ctx.device(), 1, &write, 0, nullptr);
    spdlog::debug("Updated TLAS descriptor");
}

void RTPipeline::resize_storage_image(uint32_t width, uint32_t height) {
    if (width == m_storage_width && height == m_storage_height) {
        return;  // No resize needed
    }

    m_ctx.wait_idle();

    // Destroy old image if exists
    if (m_storage_image_view != VK_NULL_HANDLE) {
        vkDestroyImageView(m_ctx.device(), m_storage_image_view, nullptr);
        m_storage_image_view = VK_NULL_HANDLE;
    }
    if (m_storage_image != VK_NULL_HANDLE) {
        vmaDestroyImage(m_ctx.allocator(), m_storage_image, m_storage_image_allocation);
        m_storage_image = VK_NULL_HANDLE;
        m_storage_image_allocation = VK_NULL_HANDLE;
    }

    // Create new storage image with a format that supports storage
    VkImageCreateInfo image_info{};
    image_info.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
    image_info.imageType = VK_IMAGE_TYPE_2D;
    image_info.format = VK_FORMAT_R8G8B8A8_UNORM;  // Supports storage, unlike SRGB
    image_info.extent = {width, height, 1};
    image_info.mipLevels = 1;
    image_info.arrayLayers = 1;
    image_info.samples = VK_SAMPLE_COUNT_1_BIT;
    image_info.tiling = VK_IMAGE_TILING_OPTIMAL;
    image_info.usage = VK_IMAGE_USAGE_STORAGE_BIT | VK_IMAGE_USAGE_TRANSFER_SRC_BIT;
    image_info.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
    image_info.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;

    VmaAllocationCreateInfo alloc_info{};
    alloc_info.usage = VMA_MEMORY_USAGE_GPU_ONLY;

    if (vmaCreateImage(m_ctx.allocator(), &image_info, &alloc_info,
                       &m_storage_image, &m_storage_image_allocation, nullptr) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create storage image");
    }

    // Create image view
    VkImageViewCreateInfo view_info{};
    view_info.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
    view_info.image = m_storage_image;
    view_info.viewType = VK_IMAGE_VIEW_TYPE_2D;
    view_info.format = VK_FORMAT_R8G8B8A8_UNORM;
    view_info.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    view_info.subresourceRange.baseMipLevel = 0;
    view_info.subresourceRange.levelCount = 1;
    view_info.subresourceRange.baseArrayLayer = 0;
    view_info.subresourceRange.layerCount = 1;

    if (vkCreateImageView(m_ctx.device(), &view_info, nullptr, &m_storage_image_view) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create storage image view");
    }

    m_storage_width = width;
    m_storage_height = height;

    // Update descriptor with new storage image
    VkDescriptorImageInfo desc_image_info{};
    desc_image_info.imageView = m_storage_image_view;
    desc_image_info.imageLayout = VK_IMAGE_LAYOUT_GENERAL;

    VkWriteDescriptorSet write{};
    write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
    write.dstSet = m_descriptor_set;
    write.dstBinding = 1;
    write.descriptorCount = 1;
    write.descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_IMAGE;
    write.pImageInfo = &desc_image_info;

    vkUpdateDescriptorSets(m_ctx.device(), 1, &write, 0, nullptr);

    spdlog::info("Created storage image: {}x{}", width, height);
}

void RTPipeline::set_instances(const std::vector<GlyphInstance>& instances) {
    if (instances.empty()) return;

    VkDeviceSize required_size = instances.size() * sizeof(GlyphInstance);
    if (required_size > m_instance_buffer.size()) {
        // Recreate buffer with larger size
        m_instance_buffer = Buffer(m_ctx, required_size * 2,
            VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
            VMA_MEMORY_USAGE_CPU_TO_GPU);

        // Update descriptor
        VkDescriptorBufferInfo info{};
        info.buffer = m_instance_buffer.handle();
        info.offset = 0;
        info.range = VK_WHOLE_SIZE;

        VkWriteDescriptorSet write{};
        write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        write.dstSet = m_descriptor_set;
        write.dstBinding = 2;
        write.descriptorCount = 1;
        write.descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
        write.pBufferInfo = &info;

        vkUpdateDescriptorSets(m_ctx.device(), 1, &write, 0, nullptr);
    }

    m_instance_buffer.upload(instances.data(), required_size);
    m_instance_count = static_cast<uint32_t>(instances.size());
}

void RTPipeline::set_lights(const std::vector<Light>& lights) {
    if (lights.empty()) return;

    VkDeviceSize required_size = lights.size() * sizeof(Light);
    if (required_size > m_light_buffer.size()) {
        // Recreate buffer with larger size
        m_light_buffer = Buffer(m_ctx, required_size * 2,
            VK_BUFFER_USAGE_STORAGE_BUFFER_BIT,
            VMA_MEMORY_USAGE_CPU_TO_GPU);

        // Update descriptor
        VkDescriptorBufferInfo info{};
        info.buffer = m_light_buffer.handle();
        info.offset = 0;
        info.range = VK_WHOLE_SIZE;

        VkWriteDescriptorSet write{};
        write.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        write.dstSet = m_descriptor_set;
        write.dstBinding = 3;
        write.descriptorCount = 1;
        write.descriptorType = VK_DESCRIPTOR_TYPE_STORAGE_BUFFER;
        write.pBufferInfo = &info;

        vkUpdateDescriptorSets(m_ctx.device(), 1, &write, 0, nullptr);
    }

    m_light_buffer.upload(lights.data(), required_size);
    m_light_count = static_cast<uint32_t>(lights.size());
}

void RTPipeline::trace_rays(VkCommandBuffer cmd, uint32_t width, uint32_t height,
                            const CameraPushConstants& camera) {
    // Ensure storage image is the right size
    resize_storage_image(width, height);

    // Bind pipeline
    vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_RAY_TRACING_KHR, m_pipeline);

    // Bind descriptor set
    vkCmdBindDescriptorSets(cmd, VK_PIPELINE_BIND_POINT_RAY_TRACING_KHR,
                            m_pipeline_layout, 0, 1, &m_descriptor_set, 0, nullptr);

    // Push constants
    vkCmdPushConstants(cmd, m_pipeline_layout,
                       VK_SHADER_STAGE_RAYGEN_BIT_KHR | VK_SHADER_STAGE_CLOSEST_HIT_BIT_KHR,
                       0, sizeof(CameraPushConstants), &camera);

    // Trace rays
    vkCmdTraceRaysKHR(cmd,
        &m_raygen_region,
        &m_miss_region,
        &m_hit_region,
        &m_callable_region,
        width, height, 1);
}

std::vector<uint8_t> RTPipeline::capture_screenshot() {
    if (m_storage_image == VK_NULL_HANDLE || m_storage_width == 0 || m_storage_height == 0) {
        spdlog::warn("Cannot capture screenshot: no storage image");
        return {};
    }

    m_ctx.wait_idle();

    VkDeviceSize image_size = m_storage_width * m_storage_height * 4;  // RGBA

    // Create staging buffer
    Buffer staging(m_ctx, image_size,
        VK_BUFFER_USAGE_TRANSFER_DST_BIT,
        VMA_MEMORY_USAGE_GPU_TO_CPU);

    // Copy image to buffer
    VkCommandBuffer cmd = m_ctx.begin_single_time_commands();

    // Transition image to transfer src
    VkImageMemoryBarrier barrier{};
    barrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
    barrier.oldLayout = VK_IMAGE_LAYOUT_GENERAL;
    barrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
    barrier.srcQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.dstQueueFamilyIndex = VK_QUEUE_FAMILY_IGNORED;
    barrier.image = m_storage_image;
    barrier.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    barrier.subresourceRange.baseMipLevel = 0;
    barrier.subresourceRange.levelCount = 1;
    barrier.subresourceRange.baseArrayLayer = 0;
    barrier.subresourceRange.layerCount = 1;
    barrier.srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT;
    barrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;

    vkCmdPipelineBarrier(cmd,
        VK_PIPELINE_STAGE_RAY_TRACING_SHADER_BIT_KHR,
        VK_PIPELINE_STAGE_TRANSFER_BIT,
        0, 0, nullptr, 0, nullptr, 1, &barrier);

    // Copy image to buffer
    VkBufferImageCopy region{};
    region.bufferOffset = 0;
    region.bufferRowLength = 0;
    region.bufferImageHeight = 0;
    region.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    region.imageSubresource.mipLevel = 0;
    region.imageSubresource.baseArrayLayer = 0;
    region.imageSubresource.layerCount = 1;
    region.imageOffset = {0, 0, 0};
    region.imageExtent = {m_storage_width, m_storage_height, 1};

    vkCmdCopyImageToBuffer(cmd, m_storage_image, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
                           staging.handle(), 1, &region);

    // Transition back to general
    barrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
    barrier.newLayout = VK_IMAGE_LAYOUT_GENERAL;
    barrier.srcAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
    barrier.dstAccessMask = VK_ACCESS_SHADER_WRITE_BIT;

    vkCmdPipelineBarrier(cmd,
        VK_PIPELINE_STAGE_TRANSFER_BIT,
        VK_PIPELINE_STAGE_RAY_TRACING_SHADER_BIT_KHR,
        0, 0, nullptr, 0, nullptr, 1, &barrier);

    m_ctx.end_single_time_commands(cmd);

    // Read pixels
    std::vector<uint8_t> pixels(image_size);
    void* data = staging.map();
    std::memcpy(pixels.data(), data, image_size);
    staging.unmap();

    spdlog::info("Captured screenshot: {}x{}", m_storage_width, m_storage_height);
    return pixels;
}

} // namespace ascii
