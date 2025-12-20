// ═══════════════════════════════════════════════════════════════════════════
// RenderLayer - Layer system for ASCII Dungeon rendering pipeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render layers determine the order in which content is composited.
 * Lower values are rendered first (behind), higher values are rendered on top.
 */
export enum RenderLayer {
  BACKGROUND = 0,   // Sky, void, ambient background
  TERRAIN = 1,      // Floor tiles, ground (Terrain component)
  OBJECTS = 2,      // Buildings, furniture, static objects (GlyphMap)
  ENTITIES = 3,     // NPCs, enemies, items
  PLAYER = 4,       // Player character (always on top of entities)
  EFFECTS = 5,      // Particles, spell effects (supports off-grid rendering)
  LIGHTING = 6,     // Light sources, shadows (additive/multiply blend)
  UI = 7,           // HUD, tooltips, menus (screen-space, always on top)
}

/**
 * Blend modes for layer compositing.
 * Different layers can use different blend modes for effects.
 */
export enum BlendMode {
  NORMAL = 0,       // Standard alpha blending (src * alpha + dst * (1-alpha))
  ADDITIVE = 1,     // Add colors together (for glow, light effects)
  MULTIPLY = 2,     // Multiply colors (for shadows, darkening)
  SCREEN = 3,       // Screen blend (for bright, ethereal effects)
}

/**
 * Layer configuration - defines properties for each layer.
 */
export interface LayerConfig {
  layer: RenderLayer
  blendMode: BlendMode
  defaultZIndex: number
  isScreenSpace: boolean  // If true, not affected by camera
}

/**
 * Default layer configurations.
 */
export const LAYER_CONFIGS: Record<RenderLayer, LayerConfig> = {
  [RenderLayer.BACKGROUND]: {
    layer: RenderLayer.BACKGROUND,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.TERRAIN]: {
    layer: RenderLayer.TERRAIN,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.OBJECTS]: {
    layer: RenderLayer.OBJECTS,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.ENTITIES]: {
    layer: RenderLayer.ENTITIES,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.PLAYER]: {
    layer: RenderLayer.PLAYER,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.EFFECTS]: {
    layer: RenderLayer.EFFECTS,
    blendMode: BlendMode.ADDITIVE,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.LIGHTING]: {
    layer: RenderLayer.LIGHTING,
    blendMode: BlendMode.MULTIPLY,
    defaultZIndex: 0,
    isScreenSpace: false,
  },
  [RenderLayer.UI]: {
    layer: RenderLayer.UI,
    blendMode: BlendMode.NORMAL,
    defaultZIndex: 0,
    isScreenSpace: true,
  },
}

/**
 * Parse a layer string to RenderLayer enum.
 * Supports lowercase names from node meta.layer.
 */
export function parseLayerString(layerStr: string | undefined): RenderLayer | undefined {
  if (!layerStr) return undefined

  const normalized = layerStr.toLowerCase().trim()
  switch (normalized) {
    case 'background': return RenderLayer.BACKGROUND
    case 'terrain': return RenderLayer.TERRAIN
    case 'objects': return RenderLayer.OBJECTS
    case 'entities': return RenderLayer.ENTITIES
    case 'player': return RenderLayer.PLAYER
    case 'effects': return RenderLayer.EFFECTS
    case 'lighting': return RenderLayer.LIGHTING
    case 'ui': return RenderLayer.UI
    default: return undefined
  }
}

/**
 * Get the default layer for a node type.
 */
export function getDefaultLayerForNodeType(nodeType: string): RenderLayer {
  switch (nodeType) {
    case 'TerrainNode':
      return RenderLayer.TERRAIN
    case 'GlyphMapNode':
      return RenderLayer.OBJECTS
    case 'GlyphNode':
      return RenderLayer.ENTITIES
    default:
      return RenderLayer.ENTITIES
  }
}

/**
 * Determine the layer for a node based on its meta and type.
 */
export function getNodeLayer(
  nodeType: string,
  meta: Record<string, unknown> | undefined
): RenderLayer {
  // Check for explicit layer in meta
  if (meta?.layer && typeof meta.layer === 'string') {
    const parsed = parseLayerString(meta.layer)
    if (parsed !== undefined) return parsed
  }

  // Check for special flags
  if (meta?.isPlayer) return RenderLayer.PLAYER
  if (meta?.isFloor) return RenderLayer.TERRAIN
  if (meta?.isUI) return RenderLayer.UI

  // Use default based on node type
  return getDefaultLayerForNodeType(nodeType)
}

/**
 * Get all layers in render order (bottom to top).
 */
export function getLayersInOrder(): RenderLayer[] {
  return [
    RenderLayer.BACKGROUND,
    RenderLayer.TERRAIN,
    RenderLayer.OBJECTS,
    RenderLayer.ENTITIES,
    RenderLayer.PLAYER,
    RenderLayer.EFFECTS,
    RenderLayer.LIGHTING,
    RenderLayer.UI,
  ]
}

/**
 * Get layers that are world-space (affected by camera).
 */
export function getWorldSpaceLayers(): RenderLayer[] {
  return getLayersInOrder().filter(l => !LAYER_CONFIGS[l].isScreenSpace)
}

/**
 * Get layers that are screen-space (not affected by camera).
 */
export function getScreenSpaceLayers(): RenderLayer[] {
  return getLayersInOrder().filter(l => LAYER_CONFIGS[l].isScreenSpace)
}
