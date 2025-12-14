#pragma once

#include <vulkan/vulkan.h>
#include <vk_mem_alloc.h>

#include <cstdint>
#include <span>

namespace ascii {

class VulkanContext;

// Simple GPU buffer wrapper using VMA
class Buffer {
public:
    Buffer() = default;
    Buffer(VulkanContext& ctx, VkDeviceSize size, VkBufferUsageFlags usage,
           VmaMemoryUsage memory_usage, VmaAllocationCreateFlags flags = 0);
    ~Buffer();

    // Move-only
    Buffer(const Buffer&) = delete;
    Buffer& operator=(const Buffer&) = delete;
    Buffer(Buffer&& other) noexcept;
    Buffer& operator=(Buffer&& other) noexcept;

    void destroy();

    // Map/unmap for host-visible buffers
    void* map();
    void unmap();

    // Upload data
    void upload(const void* data, VkDeviceSize size, VkDeviceSize offset = 0);

    template<typename T>
    void upload(std::span<const T> data, VkDeviceSize offset = 0) {
        upload(data.data(), data.size_bytes(), offset);
    }

    // Getters
    VkBuffer handle() const { return m_buffer; }
    VkDeviceSize size() const { return m_size; }
    VkDeviceAddress device_address() const;
    bool valid() const { return m_buffer != VK_NULL_HANDLE; }

    operator VkBuffer() const { return m_buffer; }

private:
    VulkanContext* m_ctx = nullptr;
    VkBuffer m_buffer = VK_NULL_HANDLE;
    VmaAllocation m_allocation = VK_NULL_HANDLE;
    VkDeviceSize m_size = 0;
    void* m_mapped = nullptr;
};

// Staging buffer for GPU uploads
class StagingBuffer {
public:
    StagingBuffer(VulkanContext& ctx, VkDeviceSize size);

    void upload(const void* data, VkDeviceSize size);
    void copy_to(Buffer& dst, VkDeviceSize size, VkDeviceSize src_offset = 0, VkDeviceSize dst_offset = 0);

    Buffer& buffer() { return m_buffer; }

private:
    VulkanContext* m_ctx;
    Buffer m_buffer;
};

} // namespace ascii
