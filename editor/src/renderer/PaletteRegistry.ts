// ═══════════════════════════════════════════════════════════════════════════
// PaletteRegistry - Prefab lookup for Terrain component rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Terrain prefab definition - visual and collision properties for a tile type.
 */
export interface TerrainPrefab {
  id: string
  char: string
  fg: [number, number, number]
  bg: [number, number, number]
  emission?: number
  emissionColor?: [number, number, number]
  blocksMovement?: boolean
  blocksVision?: boolean
  isAnimated?: boolean
  animationFrames?: string[]  // Characters to cycle through
  animationSpeed?: number     // Frames per second
}

/**
 * Built-in terrain prefabs for common tile types.
 * These are always available without loading from project files.
 */
export const BUILTIN_PREFABS: TerrainPrefab[] = [
  // Floor tiles
  {
    id: 'floor',
    char: '.',
    fg: [0.3, 0.3, 0.3],
    bg: [0.08, 0.08, 0.08],
    blocksMovement: false,
    blocksVision: false,
  },
  {
    id: 'floor-alt',
    char: ',',
    fg: [0.25, 0.25, 0.25],
    bg: [0.06, 0.06, 0.06],
    blocksMovement: false,
    blocksVision: false,
  },

  // Walls
  {
    id: 'wall',
    char: '#',
    fg: [0.6, 0.5, 0.4],
    bg: [0.15, 0.12, 0.1],
    blocksMovement: true,
    blocksVision: true,
  },
  {
    id: 'wall-stone',
    char: '█',
    fg: [0.5, 0.5, 0.5],
    bg: [0.2, 0.2, 0.2],
    blocksMovement: true,
    blocksVision: true,
  },

  // Doors
  {
    id: 'door-closed',
    char: '+',
    fg: [0.6, 0.4, 0.2],
    bg: [0.1, 0.08, 0.05],
    blocksMovement: true,
    blocksVision: true,
  },
  {
    id: 'door-open',
    char: '/',
    fg: [0.6, 0.4, 0.2],
    bg: [0.08, 0.08, 0.08],
    blocksMovement: false,
    blocksVision: false,
  },

  // Nature
  {
    id: 'grass',
    char: ',',
    fg: [0.2, 0.5, 0.2],
    bg: [0.05, 0.1, 0.05],
    blocksMovement: false,
    blocksVision: false,
  },
  {
    id: 'grass-tall',
    char: '"',
    fg: [0.3, 0.6, 0.3],
    bg: [0.05, 0.1, 0.05],
    blocksMovement: false,
    blocksVision: false,
  },
  {
    id: 'tree',
    char: '♣',
    fg: [0.2, 0.6, 0.2],
    bg: [0.05, 0.1, 0.05],
    blocksMovement: true,
    blocksVision: true,
  },

  // Water
  {
    id: 'water',
    char: '~',
    fg: [0.3, 0.5, 0.8],
    bg: [0.1, 0.2, 0.4],
    blocksMovement: true,
    blocksVision: false,
    isAnimated: true,
    animationFrames: ['~', '≈', '~', '∼'],
    animationSpeed: 2,
  },
  {
    id: 'water-shallow',
    char: '~',
    fg: [0.4, 0.6, 0.8],
    bg: [0.15, 0.25, 0.35],
    blocksMovement: false,
    blocksVision: false,
  },

  // Special
  {
    id: 'void',
    char: ' ',
    fg: [0, 0, 0],
    bg: [0, 0, 0],
    blocksMovement: true,
    blocksVision: true,
  },
  {
    id: 'stairs-down',
    char: '>',
    fg: [0.8, 0.8, 0.8],
    bg: [0.1, 0.1, 0.1],
    blocksMovement: false,
    blocksVision: false,
  },
  {
    id: 'stairs-up',
    char: '<',
    fg: [0.8, 0.8, 0.8],
    bg: [0.1, 0.1, 0.1],
    blocksMovement: false,
    blocksVision: false,
  },

  // Paths
  {
    id: 'path',
    char: '·',
    fg: [0.5, 0.45, 0.4],
    bg: [0.12, 0.1, 0.08],
    blocksMovement: false,
    blocksVision: false,
  },
  {
    id: 'road',
    char: '░',
    fg: [0.4, 0.35, 0.3],
    bg: [0.15, 0.12, 0.1],
    blocksMovement: false,
    blocksVision: false,
  },
]

/**
 * Default prefab used when a prefab ID is not found.
 */
export const DEFAULT_PREFAB: TerrainPrefab = {
  id: 'unknown',
  char: '?',
  fg: [1, 0, 1],  // Magenta for visibility
  bg: [0.2, 0, 0.2],
  blocksMovement: false,
  blocksVision: false,
}

/**
 * PaletteRegistry manages terrain prefab definitions.
 * It provides fast lookup for Terrain component rendering.
 */
export class PaletteRegistry {
  private prefabs: Map<string, TerrainPrefab> = new Map()
  private projectPath: string | null = null

  constructor() {
    this.registerBuiltins()
  }

  /**
   * Register all built-in prefabs.
   */
  registerBuiltins(): void {
    for (const prefab of BUILTIN_PREFABS) {
      this.prefabs.set(prefab.id, prefab)
    }
  }

  /**
   * Register a custom prefab.
   */
  registerPrefab(prefab: TerrainPrefab): void {
    this.prefabs.set(prefab.id, prefab)
  }

  /**
   * Get a prefab by ID. Returns DEFAULT_PREFAB if not found.
   */
  getPrefab(id: string): TerrainPrefab {
    return this.prefabs.get(id) ?? DEFAULT_PREFAB
  }

  /**
   * Check if a prefab exists.
   */
  hasPrefab(id: string): boolean {
    return this.prefabs.has(id)
  }

  /**
   * Get all registered prefab IDs.
   */
  getAllPrefabIds(): string[] {
    return Array.from(this.prefabs.keys())
  }

  /**
   * Get all prefabs.
   */
  getAllPrefabs(): TerrainPrefab[] {
    return Array.from(this.prefabs.values())
  }

  /**
   * Load prefabs from a project's palette directory.
   * Palette files are JSON with prefab definitions.
   */
  async loadFromProject(palettePath: string): Promise<void> {
    this.projectPath = palettePath
    // TODO: Implement loading from project files
    // For now, we only use built-in prefabs
    console.log('[PaletteRegistry] Would load from:', palettePath)
  }

  /**
   * Clear all custom prefabs (keeps built-ins).
   */
  clearCustomPrefabs(): void {
    const builtinIds = new Set(BUILTIN_PREFABS.map(p => p.id))
    for (const id of this.prefabs.keys()) {
      if (!builtinIds.has(id)) {
        this.prefabs.delete(id)
      }
    }
  }

  /**
   * Pack RGB color to 32-bit integer (RGBA format).
   */
  static packColor(r: number, g: number, b: number, a: number = 1): number {
    const ri = Math.round(Math.min(1, Math.max(0, r)) * 255)
    const gi = Math.round(Math.min(1, Math.max(0, g)) * 255)
    const bi = Math.round(Math.min(1, Math.max(0, b)) * 255)
    const ai = Math.round(Math.min(1, Math.max(0, a)) * 255)
    return ri | (gi << 8) | (bi << 16) | (ai << 24)
  }

  /**
   * Get packed colors for a prefab.
   */
  getPackedColors(id: string): { fg: number; bg: number } {
    const prefab = this.getPrefab(id)
    return {
      fg: PaletteRegistry.packColor(prefab.fg[0], prefab.fg[1], prefab.fg[2]),
      bg: PaletteRegistry.packColor(prefab.bg[0], prefab.bg[1], prefab.bg[2]),
    }
  }
}

// Singleton instance for global access
let globalPaletteRegistry: PaletteRegistry | null = null

/**
 * Get the global palette registry instance.
 */
export function getPaletteRegistry(): PaletteRegistry {
  if (!globalPaletteRegistry) {
    globalPaletteRegistry = new PaletteRegistry()
  }
  return globalPaletteRegistry
}

/**
 * Reset the global palette registry (for testing).
 */
export function resetPaletteRegistry(): void {
  globalPaletteRegistry = null
}
