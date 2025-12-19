// ═══════════════════════════════════════════════════════════════════════════
// Timer Manager - Named timer system for visual scripting
// ═══════════════════════════════════════════════════════════════════════════

import { GameEventBus, createGameEvent } from './events'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TimerConfig {
  /** Timer name (unique identifier) */
  name: string
  /** Duration in seconds */
  duration: number
  /** Whether to loop */
  loop?: boolean
  /** Node ID that owns this timer */
  nodeId?: string
  /** Callback when timer fires */
  onFire?: (elapsed: number) => void
  /** Callback when timer completes (for non-looping) */
  onComplete?: () => void
}

interface ActiveTimer {
  config: TimerConfig
  elapsed: number
  paused: boolean
  fireCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Timer Manager
// ─────────────────────────────────────────────────────────────────────────────

export class TimerManager {
  private timers: Map<string, ActiveTimer> = new Map()
  private nodeTimers: Map<string, Set<string>> = new Map() // nodeId -> timer names

  /**
   * Start a new timer or restart an existing one.
   */
  start(config: TimerConfig): void {
    const { name, nodeId } = config

    // Stop existing timer with same name
    if (this.timers.has(name)) {
      this.stop(name)
    }

    // Create new timer
    this.timers.set(name, {
      config,
      elapsed: 0,
      paused: false,
      fireCount: 0,
    })

    // Track by node for cleanup
    if (nodeId) {
      if (!this.nodeTimers.has(nodeId)) {
        this.nodeTimers.set(nodeId, new Set())
      }
      this.nodeTimers.get(nodeId)!.add(name)
    }
  }

  /**
   * Stop and remove a timer.
   */
  stop(name: string): boolean {
    const timer = this.timers.get(name)
    if (!timer) return false

    // Remove from node tracking
    if (timer.config.nodeId) {
      this.nodeTimers.get(timer.config.nodeId)?.delete(name)
    }

    this.timers.delete(name)
    return true
  }

  /**
   * Pause a timer.
   */
  pause(name: string): boolean {
    const timer = this.timers.get(name)
    if (!timer) return false
    timer.paused = true
    return true
  }

  /**
   * Resume a paused timer.
   */
  resume(name: string): boolean {
    const timer = this.timers.get(name)
    if (!timer) return false
    timer.paused = false
    return true
  }

  /**
   * Check if a timer exists and is running.
   */
  isRunning(name: string): boolean {
    const timer = this.timers.get(name)
    return timer !== undefined && !timer.paused
  }

  /**
   * Get remaining time on a timer.
   */
  getRemaining(name: string): number {
    const timer = this.timers.get(name)
    if (!timer) return 0
    return Math.max(0, timer.config.duration - timer.elapsed)
  }

  /**
   * Get elapsed time on a timer.
   */
  getElapsed(name: string): number {
    const timer = this.timers.get(name)
    return timer?.elapsed ?? 0
  }

  /**
   * Update all timers. Call this each frame.
   */
  update(deltaTime: number): void {
    for (const [name, timer] of this.timers) {
      if (timer.paused) continue

      timer.elapsed += deltaTime

      // Check if timer should fire (use while to handle multiple fires in one update)
      while (timer.elapsed >= timer.config.duration) {
        timer.fireCount++
        const totalElapsed = timer.fireCount * timer.config.duration

        // Fire callback
        timer.config.onFire?.(totalElapsed)

        // Emit event (only if we have a source node)
        if (timer.config.nodeId) {
          const event = createGameEvent({
            type: 'Timer',
            data: {
              name,
              elapsed: totalElapsed,
              fireCount: timer.fireCount,
            },
            source: { id: timer.config.nodeId },
            routing: 'broadcast',
          })
          GameEventBus.emit(event)
        }

        if (timer.config.loop) {
          // Reset for next loop
          timer.elapsed -= timer.config.duration
        } else {
          // Complete and remove
          timer.config.onComplete?.()
          this.timers.delete(name)

          // Clean up node tracking
          if (timer.config.nodeId) {
            this.nodeTimers.get(timer.config.nodeId)?.delete(name)
          }
          break // Exit while loop since timer is removed
        }
      }
    }
  }

  /**
   * Stop all timers for a specific node.
   */
  stopAllForNode(nodeId: string): void {
    const timerNames = this.nodeTimers.get(nodeId)
    if (!timerNames) return

    for (const name of timerNames) {
      this.timers.delete(name)
    }
    this.nodeTimers.delete(nodeId)
  }

  /**
   * Stop all timers.
   */
  stopAll(): void {
    this.timers.clear()
    this.nodeTimers.clear()
  }

  /**
   * Get all active timer names.
   */
  getActiveTimers(): string[] {
    return Array.from(this.timers.keys())
  }

  /**
   * Get timer count.
   */
  getTimerCount(): number {
    return this.timers.size
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Timers = new TimerManager()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a named timer.
 */
export function startTimer(
  name: string,
  duration: number,
  options?: { loop?: boolean; nodeId?: string }
): void {
  Timers.start({
    name,
    duration,
    loop: options?.loop,
    nodeId: options?.nodeId,
  })
}

/**
 * Stop a named timer.
 */
export function stopTimer(name: string): boolean {
  return Timers.stop(name)
}

/**
 * Check if a timer is running.
 */
export function isTimerRunning(name: string): boolean {
  return Timers.isRunning(name)
}

/**
 * Get remaining time on a timer.
 */
export function getTimerRemaining(name: string): number {
  return Timers.getRemaining(name)
}

/**
 * Create a one-shot delay.
 */
export function delay(seconds: number, callback: () => void): string {
  const name = `__delay_${Date.now()}_${Math.random().toString(36).slice(2)}`
  Timers.start({
    name,
    duration: seconds,
    loop: false,
    onFire: callback,
  })
  return name
}

/**
 * Create a repeating interval.
 */
export function interval(seconds: number, callback: (elapsed: number) => void): string {
  const name = `__interval_${Date.now()}_${Math.random().toString(36).slice(2)}`
  Timers.start({
    name,
    duration: seconds,
    loop: true,
    onFire: callback,
  })
  return name
}

/**
 * Cancel a delay or interval by its returned name.
 */
export function cancelTimer(name: string): boolean {
  return Timers.stop(name)
}
