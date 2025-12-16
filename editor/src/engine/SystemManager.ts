// ═══════════════════════════════════════════════════════════════════════════
// System Manager - Manages all engine systems
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, type SystemUpdateContext } from './System'
import type { EngineState } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// System Manager
// ─────────────────────────────────────────────────────────────────────────────

export class SystemManager {
  private systems: Map<string, EngineSystem> = new Map()
  private sortedSystems: EngineSystem[] = []
  private frame: number = 0
  private startTime: number = Date.now()

  // Fixed update timing
  private fixedTimeStep: number = 1 / 60 // 60 Hz
  private fixedTimeAccumulator: number = 0

  // State access
  private getState: () => EngineState
  private setState: (path: (string | number)[], value: unknown, description?: string) => void

  constructor(
    getState: () => EngineState,
    setState: (path: (string | number)[], value: unknown, description?: string) => void
  ) {
    this.getState = getState
    this.setState = setState
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // System Registration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a system with the engine
   */
  async register(system: EngineSystem): Promise<void> {
    if (this.systems.has(system.name)) {
      console.warn(`[SystemManager] System '${system.name}' already registered`)
      return
    }

    this.systems.set(system.name, system)
    this.sortSystems()

    // Initialize the system
    if (system.initialize) {
      await system.initialize(this.createContext(0))
    }

    console.log(`[SystemManager] Registered system: ${system.name}`)
  }

  /**
   * Unregister a system
   */
  async unregister(name: string): Promise<void> {
    const system = this.systems.get(name)
    if (!system) return

    if (system.shutdown) {
      await system.shutdown()
    }

    this.systems.delete(name)
    this.sortSystems()

    console.log(`[SystemManager] Unregistered system: ${name}`)
  }

  /**
   * Get a system by name
   */
  get<T extends EngineSystem>(name: string): T | null {
    return (this.systems.get(name) as T) ?? null
  }

  /**
   * Get all registered systems
   */
  getAll(): EngineSystem[] {
    return [...this.sortedSystems]
  }

  /**
   * Check if a system is registered
   */
  has(name: string): boolean {
    return this.systems.has(name)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Update Loop
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Main update loop - call this every frame
   */
  update(dt: number): void {
    this.frame++
    const ctx = this.createContext(dt)

    // Run fixed updates
    this.fixedTimeAccumulator += dt
    while (this.fixedTimeAccumulator >= this.fixedTimeStep) {
      const fixedCtx = this.createContext(this.fixedTimeStep)
      for (const system of this.sortedSystems) {
        if (system.enabled && system.fixedUpdate) {
          system.fixedUpdate(fixedCtx)
        }
      }
      this.fixedTimeAccumulator -= this.fixedTimeStep
    }

    // Run regular updates
    for (const system of this.sortedSystems) {
      if (system.enabled) {
        system.update(ctx)
      }
    }

    // Run late updates
    for (const system of this.sortedSystems) {
      if (system.enabled && system.lateUpdate) {
        system.lateUpdate(ctx)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private createContext(dt: number): SystemUpdateContext {
    return {
      dt,
      time: (Date.now() - this.startTime) / 1000,
      frame: this.frame,
      state: this.getState(),
      setState: this.setState,
      getSystem: <T extends EngineSystem>(name: string) => this.get<T>(name),
    }
  }

  private sortSystems(): void {
    this.sortedSystems = Array.from(this.systems.values()).sort(
      (a, b) => a.priority - b.priority
    )
  }

  /**
   * Shutdown all systems
   */
  async shutdown(): Promise<void> {
    // Shutdown in reverse order
    const reversed = [...this.sortedSystems].reverse()
    for (const system of reversed) {
      if (system.shutdown) {
        await system.shutdown()
      }
    }
    this.systems.clear()
    this.sortedSystems = []
  }
}
