// ═══════════════════════════════════════════════════════════════════════════
// Component Decorators - TypeScript decorators for exposing properties to editor
// No external dependencies - uses WeakMaps for metadata storage
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Property Types
// ─────────────────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'number'
  | 'string'
  | 'text'    // Multiline text input
  | 'boolean'
  | 'color'
  | 'vec2'
  | 'vec3'
  | 'entity'
  | 'asset'
  | 'select'

export interface PropertyOptions {
  /** Display name in inspector (defaults to property name) */
  label?: string
  /** Property type for UI control */
  type: PropertyType
  /** Minimum value for numbers */
  min?: number
  /** Maximum value for numbers */
  max?: number
  /** Step increment for number sliders */
  step?: number
  /** Decimal precision for number display (0 = integers) */
  precision?: number
  /** Whether the property is read-only in inspector */
  readonly?: boolean
  /** Tooltip text */
  tooltip?: string
  /** For 'select' type - available options */
  options?: string[]
  /** For 'entity' type - filter expression */
  filter?: string
  /** For 'asset' type - allowed extensions */
  extensions?: string[]
  /** Group/category for organizing in inspector */
  group?: string
}

export interface ComponentMetadata {
  name: string
  icon?: string
  description?: string
  properties: Map<string, PropertyOptions>
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Storage (using WeakMaps instead of reflect-metadata)
// ─────────────────────────────────────────────────────────────────────────────

// Store component metadata by class constructor
const componentMetadataMap = new WeakMap<Function, ComponentMetadata>()

// Store property metadata by prototype (accumulated during decoration)
const propertyMetadataMap = new WeakMap<object, Map<string, PropertyOptions>>()

// ─────────────────────────────────────────────────────────────────────────────
// Component Registry
// ─────────────────────────────────────────────────────────────────────────────

export const componentRegistry = new Map<string, {
  metadata: ComponentMetadata
  ctor: new (...args: unknown[]) => unknown
}>()

// ─────────────────────────────────────────────────────────────────────────────
// @component Decorator
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponentOptions {
  /** Display name in editor */
  name?: string
  /** Icon character for UI */
  icon?: string
  /** Description shown in tooltips/docs */
  description?: string
}

/**
 * Marks a class as a component that can be attached to nodes
 * @example
 * @component({ name: 'Health', icon: '♥' })
 * class Health extends Component { ... }
 */
export function component(options: ComponentOptions | string = {}) {
  return function <T extends new (...args: unknown[]) => unknown>(target: T) {
    const opts = typeof options === 'string' ? { name: options } : options
    const name = opts.name || target.name

    // Collect property metadata from the prototype
    const properties: Map<string, PropertyOptions> =
      propertyMetadataMap.get(target.prototype) || new Map()

    const metadata: ComponentMetadata = {
      name,
      icon: opts.icon,
      description: opts.description,
      properties,
    }

    // Store metadata on the class
    componentMetadataMap.set(target, metadata)

    // Register in global registry
    componentRegistry.set(name, { metadata, ctor: target })

    return target
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @property Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exposes a property to the editor inspector
 * @example
 * @property({ type: 'number', min: 0, max: 100 })
 * health: number = 100
 */
export function property(options: PropertyOptions) {
  return function (target: object, propertyKey: string) {
    // Get or create the properties map on this prototype
    let properties = propertyMetadataMap.get(target)

    if (!properties) {
      properties = new Map()
      propertyMetadataMap.set(target, properties)
    }

    // Store this property's options
    properties.set(propertyKey, {
      label: options.label || propertyKey,
      ...options,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Decorators (shortcuts)
// ─────────────────────────────────────────────────────────────────────────────

/** Number property with optional range */
export function number(min?: number, max?: number, step?: number) {
  return property({ type: 'number', min, max, step })
}

/** String property */
export function string(options: Partial<PropertyOptions> = {}) {
  return property({ type: 'string', ...options })
}

/** Boolean property */
export function boolean(options: Partial<PropertyOptions> = {}) {
  return property({ type: 'boolean', ...options })
}

/** Color property (RGB array) */
export function color(options: Partial<PropertyOptions> = {}) {
  return property({ type: 'color', ...options })
}

/** Vec2 property (XY array) */
export function vec2(options: Partial<PropertyOptions> = {}) {
  return property({ type: 'vec2', ...options })
}

/** Vec3 property (XYZ array) */
export function vec3(options: Partial<PropertyOptions> = {}) {
  return property({ type: 'vec3', ...options })
}

/** Select/dropdown property */
export function select(options: string[], extra: Partial<PropertyOptions> = {}) {
  return property({ type: 'select', options, ...extra })
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Get component metadata from a class or instance */
export function getComponentMetadata(target: unknown): ComponentMetadata | undefined {
  if (target === null || target === undefined) return undefined

  const ctor = typeof target === 'function'
    ? target as Function
    : (target as object).constructor

  return componentMetadataMap.get(ctor)
}

/** Get all registered component names */
export function getRegisteredComponents(): string[] {
  return Array.from(componentRegistry.keys())
}

/** Create a component instance by name */
export function createComponent(name: string, props?: Record<string, unknown>): unknown {
  const entry = componentRegistry.get(name)
  if (!entry) {
    throw new Error(`Component '${name}' not found in registry`)
  }
  const instance = new entry.ctor()
  if (props) {
    Object.assign(instance as object, props)
  }
  return instance
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Component Registration
// ─────────────────────────────────────────────────────────────────────────────

import { Rect2D } from '../engine/core/Rect2D'
import { GlyphImage, GlyphMap } from '../engine/core/GlyphImage'
import { GlyphImageRenderer, GlyphMapRenderer } from '../engine/core/Renderer2D'

/**
 * Register core engine components.
 * Called during app initialization.
 */
export function registerCoreComponents(): void {
  // Register Rect2D with its properties
  const rect2DProperties = new Map<string, PropertyOptions>()
  rect2DProperties.set('x', { type: 'number', label: 'X', group: 'Position' })
  rect2DProperties.set('y', { type: 'number', label: 'Y', group: 'Position' })
  rect2DProperties.set('width', { type: 'number', label: 'Width', min: 1, group: 'Size' })
  rect2DProperties.set('height', { type: 'number', label: 'Height', min: 1, group: 'Size' })
  rect2DProperties.set('autoSize', { type: 'boolean', label: 'Auto Size', group: 'Size', tooltip: 'Automatically size based on children bounds' })
  rect2DProperties.set('paddingX', { type: 'number', label: 'Padding X', min: 0, group: 'Padding', tooltip: 'Extra cells on left/right when auto-sizing' })
  rect2DProperties.set('paddingY', { type: 'number', label: 'Padding Y', min: 0, group: 'Padding', tooltip: 'Extra cells on top/bottom when auto-sizing' })

  componentRegistry.set('Rect2D', {
    metadata: {
      name: 'Rect2D',
      icon: '▢',
      description: 'Position and size in 2D space',
      properties: rect2DProperties,
    },
    ctor: Rect2D as unknown as new (...args: unknown[]) => unknown,
  })

  // Register GlyphImage with its properties
  const glyphImageProperties = new Map<string, PropertyOptions>()
  glyphImageProperties.set('cells', { type: 'string', label: 'Cells', readonly: true })

  componentRegistry.set('GlyphImage', {
    metadata: {
      name: 'GlyphImage',
      icon: '▤',
      description: 'Multi-character ASCII art grid',
      properties: glyphImageProperties,
    },
    ctor: GlyphImage as unknown as new (...args: unknown[]) => unknown,
  })

  // Backwards compatibility alias
  componentRegistry.set('GlyphMap', {
    metadata: {
      name: 'GlyphMap',
      icon: '▤',
      description: 'Multi-character ASCII art grid (alias for GlyphImage)',
      properties: glyphImageProperties,
    },
    ctor: GlyphMap as unknown as new (...args: unknown[]) => unknown,
  })

  // Register GlyphImageRenderer
  componentRegistry.set('GlyphImageRenderer', {
    metadata: {
      name: 'GlyphImageRenderer',
      icon: '▤',
      description: 'Renders a GlyphImage to the terminal',
      properties: new Map<string, PropertyOptions>(),
    },
    ctor: GlyphImageRenderer as unknown as new (...args: unknown[]) => unknown,
  })

  // Backwards compatibility alias
  componentRegistry.set('GlyphMapRenderer', {
    metadata: {
      name: 'GlyphMapRenderer',
      icon: '▤',
      description: 'Renders a GlyphImage to the terminal (alias)',
      properties: new Map<string, PropertyOptions>(),
    },
    ctor: GlyphMapRenderer as unknown as new (...args: unknown[]) => unknown,
  })

  // Register Glyph (single character) component
  const glyphProperties = new Map<string, PropertyOptions>()
  glyphProperties.set('char', { type: 'string', label: 'Character', group: 'Display' })
  glyphProperties.set('fg', { type: 'color', label: 'Foreground', group: 'Colors' })
  glyphProperties.set('bg', { type: 'color', label: 'Background', group: 'Colors' })
  glyphProperties.set('emission', { type: 'number', label: 'Emission', group: 'Lighting', min: 0, max: 10, step: 0.1 })
  glyphProperties.set('emissionColor', { type: 'color', label: 'Emission Color', group: 'Lighting' })
  glyphProperties.set('zIndex', { type: 'number', label: 'Z-Index', group: 'Rendering' })
  glyphProperties.set('visible', { type: 'boolean', label: 'Visible', group: 'Rendering' })

  componentRegistry.set('Glyph', {
    metadata: {
      name: 'Glyph',
      icon: 'A',
      description: 'Single character with colors',
      properties: glyphProperties,
    },
    ctor: class {} as unknown as new (...args: unknown[]) => unknown, // Placeholder - data-only component
  })

  console.log('[ComponentRegistry] Registered core components:', getRegisteredComponents())
}

// Auto-register on module load
registerCoreComponents()
