// ═══════════════════════════════════════════════════════════════════════════
// ASCII Component - Rich ASCII art display with palettes and animation
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'
import { getPaletteNames, getPalette, isAccentChar, type ColorPalette } from '../palettes'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RenderMode = 'flat' | 'billboard' | 'worldspace'

export interface CharCell {
  char: string
  colorOverride?: string      // Hex color override (null = use palette)
  intensity?: number          // 0-1, used for palette color selection
  animate?: boolean           // Should this char animate?
}

export interface AsciiFrame {
  chars: string[]             // Array of lines
  duration?: number           // Frame duration in seconds (for animation)
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Component
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'Ascii',
  icon: '▤',
  description: 'ASCII art display with color palettes and animation'
})
export class AsciiComponent extends Component {
  // ═══════════════════════════════════════════════════════════════════════════
  // Content
  // ═══════════════════════════════════════════════════════════════════════════

  @property({
    type: 'text',
    label: 'ASCII Art',
    group: 'Content',
    tooltip: 'Multi-line ASCII art'
  })
  art: string = `┌───┐
│ @ │
└───┘`

  @property({
    type: 'number',
    label: 'Width',
    group: 'Content',
    min: 1,
    max: 200,
    tooltip: 'Width in characters (0 = auto)'
  })
  width: number = 0

  @property({
    type: 'number',
    label: 'Height',
    group: 'Content',
    min: 1,
    max: 100,
    tooltip: 'Height in characters (0 = auto)'
  })
  height: number = 0

  // ═══════════════════════════════════════════════════════════════════════════
  // Colors
  // ═══════════════════════════════════════════════════════════════════════════

  @property({
    type: 'select',
    label: 'Palette',
    group: 'Colors',
    options: getPaletteNames()
  })
  palette: string = 'phosphor'

  @property({
    type: 'color',
    label: 'Color Override',
    group: 'Colors',
    tooltip: 'Override palette with single color (leave black to use palette)'
  })
  colorOverride: [number, number, number] = [0, 0, 0]

  @property({
    type: 'number',
    label: 'Brightness',
    group: 'Colors',
    min: 0,
    max: 2,
    step: 0.1
  })
  brightness: number = 1

  @property({
    type: 'boolean',
    label: 'Use Accent',
    group: 'Colors',
    tooltip: 'Use accent color for special characters (@, $, *, etc.)'
  })
  useAccent: boolean = true

  // ═══════════════════════════════════════════════════════════════════════════
  // Animation
  // ═══════════════════════════════════════════════════════════════════════════

  @property({
    type: 'boolean',
    label: 'Animate',
    group: 'Animation'
  })
  animate: boolean = false

  @property({
    type: 'number',
    label: 'Animation Speed',
    group: 'Animation',
    min: 0.1,
    max: 10,
    step: 0.1
  })
  animationSpeed: number = 1

  @property({
    type: 'select',
    label: 'Animation Type',
    group: 'Animation',
    options: ['glow', 'cycle', 'wave', 'typewriter', 'frames']
  })
  animationType: string = 'glow'

  @property({
    type: 'string',
    label: 'Cycle Chars',
    group: 'Animation',
    tooltip: 'Characters to cycle through (for cycle animation)'
  })
  cycleChars: string = '|/-\\'

  // ═══════════════════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  @property({
    type: 'select',
    label: 'Render Mode',
    group: 'Rendering',
    options: ['flat', 'billboard', 'worldspace']
  })
  renderMode: RenderMode = 'flat'

  @property({
    type: 'number',
    label: 'Font Size',
    group: 'Rendering',
    min: 8,
    max: 48,
    step: 1
  })
  fontSize: number = 16

  @property({
    type: 'number',
    label: 'Scale',
    group: 'Rendering',
    min: 0.1,
    max: 10,
    step: 0.1
  })
  scale: number = 1

  @property({
    type: 'boolean',
    label: 'Transparent BG',
    group: 'Rendering',
    tooltip: 'Make background transparent'
  })
  transparentBg: boolean = false

  // ═══════════════════════════════════════════════════════════════════════════
  // Animation Frames (for frame-based animation)
  // ═══════════════════════════════════════════════════════════════════════════

  private frames: AsciiFrame[] = []
  private currentFrame: number = 0
  private frameTimer: number = 0

  // Per-character color overrides (sparse map: "row,col" -> color)
  private charColors: Map<string, string> = new Map()

  // ═══════════════════════════════════════════════════════════════════════════
  // API Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get the current palette object */
  getPalette(): ColorPalette {
    return getPalette(this.palette)
  }

  /** Get ASCII art as array of lines */
  getLines(): string[] {
    if (this.frames.length > 0 && this.animationType === 'frames') {
      return this.frames[this.currentFrame]?.chars || this.art.split('\n')
    }
    return this.art.split('\n')
  }

  /** Get dimensions of the art */
  getDimensions(): { width: number; height: number } {
    const lines = this.getLines()
    const maxWidth = Math.max(...lines.map(l => l.length))
    return {
      width: this.width > 0 ? this.width : maxWidth,
      height: this.height > 0 ? this.height : lines.length
    }
  }

  /** Set animation frames for frame-based animation */
  setFrames(frames: AsciiFrame[]): void {
    this.frames = frames
    this.currentFrame = 0
    this.frameTimer = 0
  }

  /** Add a single frame */
  addFrame(art: string, duration: number = 0.5): void {
    this.frames.push({
      chars: art.split('\n'),
      duration
    })
  }

  /** Clear animation frames */
  clearFrames(): void {
    this.frames = []
    this.currentFrame = 0
    this.frameTimer = 0
  }

  /** Set color for a specific character position */
  setCharColor(row: number, col: number, color: string | null): void {
    const key = `${row},${col}`
    if (color === null) {
      this.charColors.delete(key)
    } else {
      this.charColors.set(key, color)
    }
  }

  /** Get color for a specific character position */
  getCharColor(row: number, col: number): string | null {
    return this.charColors.get(`${row},${col}`) || null
  }

  /** Clear all per-character color overrides */
  clearCharColors(): void {
    this.charColors.clear()
  }

  /** Check if a character should use accent color */
  shouldUseAccent(char: string): boolean {
    return this.useAccent && isAccentChar(char)
  }

  /** Get the color for a character at position */
  getColorAt(row: number, col: number, char: string, time: number = 0): string {
    // Check per-char override first
    const override = this.getCharColor(row, col)
    if (override) return override

    // Check global color override
    if (this.colorOverride[0] > 0 || this.colorOverride[1] > 0 || this.colorOverride[2] > 0) {
      const r = Math.round(this.colorOverride[0] * 255 * this.brightness)
      const g = Math.round(this.colorOverride[1] * 255 * this.brightness)
      const b = Math.round(this.colorOverride[2] * 255 * this.brightness)
      return `rgb(${r},${g},${b})`
    }

    // Use palette
    const pal = this.getPalette()

    // Accent characters
    if (this.shouldUseAccent(char) && pal.accent) {
      if (this.animate && this.animationType === 'glow') {
        // Animated glow for accent chars
        const glow = Math.sin(time * this.animationSpeed * 3 + col * 0.5 + row * 0.3) * 0.5 + 0.5
        const idx = Math.min(pal.chars.length - 1, Math.floor((0.5 + glow * 0.5) * pal.chars.length))
        return pal.chars[idx]
      }
      return pal.accent
    }

    // Wave animation
    if (this.animate && this.animationType === 'wave') {
      const wave = Math.sin(time * this.animationSpeed * 2 + col * 0.3 + row * 0.2) * 0.5 + 0.5
      const idx = Math.floor(wave * (pal.chars.length - 1))
      return pal.chars[idx]
    }

    // Default: use brightest color
    return pal.chars[pal.chars.length - 1]
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  onUpdate(dt: number): void {
    if (!this.animate) return

    // Frame-based animation
    if (this.animationType === 'frames' && this.frames.length > 1) {
      this.frameTimer += dt * this.animationSpeed
      const frameDuration = this.frames[this.currentFrame]?.duration || 0.5

      if (this.frameTimer >= frameDuration) {
        this.frameTimer = 0
        this.currentFrame = (this.currentFrame + 1) % this.frames.length
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════

  override serialize(): Record<string, unknown> {
    const base = super.serialize()

    // Add frames if present
    if (this.frames.length > 0) {
      base.frames = this.frames
    }

    // Add char colors if present
    if (this.charColors.size > 0) {
      base.charColors = Object.fromEntries(this.charColors)
    }

    return base
  }

  override deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)

    // Restore frames
    if (Array.isArray(data.frames)) {
      this.frames = data.frames as AsciiFrame[]
    }

    // Restore char colors
    if (data.charColors && typeof data.charColors === 'object') {
      this.charColors = new Map(Object.entries(data.charColors as Record<string, string>))
    }
  }
}
