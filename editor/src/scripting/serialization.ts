// ═══════════════════════════════════════════════════════════════════════════
// Component Serialization - Save/load components from scene data
// ═══════════════════════════════════════════════════════════════════════════

import { Component, ComponentManager } from './Component'
import { componentRegistry, getComponentMetadata } from './decorators'
import type { Node, NodeComponent } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Serialized Component Format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialized component data stored in scene files.
 * This is the format used in engineState.
 */
export interface SerializedComponent {
  id: string
  /** Component type name (e.g., 'Health', 'Light', 'Transform') */
  type: string
  enabled: boolean
  /** All serialized properties */
  properties: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a component instance to scene-storable format
 */
export function serializeComponent(component: Component): SerializedComponent {
  const metadata = getComponentMetadata(component)
  if (!metadata) {
    throw new Error(`Component has no metadata: ${component.constructor.name}`)
  }

  const properties: Record<string, unknown> = {}

  // Get all properties defined with decorators
  for (const [key, _options] of metadata.properties) {
    properties[key] = (component as unknown as Record<string, unknown>)[key]
  }

  return {
    id: component.id,
    type: metadata.name,
    enabled: component.enabled,
    properties,
  }
}

/**
 * Deserialize component data into a component instance
 */
export function deserializeComponent(data: SerializedComponent): Component | null {
  const entry = componentRegistry.get(data.type)
  if (!entry) {
    console.warn(`Unknown component type: ${data.type}`)
    return null
  }

  const instance = new entry.ctor() as Component

  // Apply properties
  for (const [key, value] of Object.entries(data.properties)) {
    if (key in instance) {
      (instance as unknown as Record<string, unknown>)[key] = value
    }
  }

  instance.enabled = data.enabled

  // Set the ID (need to access private property)
  ;(instance as unknown as { id: string }).id = data.id

  return instance
}

/**
 * Convert legacy NodeComponent format to new SerializedComponent format
 */
export function migrateLegacyComponent(legacy: NodeComponent): SerializedComponent {
  // Handle builtin scripts
  if (legacy.script.startsWith('builtin:')) {
    const builtinType = legacy.script.replace('builtin:', '')
    const typeMap: Record<string, string> = {
      'floor_generator': 'FloorGenerator',
    }

    return {
      id: legacy.id,
      type: typeMap[builtinType] || builtinType,
      enabled: legacy.enabled,
      properties: legacy.properties,
    }
  }

  // Handle script references (map to types based on script name)
  const scriptName = legacy.script.split('/').pop()?.replace('.lua', '') || ''
  const scriptTypeMap: Record<string, string> = {
    'player_controller': 'PlayerController',
    'health': 'Health',
    'enemy_ai': 'AI',
    'flicker': 'Light',
    'interactable': 'Interactable',
  }

  return {
    id: legacy.id,
    type: scriptTypeMap[scriptName] || 'Unknown',
    enabled: legacy.enabled,
    properties: legacy.properties,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Component Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all components for a node and register them with the manager
 */
export function loadNodeComponents(node: Node, manager: ComponentManager): Component[] {
  const components: Component[] = []

  for (const compData of node.components) {
    // Try new format first
    const serialized = 'type' in compData && !('script' in compData)
      ? compData as unknown as SerializedComponent
      : migrateLegacyComponent(compData)

    const instance = deserializeComponent(serialized)
    if (instance) {
      instance._setNode(node)
      manager.register(instance, node.id)
      components.push(instance)
    }
  }

  return components
}

/**
 * Save all components from a node to serialized format
 */
export function saveNodeComponents(nodeId: string, manager: ComponentManager): SerializedComponent[] {
  const components = manager.getNodeComponents(nodeId)
  return components.map(serializeComponent)
}

/**
 * Add a new component to a node
 */
export function addComponentToNode(
  node: Node,
  componentType: string,
  manager: ComponentManager,
  initialProps?: Record<string, unknown>
): Component | null {
  const entry = componentRegistry.get(componentType)
  if (!entry) {
    console.error(`Unknown component type: ${componentType}`)
    return null
  }

  const instance = new entry.ctor() as Component

  // Apply initial properties if provided
  if (initialProps) {
    for (const [key, value] of Object.entries(initialProps)) {
      if (key in instance) {
        (instance as unknown as Record<string, unknown>)[key] = value
      }
    }
  }

  instance._setNode(node)
  manager.register(instance, node.id)

  // Add serialized data to node
  const serialized = serializeComponent(instance)
  node.components.push(serialized as unknown as NodeComponent)

  return instance
}

/**
 * Remove a component from a node
 */
export function removeComponentFromNode(
  node: Node,
  componentId: string,
  manager: ComponentManager
): boolean {
  const index = node.components.findIndex(c => c.id === componentId)
  if (index === -1) return false

  node.components.splice(index, 1)
  manager.unregister(componentId)

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Recursive Scene Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively load components for a node tree
 */
export function loadSceneComponents(rootNode: Node, manager: ComponentManager): void {
  function processNode(node: Node) {
    loadNodeComponents(node, manager)
    for (const child of node.children) {
      processNode(child)
    }
  }

  processNode(rootNode)
}

/**
 * Get all component instances for a node (including by type)
 */
export function getComponents<T extends Component>(
  nodeId: string,
  manager: ComponentManager,
  type?: new (...args: unknown[]) => T
): T[] {
  const all = manager.getNodeComponents(nodeId)

  if (type) {
    return all.filter((c): c is T => c instanceof type)
  }

  return all as T[]
}

/**
 * Get a single component by type
 */
export function getComponent<T extends Component>(
  nodeId: string,
  manager: ComponentManager,
  type: new (...args: unknown[]) => T
): T | null {
  const components = getComponents(nodeId, manager, type)
  return components[0] || null
}
