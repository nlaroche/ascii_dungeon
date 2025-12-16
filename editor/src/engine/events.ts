// ═══════════════════════════════════════════════════════════════════════════
// Engine Events - Type-safe event system for engine communication
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Transform } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Event Payload Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EventPayloads {
  // Selection events
  'selection:changed': { nodeIds: string[]; previousIds: string[] }
  'selection:hover': { nodeId: string | null; previousId: string | null }

  // Transform events
  'transform:started': { nodeId: string; transform: Transform }
  'transform:updated': { nodeId: string; transform: Transform; delta: Partial<Transform> }
  'transform:ended': { nodeId: string; transform: Transform }

  // Scene events
  'scene:nodeAdded': { node: Node; parentId: string }
  'scene:nodeRemoved': { nodeId: string; parentId: string }
  'scene:nodeUpdated': { nodeId: string; changes: Partial<Node> }
  'scene:loaded': { sceneName: string }
  'scene:saved': { sceneName: string; path: string }

  // Tool events
  'tool:changed': { toolId: string; previousId: string }
  'tool:activated': { toolId: string }

  // Gizmo events
  'gizmo:dragStart': { axis: string; nodeId: string }
  'gizmo:dragUpdate': { axis: string; delta: [number, number, number] }
  'gizmo:dragEnd': { axis: string; nodeId: string }
  'gizmo:hover': { axis: string | null }

  // Input events
  'input:keyDown': { key: string; ctrl: boolean; shift: boolean; alt: boolean }
  'input:keyUp': { key: string }
  'input:mouseDown': { button: number; x: number; y: number }
  'input:mouseUp': { button: number; x: number; y: number }
  'input:mouseMove': { x: number; y: number; dx: number; dy: number }
  'input:wheel': { delta: number; x: number; y: number }

  // Camera events
  'camera:moved': { position: [number, number, number] }
  'camera:rotated': { rotation: [number, number, number] }
  'camera:modeChanged': { mode: string }

  // Component events
  'component:added': { nodeId: string; componentId: string; type: string }
  'component:removed': { nodeId: string; componentId: string }
  'component:propertyChanged': { nodeId: string; componentId: string; key: string; value: unknown }

  // Engine events
  'engine:started': Record<string, never>
  'engine:stopped': Record<string, never>
  'engine:error': { error: Error; source: string }
}

export type EngineEvent = keyof EventPayloads

// ─────────────────────────────────────────────────────────────────────────────
// Event Bus
// ─────────────────────────────────────────────────────────────────────────────

type EventCallback<E extends EngineEvent> = (payload: EventPayloads[E]) => void

class EventBusImpl {
  private listeners: Map<string, Set<EventCallback<EngineEvent>>> = new Map()

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on<E extends EngineEvent>(event: E, callback: EventCallback<E>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback<EngineEvent>)

    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<EngineEvent>)
    }
  }

  /**
   * Subscribe to an event (one-time)
   */
  once<E extends EngineEvent>(event: E, callback: EventCallback<E>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe()
      callback(payload)
    })
    return unsubscribe
  }

  /**
   * Emit an event
   */
  emit<E extends EngineEvent>(event: E, payload: EventPayloads[E]): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return

    for (const callback of callbacks) {
      try {
        callback(payload)
      } catch (e) {
        console.error(`[EventBus] Error in '${event}' handler:`, e)
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  off<E extends EngineEvent>(event: E): void {
    this.listeners.delete(event)
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear()
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: EngineEvent): number {
    return this.listeners.get(event)?.size ?? 0
  }
}

// Global event bus instance
export const EventBus = new EventBusImpl()
