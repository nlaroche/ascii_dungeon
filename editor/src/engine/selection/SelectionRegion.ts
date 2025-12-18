// ═══════════════════════════════════════════════════════════════════════════
// SelectionRegion - Represents a selection of terrain and objects
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A selected terrain cell with its prefab ID.
 */
export interface SelectedTerrainCell {
  x: number
  y: number
  prefabId: string | null
}

/**
 * SelectionRegion - Captures a selection of terrain cells and object nodes.
 *
 * Used for:
 * - Copy/paste operations
 * - Creating prefabs from selections
 * - Multi-select editing
 */
export class SelectionRegion {
  /** Selected terrain cells (from TerrainComponent grid) */
  terrainCells: SelectedTerrainCell[] = []

  /** Selected object node IDs */
  objectNodes: string[] = []

  /** Bounding box of the selection */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null

  /**
   * Add a terrain cell to the selection.
   */
  addTerrainCell(x: number, y: number, prefabId: string | null): void {
    // Don't add duplicates
    const exists = this.terrainCells.some(c => c.x === x && c.y === y)
    if (!exists) {
      this.terrainCells.push({ x, y, prefabId })
      this._updateBounds(x, y)
    }
  }

  /**
   * Add multiple terrain cells at once.
   */
  addTerrainCells(cells: Array<{ x: number; y: number; prefabId: string | null }>): void {
    for (const cell of cells) {
      this.addTerrainCell(cell.x, cell.y, cell.prefabId)
    }
  }

  /**
   * Add an object node to the selection.
   */
  addObjectNode(nodeId: string): void {
    if (!this.objectNodes.includes(nodeId)) {
      this.objectNodes.push(nodeId)
    }
  }

  /**
   * Add multiple object nodes at once.
   */
  addObjectNodes(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.addObjectNode(id)
    }
  }

  /**
   * Remove a terrain cell from the selection.
   */
  removeTerrainCell(x: number, y: number): void {
    this.terrainCells = this.terrainCells.filter(c => c.x !== x || c.y !== y)
    this._recalculateBounds()
  }

  /**
   * Remove an object node from the selection.
   */
  removeObjectNode(nodeId: string): void {
    this.objectNodes = this.objectNodes.filter(id => id !== nodeId)
  }

  /**
   * Clear all selections.
   */
  clear(): void {
    this.terrainCells = []
    this.objectNodes = []
    this.bounds = null
  }

  /**
   * Check if selection is empty.
   */
  isEmpty(): boolean {
    return this.terrainCells.length === 0 && this.objectNodes.length === 0
  }

  /**
   * Check if selection has terrain.
   */
  hasTerrain(): boolean {
    return this.terrainCells.length > 0
  }

  /**
   * Check if selection has objects.
   */
  hasObjects(): boolean {
    return this.objectNodes.length > 0
  }

  /**
   * Get selection size.
   */
  getSize(): { width: number; height: number } {
    if (!this.bounds) return { width: 0, height: 0 }
    return {
      width: this.bounds.maxX - this.bounds.minX + 1,
      height: this.bounds.maxY - this.bounds.minY + 1
    }
  }

  /**
   * Get the origin point (top-left corner) of the selection.
   */
  getOrigin(): { x: number; y: number } {
    if (!this.bounds) return { x: 0, y: 0 }
    return { x: this.bounds.minX, y: this.bounds.minY }
  }

  /**
   * Get terrain cells normalized to origin (0, 0).
   */
  getNormalizedTerrainCells(): SelectedTerrainCell[] {
    if (!this.bounds) return []

    return this.terrainCells.map(cell => ({
      x: cell.x - this.bounds!.minX,
      y: cell.y - this.bounds!.minY,
      prefabId: cell.prefabId
    }))
  }

  /**
   * Select terrain cells in a rectangular region.
   */
  selectRect(
    x1: number, y1: number,
    x2: number, y2: number,
    getCell: (x: number, y: number) => string | null
  ): void {
    const minX = Math.min(x1, x2)
    const minY = Math.min(y1, y2)
    const maxX = Math.max(x1, x2)
    const maxY = Math.max(y1, y2)

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.addTerrainCell(x, y, getCell(x, y))
      }
    }
  }

  /**
   * Update bounds when adding a point.
   */
  private _updateBounds(x: number, y: number): void {
    if (!this.bounds) {
      this.bounds = { minX: x, minY: y, maxX: x, maxY: y }
    } else {
      this.bounds.minX = Math.min(this.bounds.minX, x)
      this.bounds.minY = Math.min(this.bounds.minY, y)
      this.bounds.maxX = Math.max(this.bounds.maxX, x)
      this.bounds.maxY = Math.max(this.bounds.maxY, y)
    }
  }

  /**
   * Recalculate bounds from scratch.
   */
  private _recalculateBounds(): void {
    this.bounds = null
    for (const cell of this.terrainCells) {
      this._updateBounds(cell.x, cell.y)
    }
  }

  /**
   * Clone this selection region.
   */
  clone(): SelectionRegion {
    const copy = new SelectionRegion()
    copy.terrainCells = this.terrainCells.map(c => ({ ...c }))
    copy.objectNodes = [...this.objectNodes]
    copy.bounds = this.bounds ? { ...this.bounds } : null
    return copy
  }

  /**
   * Merge another selection into this one.
   */
  merge(other: SelectionRegion): void {
    this.addTerrainCells(other.terrainCells)
    this.addObjectNodes(other.objectNodes)
  }

  /**
   * Create a selection from a rectangle.
   */
  static fromRect(
    x1: number, y1: number,
    x2: number, y2: number,
    getCell: (x: number, y: number) => string | null
  ): SelectionRegion {
    const selection = new SelectionRegion()
    selection.selectRect(x1, y1, x2, y2, getCell)
    return selection
  }
}
