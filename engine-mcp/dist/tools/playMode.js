// ═══════════════════════════════════════════════════════════════════════════
// PlayMode Tools - MCP tools for controlling and monitoring play mode
// Enables AI to play, test, and debug game scenes
// ═══════════════════════════════════════════════════════════════════════════
import WebSocket from 'ws';
// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Connection Manager
// ─────────────────────────────────────────────────────────────────────────────
class PlayModeBridgeClient {
    ws = null;
    port = 9847;
    messageId = 0;
    pendingRequests = new Map();
    connectionPromise = null;
    stateListeners = new Set();
    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`ws://localhost:${this.port}`);
                this.ws.on('open', () => {
                    console.log('[PlayModeBridgeClient] Connected to editor');
                    this.connectionPromise = null;
                    resolve();
                });
                this.ws.on('close', () => {
                    console.log('[PlayModeBridgeClient] Disconnected from editor');
                    this.ws = null;
                    this.connectionPromise = null;
                });
                this.ws.on('error', (error) => {
                    console.error('[PlayModeBridgeClient] Connection error:', error);
                    this.connectionPromise = null;
                    reject(error);
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    }
                    catch (error) {
                        console.error('[PlayModeBridgeClient] Failed to parse message:', error);
                    }
                });
            }
            catch (error) {
                this.connectionPromise = null;
                reject(error);
            }
        });
        return this.connectionPromise;
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    handleMessage(message) {
        if (message.id) {
            // Response to a request
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.success) {
                    pending.resolve(message.data);
                }
                else {
                    pending.reject(new Error(message.error || 'Unknown error'));
                }
            }
        }
        else if (message.type === 'state') {
            // State update
            for (const listener of this.stateListeners) {
                listener(message.data);
            }
        }
        else if (message.type === 'breakpointHit') {
            // Breakpoint hit notification
            console.log('[PlayModeBridgeClient] Breakpoint hit:', message);
        }
    }
    async send(type, payload) {
        await this.connect();
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to editor');
        }
        const id = `msg_${++this.messageId}`;
        const message = { id, type, ...payload };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve: resolve, reject });
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
            this.ws.send(JSON.stringify(message));
        });
    }
    onStateUpdate(listener) {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }
    isConnected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}
// Global client instance
const client = new PlayModeBridgeClient();
// ─────────────────────────────────────────────────────────────────────────────
// Control Tools
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Start play mode execution
 */
export async function startPlayMode() {
    const result = await client.send('command', { action: 'start' });
    return {
        status: result.status,
        isRunning: true,
        frameCount: 0,
        elapsedTime: 0,
    };
}
/**
 * Stop play mode execution
 * @param apply - If true, keep runtime changes instead of restoring snapshot
 */
export async function stopPlayMode(apply = false) {
    const result = await client.send('command', { action: 'stop', params: { apply } });
    return {
        status: result.status,
        isRunning: false,
        frameCount: 0,
        elapsedTime: 0,
    };
}
/**
 * Pause play mode execution
 */
export async function pausePlayMode() {
    const result = await client.send('command', { action: 'pause' });
    return {
        status: result.status,
        isRunning: true,
        frameCount: 0,
        elapsedTime: 0,
    };
}
/**
 * Resume play mode execution
 */
export async function resumePlayMode() {
    const result = await client.send('command', { action: 'resume' });
    return {
        status: result.status,
        isRunning: true,
        frameCount: 0,
        elapsedTime: 0,
    };
}
/**
 * Step forward by N frames (while paused)
 */
export async function stepFrame(count = 1) {
    return client.send('command', { action: 'step', params: { count } });
}
// ─────────────────────────────────────────────────────────────────────────────
// Query Tools
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get current play mode status
 */
export async function getPlayModeStatus() {
    return client.send('query', { target: 'status' });
}
/**
 * Get performance statistics
 */
export async function getPlayModeStats() {
    return client.send('query', { target: 'stats' });
}
/**
 * Get all entities in the scene
 */
export async function getEntities(filter) {
    const entities = await client.send('query', { target: 'entities', params: { filter } });
    // Apply filter if specified
    if (filter?.hasComponent) {
        return entities.filter(e => e.components.some(c => c.script === filter.hasComponent));
    }
    return entities;
}
/**
 * Get state of a specific entity
 */
export async function getEntityState(entityId) {
    try {
        return await client.send('query', { target: 'entity', params: { entityId } });
    }
    catch {
        return null;
    }
}
/**
 * Get recent game events
 */
export async function getRecentEvents(limit = 20) {
    return client.send('query', { target: 'events', params: { limit } });
}
/**
 * Get variable values
 */
export async function getVariables(scope) {
    return client.send('query', { target: 'variables', params: { scope } });
}
// ─────────────────────────────────────────────────────────────────────────────
// Input Injection Tools
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Inject a key press
 */
export async function injectKeyPress(key, modifiers) {
    await client.send('inject', { inputType: 'keydown', params: { key, modifiers } });
}
/**
 * Inject a key release
 */
export async function injectKeyRelease(key) {
    await client.send('inject', { inputType: 'keyup', params: { key } });
}
/**
 * Inject a full key tap (press + release with delay)
 */
export async function injectKeyTap(key, holdMs = 50) {
    await injectKeyPress(key);
    await new Promise(resolve => setTimeout(resolve, holdMs));
    await injectKeyRelease(key);
}
/**
 * Inject a mouse click
 */
export async function injectMouseClick(button, x, y) {
    await client.send('inject', { inputType: 'mousedown', params: { button, x, y } });
    await new Promise(resolve => setTimeout(resolve, 50));
    await client.send('inject', { inputType: 'mouseup', params: { button, x, y } });
}
/**
 * Inject mouse movement
 */
export async function injectMouseMove(x, y) {
    await client.send('inject', { inputType: 'mousemove', params: { x, y } });
}
// ─────────────────────────────────────────────────────────────────────────────
// Debugging Tools
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Set a breakpoint
 */
export async function setBreakpoint(config) {
    const result = await client.send('command', {
        action: 'setBreakpoint',
        params: config,
    });
    return result.id;
}
/**
 * Remove a breakpoint
 */
export async function removeBreakpoint(id) {
    await client.send('command', { action: 'removeBreakpoint', params: { id } });
}
/**
 * Get all breakpoints
 */
export async function getBreakpoints() {
    return client.send('query', { target: 'breakpoints' });
}
/**
 * Watch a variable for changes
 */
export async function watchVariable(path) {
    await client.send('command', { action: 'watchVariable', params: { path } });
}
/**
 * Evaluate an expression in the runtime context
 */
export async function evaluateExpression(expr) {
    return client.send('query', { target: 'evaluate', params: { expr } });
}
// ─────────────────────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Connect to the editor's play mode bridge
 */
export async function connectToEditor() {
    try {
        await client.connect();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Disconnect from the editor
 */
export function disconnectFromEditor() {
    client.disconnect();
}
/**
 * Check if connected to the editor
 */
export function isConnectedToEditor() {
    return client.isConnected();
}
/**
 * Subscribe to state updates
 */
export function onPlayModeStateUpdate(listener) {
    return client.onStateUpdate(listener);
}
