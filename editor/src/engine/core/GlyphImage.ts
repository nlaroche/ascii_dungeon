// ═══════════════════════════════════════════════════════════════════════════
// GlyphImage Component - Multi-character ASCII Art Grid
// ═══════════════════════════════════════════════════════════════════════════

import type { IComponent, ComponentMeta } from './interfaces'

/**
 * Color palette entry - maps a character to its colors.
 */
export interface PaletteEntry {
  fg: [number, number, number]  // RGB 0-1
  bg: [number, number, number]  // RGB 0-1
}

/**
 * Default palette for common dungeon characters.
 */
export const DEFAULT_PALETTE: Record<string, PaletteEntry> = {
  '#': { fg: [0.5, 0.4, 0.35], bg: [0.15, 0.12, 0.1] },   // Wall
  '.': { fg: [0.3, 0.3, 0.3], bg: [0.08, 0.08, 0.08] },   // Floor
  '+': { fg: [0.6, 0.5, 0.3], bg: [0.2, 0.15, 0.1] },     // Door
  '~': { fg: [0.2, 0.4, 0.8], bg: [0.1, 0.15, 0.3] },     // Water
  '=': { fg: [1.0, 0.4, 0.1], bg: [0.3, 0.1, 0.0] },      // Lava
  '>': { fg: [0.8, 0.8, 0.6], bg: [0.08, 0.08, 0.08] },   // Stairs down
  '<': { fg: [0.8, 0.8, 0.6], bg: [0.08, 0.08, 0.08] },   // Stairs up
  '@': { fg: [0.2, 0.9, 0.5], bg: [0.08, 0.08, 0.08] },   // Player
  '$': { fg: [1.0, 0.8, 0.2], bg: [0.08, 0.08, 0.08] },   // Treasure
  ' ': { fg: [0.1, 0.1, 0.1], bg: [0.05, 0.05, 0.05] },   // Empty
}

/**
 * GlyphImage Component - Holds a grid of ASCII characters.
 *
 * This is for multi-character ASCII art (sprites, decorations, maps).
 * The image stores characters as a multi-line string and uses
 * a palette to determine colors for each character.
 */
export class GlyphImage implements IComponent {
  readonly id: string
  readonly type = 'GlyphImage'
  enabled = true
  nodeId: string | null = null

  // The ASCII content as a multi-line string
  private _cells: string = ''

  // Cached dimensions
  private _width = 0
  private _height = 0

  // Color palette for characters
  palette: Record<string, PaletteEntry> = { ...DEFAULT_PALETTE }

  constructor(id?: string) {
    this.id = id || `glyphimage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  /**
   * Get the cells as a multi-line string.
   */
  get cells(): string {
    return this._cells
  }

  /**
   * Set the cells from a multi-line string.
   * Automatically updates width/height.
   */
  set cells(value: string) {
    this._cells = value
    this._updateDimensions()
  }

  /**
   * Get image width in cells.
   */
  get width(): number {
    return this._width
  }

  /**
   * Get image height in cells.
   */
  get height(): number {
    return this._height
  }

  /**
   * Update cached dimensions from cells string.
   */
  private _updateDimensions(): void {
    const lines = this._cells.split('\n')
    this._height = lines.length
    this._width = Math.max(0, ...lines.map(l => l.length))
  }

  /**
   * Get character at position.
   */
  getChar(x: number, y: number): string {
    if (x < 0 || y < 0 || y >= this._height) return ' '
    const lines = this._cells.split('\n')
    const line = lines[y] || ''
    if (x >= line.length) return ' '
    return line[x]
  }

  /**
   * Set character at position.
   */
  setChar(x: number, y: number, char: string): void {
    if (x < 0 || y < 0) return

    const lines = this._cells.split('\n')

    // Expand height if needed
    while (y >= lines.length) {
      lines.push('')
    }

    // Expand width if needed
    let line = lines[y]
    while (x >= line.length) {
      line += ' '
    }

    // Set the character
    lines[y] = line.substring(0, x) + char[0] + line.substring(x + 1)
    this._cells = lines.join('\n')
    this._updateDimensions()
  }

  /**
   * Get color for a character.
   */
  getColors(char: string): PaletteEntry {
    return this.palette[char] || { fg: [0.5, 0.5, 0.5], bg: [0.08, 0.08, 0.08] }
  }

  /**
   * Get a line of the image.
   */
  getLine(y: number): string {
    if (y < 0 || y >= this._height) return ''
    const lines = this._cells.split('\n')
    return lines[y] || ''
  }

  /**
   * Load ASCII art from string.
   */
  loadAscii(ascii: string): this {
    this.cells = ascii
    return this
  }

  /**
   * Create an empty image of given size.
   */
  createEmpty(width: number, height: number, fillChar = '.'): this {
    const lines: string[] = []
    for (let y = 0; y < height; y++) {
      lines.push(fillChar.repeat(width))
    }
    this.cells = lines.join('\n')
    return this
  }

  /**
   * Iterate over all cells.
   */
  *iterateCells(): Generator<{ x: number; y: number; char: string; colors: PaletteEntry }> {
    const lines = this._cells.split('\n')
    for (let y = 0; y < lines.length; y++) {
      const line = lines[y]
      for (let x = 0; x < line.length; x++) {
        const char = line[x]
        yield { x, y, char, colors: this.getColors(char) }
      }
    }
  }

  serialize(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      enabled: this.enabled,
      cells: this._cells,
      palette: this.palette,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled
    if (typeof data.cells === 'string') this.cells = data.cells
    if (data.palette && typeof data.palette === 'object') {
      this.palette = { ...DEFAULT_PALETTE, ...(data.palette as Record<string, PaletteEntry>) }
    }
  }

  /**
   * Component metadata for inspector.
   */
  static readonly meta: ComponentMeta = {
    name: 'GlyphImage',
    icon: '▤',
    description: 'Multi-character ASCII art grid',
    category: 'Rendering',
    properties: [
      { key: 'cells', name: 'Cells', type: 'text', default: '' },
    ],
  }
}

// Backwards compatibility alias
export { GlyphImage as GlyphMap }
