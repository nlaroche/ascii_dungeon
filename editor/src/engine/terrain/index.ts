// ═══════════════════════════════════════════════════════════════════════════
// Terrain System - Two-layer terrain/object model
// ═══════════════════════════════════════════════════════════════════════════

export {
  TerrainPrefabRegistry,
  getTerrainPrefabRegistry,
  resetTerrainPrefabRegistry
} from './TerrainPrefabRegistry'

export type {
  ResolvedGlyph,
  ResolvedAnimation,
  ResolvedCollider,
  ResolvedPrefab
} from './TerrainPrefabRegistry'

export {
  TerrainRenderer,
  getTerrainRenderer
} from './TerrainRenderer'

export type {
  TerrainCell,
  TerrainGrid
} from './TerrainRenderer'
