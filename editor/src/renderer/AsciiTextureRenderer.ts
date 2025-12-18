// ═══════════════════════════════════════════════════════════════════════════
// ASCII Texture Renderer - Renders ASCII art to Canvas 2D textures
// ═══════════════════════════════════════════════════════════════════════════

import { getPalette, type ColorPalette } from '../scripting/palettes'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AsciiRenderOptions {
  art: string
  palette: string
  fontSize?: number
  brightness?: number
  transparentBg?: boolean
  animate?: boolean
  animationType?: string
  animationSpeed?: number
  colorOverride?: [number, number, number]
  useAccent?: boolean
  time?: number
}

export interface AsciiTexture {
  canvas: HTMLCanvasElement
  width: number
  height: number
  charWidth: number
  charHeight: number
  cols: number
  rows: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Texture Renderer
// ─────────────────────────────────────────────────────────────────────────────

export class AsciiTextureRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private textureCache: Map<string, AsciiTexture> = new Map()

  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
  }

  /**
   * Render ASCII art to a canvas texture
   */
  render(options: AsciiRenderOptions): AsciiTexture {
    const {
      art,
      palette: paletteName,
      fontSize = 16,
      brightness = 1,
      transparentBg = false,
      animate = false,
      animationType = 'glow',
      animationSpeed = 1,
      colorOverride = [0, 0, 0],
      useAccent = true,
      time = 0,
    } = options

    const palette = getPalette(paletteName)
    const lines = art.split('\n')
    const rows = lines.length
    const cols = Math.max(...lines.map(l => l.length))

    // Calculate dimensions
    const charWidth = fontSize * 0.6
    const charHeight = fontSize
    const width = Math.ceil(cols * charWidth)
    const height = Math.ceil(rows * charHeight)

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }

    // Clear canvas
    if (transparentBg) {
      this.ctx.clearRect(0, 0, width, height)
    } else {
      this.ctx.fillStyle = palette.bg
      this.ctx.fillRect(0, 0, width, height)
    }

    // Setup font
    this.ctx.font = `${fontSize}px monospace`
    this.ctx.textBaseline = 'top'

    // Check for color override
    const hasColorOverride = colorOverride[0] > 0 || colorOverride[1] > 0 || colorOverride[2] > 0

    // Render each character
    lines.forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === ' ' && transparentBg) return

        const x = col * charWidth
        const y = row * charHeight

        // Determine color
        let color: string

        if (hasColorOverride) {
          const r = Math.round(colorOverride[0] * 255 * brightness)
          const g = Math.round(colorOverride[1] * 255 * brightness)
          const b = Math.round(colorOverride[2] * 255 * brightness)
          color = `rgb(${r},${g},${b})`
        } else {
          color = this.getCharColor(char, row, col, palette, {
            animate,
            animationType,
            animationSpeed,
            useAccent,
            time,
            brightness,
          })
        }

        this.ctx.fillStyle = color
        this.ctx.fillText(char, x, y)
      })
    })

    return {
      canvas: this.canvas,
      width,
      height,
      charWidth,
      charHeight,
      cols,
      rows,
    }
  }

  /**
   * Render to a new canvas (for multiple textures)
   */
  renderToNewCanvas(options: AsciiRenderOptions): AsciiTexture {
    const result = this.render(options)

    // Create a copy of the canvas
    const newCanvas = document.createElement('canvas')
    newCanvas.width = result.width
    newCanvas.height = result.height
    const newCtx = newCanvas.getContext('2d')!
    newCtx.drawImage(this.canvas, 0, 0)

    return {
      ...result,
      canvas: newCanvas,
    }
  }

  /**
   * Get color for a character based on palette and animation
   */
  private getCharColor(
    char: string,
    row: number,
    col: number,
    palette: ColorPalette,
    options: {
      animate: boolean
      animationType: string
      animationSpeed: number
      useAccent: boolean
      time: number
      brightness: number
    }
  ): string {
    const { animate, animationType, animationSpeed, useAccent, time, brightness } = options

    // Special accent characters
    const isAccent = useAccent && this.isAccentChar(char)

    if (isAccent && palette.accent) {
      if (animate && animationType === 'glow') {
        // Animated glow
        const glow = Math.sin(time * animationSpeed * 3 + col * 0.5 + row * 0.3) * 0.5 + 0.5
        const idx = Math.min(palette.chars.length - 1, Math.floor((0.5 + glow * 0.5) * palette.chars.length))
        return this.applyBrightness(palette.chars[idx], brightness)
      }
      return this.applyBrightness(palette.accent, brightness)
    }

    // Wave animation
    if (animate && animationType === 'wave') {
      const wave = Math.sin(time * animationSpeed * 2 + col * 0.3 + row * 0.2) * 0.5 + 0.5
      const idx = Math.floor(wave * (palette.chars.length - 1))
      return this.applyBrightness(palette.chars[idx], brightness)
    }

    // Color based on character density/weight
    const colorIdx = this.getCharWeight(char, palette.chars.length)
    return this.applyBrightness(palette.chars[colorIdx], brightness)
  }

  /**
   * Get character "weight" for color selection (denser chars = brighter)
   */
  private getCharWeight(char: string, numColors: number): number {
    // Common ASCII density ramp
    const ramp = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$█"
    const idx = ramp.indexOf(char)

    if (idx >= 0) {
      return Math.floor((idx / (ramp.length - 1)) * (numColors - 1))
    }

    // Unknown chars get middle brightness
    return Math.floor(numColors / 2)
  }

  /**
   * Check if character is a special accent character
   */
  private isAccentChar(char: string): boolean {
    return '@$*#!?♦♥♠♣★☆◆●○'.includes(char)
  }

  /**
   * Apply brightness multiplier to hex color
   */
  private applyBrightness(hexColor: string, brightness: number): string {
    if (brightness === 1) return hexColor

    // Parse hex color
    const hex = hexColor.replace('#', '')
    const r = Math.min(255, Math.round(parseInt(hex.slice(0, 2), 16) * brightness))
    const g = Math.min(255, Math.round(parseInt(hex.slice(2, 4), 16) * brightness))
    const b = Math.min(255, Math.round(parseInt(hex.slice(4, 6), 16) * brightness))

    return `rgb(${r},${g},${b})`
  }

  /**
   * Create a texture from pre-defined ASCII art patterns
   */
  static createPattern(
    pattern: 'grid' | 'border' | 'fill',
    width: number,
    height: number,
    palette: string = 'phosphor'
  ): string {
    const lines: string[] = []

    switch (pattern) {
      case 'grid':
        for (let y = 0; y < height; y++) {
          let line = ''
          for (let x = 0; x < width; x++) {
            if (y === 0 || y === height - 1) {
              line += x === 0 || x === width - 1 ? '+' : '-'
            } else {
              line += x === 0 || x === width - 1 ? '|' : '.'
            }
          }
          lines.push(line)
        }
        break

      case 'border':
        for (let y = 0; y < height; y++) {
          let line = ''
          for (let x = 0; x < width; x++) {
            if (y === 0) {
              line += x === 0 ? '┌' : x === width - 1 ? '┐' : '─'
            } else if (y === height - 1) {
              line += x === 0 ? '└' : x === width - 1 ? '┘' : '─'
            } else {
              line += x === 0 || x === width - 1 ? '│' : ' '
            }
          }
          lines.push(line)
        }
        break

      case 'fill':
        for (let y = 0; y < height; y++) {
          lines.push('█'.repeat(width))
        }
        break
    }

    return lines.join('\n')
  }

  /**
   * Clear texture cache
   */
  clearCache(): void {
    this.textureCache.clear()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance
// ─────────────────────────────────────────────────────────────────────────────

let instance: AsciiTextureRenderer | null = null

export function getAsciiTextureRenderer(): AsciiTextureRenderer {
  if (!instance) {
    instance = new AsciiTextureRenderer()
  }
  return instance
}
