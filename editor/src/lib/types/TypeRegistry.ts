// TypeRegistry - Defines how Type components render in Template Mode

import type { Node } from '../../stores/engineState'

// Field types supported in Type definitions
export type TypeFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'vector3'
  | 'select'
  | 'node-ref'
  | 'script-ref'
  | 'asset-ref'

// Field definition for Type inspector
export interface TypeFieldDef {
  type: TypeFieldType
  label: string
  description?: string
  default?: unknown
  required?: boolean
  // For select type
  options?: { label: string; value: string }[]
  // For number type
  min?: number
  max?: number
  step?: number
}

// Inspector section for organizing fields
export interface TypeInspectorSection {
  id: string
  label: string
  collapsed?: boolean
  fields: string[] // Field names to show in this section
}

// Collection view configuration
export interface TypeCollectionConfig {
  columns: Array<{
    field: string
    label: string
    width?: number
  }>
  sortBy?: string
  groupBy?: string
  defaultView?: 'list' | 'grid'
}

// Scene representation (how this type appears in scene view)
export interface TypeSceneConfig {
  glyph?: string
  label?: string
  tint?: [number, number, number]
}

// Complete Type definition
export interface TypeDefinition {
  name: string
  icon: string
  color: string
  description?: string

  // Fields exposed in Template Mode inspector
  fields: Record<string, TypeFieldDef>

  // How to organize fields in inspector
  inspector: TypeInspectorSection[]

  // Collection panel configuration
  collection?: TypeCollectionConfig

  // Scene view configuration
  scene?: TypeSceneConfig

  // Component script that marks a node as this type
  componentScript: string
}

// Built-in type definitions
const BUILTIN_TYPES: TypeDefinition[] = [
  {
    name: 'Entity',
    icon: '◉',
    color: '#22d3ee', // cyan
    description: 'A game entity with position, health, and behavior',
    componentScript: 'builtin:entity',
    fields: {
      entityName: { type: 'string', label: 'Name', required: true },
      health: { type: 'number', label: 'Health', default: 100, min: 0 },
      maxHealth: { type: 'number', label: 'Max Health', default: 100, min: 1 },
      faction: {
        type: 'select',
        label: 'Faction',
        options: [
          { label: 'Player', value: 'player' },
          { label: 'Enemy', value: 'enemy' },
          { label: 'Neutral', value: 'neutral' },
        ],
        default: 'neutral'
      },
      aiScript: { type: 'script-ref', label: 'AI Script' },
    },
    inspector: [
      { id: 'identity', label: 'Identity', fields: ['entityName', 'faction'] },
      { id: 'stats', label: 'Stats', fields: ['health', 'maxHealth'] },
      { id: 'behavior', label: 'Behavior', fields: ['aiScript'], collapsed: true },
    ],
    collection: {
      columns: [
        { field: 'entityName', label: 'Name', width: 150 },
        { field: 'faction', label: 'Faction', width: 80 },
        { field: 'health', label: 'HP', width: 60 },
      ],
      sortBy: 'entityName',
      groupBy: 'faction',
    },
    scene: {
      glyph: '◉',
      tint: [0.2, 0.9, 0.9],
    },
  },
  {
    name: 'Item',
    icon: '◇',
    color: '#fbbf24', // amber
    description: 'A collectible or usable item',
    componentScript: 'builtin:item',
    fields: {
      itemName: { type: 'string', label: 'Name', required: true },
      itemType: {
        type: 'select',
        label: 'Type',
        options: [
          { label: 'Weapon', value: 'weapon' },
          { label: 'Armor', value: 'armor' },
          { label: 'Consumable', value: 'consumable' },
          { label: 'Key', value: 'key' },
          { label: 'Misc', value: 'misc' },
        ],
        default: 'misc'
      },
      value: { type: 'number', label: 'Value', default: 0, min: 0 },
      stackable: { type: 'boolean', label: 'Stackable', default: false },
      maxStack: { type: 'number', label: 'Max Stack', default: 99, min: 1 },
    },
    inspector: [
      { id: 'basic', label: 'Basic', fields: ['itemName', 'itemType', 'value'] },
      { id: 'stacking', label: 'Stacking', fields: ['stackable', 'maxStack'], collapsed: true },
    ],
    collection: {
      columns: [
        { field: 'itemName', label: 'Name', width: 150 },
        { field: 'itemType', label: 'Type', width: 100 },
        { field: 'value', label: 'Value', width: 60 },
      ],
      sortBy: 'itemName',
      groupBy: 'itemType',
    },
    scene: {
      glyph: '◇',
      tint: [0.9, 0.7, 0.2],
    },
  },
  {
    name: 'Trigger',
    icon: '▢',
    color: '#a78bfa', // violet
    description: 'An invisible trigger zone',
    componentScript: 'builtin:trigger',
    fields: {
      triggerName: { type: 'string', label: 'Name' },
      triggerType: {
        type: 'select',
        label: 'Type',
        options: [
          { label: 'On Enter', value: 'enter' },
          { label: 'On Exit', value: 'exit' },
          { label: 'While Inside', value: 'stay' },
        ],
        default: 'enter'
      },
      oneShot: { type: 'boolean', label: 'One Shot', default: false },
      script: { type: 'script-ref', label: 'Script' },
    },
    inspector: [
      { id: 'trigger', label: 'Trigger', fields: ['triggerName', 'triggerType', 'oneShot'] },
      { id: 'action', label: 'Action', fields: ['script'] },
    ],
    scene: {
      glyph: '▢',
      tint: [0.6, 0.5, 0.9],
    },
  },
  {
    name: 'Light',
    icon: '☀',
    color: '#facc15', // yellow
    description: 'A light source',
    componentScript: 'builtin:light',
    fields: {
      lightColor: { type: 'color', label: 'Color', default: [1, 1, 1] },
      intensity: { type: 'number', label: 'Intensity', default: 1, min: 0, max: 10, step: 0.1 },
      radius: { type: 'number', label: 'Radius', default: 10, min: 0 },
      castShadows: { type: 'boolean', label: 'Cast Shadows', default: true },
    },
    inspector: [
      { id: 'light', label: 'Light', fields: ['lightColor', 'intensity', 'radius', 'castShadows'] },
    ],
    scene: {
      glyph: '☀',
      tint: [1, 0.9, 0.5],
    },
  },
]

// The TypeRegistry class
class TypeRegistryClass {
  private types: Map<string, TypeDefinition> = new Map()

  constructor() {
    // Register built-in types
    for (const type of BUILTIN_TYPES) {
      this.types.set(type.name, type)
    }
  }

  // Register a custom type
  register(def: TypeDefinition) {
    this.types.set(def.name, def)
  }

  // Get a type definition by name
  get(name: string): TypeDefinition | undefined {
    return this.types.get(name)
  }

  // Get all registered types
  getAll(): TypeDefinition[] {
    return Array.from(this.types.values())
  }

  // Get types that have collection configuration
  withCollections(): TypeDefinition[] {
    return this.getAll().filter(t => t.collection)
  }

  // Find what types apply to a node (based on components)
  getNodeTypes(node: Node): string[] {
    const types: string[] = []

    for (const [typeName, typeDef] of this.types) {
      const hasComponent = node.components.some(
        c => c.script === typeDef.componentScript
      )
      if (hasComponent) {
        types.push(typeName)
      }
    }

    return types
  }

  // Check if a node is of a specific type
  isNodeType(node: Node, typeName: string): boolean {
    const typeDef = this.types.get(typeName)
    if (!typeDef) return false

    return node.components.some(c => c.script === typeDef.componentScript)
  }

  // Get the component data for a type on a node
  getTypeComponent(node: Node, typeName: string) {
    const typeDef = this.types.get(typeName)
    if (!typeDef) return null

    return node.components.find(c => c.script === typeDef.componentScript) ?? null
  }

  // Find all nodes of a type in a scene tree
  findNodesOfType(rootNode: Node, typeName: string): Node[] {
    const results: Node[] = []

    const traverse = (node: Node) => {
      if (this.isNodeType(node, typeName)) {
        results.push(node)
      }
      for (const child of node.children) {
        traverse(child)
      }
    }

    traverse(rootNode)
    return results
  }
}

// Export singleton instance
export const TypeRegistry = new TypeRegistryClass()
