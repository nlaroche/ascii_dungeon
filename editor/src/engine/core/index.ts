// ═══════════════════════════════════════════════════════════════════════════
// Core Engine Exports
// ═══════════════════════════════════════════════════════════════════════════

// Interfaces
export * from './interfaces'

// Components
export { Rect2D } from './Rect2D'
export { GlyphImage, GlyphMap, DEFAULT_PALETTE } from './GlyphImage'
export type { PaletteEntry } from './GlyphImage'

// Renderers
export { Renderer2D, GlyphImageRenderer, GlyphMapRenderer } from './Renderer2D'

// Component Registry
import type { IComponent, ComponentMeta } from './interfaces'
import { Rect2D } from './Rect2D'
import { GlyphImage } from './GlyphImage'
import { GlyphImageRenderer } from './Renderer2D'

/**
 * Registry of all available component types.
 */
export const ComponentRegistry = {
  // Component constructors by type name
  types: new Map<string, new (id?: string) => IComponent>([
    ['Rect2D', Rect2D],
    ['GlyphImage', GlyphImage],
    ['GlyphMap', GlyphImage], // Backwards compatibility
    ['GlyphImageRenderer', GlyphImageRenderer],
    ['GlyphMapRenderer', GlyphImageRenderer], // Backwards compatibility
  ]),

  // Component metadata by type name
  meta: new Map<string, ComponentMeta>([
    ['Rect2D', Rect2D.meta],
    ['GlyphImage', GlyphImage.meta],
    ['GlyphImageRenderer', GlyphImageRenderer.meta],
  ]),

  /**
   * Register a new component type.
   */
  register<T extends IComponent>(
    typeName: string,
    constructor: new (id?: string) => T,
    meta: ComponentMeta
  ): void {
    this.types.set(typeName, constructor as new (id?: string) => IComponent)
    this.meta.set(typeName, meta)
  },

  /**
   * Create a component instance by type name.
   */
  create(typeName: string, id?: string): IComponent | null {
    const Constructor = this.types.get(typeName)
    if (!Constructor) {
      console.warn(`Unknown component type: ${typeName}`)
      return null
    }
    return new Constructor(id)
  },

  /**
   * Get metadata for a component type.
   */
  getMeta(typeName: string): ComponentMeta | undefined {
    return this.meta.get(typeName)
  },

  /**
   * Get all registered component types.
   */
  getAll(): Array<{ type: string; meta: ComponentMeta }> {
    const result: Array<{ type: string; meta: ComponentMeta }> = []
    for (const [type, meta] of this.meta) {
      result.push({ type, meta })
    }
    return result
  },

  /**
   * Get components by category.
   */
  getByCategory(category: string): Array<{ type: string; meta: ComponentMeta }> {
    return this.getAll().filter(c => c.meta.category === category)
  },
}
