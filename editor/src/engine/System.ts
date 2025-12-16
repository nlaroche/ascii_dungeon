// ═══════════════════════════════════════════════════════════════════════════
// Engine System - Base class for extensible engine systems
// ═══════════════════════════════════════════════════════════════════════════

import type { EngineState } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// System Priority
// ─────────────────────────────────────────────────────────────────────────────

export enum SystemPriority {
  /** Runs first - input, events */
  Input = 0,
  /** Scene graph updates, transforms */
  Scene = 100,
  /** Game logic, AI, physics */
  Logic = 200,
  /** Gizmos, selection, tools */
  Editor = 300,
  /** Rendering, post-processing */
  Render = 400,
  /** Runs last - cleanup, stats */
  Late = 500,
}

// ─────────────────────────────────────────────────────────────────────────────
// System Update Context
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemUpdateContext {
  /** Delta time in seconds */
  dt: number
  /** Total elapsed time in seconds */
  time: number
  /** Current frame number */
  frame: number
  /** Engine state (read-only snapshot) */
  state: Readonly<EngineState>
  /** Function to update engine state */
  setState: (path: (string | number)[], value: unknown, description?: string) => void
  /** Access to other systems */
  getSystem: <T extends EngineSystem>(name: string) => T | null
}

// ─────────────────────────────────────────────────────────────────────────────
// System Hooks
// ─────────────────────────────────────────────────────────────────────────────

export type SystemHook<T = void> = (...args: unknown[]) => T

export interface SystemHooks {
  [hookName: string]: SystemHook[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Engine System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for all engine systems.
 * Systems are the building blocks of the engine - each handles a specific
 * aspect like rendering, input, selection, etc.
 *
 * Systems can expose hooks that other code can subscribe to, allowing
 * extension of engine functionality through TypeScript.
 *
 * @example
 * class MyCustomSystem extends EngineSystem {
 *   static readonly NAME = 'MyCustom'
 *
 *   constructor() {
 *     super('MyCustom', SystemPriority.Logic)
 *     this.defineHook('onCustomEvent')
 *   }
 *
 *   update(ctx: SystemUpdateContext) {
 *     // Do something
 *     this.callHook('onCustomEvent', someData)
 *   }
 * }
 */
export abstract class EngineSystem {
  /** Unique system name */
  readonly name: string

  /** System priority (lower = earlier) */
  readonly priority: SystemPriority

  /** Whether system is enabled */
  enabled: boolean = true

  /** Registered hooks */
  protected hooks: SystemHooks = {}

  constructor(name: string, priority: SystemPriority) {
    this.name = name
    this.priority = priority
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /** Called when system is added to the engine */
  initialize?(ctx: SystemUpdateContext): void | Promise<void>

  /** Called every frame */
  abstract update(ctx: SystemUpdateContext): void

  /** Called at fixed intervals (for physics) */
  fixedUpdate?(ctx: SystemUpdateContext): void

  /** Called after all systems have updated */
  lateUpdate?(ctx: SystemUpdateContext): void

  /** Called when system is removed from the engine */
  shutdown?(): void | Promise<void>

  // ─────────────────────────────────────────────────────────────────────────────
  // Hook System
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Define a hook that can be subscribed to
   */
  protected defineHook(name: string): void {
    if (!this.hooks[name]) {
      this.hooks[name] = []
    }
  }

  /**
   * Subscribe to a hook
   * @returns Unsubscribe function
   */
  on<T>(hookName: string, callback: SystemHook<T>): () => void {
    if (!this.hooks[hookName]) {
      console.warn(`[${this.name}] Hook '${hookName}' not defined`)
      this.hooks[hookName] = []
    }

    this.hooks[hookName].push(callback as SystemHook)

    return () => {
      const index = this.hooks[hookName].indexOf(callback as SystemHook)
      if (index > -1) {
        this.hooks[hookName].splice(index, 1)
      }
    }
  }

  /**
   * Call all subscribers of a hook
   */
  protected callHook(name: string, ...args: unknown[]): void {
    const callbacks = this.hooks[name]
    if (!callbacks) return

    for (const callback of callbacks) {
      try {
        callback(...args)
      } catch (e) {
        console.error(`[${this.name}] Hook '${name}' error:`, e)
      }
    }
  }

  /**
   * Call hook and collect results
   */
  protected callHookWithResults<T>(name: string, ...args: unknown[]): T[] {
    const callbacks = this.hooks[name]
    if (!callbacks) return []

    const results: T[] = []
    for (const callback of callbacks) {
      try {
        const result = callback(...args)
        if (result !== undefined) {
          results.push(result as T)
        }
      } catch (e) {
        console.error(`[${this.name}] Hook '${name}' error:`, e)
      }
    }
    return results
  }

  /**
   * Get all defined hook names
   */
  getHookNames(): string[] {
    return Object.keys(this.hooks)
  }

  /**
   * Check if a hook has subscribers
   */
  hasSubscribers(hookName: string): boolean {
    return (this.hooks[hookName]?.length ?? 0) > 0
  }
}
