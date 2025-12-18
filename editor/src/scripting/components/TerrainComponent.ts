// ═══════════════════════════════════════════════════════════════════════════
// Terrain Component - Grid of prefab IDs for tile-based terrain
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'

/**
 * TerrainComponent - Stores a grid of prefab IDs.
 *
 * This is the key component for the two-layer terrain/object model.
 * Instead of storing characters directly, it stores prefab IDs that
 * reference terrain prefabs from the project's palette.
 *
 * The renderer resolves these IDs to get the actual glyph, colors,
 * animation, and collision properties for each cell.
 */
@component({
  name: 'Terrain',
  icon: '▦',
  description: 'Grid of terrain prefab IDs'
})
export class TerrainComponent extends Component {
  @property({
    type: 'number',
    label: 'Width',
    group: 'Size',
    min: 1,
    max: 1000
  })
  width: number = 50

  @property({
    type: 'number',
    label: 'Height',
    group: 'Size',
    min: 1,
    max: 1000
  })
  height: number = 50

  // Grid of prefab IDs (null = empty cell)
  // Stored as a 1D array for efficiency, accessed as [y * width + x]
  private _grid: (string | null)[] = []

  // Dirty flag for caching
  private _dirty: boolean = true

  constructor() {
    super()
    this._initializeGrid()
  }

  /**
   * Initialize grid to empty cells.
   */
  private _initializeGrid(): void {
    const size = this.width * this.height
    this._grid = new Array(size).fill(null)
    this._dirty = true
  }

  /**
   * Resize the grid, preserving existing data where possible.
   */
  resize(newWidth: number, newHeight: number): void {
    if (newWidth === this.width && newHeight === this.height) return

    const oldGrid = this._grid
    const oldWidth = this.width
    const oldHeight = this.height

    this.width = newWidth
    this.height = newHeight
    this._grid = new Array(newWidth * newHeight).fill(null)

    // Copy over existing data
    const copyWidth = Math.min(oldWidth, newWidth)
    const copyHeight = Math.min(oldHeight, newHeight)

    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        const oldIdx = y * oldWidth + x
        const newIdx = y * newWidth + x
        this._grid[newIdx] = oldGrid[oldIdx]
      }
    }

    this._dirty = true
  }

  /**
   * Get prefab ID at position.
   */
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null
    }
    return this._grid[y * this.width + x]
  }

  /**
   * Set prefab ID at position.
   */
  set(x: number, y: number, prefabId: string | null): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    this._grid[y * this.width + x] = prefabId
    this._dirty = true
  }

  /**
   * Fill a rectangular region with a prefab ID.
   */
  fillRect(x: number, y: number, w: number, h: number, prefabId: string | null): void {
    const x1 = Math.max(0, x)
    const y1 = Math.max(0, y)
    const x2 = Math.min(this.width, x + w)
    const y2 = Math.min(this.height, y + h)

    for (let cy = y1; cy < y2; cy++) {
      for (let cx = x1; cx < x2; cx++) {
        this._grid[cy * this.width + cx] = prefabId
      }
    }
    this._dirty = true
  }

  /**
   * Clear the entire grid.
   */
  clear(): void {
    this._grid.fill(null)
    this._dirty = true
  }

  /**
   * Check if grid has been modified since last markClean().
   */
  isDirty(): boolean {
    return this._dirty
  }

  /**
   * Mark grid as clean (for caching).
   */
  markClean(): void {
    this._dirty = false
  }

  /**
   * Iterate over all non-null cells.
   */
  *iterateCells(): Generator<{ x: number; y: number; prefabId: string }> {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const prefabId = this._grid[y * this.width + x]
        if (prefabId !== null) {
          yield { x, y, prefabId }
        }
      }
    }
  }

  /**
   * Get all unique prefab IDs used in this terrain.
   */
  getUsedPrefabIds(): Set<string> {
    const ids = new Set<string>()
    for (const id of this._grid) {
      if (id !== null) {
        ids.add(id)
      }
    }
    return ids
  }

  /**
   * Count how many cells use a specific prefab.
   */
  countPrefab(prefabId: string): number {
    let count = 0
    for (const id of this._grid) {
      if (id === prefabId) count++
    }
    return count
  }

  /**
   * Replace all instances of one prefab with another.
   */
  replacePrefab(oldId: string, newId: string | null): number {
    let count = 0
    for (let i = 0; i < this._grid.length; i++) {
      if (this._grid[i] === oldId) {
        this._grid[i] = newId
        count++
      }
    }
    if (count > 0) this._dirty = true
    return count
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════

  override serialize(): Record<string, unknown> {
    // Compress grid using run-length encoding for efficient storage
    const compressed = this._compressGrid()
    return {
      ...super.serialize(),
      width: this.width,
      height: this.height,
      grid: compressed,
    }
  }

  override deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)

    if (typeof data.width === 'number') this.width = data.width
    if (typeof data.height === 'number') this.height = data.height

    this._initializeGrid()

    if (Array.isArray(data.grid)) {
      this._decompressGrid(data.grid)
    }

    this._dirty = true
  }

  /**
   * Compress grid using run-length encoding.
   * Format: [count, prefabId, count, prefabId, ...]
   */
  private _compressGrid(): (number | string | null)[] {
    const result: (number | string | null)[] = []
    let currentId: string | null = this._grid[0] ?? null
    let count = 1

    for (let i = 1; i < this._grid.length; i++) {
      const id = this._grid[i]
      if (id === currentId) {
        count++
      } else {
        result.push(count, currentId)
        currentId = id
        count = 1
      }
    }
    result.push(count, currentId)

    return result
  }

  /**
   * Decompress RLE grid data.
   */
  private _decompressGrid(compressed: (number | string | null)[]): void {
    let idx = 0
    for (let i = 0; i < compressed.length; i += 2) {
      const count = compressed[i] as number
      const prefabId = compressed[i + 1] as string | null
      for (let j = 0; j < count && idx < this._grid.length; j++) {
        this._grid[idx++] = prefabId
      }
    }
  }
}
