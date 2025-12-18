// ═══════════════════════════════════════════════════════════════════════════
// Engine Systems - Extensible TypeScript-based engine architecture
// ═══════════════════════════════════════════════════════════════════════════

// Core system infrastructure
export { EngineSystem, SystemPriority } from './System'
export type { SystemUpdateContext, SystemHook } from './System'
export { SystemManager } from './SystemManager'

// Event system
export { EventBus } from './events'
export type { EngineEvent, EventPayloads } from './events'

// Built-in systems
export { GizmoSystem } from './systems/GizmoSystem'
export type { GizmoMode, GizmoAxis, GizmoState } from './systems/GizmoSystem'

export { RenderSystem } from './systems/RenderSystem'
export { InputSystem } from './systems/InputSystem'
export type { InputState } from './systems/InputSystem'

export { SelectionSystem } from './systems/SelectionSystem'
export { SceneSystem } from './systems/SceneSystem'

// ─────────────────────────────────────────────────────────────────────────────
// Engine Initialization Helper
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineState } from '../stores/engineState'
import { SystemManager } from './SystemManager'
import { InputSystem } from './systems/InputSystem'
import { SceneSystem } from './systems/SceneSystem'
import { SelectionSystem } from './systems/SelectionSystem'
import { GizmoSystem } from './systems/GizmoSystem'
import { RenderSystem } from './systems/RenderSystem'

/**
 * Create and initialize all built-in engine systems
 */
export async function createEngineSystems(
  getState: () => EngineState,
  setState: (path: (string | number)[], value: unknown, description?: string) => void
): Promise<typeof SystemManager.prototype> {
  const manager = new SystemManager(getState, setState)

  // Register systems in priority order
  await manager.register(new InputSystem())
  await manager.register(new SceneSystem())
  await manager.register(new SelectionSystem())
  await manager.register(new GizmoSystem())
  await manager.register(new RenderSystem())

  console.log('[Engine] All systems initialized')
  return manager
}
