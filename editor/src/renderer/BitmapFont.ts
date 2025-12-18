// Bitmap Font Generator for Terminal-style ASCII Rendering
// Creates a texture atlas of ASCII characters for efficient GPU rendering

// Font configuration
const CHAR_WIDTH = 8
const CHAR_HEIGHT = 14
const CHARS_PER_ROW = 16
const TOTAL_CHARS = 256

export const FONT_CONFIG = {
  charWidth: CHAR_WIDTH,
  charHeight: CHAR_HEIGHT,
  charsPerRow: CHARS_PER_ROW,
  textureWidth: CHAR_WIDTH * CHARS_PER_ROW,  // 128
  textureHeight: CHAR_HEIGHT * (TOTAL_CHARS / CHARS_PER_ROW),  // 224
}

/**
 * Generate a bitmap font texture atlas using Canvas 2D
 * Returns ImageData that can be uploaded to a GPU texture
 */
export function generateFontTexture(): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = FONT_CONFIG.textureWidth
  canvas.height = FONT_CONFIG.textureHeight

  const ctx = canvas.getContext('2d')!

  // Clear to transparent
  ctx.fillStyle = 'rgba(0, 0, 0, 0)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Set up font rendering
  // Use a monospace font that looks good for ASCII art
  ctx.font = `${CHAR_HEIGHT - 2}px "Consolas", "Monaco", "Courier New", monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'white'  // White text, we'll colorize in shader

  // Render each ASCII character
  for (let i = 0; i < TOTAL_CHARS; i++) {
    const col = i % CHARS_PER_ROW
    const row = Math.floor(i / CHARS_PER_ROW)
    const x = col * CHAR_WIDTH
    const y = row * CHAR_HEIGHT

    // Get character (handle control chars)
    let char = String.fromCharCode(i)
    if (i < 32) {
      // Control characters - render as special symbols or empty
      if (i === 0) char = ' '  // null
      else char = ' '  // Skip control chars
    }

    // Center character in cell
    const metrics = ctx.measureText(char)
    const charX = x + (CHAR_WIDTH - metrics.width) / 2
    const charY = y + 1

    ctx.fillText(char, charX, charY)
  }

  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Get UV coordinates for a character in the font atlas
 */
export function getCharUV(charCode: number): { u0: number; v0: number; u1: number; v1: number } {
  const col = charCode % CHARS_PER_ROW
  const row = Math.floor(charCode / CHARS_PER_ROW)

  const u0 = col / CHARS_PER_ROW
  const v0 = row / (TOTAL_CHARS / CHARS_PER_ROW)
  const u1 = (col + 1) / CHARS_PER_ROW
  const v1 = (row + 1) / (TOTAL_CHARS / CHARS_PER_ROW)

  return { u0, v0, u1, v1 }
}

/**
 * Convert RGB color to packed uint32
 */
export function packColor(r: number, g: number, b: number, a: number = 1): number {
  return (
    (Math.round(r * 255) << 0) |
    (Math.round(g * 255) << 8) |
    (Math.round(b * 255) << 16) |
    (Math.round(a * 255) << 24)
  )
}

/**
 * Grid cell data structure for GPU upload
 * Each cell is 16 bytes:
 * - charCode (u32)
 * - fgColor (u32, packed RGBA)
 * - bgColor (u32, packed RGBA)
 * - flags (u32, for selection, hover, etc.)
 */
export interface GridCell {
  charCode: number
  fgColor: number  // packed RGBA
  bgColor: number  // packed RGBA
  flags: number    // bit flags: 1=selected, 2=hovered, 4=cursor
}

export const CELL_SIZE_BYTES = 16
export const CELL_FLAG_SELECTED = 1
export const CELL_FLAG_HOVERED = 2
export const CELL_FLAG_CURSOR = 4

/**
 * Create a grid data buffer for GPU upload
 */
export function createGridBuffer(width: number, height: number): Uint32Array {
  return new Uint32Array(width * height * 4)  // 4 uint32s per cell
}

/**
 * Set a cell in the grid buffer
 */
export function setGridCell(
  buffer: Uint32Array,
  gridWidth: number,
  x: number,
  y: number,
  cell: GridCell
) {
  const idx = (y * gridWidth + x) * 4
  buffer[idx + 0] = cell.charCode
  buffer[idx + 1] = cell.fgColor
  buffer[idx + 2] = cell.bgColor
  buffer[idx + 3] = cell.flags
}

/**
 * Get a cell from the grid buffer
 */
export function getGridCell(
  buffer: Uint32Array,
  gridWidth: number,
  x: number,
  y: number
): GridCell {
  const idx = (y * gridWidth + x) * 4
  return {
    charCode: buffer[idx + 0],
    fgColor: buffer[idx + 1],
    bgColor: buffer[idx + 2],
    flags: buffer[idx + 3],
  }
}

// Default terminal colors (similar to ANSI)
export const TERMINAL_COLORS = {
  black: packColor(0.0, 0.0, 0.0),
  red: packColor(0.8, 0.2, 0.2),
  green: packColor(0.2, 0.8, 0.2),
  yellow: packColor(0.8, 0.8, 0.2),
  blue: packColor(0.2, 0.2, 0.8),
  magenta: packColor(0.8, 0.2, 0.8),
  cyan: packColor(0.2, 0.8, 0.8),
  white: packColor(0.8, 0.8, 0.8),
  brightBlack: packColor(0.4, 0.4, 0.4),
  brightRed: packColor(1.0, 0.4, 0.4),
  brightGreen: packColor(0.4, 1.0, 0.4),
  brightYellow: packColor(1.0, 1.0, 0.4),
  brightBlue: packColor(0.4, 0.4, 1.0),
  brightMagenta: packColor(1.0, 0.4, 1.0),
  brightCyan: packColor(0.4, 1.0, 1.0),
  brightWhite: packColor(1.0, 1.0, 1.0),
}

// Default ASCII dungeon palette
// Note: Backgrounds should be pure black (0.0) to match the grid clear color
export const DUNGEON_PALETTE: Record<string, { fg: number; bg: number }> = {
  '#': { fg: packColor(0.6, 0.5, 0.4), bg: packColor(0.15, 0.12, 0.1) },  // Wall - visible bg for solid walls
  '.': { fg: packColor(0.25, 0.25, 0.25), bg: packColor(0.0, 0.0, 0.0) },  // Floor - black bg, subtle dot
  '+': { fg: packColor(0.7, 0.5, 0.3), bg: packColor(0.2, 0.15, 0.1) },   // Door
  '@': { fg: packColor(0.3, 1.0, 0.6), bg: packColor(0.0, 0.0, 0.0) }, // Player - black bg
  'g': { fg: packColor(0.6, 0.8, 0.3), bg: packColor(0.0, 0.0, 0.0) }, // Goblin - black bg
  '$': { fg: packColor(1.0, 0.9, 0.2), bg: packColor(0.0, 0.0, 0.0) }, // Gold - black bg
  '>': { fg: packColor(0.8, 0.8, 0.8), bg: packColor(0.0, 0.0, 0.0) }, // Stairs - black bg
  ' ': { fg: packColor(0.0, 0.0, 0.0), bg: packColor(0.0, 0.0, 0.0) }, // Empty - pure black
}
