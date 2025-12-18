// ═══════════════════════════════════════════════════════════════════════════
// ASCII Renderer - Renders ASCII art with CRT post-processing
// ═══════════════════════════════════════════════════════════════════════════

import { getAsciiTextureRenderer, type AsciiRenderOptions } from './AsciiTextureRenderer'
import { AsciiPostProcessor, type AsciiPostSettings, ASCII_POST_PRESETS } from './AsciiPostProcessor'
import { getPalette, PALETTES, type ColorPalette } from '../scripting/palettes'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AsciiLayer {
  id: string
  art: string
  x: number
  y: number
  z: number                    // Z-order for layering
  palette: string
  fontSize?: number
  animate?: boolean
  animationType?: string
  animationSpeed?: number
  visible: boolean
  opacity: number
}

export interface AsciiRendererOptions {
  width: number
  height: number
  device: GPUDevice
  format: GPUTextureFormat
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Renderer
// ─────────────────────────────────────────────────────────────────────────────

export class AsciiRenderer {
  private device: GPUDevice
  private format: GPUTextureFormat
  private width: number
  private height: number

  // Canvases for rendering
  private asciiCanvas: HTMLCanvasElement
  private asciiCtx: CanvasRenderingContext2D

  // GPU resources
  private asciiTexture: GPUTexture | null = null
  private renderTexture: GPUTexture | null = null
  private postProcessor: AsciiPostProcessor

  // Layers
  private layers: Map<string, AsciiLayer> = new Map()

  // Current palette
  private currentPalette: string = 'phosphor'

  // Time for animation
  private time: number = 0

  constructor(options: AsciiRendererOptions) {
    this.device = options.device
    this.format = options.format
    this.width = options.width
    this.height = options.height

    // Create off-screen canvas for ASCII rendering
    this.asciiCanvas = document.createElement('canvas')
    this.asciiCanvas.width = this.width
    this.asciiCanvas.height = this.height
    this.asciiCtx = this.asciiCanvas.getContext('2d')!

    // Create post-processor
    this.postProcessor = new AsciiPostProcessor(this.device)
  }

  /**
   * Initialize GPU resources
   */
  async init(): Promise<void> {
    // Create textures
    this.createTextures()

    // Initialize post-processor
    await this.postProcessor.init(this.format)

    // Apply default preset
    this.postProcessor.applyPreset('crt')
  }

  /**
   * Create GPU textures
   */
  private createTextures(): void {
    // ASCII texture (uploaded from canvas)
    this.asciiTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })

    // Render texture for post-processing
    this.renderTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: this.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    })
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return

    this.width = width
    this.height = height

    // Resize canvas
    this.asciiCanvas.width = width
    this.asciiCanvas.height = height

    // Recreate textures
    this.asciiTexture?.destroy()
    this.renderTexture?.destroy()
    this.createTextures()
  }

  /**
   * Add or update a layer
   */
  setLayer(layer: AsciiLayer): void {
    this.layers.set(layer.id, layer)
  }

  /**
   * Remove a layer
   */
  removeLayer(id: string): void {
    this.layers.delete(id)
  }

  /**
   * Clear all layers
   */
  clearLayers(): void {
    this.layers.clear()
  }

  /**
   * Set the global palette
   */
  setPalette(palette: string): void {
    this.currentPalette = palette
  }

  /**
   * Get post-processor settings
   */
  getPostSettings(): AsciiPostSettings {
    return this.postProcessor.getSettings()
  }

  /**
   * Update post-processor settings
   */
  setPostSettings(settings: Partial<AsciiPostSettings>): void {
    this.postProcessor.updateSettings(settings)
  }

  /**
   * Apply a post-processing preset
   */
  applyPreset(preset: string): void {
    this.postProcessor.applyPreset(preset)
  }

  /**
   * Render ASCII art to canvas
   */
  private renderToCanvas(): void {
    const palette = getPalette(this.currentPalette)

    // Clear with background color
    this.asciiCtx.fillStyle = palette.bg
    this.asciiCtx.fillRect(0, 0, this.width, this.height)

    // Sort layers by z-order
    const sortedLayers = Array.from(this.layers.values())
      .filter(l => l.visible)
      .sort((a, b) => a.z - b.z)

    // Render each layer
    for (const layer of sortedLayers) {
      this.renderLayer(layer, palette)
    }
  }

  /**
   * Render a single layer
   */
  private renderLayer(layer: AsciiLayer, defaultPalette: ColorPalette): void {
    const palette = layer.palette ? getPalette(layer.palette) : defaultPalette
    const fontSize = layer.fontSize || 16
    const charWidth = fontSize * 0.6
    const charHeight = fontSize

    this.asciiCtx.font = `${fontSize}px monospace`
    this.asciiCtx.textBaseline = 'top'
    this.asciiCtx.globalAlpha = layer.opacity

    const lines = layer.art.split('\n')

    lines.forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === ' ') return

        const x = layer.x + col * charWidth
        const y = layer.y + row * charHeight

        // Get character color
        let color: string

        if (layer.animate && layer.animationType === 'glow' && this.isAccentChar(char)) {
          const glow = Math.sin(this.time * (layer.animationSpeed || 1) * 3 + col * 0.5 + row * 0.3) * 0.5 + 0.5
          const idx = Math.min(palette.chars.length - 1, Math.floor((0.5 + glow * 0.5) * palette.chars.length))
          color = palette.chars[idx]
        } else if (layer.animate && layer.animationType === 'wave') {
          const wave = Math.sin(this.time * (layer.animationSpeed || 1) * 2 + col * 0.3 + row * 0.2) * 0.5 + 0.5
          const idx = Math.floor(wave * (palette.chars.length - 1))
          color = palette.chars[idx]
        } else if (this.isAccentChar(char) && palette.accent) {
          color = palette.accent
        } else {
          // Use brightest color by default
          color = palette.chars[palette.chars.length - 1]
        }

        this.asciiCtx.fillStyle = color
        this.asciiCtx.fillText(char, x, y)
      })
    })

    this.asciiCtx.globalAlpha = 1
  }

  /**
   * Check if character is a special accent character
   */
  private isAccentChar(char: string): boolean {
    return '@$*#!?♦♥♠♣★☆◆●○'.includes(char)
  }

  /**
   * Main render function
   */
  render(
    commandEncoder: GPUCommandEncoder,
    outputView: GPUTextureView,
    dt: number
  ): void {
    // Update time
    this.time += dt

    // Render ASCII to canvas
    this.renderToCanvas()

    // Upload canvas to GPU texture
    if (this.asciiTexture) {
      this.device.queue.copyExternalImageToTexture(
        { source: this.asciiCanvas },
        { texture: this.asciiTexture },
        [this.width, this.height]
      )
    }

    // Apply post-processing
    if (this.asciiTexture && this.postProcessor.isEnabled()) {
      this.postProcessor.render(
        commandEncoder,
        this.asciiTexture.createView(),
        outputView,
        this.width,
        this.height,
        this.time
      )
    } else if (this.asciiTexture) {
      // Direct copy without post-processing
      // Would need a simple blit pass here
    }
  }

  /**
   * Render a simple scene (convenience method)
   */
  renderSimple(
    art: string,
    commandEncoder: GPUCommandEncoder,
    outputView: GPUTextureView,
    dt: number
  ): void {
    // Clear layers and add single layer
    this.clearLayers()

    // Center the art
    const lines = art.split('\n')
    const maxWidth = Math.max(...lines.map(l => l.length))
    const fontSize = 16
    const charWidth = fontSize * 0.6
    const charHeight = fontSize

    const artWidth = maxWidth * charWidth
    const artHeight = lines.length * charHeight

    this.setLayer({
      id: 'main',
      art,
      x: (this.width - artWidth) / 2,
      y: (this.height - artHeight) / 2,
      z: 0,
      palette: this.currentPalette,
      fontSize,
      animate: true,
      animationType: 'glow',
      animationSpeed: 1,
      visible: true,
      opacity: 1,
    })

    this.render(commandEncoder, outputView, dt)
  }

  /**
   * Get available palette names
   */
  static getPaletteNames(): string[] {
    return Object.keys(PALETTES)
  }

  /**
   * Get available preset names
   */
  static getPresetNames(): string[] {
    return Object.keys(ASCII_POST_PRESETS)
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.asciiTexture?.destroy()
    this.renderTexture?.destroy()
  }
}
