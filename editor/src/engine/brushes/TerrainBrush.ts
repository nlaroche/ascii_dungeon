// ═══════════════════════════════════════════════════════════════════════════
// TerrainBrush - Paint prefab IDs to TerrainComponent grid
// ═══════════════════════════════════════════════════════════════════════════

export type BrushShape = 'square' | 'circle' | 'diamond'

/**
 * Brush rules for variation and density.
 */
export interface BrushRules {
  /** Prefab IDs to choose from randomly */
  variation: string[]
  /** Weights for each variation (must match variation array length) */
  weights?: number[]
  /** Chance per cell to paint (0-1) */
  density: number
}

/**
 * TerrainBrush - Paints prefab IDs onto a terrain grid.
 *
 * Properties:
 * - prefabId: The primary prefab to paint
 * - size: Brush radius in cells
 * - shape: Square, circle, or diamond
 * - rules: Optional variation and density settings
 */
export class TerrainBrush {
  /** Primary prefab ID to paint */
  prefabId: string | null = null

  /** Brush radius in cells (1 = single cell) */
  size: number = 1

  /** Brush shape */
  shape: BrushShape = 'square'

  /** Optional brush rules for variation */
  rules: BrushRules | null = null

  /**
   * Get all positions affected by the brush centered at (cx, cy).
   */
  getAffectedPositions(cx: number, cy: number): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = []
    const radius = this.size - 1

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (this._isInShape(dx, dy, radius)) {
          positions.push({ x: cx + dx, y: cy + dy })
        }
      }
    }

    return positions
  }

  /**
   * Check if a relative position is within the brush shape.
   */
  private _isInShape(dx: number, dy: number, radius: number): boolean {
    switch (this.shape) {
      case 'square':
        return true // All positions in the square are valid

      case 'circle':
        return Math.sqrt(dx * dx + dy * dy) <= radius + 0.5

      case 'diamond':
        return Math.abs(dx) + Math.abs(dy) <= radius

      default:
        return true
    }
  }

  /**
   * Get the prefab ID to paint at a position.
   * If rules are set, applies variation and density.
   */
  getPrefabIdForPosition(_x: number, _y: number): string | null {
    // Check density
    if (this.rules && Math.random() > this.rules.density) {
      return null // Skip this cell based on density
    }

    // Check variation
    if (this.rules && this.rules.variation.length > 0) {
      return this._selectVariation()
    }

    return this.prefabId
  }

  /**
   * Select a prefab from variation with weighted random selection.
   */
  private _selectVariation(): string {
    const { variation, weights } = this.rules!

    if (!weights || weights.length === 0) {
      // Equal weight selection
      return variation[Math.floor(Math.random() * variation.length)]
    }

    // Weighted selection
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let random = Math.random() * totalWeight

    for (let i = 0; i < variation.length; i++) {
      random -= weights[i] || 0
      if (random <= 0) {
        return variation[i]
      }
    }

    return variation[variation.length - 1]
  }

  /**
   * Apply the brush to a terrain grid at position (cx, cy).
   * Returns the positions and prefab IDs that should be set.
   */
  apply(cx: number, cy: number): Array<{ x: number; y: number; prefabId: string | null }> {
    const result: Array<{ x: number; y: number; prefabId: string | null }> = []
    const positions = this.getAffectedPositions(cx, cy)

    for (const pos of positions) {
      const prefabId = this.getPrefabIdForPosition(pos.x, pos.y)
      // Only include if we have a prefab to paint (null = skip)
      // Or if we're in erase mode (prefabId is null and no rules)
      if (prefabId !== null || this.prefabId === null) {
        result.push({ ...pos, prefabId })
      }
    }

    return result
  }

  /**
   * Create a brush configured for erasing (sets cells to null).
   */
  static eraser(size: number = 1, shape: BrushShape = 'square'): TerrainBrush {
    const brush = new TerrainBrush()
    brush.prefabId = null
    brush.size = size
    brush.shape = shape
    return brush
  }

  /**
   * Create a single-cell brush.
   */
  static single(prefabId: string): TerrainBrush {
    const brush = new TerrainBrush()
    brush.prefabId = prefabId
    brush.size = 1
    return brush
  }

  /**
   * Create a brush with variation.
   */
  static withVariation(
    prefabs: string[],
    weights?: number[],
    density: number = 1,
    size: number = 1
  ): TerrainBrush {
    const brush = new TerrainBrush()
    brush.prefabId = prefabs[0]
    brush.size = size
    brush.rules = {
      variation: prefabs,
      weights,
      density
    }
    return brush
  }
}
