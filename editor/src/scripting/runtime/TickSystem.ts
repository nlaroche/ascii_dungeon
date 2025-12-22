// ═══════════════════════════════════════════════════════════════════════════
// TickSystem - Roguelike turn-based tick system with smooth animations
//
// SMOOTH TICK CONCEPT:
// Instead of instant movement, entities animate over the tick duration.
// When a tick fires:
//   1. All entities record their START position and compute TARGET position
//   2. tickProgress goes from 0 → 1 over tickDuration seconds
//   3. Entities lerp from start to target based on tickProgress
//   4. Each entity can use its own easing function
//   5. Everything stays synchronized!
//
// Usage in components:
//   onTick: Record startPos, compute targetPos
//   onUpdate: const t = Ticks.getProgress(); pos = lerp(start, target, t)
// ═══════════════════════════════════════════════════════════════════════════

// Callback types
type TickCallback = (tickNumber: number) => void

// Built-in easing functions
export const TickEasing = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  }
} as const

export type EasingType = keyof typeof TickEasing

export class TickSystem {
  private static instance: TickSystem

  // Current tick number (how many turns have passed)
  private tickCount: number = 0

  // Subscribers that get notified on each tick
  private tickSubscribers: Set<TickCallback> = new Set()

  // Whether the tick system is active (play mode)
  private active: boolean = false

  // ─────────────────────────────────────────────────────────────────────────
  // Smooth Tick Animation
  // ─────────────────────────────────────────────────────────────────────────

  // Duration of tick animation in seconds (0 = instant, old behavior)
  private _tickDuration: number = 0.12

  // Current progress through tick animation (0 to 1)
  // null means no animation in progress
  private _tickProgress: number | null = null

  // Whether input is blocked during animation
  private _blockInputDuringAnimation: boolean = true

  // ─────────────────────────────────────────────────────────────────────────
  // Singleton
  // ─────────────────────────────────────────────────────────────────────────

  static getInstance(): TickSystem {
    if (!TickSystem.instance) {
      TickSystem.instance = new TickSystem()
    }
    return TickSystem.instance
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the duration of tick animations (in seconds)
   * Set to 0 for instant movement (classic roguelike)
   */
  setTickDuration(duration: number): void {
    this._tickDuration = Math.max(0, duration)
  }

  getTickDuration(): number {
    return this._tickDuration
  }

  /**
   * Whether to block player input during tick animation
   */
  setBlockInput(block: boolean): void {
    this._blockInputDuringAnimation = block
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the tick system (called when play mode starts)
   */
  start(): void {
    this.tickCount = 0
    this._tickProgress = null
    this.active = true
    console.log('[TickSystem] Started (smooth tick duration:', this._tickDuration, 's)')
  }

  /**
   * Stop the tick system (called when play mode stops)
   */
  stop(): void {
    this.active = false
    this._tickProgress = null
    this.tickSubscribers.clear()
    console.log('[TickSystem] Stopped')
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.tickCount = 0
    this._tickProgress = null
    this.tickSubscribers.clear()
    this.active = false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Frame Update (call this every frame from PlayModeManager)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update tick animation progress
   * Returns true if animation is in progress
   */
  update(deltaTime: number): boolean {
    if (this._tickProgress === null) return false

    // Advance progress
    if (this._tickDuration > 0) {
      this._tickProgress += deltaTime / this._tickDuration
    } else {
      this._tickProgress = 1
    }

    // Check if animation complete
    if (this._tickProgress >= 1) {
      this._tickProgress = null // Animation done
      return false
    }

    return true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tick Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Trigger a tick (called when player moves)
   * All subscribed AI components will update
   */
  tick(): void {
    if (!this.active) return

    // Don't allow new tick while animating (if blocking)
    if (this._blockInputDuringAnimation && this._tickProgress !== null) {
      return
    }

    this.tickCount++

    // Start animation
    this._tickProgress = 0

    // Notify all subscribers - they should record start position and compute target
    for (const callback of this.tickSubscribers) {
      try {
        callback(this.tickCount)
      } catch (error) {
        console.error('[TickSystem] Subscriber error:', error)
      }
    }
  }

  /**
   * Get the current tick count
   */
  getTickCount(): number {
    return this.tickCount
  }

  /**
   * Check if the system is active
   */
  isActive(): boolean {
    return this.active
  }

  /**
   * Check if a tick animation is currently in progress
   */
  isAnimating(): boolean {
    return this._tickProgress !== null
  }

  /**
   * Get current tick progress (0-1)
   * Returns 1 if no animation in progress (entities should be at target)
   */
  getProgress(): number {
    return this._tickProgress ?? 1
  }

  /**
   * Get eased progress using specified easing function
   */
  getEasedProgress(easing: EasingType = 'easeOut'): number {
    const t = this.getProgress()
    const easingFn = TickEasing[easing] ?? TickEasing.linear
    return easingFn(t)
  }

  /**
   * Check if input should be blocked (during animation)
   */
  isInputBlocked(): boolean {
    return this._blockInputDuringAnimation && this._tickProgress !== null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to tick events
   * Your callback should:
   *   1. Record the entity's current position as startPos
   *   2. Compute the entity's target position
   * Then in onUpdate, use getProgress() to lerp between them
   *
   * Returns unsubscribe function
   */
  subscribe(callback: TickCallback): () => void {
    this.tickSubscribers.add(callback)
    return () => {
      this.tickSubscribers.delete(callback)
    }
  }

  /**
   * Unsubscribe from tick events
   */
  unsubscribe(callback: TickCallback): void {
    this.tickSubscribers.delete(callback)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Ticks = TickSystem.getInstance()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

export const triggerTick = () => Ticks.tick()
export const onTick = (callback: TickCallback) => Ticks.subscribe(callback)
export const getTickCount = () => Ticks.getTickCount()

// Smooth tick helpers
export const getTickProgress = () => Ticks.getProgress()
export const getEasedTickProgress = (easing: EasingType = 'easeOut') => Ticks.getEasedProgress(easing)
export const isTickAnimating = () => Ticks.isAnimating()
export const setTickDuration = (duration: number) => Ticks.setTickDuration(duration)

/**
 * Helper: Lerp between two values based on tick progress
 */
export function lerpTick(start: number, end: number, easing: EasingType = 'easeOut'): number {
  const t = Ticks.getEasedProgress(easing)
  return start + (end - start) * t
}
