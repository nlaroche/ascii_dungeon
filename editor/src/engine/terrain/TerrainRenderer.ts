// ═══════════════════════════════════════════════════════════════════════════
// TerrainRenderer - Renders terrain layer from TerrainComponent
// ═══════════════════════════════════════════════════════════════════════════

import { TerrainPrefabRegistry, getTerrainPrefabRegistry } from './TerrainPrefabRegistry'
import type { ResolvedGlyph } from './TerrainPrefabRegistry'

/**
 * Cell data for terrain rendering.
 */
export interface TerrainCell {
  x: number
  y: number
  glyph: ResolvedGlyph
  prefabId: string
}

/**
 * Terrain grid data for a single TerrainComponent.
 */
export interface TerrainGrid {
  width: number
  height: number
  offsetX: number
  offsetY: number
  cells: TerrainCell[]
}

/**
 * TerrainRenderer - Builds renderable data from TerrainComponent + TerrainPrefabRegistry.
 *
 * This class bridges the gap between:
 * - TerrainComponent (stores prefab IDs in a grid)
 * - TerrainPrefabRegistry (resolves IDs to glyph data)
 * - The actual renderer (needs characters and colors)
 *
 * Call buildTerrainLayer() each frame to get updated cell data with animations.
 */
export class TerrainRenderer {
  private registry: TerrainPrefabRegistry

  constructor(registry?: TerrainPrefabRegistry) {
    this.registry = registry || getTerrainPrefabRegistry()
  }

  /**
   * Build terrain layer from a grid of prefab IDs.
   * Returns resolved cell data ready for rendering.
   *
   * @param grid - 2D array of prefab IDs (null = empty cell)
   * @param width - Grid width
   * @param height - Grid height
   * @param offsetX - World X offset (from node position)
   * @param offsetY - World Y offset (from node position)
   * @param time - Current time for animation
   */
  buildTerrainLayer(
    grid: (string | null)[],
    width: number,
    height: number,
    offsetX: number = 0,
    offsetY: number = 0,
    time: number = 0
  ): TerrainGrid {
    const cells: TerrainCell[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const prefabId = grid[y * width + x]
        if (prefabId === null) continue

        const glyph = this.registry.getGlyph(prefabId, time)

        cells.push({
          x: offsetX + x,
          y: offsetY + y,
          glyph,
          prefabId
        })
      }
    }

    return { width, height, offsetX, offsetY, cells }
  }

  /**
   * Build terrain layer from a TerrainComponent directly.
   */
  buildFromComponent(
    terrain: { width: number; height: number; get: (x: number, y: number) => string | null },
    offsetX: number = 0,
    offsetY: number = 0,
    time: number = 0
  ): TerrainGrid {
    const cells: TerrainCell[] = []

    for (let y = 0; y < terrain.height; y++) {
      for (let x = 0; x < terrain.width; x++) {
        const prefabId = terrain.get(x, y)
        if (prefabId === null) continue

        const glyph = this.registry.getGlyph(prefabId, time)

        cells.push({
          x: offsetX + x,
          y: offsetY + y,
          glyph,
          prefabId
        })
      }
    }

    return { width: terrain.width, height: terrain.height, offsetX, offsetY, cells }
  }

  /**
   * Get the collision value at a world position.
   */
  getCollisionAt(
    grid: (string | null)[],
    width: number,
    height: number,
    worldX: number,
    worldY: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): { blocksMovement: boolean; blocksVision: boolean } | null {
    const localX = Math.floor(worldX - offsetX)
    const localY = Math.floor(worldY - offsetY)

    if (localX < 0 || localX >= width || localY < 0 || localY >= height) {
      return null
    }

    const prefabId = grid[localY * width + localX]
    if (prefabId === null) {
      return { blocksMovement: false, blocksVision: false }
    }

    const collider = this.registry.getCollider(prefabId)
    if (!collider) {
      return { blocksMovement: false, blocksVision: false }
    }

    return {
      blocksMovement: collider.blocksMovement,
      blocksVision: collider.blocksVision
    }
  }

  /**
   * Get light sources from terrain.
   */
  getLightSources(
    grid: (string | null)[],
    width: number,
    height: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): Array<{ x: number; y: number; intensity: number; color: [number, number, number] }> {
    const lights: Array<{ x: number; y: number; intensity: number; color: [number, number, number] }> = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const prefabId = grid[y * width + x]
        if (prefabId === null) continue

        const prefab = this.registry.get(prefabId)
        if (!prefab || prefab.glyph.emission <= 0) continue

        lights.push({
          x: offsetX + x,
          y: offsetY + y,
          intensity: prefab.glyph.emission,
          color: prefab.glyph.emissionColor
        })
      }
    }

    return lights
  }

  /**
   * Set the registry to use.
   */
  setRegistry(registry: TerrainPrefabRegistry): void {
    this.registry = registry
  }

  /**
   * Get the current registry.
   */
  getRegistry(): TerrainPrefabRegistry {
    return this.registry
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global instance
// ─────────────────────────────────────────────────────────────────────────────

let _globalRenderer: TerrainRenderer | null = null

/**
 * Get the global terrain renderer instance.
 */
export function getTerrainRenderer(): TerrainRenderer {
  if (!_globalRenderer) {
    _globalRenderer = new TerrainRenderer()
  }
  return _globalRenderer
}
