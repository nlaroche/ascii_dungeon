// ═══════════════════════════════════════════════════════════════════════════
// Base Component Class - Foundation for all TypeScript components
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Transform as TransformData } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Component Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponentLifecycle {
  /** Called when component is first attached to a node */
  onAttach?(node: Node): void
  /** Called when component is removed from a node */
  onDetach?(): void
  /** Called once after onAttach, when play mode starts */
  onInit?(): void
  /** Called before onDetach, when play mode stops */
  onDispose?(): void
  /** Called every frame with delta time */
  onUpdate?(dt: number): void
  /** Called at fixed intervals for physics */
  onFixedUpdate?(dt: number): void
  /** Called when any property changes */
  onPropertyChanged?(key: string, oldValue: unknown, newValue: unknown): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for all components in the engine.
 * Components add behavior and data to nodes.
 *
 * @example
 * @component({ name: 'Health', icon: '♥' })
 * class Health extends Component {
 *   @number(0, 100)
 *   current: number = 100
 *
 *   @number(0, 100)
 *   max: number = 100
 *
 *   onUpdate(dt: number) {
 *     // Regeneration logic
 *   }
 * }
 */
export abstract class Component implements ComponentLifecycle {
  /** The node this component is attached to */
  protected node: Node | null = null

  /** Whether this component is enabled */
  enabled: boolean = true

  /** Unique ID for this component instance */
  readonly id: string

  constructor() {
    this.id = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /** Get the owning node */
  getNode(): Node | null {
    return this.node
  }

  /** Get the node's transform (convenience method) */
  getTransform(): TransformData | undefined {
    return this.node?.transform
  }

  /** Set the owning node (called internally) */
  _setNode(node: Node | null): void {
    const oldNode = this.node
    this.node = node

    if (node && !oldNode) {
      this.onAttach?.(node)
    } else if (!node && oldNode) {
      this.onDetach?.()
    }
  }

  // Lifecycle methods - override in subclasses
  onAttach?(node: Node): void
  onDetach?(): void
  onInit?(): void
  onDispose?(): void
  onUpdate?(dt: number): void
  onFixedUpdate?(dt: number): void
  onPropertyChanged?(key: string, oldValue: unknown, newValue: unknown): void

  /** Serialize component to plain object for saving */
  serialize(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      id: this.id,
      enabled: this.enabled,
    }

    // Get all own properties (decorated ones)
    for (const key of Object.keys(this)) {
      if (key !== 'node' && key !== 'id') {
        result[key] = (this as Record<string, unknown>)[key]
      }
    }

    return result
  }

  /** Deserialize from plain object */
  deserialize(data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key in this) {
        (this as Record<string, unknown>)[key] = value
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Manager
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages component instances and their lifecycle.
 * Used by the engine to update components each frame.
 */
export class ComponentManager {
  private static instance: ComponentManager
  private components: Map<string, Component> = new Map()
  private nodeComponents: Map<string, Set<string>> = new Map() // nodeId -> componentIds

  static getInstance(): ComponentManager {
    if (!ComponentManager.instance) {
      ComponentManager.instance = new ComponentManager()
    }
    return ComponentManager.instance
  }

  /** Register a component instance */
  register(component: Component, nodeId: string): void {
    this.components.set(component.id, component)

    if (!this.nodeComponents.has(nodeId)) {
      this.nodeComponents.set(nodeId, new Set())
    }
    this.nodeComponents.get(nodeId)!.add(component.id)
  }

  /** Unregister a component instance */
  unregister(componentId: string): void {
    const component = this.components.get(componentId)
    if (component) {
      component._setNode(null)
      this.components.delete(componentId)

      // Remove from node mapping
      for (const [nodeId, compIds] of this.nodeComponents) {
        if (compIds.has(componentId)) {
          compIds.delete(componentId)
          if (compIds.size === 0) {
            this.nodeComponents.delete(nodeId)
          }
          break
        }
      }
    }
  }

  /** Get all components for a node */
  getNodeComponents(nodeId: string): Component[] {
    const compIds = this.nodeComponents.get(nodeId)
    if (!compIds) return []

    return Array.from(compIds)
      .map(id => this.components.get(id))
      .filter((c): c is Component => c !== undefined)
  }

  /** Get a specific component by ID */
  getComponent(id: string): Component | undefined {
    return this.components.get(id)
  }

  /** Update all enabled components */
  update(dt: number): void {
    for (const component of this.components.values()) {
      if (component.enabled && component.onUpdate) {
        component.onUpdate(dt)
      }
    }
  }

  /** Fixed update for physics */
  fixedUpdate(dt: number): void {
    for (const component of this.components.values()) {
      if (component.enabled && component.onFixedUpdate) {
        component.onFixedUpdate(dt)
      }
    }
  }

  /** Clear all components */
  clear(): void {
    for (const component of this.components.values()) {
      component._setNode(null)
    }
    this.components.clear()
    this.nodeComponents.clear()
  }
}
