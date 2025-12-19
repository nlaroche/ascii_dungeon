// =============================================================================
// Entity Binding - Connect visual scripting graphs to game entities
// =============================================================================

import { GraphRunner } from './GraphRunner'
import { TriplePhaseEventBus, GameEventBus, createGameEvent } from './events'
import { ExprValue } from './expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EntityRef {
  id: string
  name: string
  type: string
  components: string[]
}

export interface BoundGraph {
  graphId: string
  runner: GraphRunner
  entity: EntityRef
  isActive: boolean
}

export interface ComponentProxy {
  get(property: string): ExprValue
  set(property: string, value: ExprValue): void
  call(method: string, ...args: ExprValue[]): ExprValue
}

// -----------------------------------------------------------------------------
// Entity Binding Manager
// -----------------------------------------------------------------------------

export class EntityBindingManager {
  private bindings: Map<string, BoundGraph> = new Map()
  private entityComponents: Map<string, Map<string, ComponentProxy>> = new Map()
  private eventBus: TriplePhaseEventBus

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
  }

  /**
   * Bind a graph to an entity
   */
  bind(entityId: string, entity: EntityRef, runner: GraphRunner): string {
    const bindingId = `${entityId}_${runner.getState()}_${Date.now()}`

    this.bindings.set(bindingId, {
      graphId: bindingId,
      runner,
      entity,
      isActive: false,
    })

    // Set up entity context for the runner
    this.setupEntityContext(bindingId, entity)

    return bindingId
  }

  /**
   * Unbind a graph from an entity
   */
  unbind(bindingId: string): void {
    const binding = this.bindings.get(bindingId)
    if (binding) {
      if (binding.isActive) {
        binding.runner.stop()
      }
      this.bindings.delete(bindingId)
      this.entityComponents.delete(bindingId)
    }
  }

  /**
   * Start all bound graphs for an entity
   */
  async startEntity(entityId: string): Promise<void> {
    for (const [id, binding] of this.bindings) {
      if (binding.entity.id === entityId && !binding.isActive) {
        binding.isActive = true
        await binding.runner.start()
      }
    }
  }

  /**
   * Stop all bound graphs for an entity
   */
  stopEntity(entityId: string): void {
    for (const [id, binding] of this.bindings) {
      if (binding.entity.id === entityId && binding.isActive) {
        binding.isActive = false
        binding.runner.stop()
      }
    }
  }

  /**
   * Get all bindings for an entity
   */
  getBindingsForEntity(entityId: string): BoundGraph[] {
    return Array.from(this.bindings.values()).filter(
      (b) => b.entity.id === entityId
    )
  }

  /**
   * Get a specific binding
   */
  getBinding(bindingId: string): BoundGraph | undefined {
    return this.bindings.get(bindingId)
  }

  /**
   * Register a component proxy for an entity
   */
  registerComponent(
    bindingId: string,
    componentName: string,
    proxy: ComponentProxy
  ): void {
    if (!this.entityComponents.has(bindingId)) {
      this.entityComponents.set(bindingId, new Map())
    }
    this.entityComponents.get(bindingId)!.set(componentName, proxy)
  }

  /**
   * Get a component proxy
   */
  getComponent(bindingId: string, componentName: string): ComponentProxy | undefined {
    return this.entityComponents.get(bindingId)?.get(componentName)
  }

  /**
   * Send an event to all graphs bound to an entity
   */
  async sendEventToEntity(
    entityId: string,
    eventType: string,
    data?: unknown
  ): Promise<void> {
    for (const binding of this.getBindingsForEntity(entityId)) {
      if (binding.isActive) {
        await binding.runner.triggerSignal(eventType, data)
      }
    }
  }

  /**
   * Set up entity context for a graph runner
   */
  private setupEntityContext(bindingId: string, entity: EntityRef): void {
    const binding = this.bindings.get(bindingId)
    if (!binding) return

    // The runner will have access to 'self' referring to this entity
    binding.runner.setVariable('self', entity.id)
    binding.runner.setVariable('selfName', entity.name)
    binding.runner.setVariable('selfType', entity.type)
  }

  /**
   * Update all active bindings (called each frame)
   */
  async update(deltaTime: number): Promise<void> {
    for (const binding of this.bindings.values()) {
      if (binding.isActive) {
        // The runner handles its own update loop
      }
    }
  }

  /**
   * Dispose of all bindings
   */
  dispose(): void {
    for (const binding of this.bindings.values()) {
      if (binding.isActive) {
        binding.runner.stop()
      }
      binding.runner.dispose()
    }
    this.bindings.clear()
    this.entityComponents.clear()
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const entityBindingManager = new EntityBindingManager()

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function bindGraphToEntity(
  entityId: string,
  entity: EntityRef,
  runner: GraphRunner
): string {
  return entityBindingManager.bind(entityId, entity, runner)
}

export function unbindGraph(bindingId: string): void {
  entityBindingManager.unbind(bindingId)
}

export function startEntityGraphs(entityId: string): Promise<void> {
  return entityBindingManager.startEntity(entityId)
}

export function stopEntityGraphs(entityId: string): void {
  entityBindingManager.stopEntity(entityId)
}

export function sendEntityEvent(
  entityId: string,
  eventType: string,
  data?: unknown
): Promise<void> {
  return entityBindingManager.sendEventToEntity(entityId, eventType, data)
}
