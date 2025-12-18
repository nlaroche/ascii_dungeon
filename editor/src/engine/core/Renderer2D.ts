// ═══════════════════════════════════════════════════════════════════════════
// Renderer2D - Base class for 2D rendering components
// ═══════════════════════════════════════════════════════════════════════════

import type { IComponent, IRect2D, IRenderer2D, ComponentMeta } from './interfaces'
import type { Terminal2DRenderer } from '../../renderer/Terminal2DRenderer'

/**
 * Base class for all 2D renderers.
 *
 * Renderers are responsible for drawing content to the terminal.
 * Each renderer type handles a specific kind of content (glyphs, sprites, etc.)
 *
 * Subclasses should override:
 * - render() - to draw content
 * - getContentSize() - to report natural dimensions
 */
export abstract class Renderer2D implements IComponent, IRenderer2D {
  readonly id: string
  abstract readonly type: string
  enabled = true
  nodeId: string | null = null

  // Rendering properties
  zIndex = 0
  visible = true
  opacity = 1.0

  constructor(id?: string) {
    this.id = id || `renderer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  /**
   * Render this component to the terminal.
   *
   * @param terminal - The Terminal2DRenderer to draw to
   * @param bounds - The Rect2D bounds of the owning node
   * @param viewport - The visible viewport in cell coordinates
   */
  abstract render(
    terminal: Terminal2DRenderer,
    bounds: IRect2D,
    viewport: { x: number; y: number; width: number; height: number }
  ): void

  /**
   * Get the natural size of this renderer's content.
   * Used for auto-sizing nodes.
   */
  abstract getContentSize(): { width: number; height: number }

  serialize(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      enabled: this.enabled,
      zIndex: this.zIndex,
      visible: this.visible,
      opacity: this.opacity,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled
    if (typeof data.zIndex === 'number') this.zIndex = data.zIndex
    if (typeof data.visible === 'boolean') this.visible = data.visible
    if (typeof data.opacity === 'number') this.opacity = data.opacity
  }
}

/**
 * GlyphImageRenderer - Renders a GlyphImage to the terminal.
 */
import { GlyphImage } from './GlyphImage'
import { packColor } from '../../renderer/BitmapFont'

export class GlyphImageRenderer extends Renderer2D {
  readonly type = 'GlyphImageRenderer'

  // Reference to the GlyphImage component to render
  private _glyphImage: GlyphImage | null = null

  /**
   * Set the GlyphImage to render.
   */
  setGlyphImage(glyphImage: GlyphImage): this {
    this._glyphImage = glyphImage
    return this
  }

  /**
   * Get the GlyphImage being rendered.
   */
  getGlyphImage(): GlyphImage | null {
    return this._glyphImage
  }

  render(
    terminal: Terminal2DRenderer,
    bounds: IRect2D,
    _viewport: { x: number; y: number; width: number; height: number }
  ): void {
    if (!this.visible || !this._glyphImage || this.opacity <= 0) return

    // Render each cell of the glyph image
    for (const { x, y, char, colors } of this._glyphImage.iterateCells()) {
      const worldX = bounds.x + x
      const worldY = bounds.y + y

      // Convert colors to packed format
      const fg = packColor(colors.fg[0], colors.fg[1], colors.fg[2])
      const bg = packColor(colors.bg[0], colors.bg[1], colors.bg[2])

      terminal.setCell(worldX, worldY, char, fg, bg)
    }
  }

  getContentSize(): { width: number; height: number } {
    if (!this._glyphImage) return { width: 1, height: 1 }
    return {
      width: this._glyphImage.width,
      height: this._glyphImage.height,
    }
  }

  serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      glyphImageId: this._glyphImage?.id || null,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)
    // GlyphImage reference will be resolved by the scene loader
  }

  static readonly meta: ComponentMeta = {
    name: 'GlyphImageRenderer',
    icon: '▤',
    description: 'Renders a GlyphImage to the terminal',
    category: 'Rendering',
    properties: [
      { key: 'zIndex', name: 'Z-Index', type: 'number', default: 0 },
      { key: 'visible', name: 'Visible', type: 'boolean', default: true },
      { key: 'opacity', name: 'Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.1 },
    ],
  }
}

// Backwards compatibility alias
export { GlyphImageRenderer as GlyphMapRenderer }
