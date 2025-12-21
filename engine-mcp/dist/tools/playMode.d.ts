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
/**
 * Start play mode execution
 */
export declare function startPlayMode(): Promise<PlayModeState>;
/**
 * Stop play mode execution
 * @param apply - If true, keep runtime changes instead of restoring snapshot
 */
export declare function stopPlayMode(apply?: boolean): Promise<PlayModeState>;
/**
 * Pause play mode execution
 */
export declare function pausePlayMode(): Promise<PlayModeState>;
/**
 * Resume play mode execution
 */
export declare function resumePlayMode(): Promise<PlayModeState>;
/**
 * Step forward by N frames (while paused)
 */
export declare function stepFrame(count?: number): Promise<{
    stepped: number;
}>;
/**
 * Get current play mode status
 */
export declare function getPlayModeStatus(): Promise<PlayModeState>;
/**
 * Get performance statistics
 */
export declare function getPlayModeStats(): Promise<PlayModeStats>;
/**
 * Get all entities in the scene
 */
export declare function getEntities(filter?: {
    hasComponent?: string;
}): Promise<EntityState[]>;
/**
 * Get state of a specific entity
 */
export declare function getEntityState(entityId: string): Promise<EntityState | null>;
/**
 * Get recent game events
 */
export declare function getRecentEvents(limit?: number): Promise<GameEvent[]>;
/**
 * Get variable values
 */
export declare function getVariables(scope?: 'global' | 'scene'): Promise<Record<string, unknown>>;
/**
 * Inject a key press
 */
export declare function injectKeyPress(key: string, modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
}): Promise<void>;
/**
 * Inject a key release
 */
export declare function injectKeyRelease(key: string): Promise<void>;
/**
 * Inject a full key tap (press + release with delay)
 */
export declare function injectKeyTap(key: string, holdMs?: number): Promise<void>;
/**
 * Inject a mouse click
 */
export declare function injectMouseClick(button: number, x: number, y: number): Promise<void>;
/**
 * Inject mouse movement
 */
export declare function injectMouseMove(x: number, y: number): Promise<void>;
/**
 * Set a breakpoint
 */
export declare function setBreakpoint(config: BreakpointConfig): Promise<string>;
/**
 * Remove a breakpoint
 */
export declare function removeBreakpoint(id: string): Promise<void>;
/**
 * Get all breakpoints
 */
export declare function getBreakpoints(): Promise<Breakpoint[]>;
/**
 * Watch a variable for changes
 */
export declare function watchVariable(path: string): Promise<void>;
/**
 * Evaluate an expression in the runtime context
 */
export declare function evaluateExpression(expr: string): Promise<unknown>;
/**
 * Connect to the editor's play mode bridge
 */
export declare function connectToEditor(): Promise<boolean>;
/**
 * Disconnect from the editor
 */
export declare function disconnectFromEditor(): void;
/**
 * Check if connected to the editor
 */
export declare function isConnectedToEditor(): boolean;
/**
 * Subscribe to state updates
 */
export declare function onPlayModeStateUpdate(listener: (state: unknown) => void): () => void;
