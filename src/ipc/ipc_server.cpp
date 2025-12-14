#include "ipc_server.hpp"

#include <ixwebsocket/IXWebSocketServer.h>
#include <ixwebsocket/IXNetSystem.h>
#include <spdlog/spdlog.h>

#include <mutex>
#include <set>

namespace ascii {

struct IPCServer::Impl {
    uint16_t port;
    ix::WebSocketServer server;
    std::unordered_map<std::string, CommandHandler> handlers;
    std::set<ix::WebSocket*> clients;
    std::mutex clients_mutex;
    bool running = false;

    Impl(uint16_t p) : port(p), server(p, "127.0.0.1") {
        // Disable address reuse to avoid Windows socket issues
        server.disablePerMessageDeflate();
    }

    void handle_message(ix::WebSocket& ws, const std::string& msg) {
        try {
            auto request = json::parse(msg);

            // Validate request format
            if (!request.contains("type") || request["type"] != "request") {
                send_error(ws, "", "Invalid message type");
                return;
            }

            std::string id = request.value("id", "");
            std::string method = request.value("method", "");
            json params = request.value("params", json::object());

            if (method.empty()) {
                send_error(ws, id, "Missing method");
                return;
            }

            // Find and call handler
            auto it = handlers.find(method);
            if (it == handlers.end()) {
                send_error(ws, id, "Unknown method: " + method);
                return;
            }

            try {
                json result = it->second(params);
                send_response(ws, id, true, result);
            } catch (const std::exception& e) {
                send_error(ws, id, e.what());
            }
        } catch (const json::parse_error& e) {
            spdlog::error("[IPC] JSON parse error: {}", e.what());
        }
    }

    void send_response(ix::WebSocket& ws, const std::string& id,
                       bool success, const json& data) {
        json response = {
            {"type", "response"},
            {"id", id},
            {"success", success}
        };
        if (success) {
            response["data"] = data;
        } else {
            response["error"] = data.get<std::string>();
        }
        ws.send(response.dump());
    }

    void send_error(ix::WebSocket& ws, const std::string& id,
                    const std::string& error) {
        json response = {
            {"type", "response"},
            {"id", id},
            {"success", false},
            {"error", error}
        };
        ws.send(response.dump());
    }

    void broadcast(const std::string& msg) {
        std::lock_guard<std::mutex> lock(clients_mutex);
        for (auto* client : clients) {
            if (client->getReadyState() == ix::ReadyState::Open) {
                client->send(msg);
            }
        }
    }
};

IPCServer::IPCServer(uint16_t port)
    : m_impl(std::make_unique<Impl>(port)) {
    // Initialize network system (required on Windows for Winsock)
    ix::initNetSystem();
}

IPCServer::~IPCServer() {
    stop();
    ix::uninitNetSystem();
}

bool IPCServer::start() {
    if (m_impl->running) {
        return true;
    }

    m_impl->server.setOnClientMessageCallback(
        [this](std::shared_ptr<ix::ConnectionState> connectionState,
               ix::WebSocket& webSocket,
               const ix::WebSocketMessagePtr& msg) {

            if (msg->type == ix::WebSocketMessageType::Open) {
                spdlog::info("[IPC] Client connected from {}", connectionState->getRemoteIp());
                {
                    std::lock_guard<std::mutex> lock(m_impl->clients_mutex);
                    m_impl->clients.insert(&webSocket);
                }
            }
            else if (msg->type == ix::WebSocketMessageType::Close) {
                spdlog::info("[IPC] Client disconnected");
                {
                    std::lock_guard<std::mutex> lock(m_impl->clients_mutex);
                    m_impl->clients.erase(&webSocket);
                }
            }
            else if (msg->type == ix::WebSocketMessageType::Message) {
                m_impl->handle_message(webSocket, msg->str);
            }
            else if (msg->type == ix::WebSocketMessageType::Error) {
                spdlog::error("[IPC] WebSocket error: {}", msg->errorInfo.reason);
            }
        }
    );

    auto result = m_impl->server.listen();
    if (!result.first) {
        spdlog::error("[IPC] Failed to start server on port {}: {}",
                      m_impl->port, result.second);
        return false;
    }

    m_impl->server.start();
    m_impl->running = true;

    spdlog::info("[IPC] Server started on ws://127.0.0.1:{}", m_impl->port);
    return true;
}

void IPCServer::stop() {
    if (!m_impl->running) {
        return;
    }

    m_impl->server.stop();
    m_impl->running = false;

    {
        std::lock_guard<std::mutex> lock(m_impl->clients_mutex);
        m_impl->clients.clear();
    }

    spdlog::info("[IPC] Server stopped");
}

bool IPCServer::is_running() const {
    return m_impl->running;
}

void IPCServer::register_command(const std::string& method, CommandHandler handler) {
    m_impl->handlers[method] = std::move(handler);
    spdlog::debug("[IPC] Registered command: {}", method);
}

void IPCServer::emit_event(const std::string& event, const json& data) {
    json message = {
        {"type", "event"},
        {"event", event},
        {"data", data}
    };
    m_impl->broadcast(message.dump());
}

size_t IPCServer::client_count() const {
    std::lock_guard<std::mutex> lock(m_impl->clients_mutex);
    return m_impl->clients.size();
}

} // namespace ascii
