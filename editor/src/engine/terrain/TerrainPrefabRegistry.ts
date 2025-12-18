// ═══════════════════════════════════════════════════════════════════════════
// TerrainPrefabRegistry - Resolves prefab IDs to renderable data
// ═══════════════════════════════════════════════════════════════════════════

import type { Prefab } from '../../stores/engineState'

/**
 * Glyph data resolved from a prefab.
 */
export interface ResolvedGlyph {
  char: string
  fg: [number, number, number]
  bg: [number, number, number]
  emission: number
  emissionColor: [number, number, number]
}

/**
 * Animation data resolved from a prefab.
 */
export interface ResolvedAnimation {
  frames: string
  fps: number
  randomOffset: number
}

/**
 * Collision data resolved from a prefab.
 */
export interface ResolvedCollider {
  blocksMovement: boolean
  blocksVision: boolean
  isTrigger: boolean
}

/**
 * Fully resolved prefab data for terrain rendering.
 */
export interface ResolvedPrefab {
  id: string
  name: string
  glyph: ResolvedGlyph
  animation: ResolvedAnimation | null
  collider: ResolvedCollider | null
}

/**
 * TerrainPrefabRegistry - Resolves terrain prefab IDs to renderable data.
 *
 * This is the key link between the TerrainComponent (which stores prefab IDs)
 * and the renderer (which needs actual characters and colors to display).
 *
 * Prefabs are loaded from the project's palettes and stored here for
 * efficient lookup during rendering.
 */
export class TerrainPrefabRegistry {
  // Map of prefab ID -> resolved data
  private _prefabs: Map<string, ResolvedPrefab> = new Map()

  // Default glyph for missing prefabs
  private _defaultGlyph: ResolvedGlyph = {
    char: '?',
    fg: [1, 0, 1],
    bg: [0, 0, 0],
    emission: 0,
    emissionColor: [1, 1, 1]
  }

  /**
   * Register a prefab from the palette system.
   */
  registerPrefab(prefab: Prefab): void {
    const resolved = this._resolvePrefab(prefab)
    this._prefabs.set(prefab.id, resolved)
  }

  /**
   * Register multiple prefabs at once.
   */
  registerPrefabs(prefabs: Prefab[]): void {
    for (const prefab of prefabs) {
      this.registerPrefab(prefab)
    }
  }

  /**
   * Unregister a prefab.
   */
  unregisterPrefab(id: string): void {
    this._prefabs.delete(id)
  }

  /**
   * Clear all registered prefabs.
   */
  clear(): void {
    this._prefabs.clear()
  }

  /**
   * Check if a prefab is registered.
   */
  has(id: string): boolean {
    return this._prefabs.has(id)
  }

  /**
   * Get a resolved prefab by ID.
   */
  get(id: string): ResolvedPrefab | null {
    return this._prefabs.get(id) || null
  }

  /**
   * Get the character to render for a prefab at a given time.
   * Handles animation if the prefab has an Animator component.
   */
  getGlyph(id: string, time: number = 0): ResolvedGlyph {
    const prefab = this._prefabs.get(id)
    if (!prefab) return this._defaultGlyph

    // If no animation, return static glyph
    if (!prefab.animation || !prefab.animation.frames) {
      return prefab.glyph
    }

    // Calculate animated character
    const { frames, fps, randomOffset } = prefab.animation
    if (frames.length <= 1) return prefab.glyph

    const effectiveTime = time + randomOffset
    const frameIndex = Math.floor(effectiveTime * fps) % frames.length
    const animatedChar = frames[frameIndex]

    return {
      ...prefab.glyph,
      char: animatedChar
    }
  }

  /**
   * Get collision data for a prefab.
   */
  getCollider(id: string): ResolvedCollider | null {
    return this._prefabs.get(id)?.collider || null
  }

  /**
   * Check if a prefab blocks movement.
   */
  blocksMovement(id: string): boolean {
    return this._prefabs.get(id)?.collider?.blocksMovement ?? false
  }

  /**
   * Check if a prefab blocks vision.
   */
  blocksVision(id: string): boolean {
    return this._prefabs.get(id)?.collider?.blocksVision ?? false
  }

  /**
   * Get all registered prefab IDs.
   */
  getAllIds(): string[] {
    return Array.from(this._prefabs.keys())
  }

  /**
   * Get all registered prefabs.
   */
  getAll(): ResolvedPrefab[] {
    return Array.from(this._prefabs.values())
  }

  /**
   * Resolve a Prefab into renderable data.
   */
  private _resolvePrefab(prefab: Prefab): ResolvedPrefab {
    const glyph = this._extractGlyph(prefab)
    const animation = this._extractAnimation(prefab)
    const collider = this._extractCollider(prefab)

    return {
      id: prefab.id,
      name: prefab.name,
      glyph,
      animation,
      collider
    }
  }

  /**
   * Extract glyph data from a prefab's components.
   */
  private _extractGlyph(prefab: Prefab): ResolvedGlyph {
    const components = prefab.template.components

    // Look for Glyph component first
    const glyphComp = components.find(c => c.script === 'Glyph')
    if (glyphComp?.properties) {
      return {
        char: (glyphComp.properties.char as string) || '@',
        fg: (glyphComp.properties.fg as [number, number, number]) || [1, 1, 1],
        bg: (glyphComp.properties.bg as [number, number, number]) || [0, 0, 0],
        emission: (glyphComp.properties.emission as number) || 0,
        emissionColor: (glyphComp.properties.emissionColor as [number, number, number]) || [1, 1, 1]
      }
    }

    // Fall back to GlyphImage/GlyphMap (extract first char)
    const glyphImage = components.find(c => c.script === 'GlyphImage' || c.script === 'GlyphMap')
    if (glyphImage?.properties?.cells) {
      const cells = glyphImage.properties.cells as string
      const firstChar = cells.trim()[0] || '?'
      return {
        char: firstChar,
        fg: [1, 1, 1],
        bg: [0, 0, 0],
        emission: 0,
        emissionColor: [1, 1, 1]
      }
    }

    // Fall back to Ascii component
    const asciiComp = components.find(c => c.script === 'Ascii')
    if (asciiComp?.properties?.art) {
      const art = asciiComp.properties.art as string
      const firstChar = art.trim()[0] || '?'
      return {
        char: firstChar,
        fg: [1, 1, 1],
        bg: [0, 0, 0],
        emission: 0,
        emissionColor: [1, 1, 1]
      }
    }

    return this._defaultGlyph
  }

  /**
   * Extract animation data from a prefab's components.
   */
  private _extractAnimation(prefab: Prefab): ResolvedAnimation | null {
    const components = prefab.template.components

    const animator = components.find(c => c.script === 'Animator')
    if (!animator?.properties) return null

    const frames = animator.properties.frames as string
    if (!frames || frames.length <= 1) return null

    return {
      frames,
      fps: (animator.properties.fps as number) || 4,
      randomOffset: Math.random() * ((animator.properties.randomOffset as number) || 0)
    }
  }

  /**
   * Extract collision data from a prefab's components.
   */
  private _extractCollider(prefab: Prefab): ResolvedCollider | null {
    const components = prefab.template.components

    const collider = components.find(c => c.script === 'Collider')
    if (!collider?.properties) return null

    return {
      blocksMovement: (collider.properties.blocksMovement as boolean) ?? true,
      blocksVision: (collider.properties.blocksVision as boolean) ?? true,
      isTrigger: collider.properties.colliderType === 'trigger'
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global instance for convenience
// ─────────────────────────────────────────────────────────────────────────────

let _globalRegistry: TerrainPrefabRegistry | null = null

/**
 * Get the global terrain prefab registry instance.
 */
export function getTerrainPrefabRegistry(): TerrainPrefabRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new TerrainPrefabRegistry()
  }
  return _globalRegistry
}

/**
 * Reset the global registry (useful for testing).
 */
export function resetTerrainPrefabRegistry(): void {
  _globalRegistry = null
}
