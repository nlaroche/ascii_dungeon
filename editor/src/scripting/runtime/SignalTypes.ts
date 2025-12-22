// ═══════════════════════════════════════════════════════════════════════════
// SignalTypes - Extensible signal type system
// Allows different behaviors for how signals are emitted and processed
// ═══════════════════════════════════════════════════════════════════════════

import { GameEvent, createGameEvent, GameEventBus, type EventPhase } from './events'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options passed when emitting a signal
 */
export interface SignalEmitOptions {
  /** Signal type (defaults to 'instant') */
  type?: string
  /** Duration in ms (for timed signals) */
  duration?: number
  /** Additional type-specific options */
  [key: string]: unknown
}

/**
 * Data included in signal events
 */
export interface SignalEventData<T = unknown> {
  /** Original payload */
  payload: T
  /** Normalized progress 0-1 (for timed signals) */
  t: number
  /** Signal type that emitted this */
  signalType: string
  /** Duration in ms (0 for instant) */
  duration: number
}

/**
 * Context for signal type emission
 */
export interface SignalEmitContext {
  /** The event bus to emit on */
  bus: typeof GameEventBus
  /** Event type name */
  eventType: string
  /** Source node reference */
  source: { type: string; id: string }
  /** User payload */
  payload: unknown
  /** Emit options */
  options: SignalEmitOptions
}

/**
 * Active timed signal being processed
 */
export interface ActiveTimedSignal {
  id: string
  eventType: string
  source: { type: string; id: string }
  payload: unknown
  duration: number
  elapsed: number
  startTime: number
}

/**
 * SignalType interface - implement to create custom signal behaviors
 */
export interface SignalType {
  /** Unique name for this signal type */
  readonly name: string

  /** Description for UI/docs */
  readonly description: string

  /**
   * Emit the signal. Called when emit() is invoked with this type.
   * For instant signals, fire all phases immediately.
   * For timed signals, fire 'before' and register for updates.
   */
  emit(ctx: SignalEmitContext): void

  /**
   * Called every frame for active signals (timed, repeating, etc.)
   * Return false when the signal is complete.
   */
  update?(signal: ActiveTimedSignal, deltaTime: number): boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Type Registry
// ─────────────────────────────────────────────────────────────────────────────

class SignalTypeRegistryClass {
  private types: Map<string, SignalType> = new Map()
  private activeSignals: Map<string, ActiveTimedSignal> = new Map()
  private signalIdCounter = 0

  /**
   * Register a signal type
   */
  register(type: SignalType): void {
    if (this.types.has(type.name)) {
      console.warn(`[SignalTypes] Overwriting signal type: ${type.name}`)
    }
    this.types.set(type.name, type)
    console.log(`[SignalTypes] Registered: ${type.name}`)
  }

  /**
   * Get a signal type by name
   */
  get(name: string): SignalType | undefined {
    return this.types.get(name)
  }

  /**
   * Check if a signal type exists
   */
  has(name: string): boolean {
    return this.types.has(name)
  }

  /**
   * Get all registered type names
   */
  getTypeNames(): string[] {
    return Array.from(this.types.keys())
  }

  /**
   * Emit a signal using the specified type
   */
  emit(
    eventType: string,
    payload: unknown,
    source: { type: string; id: string },
    options: SignalEmitOptions = {}
  ): string {
    const typeName = options.type || 'instant'
    const signalType = this.types.get(typeName)

    if (!signalType) {
      console.error(`[SignalTypes] Unknown signal type: ${typeName}`)
      return ''
    }

    const signalId = `sig_${++this.signalIdCounter}`

    signalType.emit({
      bus: GameEventBus,
      eventType,
      source,
      payload,
      options: { ...options, signalId }
    })

    return signalId
  }

  /**
   * Register an active timed signal for frame updates
   */
  registerActiveSignal(signal: ActiveTimedSignal): void {
    this.activeSignals.set(signal.id, signal)
  }

  /**
   * Remove an active signal
   */
  removeActiveSignal(id: string): void {
    this.activeSignals.delete(id)
  }

  /**
   * Update all active signals (call every frame)
   */
  update(deltaTime: number): void {
    for (const [id, signal] of this.activeSignals) {
      const typeName = 'timed' // Active signals are always timed
      const signalType = this.types.get(typeName)

      if (signalType?.update) {
        const stillActive = signalType.update(signal, deltaTime)
        if (!stillActive) {
          this.activeSignals.delete(id)
        }
      }
    }
  }

  /**
   * Check if any signals are active
   */
  hasActiveSignals(): boolean {
    return this.activeSignals.size > 0
  }

  /**
   * Get count of active signals
   */
  getActiveSignalCount(): number {
    return this.activeSignals.size
  }

  /**
   * Clear all active signals (e.g., when stopping play mode)
   */
  clearActiveSignals(): void {
    this.activeSignals.clear()
  }

  /**
   * Reset the registry
   */
  reset(): void {
    this.activeSignals.clear()
    this.signalIdCounter = 0
  }
}

export const SignalTypeRegistry = new SignalTypeRegistryClass()

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Signal Type: Instant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Instant signal - fires all three phases immediately
 * This is the default signal behavior
 */
export const InstantSignalType: SignalType = {
  name: 'instant',
  description: 'Fires all phases (before, execute, after) immediately',

  emit(ctx: SignalEmitContext): void {
    const eventData: SignalEventData = {
      payload: ctx.payload,
      t: 1, // Instant = complete
      signalType: 'instant',
      duration: 0
    }

    // Fire all three phases synchronously
    const phases: EventPhase[] = ['before', 'execute', 'after']

    for (const phase of phases) {
      const event = createGameEvent({
        type: ctx.eventType,
        source: ctx.source,
        data: { ...eventData, phase },
        routing: 'bus'
      })

      // Set phase on the event
      ;(event as any)._setPhase?.(phase)

      GameEventBus.emitSync(event)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Signal Type: Timed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Timed signal - animates over a duration
 * - 'before' fires once at t=0
 * - 'execute' fires every frame with t going 0→1
 * - 'after' fires once at t=1
 */
export const TimedSignalType: SignalType = {
  name: 'timed',
  description: 'Animates over duration with t progressing 0→1',

  emit(ctx: SignalEmitContext): void {
    const duration = (ctx.options.duration as number) || 0
    const signalId = (ctx.options.signalId as string) || `sig_${Date.now()}`

    // If duration is 0, behave like instant
    if (duration <= 0) {
      InstantSignalType.emit(ctx)
      return
    }

    // Fire 'before' phase immediately
    const beforeData: SignalEventData = {
      payload: ctx.payload,
      t: 0,
      signalType: 'timed',
      duration
    }

    const beforeEvent = createGameEvent({
      type: ctx.eventType,
      source: ctx.source,
      data: { ...beforeData, phase: 'before' },
      routing: 'bus'
    })
    ;(beforeEvent as any)._setPhase?.('before')
    GameEventBus.emitSync(beforeEvent)

    // Register for frame updates
    SignalTypeRegistry.registerActiveSignal({
      id: signalId,
      eventType: ctx.eventType,
      source: ctx.source,
      payload: ctx.payload,
      duration,
      elapsed: 0,
      startTime: Date.now()
    })
  },

  update(signal: ActiveTimedSignal, deltaTime: number): boolean {
    signal.elapsed += deltaTime * 1000 // Convert to ms

    const t = Math.min(signal.elapsed / signal.duration, 1)
    const isComplete = t >= 1

    // Fire 'execute' phase with current t
    const executeData: SignalEventData = {
      payload: signal.payload,
      t,
      signalType: 'timed',
      duration: signal.duration
    }

    const executeEvent = createGameEvent({
      type: signal.eventType,
      source: signal.source,
      data: { ...executeData, phase: 'execute' },
      routing: 'bus'
    })
    ;(executeEvent as any)._setPhase?.('execute')
    GameEventBus.emitSync(executeEvent)

    // If complete, fire 'after' phase
    if (isComplete) {
      const afterData: SignalEventData = {
        payload: signal.payload,
        t: 1,
        signalType: 'timed',
        duration: signal.duration
      }

      const afterEvent = createGameEvent({
        type: signal.eventType,
        source: signal.source,
        data: { ...afterData, phase: 'after' },
        routing: 'bus'
      })
      ;(afterEvent as any)._setPhase?.('after')
      GameEventBus.emitSync(afterEvent)

      return false // Signal complete
    }

    return true // Still active
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Signal Type: Delayed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delayed signal - fires after a delay
 */
export const DelayedSignalType: SignalType = {
  name: 'delayed',
  description: 'Fires all phases after a delay',

  emit(ctx: SignalEmitContext): void {
    const delay = (ctx.options.delay as number) || 0

    if (delay <= 0) {
      InstantSignalType.emit(ctx)
      return
    }

    // Use setTimeout for simplicity
    setTimeout(() => {
      InstantSignalType.emit(ctx)
    }, delay)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Register Built-in Types
// ─────────────────────────────────────────────────────────────────────────────

export function registerBuiltinSignalTypes(): void {
  SignalTypeRegistry.register(InstantSignalType)
  SignalTypeRegistry.register(TimedSignalType)
  SignalTypeRegistry.register(DelayedSignalType)
  console.log('[SignalTypes] Registered built-in signal types')
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a signal with the specified type
 */
export function emitSignal(
  eventType: string,
  payload: unknown = {},
  source: { type: string; id: string } = { type: 'system', id: 'signal' },
  options: SignalEmitOptions = {}
): string {
  return SignalTypeRegistry.emit(eventType, payload, source, options)
}

/**
 * Emit an instant signal (shorthand)
 */
export function emitInstant(
  eventType: string,
  payload: unknown = {},
  source: { type: string; id: string } = { type: 'system', id: 'signal' }
): string {
  return SignalTypeRegistry.emit(eventType, payload, source, { type: 'instant' })
}

/**
 * Emit a timed signal (shorthand)
 */
export function emitTimed(
  eventType: string,
  duration: number,
  payload: unknown = {},
  source: { type: string; id: string } = { type: 'system', id: 'signal' }
): string {
  return SignalTypeRegistry.emit(eventType, payload, source, { type: 'timed', duration })
}

/**
 * Update active signals (call every frame from game loop)
 */
export function updateSignals(deltaTime: number): void {
  SignalTypeRegistry.update(deltaTime)
}

/**
 * Check if input should be blocked (active timed signals)
 */
export function isSignalAnimating(): boolean {
  return SignalTypeRegistry.hasActiveSignals()
}
