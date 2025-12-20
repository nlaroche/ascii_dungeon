// ═══════════════════════════════════════════════════════════════════════════
// SceneGridBuilder - Layer-based scene traversal and grid compositing
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, NodeComponent } from '../stores/engineState'
import { RenderLayer, getNodeLayer, getLayersInOrder, BlendMode, LAYER_CONFIGS } from './RenderLayer'
import { PaletteRegistry, getPaletteRegistry } from './PaletteRegistry'

/**
 * A single cell in the render grid.
 */
export interface RenderCell {
  char: number        // ASCII code (0 = transparent)
  fg: number          // Packed RGBA foreground color
  bg: number          // Packed RGBA background color
  flags: number       // Selection/hover flags
  nodeId: string      // For hit testing (which node owns this cell)
  emission: number    // 0-1 glow intensity
}

/**
 * Layer data - cells and z-ordering for a single layer.
 */
interface LayerData {
  cells: Map<string, RenderCell>  // "x,y" → cell
  nodes: Map<string, number>       // nodeId → zIndex for sorting
}

/**
 * Result of compositing all layers.
 */
export interface CompositeResult {
  cells: Uint32Array      // [charCode, fgColor, bgColor, flags] × cellCount
  emission: Float32Array  // emission value per cell
  hitTest: Map<string, string>  // "x,y" → nodeId for editor hit testing
}

/**
 * Grid dimensions configuration.
 */
export interface GridConfig {
  width: number
  height: number
  originX: number  // Grid cell that corresponds to world (0,0)
  originY: number
}

const DEFAULT_GRID_CONFIG: GridConfig = {
  width: 500,
  height: 500,
  originX: 250,
  originY: 250,
}

/**
 * SceneGridBuilder traverses the scene hierarchy and builds a layered grid
 * for efficient WebGPU rendering.
 */
export class SceneGridBuilder {
  private paletteRegistry: PaletteRegistry
  private gridConfig: GridConfig
  private layers: Map<RenderLayer, LayerData> = new Map()
  private dirty: boolean = true
  private lastRootNode: Node | null = null

  constructor(paletteRegistry?: PaletteRegistry, gridConfig?: Partial<GridConfig>) {
    this.paletteRegistry = paletteRegistry ?? getPaletteRegistry()
    this.gridConfig = { ...DEFAULT_GRID_CONFIG, ...gridConfig }
    this.initializeLayers()
  }

  /**
   * Initialize empty layer data structures.
   */
  private initializeLayers(): void {
    for (const layer of getLayersInOrder()) {
      this.layers.set(layer, {
        cells: new Map(),
        nodes: new Map(),
      })
    }
  }

  /**
   * Clear all layer data.
   */
  private clearLayers(): void {
    for (const layer of this.layers.values()) {
      layer.cells.clear()
      layer.nodes.clear()
    }
  }

  /**
   * Convert world coordinates to grid coordinates.
   */
  worldToGrid(worldX: number, worldY: number): [number, number] {
    return [
      Math.round(this.gridConfig.originX + worldX),
      Math.round(this.gridConfig.originY + worldY),
    ]
  }

  /**
   * Convert grid coordinates to world coordinates.
   */
  gridToWorld(gridX: number, gridY: number): [number, number] {
    return [
      gridX - this.gridConfig.originX,
      gridY - this.gridConfig.originY,
    ]
  }

  /**
   * Create a cell key from grid coordinates.
   */
  private cellKey(x: number, y: number): string {
    return `${x},${y}`
  }

  /**
   * Pack RGB color to 32-bit integer.
   */
  private packColor(r: number, g: number, b: number, a: number = 1): number {
    const ri = Math.round(Math.min(1, Math.max(0, r)) * 255)
    const gi = Math.round(Math.min(1, Math.max(0, g)) * 255)
    const bi = Math.round(Math.min(1, Math.max(0, b)) * 255)
    const ai = Math.round(Math.min(1, Math.max(0, a)) * 255)
    return ri | (gi << 8) | (bi << 16) | (ai << 24)
  }

  /**
   * Write a cell to a specific layer.
   */
  private writeCell(
    layer: RenderLayer,
    gridX: number,
    gridY: number,
    cell: Omit<RenderCell, 'flags'>
  ): void {
    const layerData = this.layers.get(layer)
    if (!layerData) return

    const key = this.cellKey(gridX, gridY)
    layerData.cells.set(key, { ...cell, flags: 0 })
  }

  /**
   * Rebuild the grid from the scene hierarchy.
   */
  rebuild(rootNode: Node | null): void {
    if (!rootNode) {
      this.clearLayers()
      this.dirty = true
      return
    }

    this.clearLayers()
    this.lastRootNode = rootNode

    // Traverse the scene tree depth-first
    this.traverseNode(rootNode, 0, 0)

    this.dirty = true
  }

  /**
   * Recursively traverse a node and its children.
   */
  private traverseNode(
    node: Node,
    parentGlobalX: number,
    parentGlobalY: number
  ): void {
    // Skip hidden nodes
    if (node.meta?.visible === false) return

    // Get the Rect2D component for position
    const rect2D = this.findComponent(node, 'Rect2D')
    const props = rect2D?.properties ?? {}

    // Calculate this node's global position
    const localX = (props.x as number) ?? 0
    const localY = (props.y as number) ?? 0
    const width = (props.width as number) ?? 1
    const height = (props.height as number) ?? 1
    const pivotX = (props.pivotX as number) ?? 0
    const pivotY = (props.pivotY as number) ?? 0

    const globalX = parentGlobalX + localX - Math.floor(width * pivotX)
    const globalY = parentGlobalY + localY - Math.floor(height * pivotY)

    // Determine the layer for this node
    const layer = getNodeLayer(node.type, node.meta)
    const zIndex = (node.meta?.zIndex as number) ?? 0

    // Track node in layer for z-ordering
    const layerData = this.layers.get(layer)
    if (layerData) {
      layerData.nodes.set(node.id, zIndex)
    }

    // Process visual components
    this.processTerrainComponent(node, layer, globalX, globalY)
    this.processGlyphMapComponent(node, layer, globalX, globalY)
    this.processGlyphComponent(node, layer, globalX, globalY)

    // Recurse into children with updated global position
    for (const child of node.children) {
      this.traverseNode(child, globalX, globalY)
    }
  }

  /**
   * Find a component by script name.
   */
  private findComponent(node: Node, scriptName: string): NodeComponent | undefined {
    return node.components.find(c => c.script === scriptName && c.enabled !== false)
  }

  /**
   * Process Terrain component - grid of prefab IDs.
   */
  private processTerrainComponent(
    node: Node,
    layer: RenderLayer,
    globalX: number,
    globalY: number
  ): void {
    const terrain = this.findComponent(node, 'Terrain')
    if (!terrain) return

    const props = terrain.properties
    const width = (props.width as number) ?? 0
    const height = (props.height as number) ?? 0
    const grid = props.grid as (number | string | null)[] | undefined

    if (!grid || !width || !height) return

    // Decompress RLE grid if needed
    const cells = this.decompressTerrainGrid(grid, width, height)

    // Render each cell
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const prefabId = cells[y * width + x]
        if (!prefabId) continue

        const prefab = this.paletteRegistry.getPrefab(prefabId)
        const [gridX, gridY] = this.worldToGrid(globalX + x, globalY + y)

        this.writeCell(layer, gridX, gridY, {
          char: prefab.char.charCodeAt(0),
          fg: this.packColor(prefab.fg[0], prefab.fg[1], prefab.fg[2]),
          bg: this.packColor(prefab.bg[0], prefab.bg[1], prefab.bg[2]),
          nodeId: node.id,
          emission: prefab.emission ?? 0,
        })
      }
    }
  }

  /**
   * Decompress RLE terrain grid.
   * Format: [count, prefabId, count, prefabId, ...]
   */
  private decompressTerrainGrid(
    compressed: (number | string | null)[],
    width: number,
    height: number
  ): (string | null)[] {
    const result: (string | null)[] = new Array(width * height).fill(null)
    let idx = 0

    for (let i = 0; i < compressed.length; i += 2) {
      const count = compressed[i] as number
      const prefabId = compressed[i + 1] as string | null

      for (let j = 0; j < count && idx < result.length; j++) {
        result[idx++] = prefabId
      }
    }

    return result
  }

  /**
   * Process GlyphMap component - multi-character ASCII art.
   */
  private processGlyphMapComponent(
    node: Node,
    layer: RenderLayer,
    globalX: number,
    globalY: number
  ): void {
    const glyphMap = this.findComponent(node, 'GlyphMap') ?? this.findComponent(node, 'GlyphImage')
    if (!glyphMap) return

    const cells = glyphMap.properties?.cells as string | undefined
    if (!cells) return

    // Parse palette if provided
    const palette = glyphMap.properties?.palette as Record<string, { fg?: number[]; bg?: number[] }> | undefined

    // Default colors
    const defaultFg = this.packColor(0.8, 0.8, 0.8)
    const defaultBg = this.packColor(0, 0, 0, 0)  // Transparent background

    // Parse the cells string line by line
    const lines = cells.split('\n')
    for (let y = 0; y < lines.length; y++) {
      const line = lines[y]
      for (let x = 0; x < line.length; x++) {
        const char = line[x]
        if (char === ' ') continue  // Skip spaces (transparent)

        const [gridX, gridY] = this.worldToGrid(globalX + x, globalY + y)

        // Get colors from palette or use defaults
        let fg = defaultFg
        let bg = defaultBg

        if (palette && palette[char]) {
          const entry = palette[char]
          if (entry.fg) {
            fg = this.packColor(entry.fg[0], entry.fg[1], entry.fg[2])
          }
          if (entry.bg) {
            bg = this.packColor(entry.bg[0], entry.bg[1], entry.bg[2])
          }
        }

        this.writeCell(layer, gridX, gridY, {
          char: char.charCodeAt(0),
          fg,
          bg,
          nodeId: node.id,
          emission: 0,
        })
      }
    }
  }

  /**
   * Process Glyph component - single character.
   */
  private processGlyphComponent(
    node: Node,
    layer: RenderLayer,
    globalX: number,
    globalY: number
  ): void {
    const glyph = this.findComponent(node, 'Glyph')
    if (!glyph) return

    const props = glyph.properties
    const char = props.char as string | undefined
    if (!char || char.length === 0) return

    const fg = props.fg as number[] | undefined
    const bg = props.bg as number[] | undefined
    const emission = (props.emission as number) ?? 0

    const [gridX, gridY] = this.worldToGrid(globalX, globalY)

    this.writeCell(layer, gridX, gridY, {
      char: char.charCodeAt(0),
      fg: fg ? this.packColor(fg[0], fg[1], fg[2]) : this.packColor(0.8, 0.8, 0.8),
      bg: bg ? this.packColor(bg[0], bg[1], bg[2]) : this.packColor(0, 0, 0, 0),
      nodeId: node.id,
      emission,
    })
  }

  /**
   * Composite all layers into final buffers for GPU.
   */
  composite(): CompositeResult {
    const totalCells = this.gridConfig.width * this.gridConfig.height
    const cells = new Uint32Array(totalCells * 4)  // charCode, fg, bg, flags
    const emission = new Float32Array(totalCells)
    const hitTest = new Map<string, string>()

    // Initialize with transparent background
    for (let i = 0; i < totalCells; i++) {
      cells[i * 4 + 0] = 0  // No character
      cells[i * 4 + 1] = 0  // No fg color
      cells[i * 4 + 2] = 0  // No bg color
      cells[i * 4 + 3] = 0  // No flags
      emission[i] = 0
    }

    // Composite layers in order (bottom to top)
    for (const layerType of getLayersInOrder()) {
      const layerData = this.layers.get(layerType)
      if (!layerData) continue

      const layerConfig = LAYER_CONFIGS[layerType]

      for (const [key, cell] of layerData.cells) {
        const [x, y] = key.split(',').map(Number)
        if (x < 0 || x >= this.gridConfig.width || y < 0 || y >= this.gridConfig.height) continue

        const idx = y * this.gridConfig.width + x

        // Skip transparent cells
        if (cell.char === 0 && (cell.bg & 0xFF000000) === 0) continue

        // Apply based on blend mode
        switch (layerConfig.blendMode) {
          case BlendMode.ADDITIVE:
            // Add emission/glow
            emission[idx] = Math.min(1, emission[idx] + cell.emission)
            // Additive blending for colors (simplified - just overwrite for now)
            if (cell.char !== 0) {
              cells[idx * 4 + 0] = cell.char
              cells[idx * 4 + 1] = cell.fg
              cells[idx * 4 + 2] = cell.bg
              cells[idx * 4 + 3] = cell.flags
              hitTest.set(key, cell.nodeId)
            }
            break

          case BlendMode.MULTIPLY:
            // For lighting layer - multiply intensity (simplified for now)
            // Just track the emission
            emission[idx] = Math.min(1, emission[idx] + cell.emission)
            break

          case BlendMode.NORMAL:
          default:
            // Standard alpha blending - overwrite non-transparent cells
            if (cell.char !== 0) {
              cells[idx * 4 + 0] = cell.char
              cells[idx * 4 + 1] = cell.fg
              cells[idx * 4 + 2] = cell.bg
              cells[idx * 4 + 3] = cell.flags
              hitTest.set(key, cell.nodeId)
            }
            // Also update background if it has alpha
            if ((cell.bg & 0xFF000000) !== 0 && cell.char === 0) {
              cells[idx * 4 + 2] = cell.bg
            }
            emission[idx] = Math.max(emission[idx], cell.emission)
            break
        }
      }
    }

    this.dirty = false
    return { cells, emission, hitTest }
  }

  /**
   * Get the node ID at a specific grid position (for editor hit testing).
   */
  getNodeAtCell(gridX: number, gridY: number): string | null {
    const key = this.cellKey(gridX, gridY)

    // Check layers in reverse order (top to bottom) for hit testing
    const layers = getLayersInOrder().reverse()
    for (const layerType of layers) {
      const layerData = this.layers.get(layerType)
      if (!layerData) continue

      const cell = layerData.cells.get(key)
      if (cell && cell.char !== 0) {
        return cell.nodeId
      }
    }

    return null
  }

  /**
   * Check if the grid needs to be re-composited.
   */
  isDirty(): boolean {
    return this.dirty
  }

  /**
   * Mark the grid as needing re-compositing.
   */
  markDirty(): void {
    this.dirty = true
  }

  /**
   * Get grid configuration.
   */
  getGridConfig(): GridConfig {
    return { ...this.gridConfig }
  }
}
