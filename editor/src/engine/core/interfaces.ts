// ═══════════════════════════════════════════════════════════════════════════
// Core Interfaces - Foundation for the ASCII Dungeon Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base interface for all components.
 * Components are data containers that can be attached to nodes.
 * They define behavior and properties that can be edited in the inspector.
 */
export interface IComponent {
  /** Unique identifier for this component instance */
  readonly id: string

  /** Component type name (e.g., 'Rect2D', 'GlyphMap') */
  readonly type: string

  /** Whether this component is enabled */
  enabled: boolean

  /** The node this component is attached to */
  nodeId: string | null

  /** Serialize component to plain object for saving */
  serialize(): Record<string, unknown>

  /** Deserialize from plain object */
  deserialize(data: Record<string, unknown>): void
}

/**
 * Base interface for all nodes.
 * Nodes are the building blocks of scenes - everything is a node.
 */
export interface INode {
  /** Unique identifier */
  readonly id: string

  /** Display name */
  name: string

  /** Node type (e.g., 'Node2D', 'GlyphMapNode') */
  type: string

  /** Parent node ID (null for root) */
  parentId: string | null

  /** Child node IDs */
  childIds: string[]

  /** Component IDs attached to this node */
  componentIds: string[]

  /** Custom metadata */
  meta: Record<string, unknown>
}

/**
 * 2D Rectangle bounds - position and size in 2D space.
 * Used for positioning elements in the 2D editor.
 */
export interface IRect2D {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Glyph data - a single character with color information.
 */
export interface IGlyph {
  char: string
  fgColor: [number, number, number]  // RGB 0-1
  bgColor: [number, number, number]  // RGB 0-1
}

/**
 * Renderer2D interface - base for all 2D renderers.
 */
export interface IRenderer2D {
  /** Render to the terminal/canvas */
  render(
    terminal: unknown,  // Terminal2DRenderer
    bounds: IRect2D,
    viewport: { x: number; y: number; width: number; height: number }
  ): void

  /** Get the natural size of this renderer's content */
  getContentSize(): { width: number; height: number }
}

/**
 * Component metadata for registration and inspector display.
 */
export interface ComponentMeta {
  name: string
  icon: string
  description: string
  category: string
  properties: PropertyMeta[]
}

/**
 * Property metadata for inspector display.
 */
export interface PropertyMeta {
  key: string
  name: string
  type: 'number' | 'string' | 'boolean' | 'color' | 'vec2' | 'text'
  default?: unknown
  min?: number
  max?: number
  step?: number
}
