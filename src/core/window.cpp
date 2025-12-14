#include "window.hpp"
#include <spdlog/spdlog.h>
#include <stdexcept>

#ifdef _WIN32
#define GLFW_EXPOSE_NATIVE_WIN32
#include <GLFW/glfw3native.h>
#include <windows.h>

// OBJID_WINDOW constant (normally from oleacc.h)
#ifndef OBJID_WINDOW
#define OBJID_WINDOW 0
#endif

// Global pointer for WinEvent hook callback (only one overlay window supported)
static ascii::Window* g_hooked_window = nullptr;
#endif

namespace ascii {

Window::Window(const Config& config)
    : m_width(config.width)
    , m_height(config.height)
{
    spdlog::info("Initializing GLFW...");

    if (!glfwInit()) {
        throw std::runtime_error("Failed to initialize GLFW");
    }

    // We're using Vulkan, not OpenGL
    glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
    glfwWindowHint(GLFW_RESIZABLE, config.resizable ? GLFW_TRUE : GLFW_FALSE);

    spdlog::info("Creating window: {}x{} - {}", config.width, config.height, config.title);

    // Start hidden if requested (for overlay mode - show after positioned)
    if (config.start_hidden) {
        glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
    }

    m_window = glfwCreateWindow(
        config.width,
        config.height,
        config.title.c_str(),
        nullptr,
        nullptr
    );

    if (!m_window) {
        glfwTerminate();
        throw std::runtime_error("Failed to create GLFW window");
    }

    // Store this pointer for callbacks
    glfwSetWindowUserPointer(m_window, this);

    // Set up callbacks
    glfwSetFramebufferSizeCallback(m_window, framebuffer_resize_callback);
    glfwSetKeyCallback(m_window, key_callback);
    glfwSetMouseButtonCallback(m_window, mouse_button_callback);
    glfwSetCursorPosCallback(m_window, cursor_pos_callback);

    // Get actual framebuffer size
    glfwGetFramebufferSize(m_window, &m_width, &m_height);

    // Initialize time
    m_last_frame_time = glfwGetTime();

    // If parent HWND provided, embed as child window BEFORE Vulkan initialization
    if (config.parent_hwnd != nullptr) {
        set_parent(config.parent_hwnd);
        // Show window after reparenting
        glfwShowWindow(m_window);
    }

    spdlog::info("Window created successfully");
}

Window::~Window() {
#ifdef _WIN32
    uninstall_move_hook();
#endif
    if (m_window) {
        glfwDestroyWindow(m_window);
    }
    glfwTerminate();
    spdlog::info("Window destroyed");
}

bool Window::should_close() const {
    return glfwWindowShouldClose(m_window);
}

void Window::poll_events() {
    update_input();
    glfwPollEvents();
    update_time();
}

void Window::set_title(const std::string& title) {
    glfwSetWindowTitle(m_window, title.c_str());
}

void Window::update_time() {
    double current_time = glfwGetTime();
    m_delta_time = static_cast<float>(current_time - m_last_frame_time);
    m_last_frame_time = current_time;
    m_total_time = static_cast<float>(current_time);
}

void Window::update_input() {
    // Save previous state
    m_keys_previous = m_keys_current;
    m_mouse_previous = m_mouse_current;

    // Reset mouse delta for next frame
    // (delta is calculated as current - last, so set last = current after each frame)
    if (m_first_mouse) {
        m_first_mouse = false;
    }
    m_mouse_last_x = m_mouse_x;
    m_mouse_last_y = m_mouse_y;
}

// Input - Keys
bool Window::key_down(int key) const {
    if (key < 0 || key >= MAX_KEYS) return false;
    return m_keys_current[key];
}

bool Window::key_pressed(int key) const {
    if (key < 0 || key >= MAX_KEYS) return false;
    return m_keys_current[key] && !m_keys_previous[key];
}

bool Window::key_released(int key) const {
    if (key < 0 || key >= MAX_KEYS) return false;
    return !m_keys_current[key] && m_keys_previous[key];
}

// Input - Mouse
std::pair<double, double> Window::mouse_pos() const {
    return {m_mouse_x, m_mouse_y};
}

std::pair<double, double> Window::mouse_delta() const {
    return {m_mouse_x - m_mouse_last_x, m_mouse_y - m_mouse_last_y};
}

bool Window::mouse_down(int button) const {
    if (button < 0 || button >= MAX_MOUSE_BUTTONS) return false;
    return m_mouse_current[button];
}

bool Window::mouse_pressed(int button) const {
    if (button < 0 || button >= MAX_MOUSE_BUTTONS) return false;
    return m_mouse_current[button] && !m_mouse_previous[button];
}

bool Window::mouse_released(int button) const {
    if (button < 0 || button >= MAX_MOUSE_BUTTONS) return false;
    return !m_mouse_current[button] && m_mouse_previous[button];
}

void Window::set_cursor_captured(bool captured) {
    m_cursor_captured = captured;
    if (captured) {
        glfwSetInputMode(m_window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
        // Reset mouse tracking to avoid jump
        m_first_mouse = true;
    } else {
        glfwSetInputMode(m_window, GLFW_CURSOR, GLFW_CURSOR_NORMAL);
    }
}

// Vulkan integration - use direct Win32 surface creation for child window support
VkSurfaceKHR Window::create_surface(VkInstance instance) const {
    VkSurfaceKHR surface;

#ifdef _WIN32
    // Use vkCreateWin32SurfaceKHR directly instead of glfwCreateWindowSurface
    // This works with child windows (SetParent) while GLFW's version doesn't
    VkWin32SurfaceCreateInfoKHR create_info{};
    create_info.sType = VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR;
    create_info.hwnd = glfwGetWin32Window(m_window);
    create_info.hinstance = GetModuleHandle(nullptr);

    spdlog::info("Creating Vulkan surface for HWND {:p}", static_cast<void*>(create_info.hwnd));

    if (vkCreateWin32SurfaceKHR(instance, &create_info, nullptr, &surface) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create Win32 Vulkan surface");
    }
#else
    // Fallback to GLFW for non-Windows platforms
    if (glfwCreateWindowSurface(instance, m_window, nullptr, &surface) != VK_SUCCESS) {
        throw std::runtime_error("Failed to create window surface");
    }
#endif

    return surface;
}

std::vector<const char*> Window::get_required_extensions() const {
    uint32_t count = 0;
    const char** extensions = glfwGetRequiredInstanceExtensions(&count);
    return std::vector<const char*>(extensions, extensions + count);
}

// Static callbacks
void Window::framebuffer_resize_callback(GLFWwindow* window, int width, int height) {
    auto* self = static_cast<Window*>(glfwGetWindowUserPointer(window));
    self->m_width = width;
    self->m_height = height;
    self->m_resized = true;
    spdlog::debug("Window resized: {}x{}", width, height);
}

void Window::key_callback(GLFWwindow* window, int key, int /*scancode*/, int action, int /*mods*/) {
    auto* self = static_cast<Window*>(glfwGetWindowUserPointer(window));
    if (key >= 0 && key < MAX_KEYS) {
        if (action == GLFW_PRESS) {
            self->m_keys_current[key] = true;
        } else if (action == GLFW_RELEASE) {
            self->m_keys_current[key] = false;
        }
    }
}

void Window::mouse_button_callback(GLFWwindow* window, int button, int action, int /*mods*/) {
    auto* self = static_cast<Window*>(glfwGetWindowUserPointer(window));
    if (button >= 0 && button < MAX_MOUSE_BUTTONS) {
        if (action == GLFW_PRESS) {
            self->m_mouse_current[button] = true;
        } else if (action == GLFW_RELEASE) {
            self->m_mouse_current[button] = false;
        }
    }
}

void Window::cursor_pos_callback(GLFWwindow* window, double xpos, double ypos) {
    auto* self = static_cast<Window*>(glfwGetWindowUserPointer(window));
    // Only update current position - delta tracking is handled by update_input()
    self->m_mouse_x = xpos;
    self->m_mouse_y = ypos;
}

// Window embedding support - embeds as true child window
// Vulkan CAN work with child windows if we set things up correctly
void Window::set_parent(void* parent_hwnd) {
#ifdef _WIN32
    if (!parent_hwnd) return;

    HWND hwnd = glfwGetWin32Window(m_window);
    HWND parent = static_cast<HWND>(parent_hwnd);

    spdlog::info("Embedding as child of HWND {:p}", parent_hwnd);

    // Get parent's client area size for initial sizing
    RECT parent_client;
    GetClientRect(parent, &parent_client);
    int parent_width = parent_client.right - parent_client.left;
    int parent_height = parent_client.bottom - parent_client.top;
    spdlog::info("Parent client area: {}x{}", parent_width, parent_height);

    // Change to child window style BEFORE calling SetParent
    LONG style = GetWindowLong(hwnd, GWL_STYLE);
    style &= ~(WS_POPUP | WS_OVERLAPPEDWINDOW | WS_CAPTION | WS_THICKFRAME |
               WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU | WS_BORDER);
    style |= WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS;
    SetWindowLong(hwnd, GWL_STYLE, style);

    // Remove all extended styles
    LONG exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
    exStyle &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE |
                 WS_EX_WINDOWEDGE | WS_EX_APPWINDOW | WS_EX_TOOLWINDOW |
                 WS_EX_OVERLAPPEDWINDOW);
    SetWindowLong(hwnd, GWL_EXSTYLE, exStyle);

    // Reparent
    SetParent(hwnd, parent);

    // Position and size the child window to fill parent initially
    // Use a reasonable default size (will be updated by set_position_and_size later)
    int initial_width = (parent_width > 0) ? parent_width : m_width;
    int initial_height = (parent_height > 0) ? parent_height : m_height;

    SetWindowPos(hwnd, HWND_TOP,
                 0, 0, initial_width, initial_height,
                 SWP_FRAMECHANGED | SWP_SHOWWINDOW);

    // Update our stored dimensions
    m_width = initial_width;
    m_height = initial_height;

    // Process pending messages to ensure Windows has updated everything
    MSG msg;
    while (PeekMessage(&msg, hwnd, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    // Verify final size
    RECT client_rect;
    GetClientRect(hwnd, &client_rect);
    spdlog::info("Child window client area after embedding: {}x{}",
                 client_rect.right, client_rect.bottom);

    m_width = client_rect.right;
    m_height = client_rect.bottom;
    m_resized = true;

    spdlog::info("Window successfully embedded as child");
#else
    spdlog::warn("Window embedding not supported on this platform");
#endif
}

void Window::resize(int width, int height) {
    if (width > 0 && height > 0) {
        glfwSetWindowSize(m_window, width, height);
        m_width = width;
        m_height = height;
        m_resized = true;
        spdlog::debug("Window resized to {}x{}", width, height);
    }
}

void Window::set_position(int x, int y) {
#ifdef _WIN32
    HWND hwnd = glfwGetWin32Window(m_window);
    SetWindowPos(hwnd, HWND_TOP, x, y, 0, 0, SWP_NOSIZE | SWP_SHOWWINDOW);
    spdlog::debug("Window positioned to ({}, {})", x, y);
#else
    glfwSetWindowPos(m_window, x, y);
#endif
}

void Window::set_position_and_size(int x, int y, int width, int height) {
#ifdef _WIN32
    HWND hwnd = glfwGetWin32Window(m_window);

    // Skip if size hasn't actually changed
    if (width == m_width && height == m_height) {
        // Just reposition without triggering resize
        SetWindowPos(hwnd, HWND_TOP, x, y, 0, 0, SWP_NOSIZE | SWP_SHOWWINDOW);
        spdlog::debug("Window repositioned to ({}, {})", x, y);
        return;
    }

    // For child windows, position is relative to parent's client area
    SetWindowPos(hwnd, HWND_TOP, x, y, width, height, SWP_SHOWWINDOW);

    // Process pending messages to let Windows update the surface
    MSG msg;
    while (PeekMessage(&msg, hwnd, 0, 0, PM_REMOVE)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    m_width = width;
    m_height = height;
    m_resized = true;
    spdlog::debug("Window set to ({}, {}) size {}x{}", x, y, width, height);
#else
    glfwSetWindowPos(m_window, x, y);
    glfwSetWindowSize(m_window, width, height);
    m_width = width;
    m_height = height;
    m_resized = true;
#endif
}

void* Window::native_handle() const {
#ifdef _WIN32
    return static_cast<void*>(glfwGetWin32Window(m_window));
#else
    return nullptr;
#endif
}

void Window::set_owner(void* owner_hwnd) {
#ifdef _WIN32
    if (!owner_hwnd) return;

    HWND hwnd = glfwGetWin32Window(m_window);
    HWND owner = static_cast<HWND>(owner_hwnd);

    // Store for follow mode
    m_owner_hwnd = owner_hwnd;

    // Ensure window doesn't show in taskbar: remove WS_EX_APPWINDOW, add WS_EX_TOOLWINDOW
    LONG exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
    exStyle &= ~WS_EX_APPWINDOW;
    exStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
    SetWindowLong(hwnd, GWL_EXSTYLE, exStyle);

    // Set the owner window - this creates a z-order relationship
    // The owned window will always stay above its owner
    SetWindowLongPtr(hwnd, GWLP_HWNDPARENT, reinterpret_cast<LONG_PTR>(owner));

    // Force style and z-order update
    SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);

    spdlog::info("Window owner set to HWND {:p} (hidden from taskbar)", owner_hwnd);
#else
    (void)owner_hwnd;
    spdlog::warn("set_owner not supported on this platform");
#endif
}

void Window::set_follow_owner(bool follow, int offset_x, int offset_y, int follow_width, int follow_height) {
    m_follow_owner = follow;
    m_follow_offset_x = offset_x;
    m_follow_offset_y = offset_y;
    m_follow_width = follow_width;
    m_follow_height = follow_height;

    if (follow) {
        spdlog::info("Follow owner enabled: offset ({}, {}), size {}x{}",
                     offset_x, offset_y, follow_width, follow_height);
#ifdef _WIN32
        install_move_hook();
#endif
    } else {
        spdlog::info("Follow owner disabled");
#ifdef _WIN32
        uninstall_move_hook();
#endif
    }
}

void Window::update_follow_owner() {
#ifdef _WIN32
    if (!m_follow_owner || !m_owner_hwnd) return;

    HWND owner = static_cast<HWND>(m_owner_hwnd);
    HWND hwnd = glfwGetWin32Window(m_window);

    // Check if owner window still exists (throttle this check - it's slow)
    static int check_counter = 0;
    if (++check_counter >= 60) {  // Check every ~60 frames
        check_counter = 0;
        if (!IsWindow(owner)) {
            m_follow_owner = false;
            spdlog::warn("Owner window no longer exists, disabling follow mode");
            return;
        }
    }

    // Get owner's client area position in screen coordinates
    POINT client_origin = {0, 0};
    if (!ClientToScreen(owner, &client_origin)) {
        return;  // Owner window may have been destroyed
    }

    // Calculate target position
    int target_x = client_origin.x + m_follow_offset_x;
    int target_y = client_origin.y + m_follow_offset_y;

    // Cache current position to avoid GetWindowRect call every frame
    static int cached_x = 0, cached_y = 0;

    // Only update if position actually changed
    if (cached_x == target_x && cached_y == target_y) {
        return;
    }
    cached_x = target_x;
    cached_y = target_y;

    // Synchronous update for lag-free following (removed ASYNCWINDOWPOS)
    // NOACTIVATE prevents stealing focus, NOOWNERZORDER keeps z-order stable
    UINT flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOZORDER;

    if (m_follow_width > 0 && m_follow_height > 0 &&
        (m_follow_width != m_width || m_follow_height != m_height)) {
        // Size changed - resize as well
        SetWindowPos(hwnd, nullptr, target_x, target_y, m_follow_width, m_follow_height, flags);
        m_width = m_follow_width;
        m_height = m_follow_height;
        m_resized = true;
    } else {
        // Just reposition
        SetWindowPos(hwnd, nullptr, target_x, target_y, 0, 0, flags | SWP_NOSIZE);
    }
#endif
}

void Window::set_borderless(bool borderless) {
#ifdef _WIN32
    HWND hwnd = glfwGetWin32Window(m_window);

    if (borderless) {
        // Remove window decorations for overlay mode
        LONG style = GetWindowLong(hwnd, GWL_STYLE);
        style &= ~(WS_OVERLAPPEDWINDOW | WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU);
        style |= WS_POPUP;
        SetWindowLong(hwnd, GWL_STYLE, style);

        // Remove extended styles that add borders
        LONG exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        exStyle &= ~(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE | WS_EX_WINDOWEDGE);
        exStyle |= WS_EX_TOOLWINDOW;  // Don't show in taskbar
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle);

        // Apply the changes
        SetWindowPos(hwnd, nullptr, 0, 0, 0, 0,
                     SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER);

        spdlog::info("Window set to borderless mode");
    } else {
        // Restore normal window decorations
        LONG style = GetWindowLong(hwnd, GWL_STYLE);
        style |= WS_OVERLAPPEDWINDOW;
        style &= ~WS_POPUP;
        SetWindowLong(hwnd, GWL_STYLE, style);

        LONG exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        exStyle &= ~WS_EX_TOOLWINDOW;
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle);

        SetWindowPos(hwnd, nullptr, 0, 0, 0, 0,
                     SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER);

        spdlog::info("Window restored to normal mode");
    }
#else
    (void)borderless;
    spdlog::warn("set_borderless not supported on this platform");
#endif
}

void Window::show() {
    glfwShowWindow(m_window);
    spdlog::debug("Window shown");
}

void Window::hide() {
    glfwHideWindow(m_window);
    spdlog::debug("Window hidden");
}

#ifdef _WIN32
void CALLBACK Window::win_event_proc(void* hWinEventHook, unsigned long event,
                                     void* hwnd, long idObject, long idChild,
                                     unsigned long idEventThread, unsigned long dwmsEventTime) {
    (void)hWinEventHook;
    (void)event;
    (void)idChild;
    (void)idEventThread;
    (void)dwmsEventTime;

    // Only respond to window object events (not child controls)
    if (idObject != OBJID_WINDOW) return;

    // Check if this is our owner window
    if (g_hooked_window && g_hooked_window->m_owner_hwnd == hwnd) {
        g_hooked_window->on_owner_moved();
    }
}

void Window::install_move_hook() {
    if (m_win_event_hook) return;  // Already installed
    if (!m_owner_hwnd) {
        spdlog::warn("Cannot install move hook: no owner window set");
        return;
    }

    g_hooked_window = this;

    // Get the thread ID of the owner window
    DWORD owner_thread_id = GetWindowThreadProcessId(static_cast<HWND>(m_owner_hwnd), nullptr);

    // Install hook for EVENT_OBJECT_LOCATIONCHANGE on the owner window's thread
    // This fires whenever a window moves, resizes, or changes z-order
    HWINEVENTHOOK hook = SetWinEventHook(
        EVENT_OBJECT_LOCATIONCHANGE,  // eventMin
        EVENT_OBJECT_LOCATIONCHANGE,  // eventMax
        nullptr,                       // hmodWinEventProc (nullptr = in-process callback)
        reinterpret_cast<WINEVENTPROC>(win_event_proc),
        0,                            // idProcess (0 = all processes)
        owner_thread_id,              // idThread (owner's thread only)
        WINEVENT_OUTOFCONTEXT         // dwFlags (async callback, no DLL needed)
    );

    if (hook) {
        m_win_event_hook = hook;
        spdlog::info("Installed WinEvent hook for owner window (thread {})", owner_thread_id);
    } else {
        spdlog::error("Failed to install WinEvent hook: {}", GetLastError());
    }
}

void Window::uninstall_move_hook() {
    if (m_win_event_hook) {
        UnhookWinEvent(static_cast<HWINEVENTHOOK>(m_win_event_hook));
        m_win_event_hook = nullptr;
        spdlog::info("Uninstalled WinEvent hook");
    }
    if (g_hooked_window == this) {
        g_hooked_window = nullptr;
    }
}

void Window::on_owner_moved() {
    if (!m_follow_owner || !m_owner_hwnd) return;

    HWND owner = static_cast<HWND>(m_owner_hwnd);
    HWND hwnd = glfwGetWin32Window(m_window);

    // Get owner's client area position in screen coordinates
    POINT client_origin = {0, 0};
    if (!ClientToScreen(owner, &client_origin)) {
        return;
    }

    // Calculate target position
    int target_x = client_origin.x + m_follow_offset_x;
    int target_y = client_origin.y + m_follow_offset_y;

    // Synchronous, immediate update - this is called from the hook so timing is critical
    UINT flags = SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOOWNERZORDER;

    if (m_follow_width > 0 && m_follow_height > 0 &&
        (m_follow_width != m_width || m_follow_height != m_height)) {
        SetWindowPos(hwnd, nullptr, target_x, target_y, m_follow_width, m_follow_height, flags);
        m_width = m_follow_width;
        m_height = m_follow_height;
        m_resized = true;
    } else {
        SetWindowPos(hwnd, nullptr, target_x, target_y, 0, 0, flags | SWP_NOSIZE);
    }
}
#endif

} // namespace ascii
