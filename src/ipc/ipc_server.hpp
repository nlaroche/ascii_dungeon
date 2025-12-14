#pragma once

#include <nlohmann/json.hpp>
#include <functional>
#include <string>
#include <memory>
#include <unordered_map>

namespace ascii {

using json = nlohmann::json;

// Handler for IPC commands
// Receives: params JSON object
// Returns: result JSON object (will be wrapped in response)
using CommandHandler = std::function<json(const json& params)>;

// Callback for when events should be emitted
using EventCallback = std::function<void(const std::string& event, const json& data)>;

class IPCServer {
public:
    explicit IPCServer(uint16_t port = 9999);
    ~IPCServer();

    // Non-copyable
    IPCServer(const IPCServer&) = delete;
    IPCServer& operator=(const IPCServer&) = delete;

    // Start/stop the WebSocket server
    bool start();
    void stop();
    bool is_running() const;

    // Register a command handler
    // method: Command name (e.g., "scene.get", "camera.set")
    // handler: Function to handle the command
    void register_command(const std::string& method, CommandHandler handler);

    // Emit an event to all connected clients
    // event: Event name (e.g., "frame_rendered", "lua_error")
    // data: Event payload
    void emit_event(const std::string& event, const json& data);

    // Get the number of connected clients
    size_t client_count() const;

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};

} // namespace ascii
