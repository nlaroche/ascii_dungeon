// ═══════════════════════════════════════════════════════════════════════════
// PlayMode Tools - MCP tools for controlling and monitoring play mode
// Enables AI to play, test, and debug game scenes
// ═══════════════════════════════════════════════════════════════════════════

import WebSocket from 'ws';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PlayModeStatus = 'stopped' | 'playing' | 'paused';

export interface PlayModeState {
  status: PlayModeStatus;
  isRunning: boolean;
  frameCount: number;
  elapsedTime: number;
}

export interface PlayModeStats {
  fps: number;
  frameTime: number;
  entityCount: number;
  componentCount: number;
  behaviorCount: number;
}

export interface EntityState {
  id: string;
  name: string;
  position: [number, number, number];
  components: Array<{
    id: string;
    script: string;
    enabled: boolean;
    properties: Record<string, unknown>;
  }>;
}

export interface GameEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface BreakpointConfig {
  type: 'event' | 'frame' | 'variable';
  eventType?: string;
  frameNumber?: number;
  variableName?: string;
  condition?: string;
}

export interface Breakpoint extends BreakpointConfig {
  id: string;
  enabled: boolean;
  hitCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Connection Manager
// ─────────────────────────────────────────────────────────────────────────────

class PlayModeBridgeClient {
  private ws: WebSocket | null = null;
  private port: number = 9847;
  private messageId: number = 0;
  private pendingRequests: Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void }> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private stateListeners: Set<(state: unknown) => void> = new Set();

  async connect(): Promise<void> {
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
          } catch (error) {
            console.error('[PlayModeBridgeClient] Failed to parse message:', error);
          }
        });
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(message: { id?: string; type?: string; success?: boolean; data?: unknown; error?: string }): void {
    if (message.id) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.success) {
          pending.resolve(message.data);
        } else {
          pending.reject(new Error(message.error || 'Unknown error'));
        }
      }
    } else if (message.type === 'state') {
      // State update
      for (const listener of this.stateListeners) {
        listener(message.data);
      }
    } else if (message.type === 'breakpointHit') {
      // Breakpoint hit notification
      console.log('[PlayModeBridgeClient] Breakpoint hit:', message);
    }
  }

  async send<T>(type: 'command' | 'query' | 'inject', payload: Record<string, unknown>): Promise<T> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to editor');
    }

    const id = `msg_${++this.messageId}`;
    const message = { id, type, ...payload };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (data: unknown) => void, reject });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      this.ws!.send(JSON.stringify(message));
    });
  }

  onStateUpdate(listener: (state: unknown) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  isConnected(): boolean {
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
export async function startPlayMode(): Promise<PlayModeState> {
  const result = await client.send<{ status: string }>('command', { action: 'start' });
  return {
    status: result.status as PlayModeStatus,
    isRunning: true,
    frameCount: 0,
    elapsedTime: 0,
  };
}

/**
 * Stop play mode execution
 * @param apply - If true, keep runtime changes instead of restoring snapshot
 */
export async function stopPlayMode(apply: boolean = false): Promise<PlayModeState> {
  const result = await client.send<{ status: string }>('command', { action: 'stop', params: { apply } });
  return {
    status: result.status as PlayModeStatus,
    isRunning: false,
    frameCount: 0,
    elapsedTime: 0,
  };
}

/**
 * Pause play mode execution
 */
export async function pausePlayMode(): Promise<PlayModeState> {
  const result = await client.send<{ status: string }>('command', { action: 'pause' });
  return {
    status: result.status as PlayModeStatus,
    isRunning: true,
    frameCount: 0,
    elapsedTime: 0,
  };
}

/**
 * Resume play mode execution
 */
export async function resumePlayMode(): Promise<PlayModeState> {
  const result = await client.send<{ status: string }>('command', { action: 'resume' });
  return {
    status: result.status as PlayModeStatus,
    isRunning: true,
    frameCount: 0,
    elapsedTime: 0,
  };
}

/**
 * Step forward by N frames (while paused)
 */
export async function stepFrame(count: number = 1): Promise<{ stepped: number }> {
  return client.send<{ stepped: number }>('command', { action: 'step', params: { count } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current play mode status
 */
export async function getPlayModeStatus(): Promise<PlayModeState> {
  return client.send<PlayModeState>('query', { target: 'status' });
}

/**
 * Get performance statistics
 */
export async function getPlayModeStats(): Promise<PlayModeStats> {
  return client.send<PlayModeStats>('query', { target: 'stats' });
}

/**
 * Get all entities in the scene
 */
export async function getEntities(filter?: { hasComponent?: string }): Promise<EntityState[]> {
  const entities = await client.send<EntityState[]>('query', { target: 'entities', params: { filter } });

  // Apply filter if specified
  if (filter?.hasComponent) {
    return entities.filter(e =>
      e.components.some(c => c.script === filter.hasComponent)
    );
  }

  return entities;
}

/**
 * Get state of a specific entity
 */
export async function getEntityState(entityId: string): Promise<EntityState | null> {
  try {
    return await client.send<EntityState>('query', { target: 'entity', params: { entityId } });
  } catch {
    return null;
  }
}

/**
 * Get recent game events
 */
export async function getRecentEvents(limit: number = 20): Promise<GameEvent[]> {
  return client.send<GameEvent[]>('query', { target: 'events', params: { limit } });
}

/**
 * Get variable values
 */
export async function getVariables(scope?: 'global' | 'scene'): Promise<Record<string, unknown>> {
  return client.send<Record<string, unknown>>('query', { target: 'variables', params: { scope } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Injection Tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject a key press
 */
export async function injectKeyPress(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }): Promise<void> {
  await client.send('inject', { inputType: 'keydown', params: { key, modifiers } });
}

/**
 * Inject a key release
 */
export async function injectKeyRelease(key: string): Promise<void> {
  await client.send('inject', { inputType: 'keyup', params: { key } });
}

/**
 * Inject a full key tap (press + release with delay)
 */
export async function injectKeyTap(key: string, holdMs: number = 50): Promise<void> {
  await injectKeyPress(key);
  await new Promise(resolve => setTimeout(resolve, holdMs));
  await injectKeyRelease(key);
}

/**
 * Inject a mouse click
 */
export async function injectMouseClick(button: number, x: number, y: number): Promise<void> {
  await client.send('inject', { inputType: 'mousedown', params: { button, x, y } });
  await new Promise(resolve => setTimeout(resolve, 50));
  await client.send('inject', { inputType: 'mouseup', params: { button, x, y } });
}

/**
 * Inject mouse movement
 */
export async function injectMouseMove(x: number, y: number): Promise<void> {
  await client.send('inject', { inputType: 'mousemove', params: { x, y } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Debugging Tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a breakpoint
 */
export async function setBreakpoint(config: BreakpointConfig): Promise<string> {
  const result = await client.send<{ id: string }>('command', {
    action: 'setBreakpoint',
    params: config,
  });
  return result.id;
}

/**
 * Remove a breakpoint
 */
export async function removeBreakpoint(id: string): Promise<void> {
  await client.send('command', { action: 'removeBreakpoint', params: { id } });
}

/**
 * Get all breakpoints
 */
export async function getBreakpoints(): Promise<Breakpoint[]> {
  return client.send<Breakpoint[]>('query', { target: 'breakpoints' });
}

/**
 * Watch a variable for changes
 */
export async function watchVariable(path: string): Promise<void> {
  await client.send('command', { action: 'watchVariable', params: { path } });
}

/**
 * Evaluate an expression in the runtime context
 */
export async function evaluateExpression(expr: string): Promise<unknown> {
  return client.send<unknown>('query', { target: 'evaluate', params: { expr } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connect to the editor's play mode bridge
 */
export async function connectToEditor(): Promise<boolean> {
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Disconnect from the editor
 */
export function disconnectFromEditor(): void {
  client.disconnect();
}

/**
 * Check if connected to the editor
 */
export function isConnectedToEditor(): boolean {
  return client.isConnected();
}

/**
 * Subscribe to state updates
 */
export function onPlayModeStateUpdate(listener: (state: unknown) => void): () => void {
  return client.onStateUpdate(listener);
}
