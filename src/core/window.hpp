#pragma once

#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>

#include <string>
#include <functional>
#include <array>

namespace ascii {

class Window {
public:
    struct Config {
        int width = 1280;
        int height = 720;
        std::string title = "ASCII Dungeon";
        bool resizable = true;
        bool vsync = true;
        void* parent_hwnd = nullptr;  // Optional parent window for embedding
        bool start_hidden = false;    // Start hidden (for overlay mode - show after positioned)
    };

    explicit Window(const Config& config);
    ~Window();

    // Non-copyable, non-movable
    Window(const Window&) = delete;
    Window& operator=(const Window&) = delete;
    Window(Window&&) = delete;
    Window& operator=(Window&&) = delete;

    // Window state
    bool should_close() const;
    void poll_events();
    void set_title(const std::string& title);

    // Getters
    GLFWwindow* handle() const { return m_window; }
    int width() const { return m_width; }
    int height() const { return m_height; }
    float aspect_ratio() const { return static_cast<float>(m_width) / static_cast<float>(m_height); }
    bool was_resized() const { return m_resized; }
    void reset_resized_flag() { m_resized = false; }

    // Time
    float delta_time() const { return m_delta_time; }
    float total_time() const { return m_total_time; }

    // Input - Keys
    bool key_down(int key) const;
    bool key_pressed(int key) const;
    bool key_released(int key) const;

    // Input - Mouse
    std::pair<double, double> mouse_pos() const;
    std::pair<double, double> mouse_delta() const;
    bool mouse_down(int button) const;
    bool mouse_pressed(int button) const;
    bool mouse_released(int button) const;

    // Mouse capture (for FPS-style controls)
    void set_cursor_captured(bool captured);
    bool is_cursor_captured() const { return m_cursor_captured; }

    // Window embedding (for editor integration)
    void set_parent(void* parent_hwnd);
    void set_owner(void* owner_hwnd);  // Set owner for z-order (overlay stays above owner)
    void resize(int width, int height);
    void set_position(int x, int y);
    void set_position_and_size(int x, int y, int width, int height);
    void* native_handle() const;  // Returns platform-specific window handle (HWND on Windows)
    void set_borderless(bool borderless);  // Remove/restore window decorations for overlay mode
    void show();  // Show a hidden window
    void hide();  // Hide the window

    // Enable automatic position tracking of owner window (bypasses IPC for lower latency)
    void set_follow_owner(bool follow, int offset_x = 0, int offset_y = 0, int follow_width = 0, int follow_height = 0);
    void update_follow_owner();  // Called each frame to sync position with owner

    // Vulkan surface creation
    VkSurfaceKHR create_surface(VkInstance instance) const;
    std::vector<const char*> get_required_extensions() const;

private:
    static void framebuffer_resize_callback(GLFWwindow* window, int width, int height);
    static void key_callback(GLFWwindow* window, int key, int scancode, int action, int mods);
    static void mouse_button_callback(GLFWwindow* window, int button, int action, int mods);
    static void cursor_pos_callback(GLFWwindow* window, double xpos, double ypos);

    void update_time();
    void update_input();

    GLFWwindow* m_window = nullptr;
    int m_width = 0;
    int m_height = 0;
    bool m_resized = false;

    // Time tracking
    float m_delta_time = 0.0f;
    float m_total_time = 0.0f;
    double m_last_frame_time = 0.0;

    // Input state
    static constexpr int MAX_KEYS = 512;
    static constexpr int MAX_MOUSE_BUTTONS = 8;

    std::array<bool, MAX_KEYS> m_keys_current{};
    std::array<bool, MAX_KEYS> m_keys_previous{};
    std::array<bool, MAX_MOUSE_BUTTONS> m_mouse_current{};
    std::array<bool, MAX_MOUSE_BUTTONS> m_mouse_previous{};

    double m_mouse_x = 0.0;
    double m_mouse_y = 0.0;
    double m_mouse_last_x = 0.0;
    double m_mouse_last_y = 0.0;
    bool m_first_mouse = true;
    bool m_cursor_captured = false;

    // Owner following (for low-latency overlay tracking)
    void* m_owner_hwnd = nullptr;
    bool m_follow_owner = false;
    int m_follow_offset_x = 0;
    int m_follow_offset_y = 0;
    int m_follow_width = 0;
    int m_follow_height = 0;

    // WinEvent hook for seamless owner tracking (Windows only)
#ifdef _WIN32
    void* m_win_event_hook = nullptr;  // HWINEVENTHOOK
    void install_move_hook();
    void uninstall_move_hook();
    void on_owner_moved();  // Called by hook when owner window moves
    static void CALLBACK win_event_proc(void* hWinEventHook, unsigned long event,
                                        void* hwnd, long idObject, long idChild,
                                        unsigned long idEventThread, unsigned long dwmsEventTime);
#endif
};

} // namespace ascii
