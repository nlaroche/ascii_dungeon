#include "buffer.hpp"
#include "core/vulkan_context.hpp"

#include <stdexcept>
#include <cstring>

namespace ascii {

Buffer::Buffer(VulkanContext& ctx, VkDeviceSize size, VkBufferUsageFlags usage,
               VmaMemoryUsage memory_usage, VmaAllocationCreateFlags flags)
    : m_ctx(&ctx)
    , m_size(size)
{
    VkBufferCreateInfo buffer_info{};
    buffer_info.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
    buffer_info.size = size;
    buffer_info.usage = usage;
    buffer_info.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

    VmaAllocationCreateInfo alloc_info{};
    alloc_info.usage = memory_usage;
    alloc_info.flags = flags;

    if (vmaCreateBuffer(ctx.allocator(), &buffer_info, &alloc_info,
                        &m_buffer, &m_allocation, nullptr) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create buffer");
    }
}

Buffer::~Buffer() {
    destroy();
}

Buffer::Buffer(Buffer&& other) noexcept
    : m_ctx(other.m_ctx)
    , m_buffer(other.m_buffer)
    , m_allocation(other.m_allocation)
    , m_size(other.m_size)
    , m_mapped(other.m_mapped)
{
    other.m_ctx = nullptr;
    other.m_buffer = VK_NULL_HANDLE;
    other.m_allocation = VK_NULL_HANDLE;
    other.m_size = 0;
    other.m_mapped = nullptr;
}

Buffer& Buffer::operator=(Buffer&& other) noexcept {
    if (this != &other) {
        destroy();

        m_ctx = other.m_ctx;
        m_buffer = other.m_buffer;
        m_allocation = other.m_allocation;
        m_size = other.m_size;
        m_mapped = other.m_mapped;

        other.m_ctx = nullptr;
        other.m_buffer = VK_NULL_HANDLE;
        other.m_allocation = VK_NULL_HANDLE;
        other.m_size = 0;
        other.m_mapped = nullptr;
    }
    return *this;
}

void Buffer::destroy() {
    if (m_buffer != VK_NULL_HANDLE && m_ctx) {
        if (m_mapped) {
            unmap();
        }
        vmaDestroyBuffer(m_ctx->allocator(), m_buffer, m_allocation);
        m_buffer = VK_NULL_HANDLE;
        m_allocation = VK_NULL_HANDLE;
    }
}

void* Buffer::map() {
    if (!m_mapped) {
        if (vmaMapMemory(m_ctx->allocator(), m_allocation, &m_mapped) != VK_SUCCESS) {
            throw std::runtime_error("Failed to map buffer memory");
        }
    }
    return m_mapped;
}

void Buffer::unmap() {
    if (m_mapped) {
        vmaUnmapMemory(m_ctx->allocator(), m_allocation);
        m_mapped = nullptr;
    }
}

void Buffer::upload(const void* data, VkDeviceSize size, VkDeviceSize offset) {
    void* mapped = map();
    std::memcpy(static_cast<char*>(mapped) + offset, data, size);
    unmap();
}

VkDeviceAddress Buffer::device_address() const {
    VkBufferDeviceAddressInfo info{};
    info.sType = VK_STRUCTURE_TYPE_BUFFER_DEVICE_ADDRESS_INFO;
    info.buffer = m_buffer;
    return vkGetBufferDeviceAddress(m_ctx->device(), &info);
}

// StagingBuffer implementation
StagingBuffer::StagingBuffer(VulkanContext& ctx, VkDeviceSize size)
    : m_ctx(&ctx)
    , m_buffer(ctx, size,
               VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
               VMA_MEMORY_USAGE_CPU_ONLY)
{
}

void StagingBuffer::upload(const void* data, VkDeviceSize size) {
    m_buffer.upload(data, size);
}

void StagingBuffer::copy_to(Buffer& dst, VkDeviceSize size, VkDeviceSize src_offset, VkDeviceSize dst_offset) {
    VkCommandBuffer cmd = m_ctx->begin_single_time_commands();

    VkBufferCopy copy_region{};
    copy_region.srcOffset = src_offset;
    copy_region.dstOffset = dst_offset;
    copy_region.size = size;

    vkCmdCopyBuffer(cmd, m_buffer.handle(), dst.handle(), 1, &copy_region);

    m_ctx->end_single_time_commands(cmd);
}

} // namespace ascii
