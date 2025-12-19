// ═══════════════════════════════════════════════════════════════════════════
// Triple-Phase Event System
// Events flow through Before → Execute → After phases with cancellation support
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EventPhase = 'before' | 'execute' | 'after'

export type EventRouting =
  | 'local'      // Node only - no propagation
  | 'bubble'     // Node → Parent → ... → Scene Root (default)
  | 'capture'    // Scene Root → ... → Parent → Node (then Bubble)
  | 'broadcast'  // Node → All descendants (depth-first)
  | 'direct'     // Send to specific node by reference
  | 'bus'        // Global pub/sub channel (decoupled)

export interface NodeRef {
  id: string
  path?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// GameEvent Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface GameEvent<T = unknown> {
  // ─── Identity ───
  readonly type: string
  readonly timestamp: number
  readonly id: string
  readonly source: NodeRef

  // ─── Payload ───
  data: T
  result?: unknown
  error?: Error

  // ─── Flow Control ───
  cancelled: boolean
  cancel(): void

  // ─── Propagation ───
  propagationStopped: boolean
  stopPropagation(): void
  immediatePropagationStopped: boolean
  stopImmediatePropagation(): void

  // ─── Phase Tracking ───
  readonly phase: EventPhase

  // ─── Metadata ───
  readonly bubbles: boolean
  readonly cancelable: boolean
  readonly routing: EventRouting
}

// ─────────────────────────────────────────────────────────────────────────────
// GameEvent Implementation
// ─────────────────────────────────────────────────────────────────────────────

let eventIdCounter = 0

export interface CreateEventOptions<T> {
  type: string
  source: NodeRef
  data: T
  bubbles?: boolean
  cancelable?: boolean
  routing?: EventRouting
}

export function createGameEvent<T>(options: CreateEventOptions<T>): GameEvent<T> {
  const {
    type,
    source,
    data,
    bubbles = true,
    cancelable = true,
    routing = 'bubble',
  } = options

  let _cancelled = false
  let _propagationStopped = false
  let _immediatePropagationStopped = false
  let _phase: EventPhase = 'before'
  let _result: unknown = undefined
  let _error: Error | undefined = undefined
  let _data = data

  const event: GameEvent<T> = {
    // Identity
    type,
    timestamp: Date.now(),
    id: `evt_${++eventIdCounter}_${type}`,
    source,

    // Payload (with getter/setter for data)
    get data() { return _data },
    set data(value: T) {
      if (_phase === 'before') {
        _data = value
      } else {
        console.warn(`[Event] Cannot modify data outside 'before' phase`)
      }
    },
    get result() { return _result },
    set result(value: unknown) { _result = value },
    get error() { return _error },
    set error(value: Error | undefined) { _error = value },

    // Flow Control
    get cancelled() { return _cancelled },
    set cancelled(value: boolean) { _cancelled = value },
    cancel() {
      if (!cancelable) {
        console.warn(`[Event] Event '${type}' is not cancelable`)
        return
      }
      if (_phase !== 'before') {
        console.warn(`[Event] Can only cancel during 'before' phase`)
        return
      }
      _cancelled = true
    },

    // Propagation
    get propagationStopped() { return _propagationStopped },
    stopPropagation() { _propagationStopped = true },
    get immediatePropagationStopped() { return _immediatePropagationStopped },
    stopImmediatePropagation() {
      _propagationStopped = true
      _immediatePropagationStopped = true
    },

    // Phase Tracking
    get phase() { return _phase },

    // Metadata
    bubbles,
    cancelable,
    routing,
  }

  // Internal method to advance phase (not exposed on interface)
  ;(event as GameEventInternal<T>)._setPhase = (phase: EventPhase) => {
    _phase = phase
  }

  return event
}

// Internal interface for phase management
interface GameEventInternal<T> extends GameEvent<T> {
  _setPhase(phase: EventPhase): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handler Types
// ─────────────────────────────────────────────────────────────────────────────

export type EventHandler<T = unknown> = (event: GameEvent<T>) => void | Promise<void>

export interface HandlerRegistration {
  eventType: string
  phase: EventPhase
  handler: EventHandler
  nodeId?: string // If undefined, listens to all events of this type
  priority: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Triple-Phase Event Bus
// ─────────────────────────────────────────────────────────────────────────────

export class TriplePhaseEventBus {
  private handlers: Map<string, HandlerRegistration[]> = new Map()
  private nodeHierarchy: Map<string, string | null> = new Map() // nodeId -> parentId

  /**
   * Register a node's parent for event bubbling
   */
  setNodeParent(nodeId: string, parentId: string | null): void {
    this.nodeHierarchy.set(nodeId, parentId)
  }

  /**
   * Remove a node from the hierarchy
   */
  removeNode(nodeId: string): void {
    this.nodeHierarchy.delete(nodeId)
    // Remove all handlers for this node
    for (const [key, handlers] of this.handlers) {
      this.handlers.set(key, handlers.filter(h => h.nodeId !== nodeId))
    }
  }

  /**
   * Get parent chain for bubbling (bottom-up)
   */
  getAncestors(nodeId: string): string[] {
    const ancestors: string[] = []
    let current = this.nodeHierarchy.get(nodeId)
    while (current) {
      ancestors.push(current)
      current = this.nodeHierarchy.get(current)
    }
    return ancestors
  }

  /**
   * Subscribe to an event phase
   */
  on<T = unknown>(
    eventType: string,
    phase: EventPhase,
    handler: EventHandler<T>,
    options?: { nodeId?: string; priority?: number }
  ): () => void {
    const key = `${eventType}:${phase}`
    const registration: HandlerRegistration = {
      eventType,
      phase,
      handler: handler as EventHandler,
      nodeId: options?.nodeId,
      priority: options?.priority ?? 0,
    }

    if (!this.handlers.has(key)) {
      this.handlers.set(key, [])
    }

    const handlers = this.handlers.get(key)!
    handlers.push(registration)
    // Sort by priority (higher first)
    handlers.sort((a, b) => b.priority - a.priority)

    // Return unsubscribe function
    return () => {
      const idx = handlers.indexOf(registration)
      if (idx !== -1) {
        handlers.splice(idx, 1)
      }
    }
  }

  /**
   * Shorthand for subscribing to all three phases
   */
  onAll<T = unknown>(
    eventType: string,
    handlers: {
      before?: EventHandler<T>
      execute?: EventHandler<T>
      after?: EventHandler<T>
    },
    options?: { nodeId?: string; priority?: number }
  ): () => void {
    const unsubs: (() => void)[] = []
    if (handlers.before) {
      unsubs.push(this.on(eventType, 'before', handlers.before, options))
    }
    if (handlers.execute) {
      unsubs.push(this.on(eventType, 'execute', handlers.execute, options))
    }
    if (handlers.after) {
      unsubs.push(this.on(eventType, 'after', handlers.after, options))
    }
    return () => unsubs.forEach(fn => fn())
  }

  /**
   * Emit an event through the triple-phase pipeline
   */
  async emit<T>(event: GameEvent<T>): Promise<GameEvent<T>> {
    const internal = event as GameEventInternal<T>

    // Phase 1: BEFORE
    internal._setPhase('before')
    await this.runPhase(event, 'before')

    // Phase 2: EXECUTE (skipped if cancelled)
    if (!event.cancelled) {
      internal._setPhase('execute')
      try {
        await this.runPhase(event, 'execute')
      } catch (err) {
        event.error = err instanceof Error ? err : new Error(String(err))
      }
    }

    // Phase 3: AFTER (always runs unless node disposed)
    internal._setPhase('after')
    await this.runPhase(event, 'after')

    return event
  }

  /**
   * Synchronous emit (for performance-critical paths)
   */
  emitSync<T>(event: GameEvent<T>): GameEvent<T> {
    const internal = event as GameEventInternal<T>

    // Phase 1: BEFORE
    internal._setPhase('before')
    this.runPhaseSync(event, 'before')

    // Phase 2: EXECUTE (skipped if cancelled)
    if (!event.cancelled) {
      internal._setPhase('execute')
      try {
        this.runPhaseSync(event, 'execute')
      } catch (err) {
        event.error = err instanceof Error ? err : new Error(String(err))
      }
    }

    // Phase 3: AFTER
    internal._setPhase('after')
    this.runPhaseSync(event, 'after')

    return event
  }

  /**
   * Run handlers for a specific phase
   */
  private async runPhase<T>(event: GameEvent<T>, phase: EventPhase): Promise<void> {
    const sourceId = event.source.id

    // Run handlers per-node to properly respect stopPropagation
    await this.runHandlersForNode(event, phase, sourceId)

    // If bubbling and not stopped, run on ancestors
    if (event.routing === 'bubble' && event.bubbles && !event.propagationStopped) {
      for (const ancestorId of this.getAncestors(sourceId)) {
        if (event.propagationStopped) break
        await this.runHandlersForNode(event, phase, ancestorId)
      }
    }

    // For bus routing, run all handlers
    if (event.routing === 'bus') {
      const key = `${event.type}:${phase}`
      const allHandlers = this.handlers.get(key) || []
      for (const registration of allHandlers) {
        if (event.immediatePropagationStopped) break
        if (registration.nodeId !== sourceId) { // Skip source (already handled)
          try {
            await registration.handler(event)
          } catch (err) {
            console.error(`[EventBus] Error in ${phase}:${event.type} handler:`, err)
            if (phase === 'execute') throw err
          }
        }
      }
    }
  }

  /**
   * Run handlers for a specific node
   */
  private async runHandlersForNode<T>(
    event: GameEvent<T>,
    phase: EventPhase,
    nodeId: string
  ): Promise<void> {
    const key = `${event.type}:${phase}`
    const allHandlers = this.handlers.get(key) || []

    // Get handlers for this specific node + global handlers
    const nodeHandlers = allHandlers.filter(h =>
      h.nodeId === nodeId || (h.nodeId === undefined && nodeId === event.source.id)
    ).sort((a, b) => b.priority - a.priority)

    for (const registration of nodeHandlers) {
      if (event.immediatePropagationStopped) break

      try {
        await registration.handler(event)
      } catch (err) {
        console.error(`[EventBus] Error in ${phase}:${event.type} handler:`, err)
        if (phase === 'execute') throw err
      }
    }
  }

  /**
   * Run handlers synchronously
   */
  private runPhaseSync<T>(event: GameEvent<T>, phase: EventPhase): void {
    const sourceId = event.source.id

    // Run handlers per-node to properly respect stopPropagation
    this.runHandlersForNodeSync(event, phase, sourceId)

    // If bubbling and not stopped, run on ancestors
    if (event.routing === 'bubble' && event.bubbles && !event.propagationStopped) {
      for (const ancestorId of this.getAncestors(sourceId)) {
        if (event.propagationStopped) break
        this.runHandlersForNodeSync(event, phase, ancestorId)
      }
    }

    // For bus routing, run all handlers
    if (event.routing === 'bus') {
      const key = `${event.type}:${phase}`
      const allHandlers = this.handlers.get(key) || []
      for (const registration of allHandlers) {
        if (event.immediatePropagationStopped) break
        if (registration.nodeId !== sourceId) {
          try {
            const result = registration.handler(event)
            if (result instanceof Promise) {
              console.warn(`[EventBus] Async handler called in sync emit for ${event.type}`)
            }
          } catch (err) {
            console.error(`[EventBus] Error in ${phase}:${event.type} handler:`, err)
            if (phase === 'execute') throw err
          }
        }
      }
    }
  }

  /**
   * Run handlers for a specific node synchronously
   */
  private runHandlersForNodeSync<T>(
    event: GameEvent<T>,
    phase: EventPhase,
    nodeId: string
  ): void {
    const key = `${event.type}:${phase}`
    const allHandlers = this.handlers.get(key) || []

    const nodeHandlers = allHandlers.filter(h =>
      h.nodeId === nodeId || (h.nodeId === undefined && nodeId === event.source.id)
    ).sort((a, b) => b.priority - a.priority)

    for (const registration of nodeHandlers) {
      if (event.immediatePropagationStopped) break

      try {
        const result = registration.handler(event)
        if (result instanceof Promise) {
          console.warn(`[EventBus] Async handler called in sync emit for ${event.type}`)
        }
      } catch (err) {
        console.error(`[EventBus] Error in ${phase}:${event.type} handler:`, err)
        if (phase === 'execute') throw err
      }
    }
  }

  /**
   * Get handlers that should fire for an event, considering routing
   */
  private getHandlersForEvent<T>(event: GameEvent<T>, phase: EventPhase): HandlerRegistration[] {
    const key = `${event.type}:${phase}`
    const allHandlers = this.handlers.get(key) || []
    const result: HandlerRegistration[] = []

    const sourceId = event.source.id

    switch (event.routing) {
      case 'local':
        // Only handlers for the source node
        result.push(...allHandlers.filter(h => h.nodeId === sourceId || h.nodeId === undefined))
        break

      case 'bubble':
        // Source node, then ancestors
        result.push(...allHandlers.filter(h => h.nodeId === sourceId || h.nodeId === undefined))
        if (event.bubbles && !event.propagationStopped) {
          for (const ancestorId of this.getAncestors(sourceId)) {
            if (event.propagationStopped) break
            result.push(...allHandlers.filter(h => h.nodeId === ancestorId))
          }
        }
        break

      case 'bus':
        // All handlers regardless of node
        result.push(...allHandlers)
        break

      default:
        // Default to local + global handlers
        result.push(...allHandlers.filter(h => h.nodeId === sourceId || h.nodeId === undefined))
    }

    // Sort by priority
    return result.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear()
    this.nodeHierarchy.clear()
  }

  /**
   * Get handler count for debugging
   */
  getHandlerCount(eventType?: string, phase?: EventPhase): number {
    if (eventType && phase) {
      return this.handlers.get(`${eventType}:${phase}`)?.length ?? 0
    }
    let total = 0
    for (const handlers of this.handlers.values()) {
      total += handlers.length
    }
    return total
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const GameEventBus = new TriplePhaseEventBus()
