// ═══════════════════════════════════════════════════════════════════════════
// ObjectBrush - Spawn prefab instances as child nodes
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, NodeComponent, Prefab } from '../../stores/engineState'

/**
 * Options for spawning an object.
 */
export interface SpawnOptions {
  /** Override the prefab name */
  name?: string
  /** Offset from spawn position */
  offset?: { x: number; y: number }
  /** Random rotation range in degrees */
  randomRotation?: number
  /** Scale multiplier */
  scale?: number
}

/**
 * Spawned node data (not yet added to scene).
 */
export interface SpawnedNode {
  id: string
  name: string
  type: string
  position: { x: number; y: number }
  rotation: number
  scale: { x: number; y: number }
  components: NodeComponent[]
  children: SpawnedNode[]
}

/**
 * ObjectBrush - Spawns prefab instances as nodes in the scene.
 *
 * Unlike TerrainBrush which writes to a grid, ObjectBrush creates
 * actual scene nodes with identity that can be selected, moved, etc.
 *
 * Properties:
 * - prefab: The prefab to spawn
 * - size: Brush radius (for multi-spawn)
 * - spacing: Minimum distance between spawned objects
 */
export class ObjectBrush {
  /** The prefab to spawn */
  prefab: Prefab | null = null

  /** Brush radius (1 = single object) */
  size: number = 1

  /** Minimum spacing between objects */
  spacing: number = 1

  /** Spawn options */
  options: SpawnOptions = {}

  // Track recently spawned positions to enforce spacing
  private _recentSpawns: Array<{ x: number; y: number; time: number }> = []
  private _spacingCooldown: number = 0.1 // seconds

  /**
   * Generate a unique ID for a new node.
   */
  private _generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Check if we can spawn at this position (respects spacing).
   */
  canSpawnAt(x: number, y: number): boolean {
    if (!this.prefab) return false

    // Check recent spawns for spacing
    const now = Date.now() / 1000
    this._recentSpawns = this._recentSpawns.filter(s => now - s.time < this._spacingCooldown)

    for (const spawn of this._recentSpawns) {
      const dx = x - spawn.x
      const dy = y - spawn.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < this.spacing) {
        return false
      }
    }

    return true
  }

  /**
   * Create a spawned node from the current prefab at the given position.
   */
  createSpawnedNode(x: number, y: number): SpawnedNode | null {
    if (!this.prefab || !this.canSpawnAt(x, y)) {
      return null
    }

    // Record this spawn
    this._recentSpawns.push({ x, y, time: Date.now() / 1000 })

    // Calculate position with offset
    const finalX = x + (this.options.offset?.x || 0)
    const finalY = y + (this.options.offset?.y || 0)

    // Calculate rotation
    let rotation = 0
    if (this.options.randomRotation) {
      rotation = (Math.random() - 0.5) * 2 * this.options.randomRotation
    }

    // Calculate scale
    const scale = this.options.scale || 1

    // Clone components from prefab template
    const components = this.prefab.template.components.map(comp => ({
      ...comp,
      id: `${comp.id}_${this._generateId()}`,
      properties: { ...comp.properties }
    }))

    // Clone children recursively
    const cloneChildren = (children: Node[]): SpawnedNode[] => {
      return children.map(child => ({
        id: this._generateId(),
        name: child.name,
        type: child.type,
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        components: child.components.map(comp => ({
          ...comp,
          id: `${comp.id}_${this._generateId()}`,
          properties: { ...comp.properties }
        })),
        children: cloneChildren(child.children)
      }))
    }

    return {
      id: this._generateId(),
      name: this.options.name || this.prefab.name,
      type: this.prefab.template.type,
      position: { x: finalX, y: finalY },
      rotation,
      scale: { x: scale, y: scale },
      components,
      children: cloneChildren(this.prefab.template.children)
    }
  }

  /**
   * Get all spawn positions for a brush stroke centered at (cx, cy).
   */
  getSpawnPositions(cx: number, cy: number): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = []
    const radius = this.size - 1

    if (radius === 0) {
      // Single spawn
      positions.push({ x: cx, y: cy })
    } else {
      // Grid of potential spawns
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Circle shape check
          if (Math.sqrt(dx * dx + dy * dy) <= radius + 0.5) {
            // Offset by spacing to create grid pattern
            const px = cx + dx * this.spacing
            const py = cy + dy * this.spacing
            positions.push({ x: px, y: py })
          }
        }
      }
    }

    return positions
  }

  /**
   * Apply the brush at position (cx, cy).
   * Returns spawned nodes ready to be added to the scene.
   */
  apply(cx: number, cy: number): SpawnedNode[] {
    const results: SpawnedNode[] = []
    const positions = this.getSpawnPositions(cx, cy)

    for (const pos of positions) {
      const node = this.createSpawnedNode(pos.x, pos.y)
      if (node) {
        results.push(node)
      }
    }

    return results
  }

  /**
   * Clear spawn history (call this when brush stroke ends).
   */
  clearHistory(): void {
    this._recentSpawns = []
  }

  /**
   * Set the prefab to use.
   */
  setPrefab(prefab: Prefab): this {
    this.prefab = prefab
    return this
  }

  /**
   * Create a single-object brush.
   */
  static single(prefab: Prefab): ObjectBrush {
    const brush = new ObjectBrush()
    brush.prefab = prefab
    brush.size = 1
    return brush
  }

  /**
   * Create a scatter brush for natural-looking placement.
   */
  static scatter(prefab: Prefab, _density: number = 0.3): ObjectBrush {
    const brush = new ObjectBrush()
    brush.prefab = prefab
    brush.size = 3
    brush.spacing = 1.5
    brush.options = {
      randomRotation: 15
    }
    return brush
  }
}
