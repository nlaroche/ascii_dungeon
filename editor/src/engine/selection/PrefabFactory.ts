// ═══════════════════════════════════════════════════════════════════════════
// PrefabFactory - Create prefabs from selections
// ═══════════════════════════════════════════════════════════════════════════

import { SelectionRegion } from './SelectionRegion'
import type { Node, NodeComponent, Prefab } from '../../stores/engineState'

/**
 * Options for creating a prefab.
 */
export interface CreatePrefabOptions {
  /** Name for the new prefab */
  name: string
  /** Category path for the prefab */
  category: string[]
  /** Tags for searching/filtering */
  tags?: string[]
  /** Description of the prefab */
  description?: string
}

/**
 * PrefabFactory - Creates prefabs from selections.
 *
 * Supports creating prefabs from:
 * - Terrain selections (TerrainComponent data)
 * - Object selections (Node instances)
 * - Combined terrain + objects
 */
export class PrefabFactory {
  /**
   * Generate a unique prefab ID.
   */
  private static _generateId(): string {
    return `prefab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Generate a unique node ID.
   */
  private static _generateNodeId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Create a prefab from a selection region.
   */
  static createFromSelection(
    selection: SelectionRegion,
    options: CreatePrefabOptions,
    nodeGetter?: (nodeId: string) => Node | undefined
  ): Prefab {
    const now = Date.now()
    const size = selection.getSize()

    // Create the template node structure
    const template = this._buildTemplateNode(selection, options.name, size, nodeGetter)

    return {
      id: this._generateId(),
      name: options.name,
      category: options.category,
      tags: options.tags || [],
      description: options.description,
      template,
      createdAt: now,
      modifiedAt: now
    }
  }

  /**
   * Build the template node from a selection.
   */
  private static _buildTemplateNode(
    selection: SelectionRegion,
    name: string,
    size: { width: number; height: number },
    nodeGetter?: (nodeId: string) => Node | undefined
  ): Node {
    const components: NodeComponent[] = []
    const children: Node[] = []

    // Add Rect2D component for positioning
    components.push({
      id: `${this._generateNodeId()}_rect2d`,
      script: 'Rect2D',
      enabled: true,
      properties: {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height
      }
    })

    // If we have terrain cells, create a TerrainComponent
    if (selection.hasTerrain()) {
      const terrainComp = this._buildTerrainComponent(selection, size)
      components.push(terrainComp)
    }

    // If we have object nodes, clone them as children
    if (selection.hasObjects() && nodeGetter) {
      const origin = selection.getOrigin()
      for (const nodeId of selection.objectNodes) {
        const node = nodeGetter(nodeId)
        if (node) {
          const clonedNode = this._cloneNodeForTemplate(node, origin)
          children.push(clonedNode)
        }
      }
    }

    return {
      id: this._generateNodeId(),
      name,
      type: 'prefab_template',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      components,
      children,
      meta: {}
    }
  }

  /**
   * Build a TerrainComponent from selected terrain cells.
   */
  private static _buildTerrainComponent(
    selection: SelectionRegion,
    size: { width: number; height: number }
  ): NodeComponent {
    const normalizedCells = selection.getNormalizedTerrainCells()

    // Build grid as RLE-compressed data
    const grid: (string | null)[] = new Array(size.width * size.height).fill(null)

    for (const cell of normalizedCells) {
      if (cell.x >= 0 && cell.x < size.width && cell.y >= 0 && cell.y < size.height) {
        grid[cell.y * size.width + cell.x] = cell.prefabId
      }
    }

    // Compress grid using RLE
    const compressed = this._compressGrid(grid)

    return {
      id: `${this._generateNodeId()}_terrain`,
      script: 'Terrain',
      enabled: true,
      properties: {
        width: size.width,
        height: size.height,
        grid: compressed
      }
    }
  }

  /**
   * Compress grid using run-length encoding.
   */
  private static _compressGrid(grid: (string | null)[]): (number | string | null)[] {
    if (grid.length === 0) return []

    const result: (number | string | null)[] = []
    let currentId = grid[0]
    let count = 1

    for (let i = 1; i < grid.length; i++) {
      if (grid[i] === currentId) {
        count++
      } else {
        result.push(count, currentId)
        currentId = grid[i]
        count = 1
      }
    }
    result.push(count, currentId)

    return result
  }

  /**
   * Clone a node for use in a prefab template.
   */
  private static _cloneNodeForTemplate(
    node: Node,
    origin: { x: number; y: number }
  ): Node {
    // Get node position and normalize to origin
    const position = node.transform?.position || [0, 0, 0]
    const normalizedPosition: [number, number, number] = [
      position[0] - origin.x,
      position[1] - origin.y,
      position[2]
    ]

    // Clone components with new IDs
    const clonedComponents = node.components.map(comp => ({
      id: `${this._generateNodeId()}_${comp.script}`,
      script: comp.script,
      enabled: comp.enabled,
      properties: { ...comp.properties }
    }))

    // Recursively clone children
    const clonedChildren = node.children.map(child =>
      this._cloneNodeForTemplate(child, { x: 0, y: 0 }) // Children are already relative
    )

    return {
      id: this._generateNodeId(),
      name: node.name,
      type: node.type,
      transform: {
        position: normalizedPosition,
        rotation: node.transform?.rotation || [0, 0, 0],
        scale: node.transform?.scale || [1, 1, 1]
      },
      components: clonedComponents,
      children: clonedChildren,
      meta: node.meta || {}
    }
  }

  /**
   * Create a prefab from a single node.
   */
  static createFromNode(
    node: Node,
    options: CreatePrefabOptions
  ): Prefab {
    const now = Date.now()

    // Clone the node as the template
    const template = this._cloneNodeForTemplate(node, { x: 0, y: 0 })
    template.name = options.name
    template.type = 'prefab_template'

    return {
      id: this._generateId(),
      name: options.name,
      category: options.category,
      tags: options.tags || [],
      description: options.description,
      template,
      createdAt: now,
      modifiedAt: now
    }
  }

  /**
   * Create a simple single-glyph prefab.
   */
  static createGlyphPrefab(
    char: string,
    fg: [number, number, number],
    bg: [number, number, number],
    options: CreatePrefabOptions
  ): Prefab {
    const now = Date.now()

    const template: Node = {
      id: this._generateNodeId(),
      name: options.name,
      type: 'glyph',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      components: [
        {
          id: `${this._generateNodeId()}_rect2d`,
          script: 'Rect2D',
          enabled: true,
          properties: { x: 0, y: 0, width: 1, height: 1 }
        },
        {
          id: `${this._generateNodeId()}_glyph`,
          script: 'Glyph',
          enabled: true,
          properties: {
            char,
            fg,
            bg,
            emission: 0,
            emissionColor: [1, 1, 1],
            zIndex: 0,
            visible: true
          }
        }
      ],
      children: [],
      meta: {}
    }

    return {
      id: this._generateId(),
      name: options.name,
      category: options.category,
      tags: options.tags || [],
      description: options.description,
      template,
      createdAt: now,
      modifiedAt: now
    }
  }
}
