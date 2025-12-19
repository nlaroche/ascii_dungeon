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
  category?: string
  timeMode?: 'game' | 'real'
  properties: Map<string, PropertyOptions>
  actions: Map<string, ActionMetadata>
  signals: Map<string, SignalMetadata>
  handlers: Map<string, HandlerMetadata>
  lifecycleHandlers: Map<string, LifecycleMetadata>
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Metadata (methods exposed to logic graphs)
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionMetadata {
  /** Method name */
  methodName: string
  /** Display name in editor */
  displayName?: string
  /** Category for grouping in UI */
  category?: string
  /** Whether the action is async */
  async?: boolean
  /** Output pin names (e.g., ['success', 'error', 'timeout']) */
  outputs?: string[]
  /** Description for tooltips */
  description?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal Metadata (outbound events)
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalMetadata {
  /** Property name */
  propertyName: string
  /** Display name in editor */
  displayName?: string
  /** Description for tooltips */
  description?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler Metadata (event listeners)
// ─────────────────────────────────────────────────────────────────────────────

export type EventPhase = 'before' | 'execute' | 'after'

export interface HandlerMetadata {
  /** Method name */
  methodName: string
  /** Event type to listen for */
  eventType: string
  /** Which phase to handle */
  phase: EventPhase
  /** Priority (higher = runs first) */
  priority?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Metadata
// ─────────────────────────────────────────────────────────────────────────────

export type LifecycleEvent =
  | 'ConstructionScript'
  | 'Before:Init'
  | 'Execute:Init'
  | 'After:Init'
  | 'Execute:Enable'
  | 'Execute:Disable'
  | 'Execute:Update'
  | 'Execute:FixedUpdate'
  | 'Execute:LateUpdate'
  | 'Execute:VisibilityChange'
  | 'Before:Dispose'
  | 'Execute:Dispose'
  | 'After:Dispose'

export interface LifecycleMetadata {
  /** Method name */
  methodName: string
  /** Lifecycle event to hook */
  event: LifecycleEvent
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Storage (using WeakMaps instead of reflect-metadata)
// ─────────────────────────────────────────────────────────────────────────────

// Store component metadata by class constructor
const componentMetadataMap = new WeakMap<Function, ComponentMetadata>()

// Store property metadata by prototype (accumulated during decoration)
const propertyMetadataMap = new WeakMap<object, Map<string, PropertyOptions>>()

// Store action metadata by prototype (methods exposed to logic graphs)
const actionMetadataMap = new WeakMap<object, Map<string, ActionMetadata>>()

// Store signal metadata by prototype (outbound events)
const signalMetadataMap = new WeakMap<object, Map<string, SignalMetadata>>()

// Store handler metadata by prototype (event listeners)
const handlerMetadataMap = new WeakMap<object, Map<string, HandlerMetadata>>()

// Store lifecycle metadata by prototype (lifecycle hooks)
const lifecycleMetadataMap = new WeakMap<object, Map<string, LifecycleMetadata>>()

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

    // Collect all metadata from the prototype
    const properties: Map<string, PropertyOptions> =
      propertyMetadataMap.get(target.prototype) || new Map()
    const actions: Map<string, ActionMetadata> =
      actionMetadataMap.get(target.prototype) || new Map()
    const signals: Map<string, SignalMetadata> =
      signalMetadataMap.get(target.prototype) || new Map()
    const handlers: Map<string, HandlerMetadata> =
      handlerMetadataMap.get(target.prototype) || new Map()
    const lifecycleHandlers: Map<string, LifecycleMetadata> =
      lifecycleMetadataMap.get(target.prototype) || new Map()

    const metadata: ComponentMetadata = {
      name,
      icon: opts.icon,
      description: opts.description,
      properties,
      actions,
      signals,
      handlers,
      lifecycleHandlers,
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
// @action Decorator
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionOptions {
  /** Display name in editor (defaults to method name) */
  displayName?: string
  /** Category for grouping in UI */
  category?: string
  /** Whether the action is async (auto-detected if method returns Promise) */
  async?: boolean
  /** Output pin names for branching (e.g., ['success', 'error']) */
  outputs?: string[]
  /** Description for tooltips */
  description?: string
}

/**
 * Marks a method as an action that can be triggered from logic graphs
 * @example
 * @action({ displayName: 'Take Damage', outputs: ['survived', 'died'] })
 * takeDamage(amount: number): void { ... }
 */
export function action(options: ActionOptions | string = {}) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ) {
    const opts = typeof options === 'string' ? { displayName: options } : options

    // Get or create the actions map on this prototype
    let actions = actionMetadataMap.get(target)
    if (!actions) {
      actions = new Map()
      actionMetadataMap.set(target, actions)
    }

    // Store this action's metadata
    actions.set(propertyKey, {
      methodName: propertyKey,
      displayName: opts.displayName || propertyKey,
      category: opts.category,
      async: opts.async,
      outputs: opts.outputs,
      description: opts.description,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @signal Decorator
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalOptions {
  /** Display name in editor (defaults to property name) */
  displayName?: string
  /** Description for tooltips */
  description?: string
}

/**
 * Marks a property as a signal that can emit events to logic graphs
 * Signals are typically EventEmitter-like objects
 * @example
 * @signal({ displayName: 'On Death' })
 * onDeath = new Signal<{ killer: Entity }>()
 */
export function signal(options: SignalOptions | string = {}) {
  return function (target: object, propertyKey: string) {
    const opts = typeof options === 'string' ? { displayName: options } : options

    // Get or create the signals map on this prototype
    let signals = signalMetadataMap.get(target)
    if (!signals) {
      signals = new Map()
      signalMetadataMap.set(target, signals)
    }

    // Store this signal's metadata
    signals.set(propertyKey, {
      propertyName: propertyKey,
      displayName: opts.displayName || propertyKey,
      description: opts.description,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @handler Decorator
// ─────────────────────────────────────────────────────────────────────────────

export interface HandlerOptions {
  /** Event type to listen for */
  event: string
  /** Which phase to handle (defaults to 'execute') */
  phase?: EventPhase
  /** Priority (higher = runs first, defaults to 0) */
  priority?: number
}

/**
 * Marks a method as an event handler
 * @example
 * @handler({ event: 'damage', phase: 'before' })
 * onBeforeDamage(event: GameEvent<DamageData>): void { ... }
 */
export function handler(options: HandlerOptions) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ) {
    // Get or create the handlers map on this prototype
    let handlers = handlerMetadataMap.get(target)
    if (!handlers) {
      handlers = new Map()
      handlerMetadataMap.set(target, handlers)
    }

    // Store this handler's metadata
    handlers.set(propertyKey, {
      methodName: propertyKey,
      eventType: options.event,
      phase: options.phase || 'execute',
      priority: options.priority ?? 0,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @lifecycle Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks a method as a lifecycle hook
 * @example
 * @lifecycle('Execute:Init')
 * onInit(): void { ... }
 *
 * @lifecycle('Execute:Update')
 * onUpdate(): void { ... }
 */
export function lifecycle(event: LifecycleEvent) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ) {
    // Get or create the lifecycle handlers map on this prototype
    let lifecycleHandlers = lifecycleMetadataMap.get(target)
    if (!lifecycleHandlers) {
      lifecycleHandlers = new Map()
      lifecycleMetadataMap.set(target, lifecycleHandlers)
    }

    // Store this lifecycle handler's metadata
    lifecycleHandlers.set(propertyKey, {
      methodName: propertyKey,
      event,
    })
  }
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

/** Helper to create empty metadata maps */
function createEmptyMetadataMaps() {
  return {
    actions: new Map<string, ActionMetadata>(),
    signals: new Map<string, SignalMetadata>(),
    handlers: new Map<string, HandlerMetadata>(),
    lifecycleHandlers: new Map<string, LifecycleMetadata>(),
  }
}

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
      ...createEmptyMetadataMaps(),
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
      ...createEmptyMetadataMaps(),
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
      ...createEmptyMetadataMaps(),
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
      ...createEmptyMetadataMaps(),
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
      ...createEmptyMetadataMaps(),
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
      ...createEmptyMetadataMaps(),
    },
    ctor: class {} as unknown as new (...args: unknown[]) => unknown, // Placeholder - data-only component
  })

  console.log('[ComponentRegistry] Registered core components:', getRegisteredComponents())
}

// Auto-register on module load
registerCoreComponents()
