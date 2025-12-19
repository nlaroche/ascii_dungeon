// ═══════════════════════════════════════════════════════════════════════════
// Scene Manager - Scene loading and entity management for visual scripting
// ═══════════════════════════════════════════════════════════════════════════

import { GameEventBus, createGameEvent } from './events'

// System-level source for scene events
const SCENE_SOURCE = { id: '__scene__' }

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneData {
  name: string
  entities: EntityData[]
  variables?: Record<string, unknown>
}

export interface EntityData {
  id: string
  name?: string
  tags?: string[]
  layer?: string
  enabled?: boolean
  position?: { x: number; y: number }
  parent?: string
  children?: string[]
  components?: ComponentData[]
}

export interface ComponentData {
  type: string
  properties: Record<string, unknown>
}

export interface PrefabData {
  id: string
  name: string
  entity: EntityData
}

export interface EntityQuery {
  name?: string
  tag?: string
  layer?: string
  hasComponent?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene Manager
// ─────────────────────────────────────────────────────────────────────────────

export class SceneManager {
  private currentScene: SceneData | null = null
  private entities: Map<string, EntityData> = new Map()
  private entitiesByName: Map<string, EntityData> = new Map()
  private entitiesByTag: Map<string, Set<EntityData>> = new Map()
  private entitiesByLayer: Map<string, Set<EntityData>> = new Map()
  private prefabs: Map<string, PrefabData> = new Map()
  private sceneLoaders: Map<string, () => Promise<SceneData> | SceneData> = new Map()
  private pendingDestroys: Map<string, number> = new Map() // entityId -> delay remaining

  // ─────────────────────────────────────────────────────────────────────────
  // Scene Loading
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a scene loader function.
   */
  registerScene(name: string, loader: () => Promise<SceneData> | SceneData): void {
    this.sceneLoaders.set(name, loader)
  }

  /**
   * Register a prefab for instantiation.
   */
  registerPrefab(prefab: PrefabData): void {
    this.prefabs.set(prefab.id, prefab)
  }

  /**
   * Load a scene by name.
   */
  async loadScene(name: string): Promise<boolean> {
    const loader = this.sceneLoaders.get(name)
    if (!loader) {
      console.warn(`[SceneManager] Scene not found: ${name}`)
      return false
    }

    // Emit before-load event
    const beforeEvent = createGameEvent({
      type: 'SceneUnload',
      source: SCENE_SOURCE,
      data: { name: this.currentScene?.name },
      routing: 'broadcast',
    })
    await GameEventBus.emit(beforeEvent)

    // Clear current scene
    this.clearScene()

    // Load new scene
    try {
      const sceneData = await loader()
      this.currentScene = sceneData

      // Index all entities
      for (const entity of sceneData.entities) {
        this.addEntity(entity)
      }

      // Emit loaded event
      const loadedEvent = createGameEvent({
        type: 'SceneLoaded',
        source: SCENE_SOURCE,
        data: { name: sceneData.name },
        routing: 'broadcast',
      })
      await GameEventBus.emit(loadedEvent)

      return true
    } catch (error) {
      console.error(`[SceneManager] Failed to load scene: ${name}`, error)
      return false
    }
  }

  /**
   * Reload the current scene.
   */
  async reloadScene(): Promise<boolean> {
    if (!this.currentScene) return false
    return this.loadScene(this.currentScene.name)
  }

  /**
   * Get current scene name.
   */
  getSceneName(): string | null {
    return this.currentScene?.name ?? null
  }

  /**
   * Clear the current scene.
   */
  private clearScene(): void {
    // Emit destroy events for all entities
    for (const [id] of this.entities) {
      const event = createGameEvent({
        type: 'Destroy',
        data: { entityId: id },
        source: { id },
        routing: 'direct',
      })
      GameEventBus.emit(event)
    }

    this.entities.clear()
    this.entitiesByName.clear()
    this.entitiesByTag.clear()
    this.entitiesByLayer.clear()
    this.pendingDestroys.clear()
    this.currentScene = null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entity Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add an entity to the scene.
   */
  addEntity(entity: EntityData): void {
    this.entities.set(entity.id, entity)

    // Index by name
    if (entity.name) {
      this.entitiesByName.set(entity.name, entity)
    }

    // Index by tags
    if (entity.tags) {
      for (const tag of entity.tags) {
        if (!this.entitiesByTag.has(tag)) {
          this.entitiesByTag.set(tag, new Set())
        }
        this.entitiesByTag.get(tag)!.add(entity)
      }
    }

    // Index by layer
    if (entity.layer) {
      if (!this.entitiesByLayer.has(entity.layer)) {
        this.entitiesByLayer.set(entity.layer, new Set())
      }
      this.entitiesByLayer.get(entity.layer)!.add(entity)
    }
  }

  /**
   * Remove an entity from the scene.
   */
  private removeEntity(id: string): EntityData | undefined {
    const entity = this.entities.get(id)
    if (!entity) return undefined

    this.entities.delete(id)

    // Remove from name index
    if (entity.name) {
      this.entitiesByName.delete(entity.name)
    }

    // Remove from tag indices
    if (entity.tags) {
      for (const tag of entity.tags) {
        this.entitiesByTag.get(tag)?.delete(entity)
      }
    }

    // Remove from layer index
    if (entity.layer) {
      this.entitiesByLayer.get(entity.layer)?.delete(entity)
    }

    return entity
  }

  /**
   * Get entity by ID.
   */
  getEntity(id: string): EntityData | undefined {
    return this.entities.get(id)
  }

  /**
   * Find entity by name.
   */
  findByName(name: string): EntityData | undefined {
    return this.entitiesByName.get(name)
  }

  /**
   * Find entities by tag.
   */
  findByTag(tag: string): EntityData[] {
    return Array.from(this.entitiesByTag.get(tag) ?? [])
  }

  /**
   * Find entities by layer.
   */
  findByLayer(layer: string): EntityData[] {
    return Array.from(this.entitiesByLayer.get(layer) ?? [])
  }

  /**
   * Find entities matching a query.
   */
  findEntities(query: EntityQuery): EntityData[] {
    let results: EntityData[] | null = null

    // Start with most restrictive filter
    if (query.name) {
      const entity = this.entitiesByName.get(query.name)
      results = entity ? [entity] : []
    } else if (query.tag) {
      results = this.findByTag(query.tag)
    } else if (query.layer) {
      results = this.findByLayer(query.layer)
    } else {
      results = Array.from(this.entities.values())
    }

    // Apply additional filters
    if (query.hasComponent && results.length > 0) {
      results = results.filter(e =>
        e.components?.some(c => c.type === query.hasComponent)
      )
    }

    return results
  }

  /**
   * Get parent entity.
   */
  getParent(entityId: string): EntityData | undefined {
    const entity = this.entities.get(entityId)
    if (!entity?.parent) return undefined
    return this.entities.get(entity.parent)
  }

  /**
   * Get child entities.
   */
  getChildren(entityId: string): EntityData[] {
    const entity = this.entities.get(entityId)
    if (!entity?.children) return []
    return entity.children
      .map(id => this.entities.get(id))
      .filter((e): e is EntityData => e !== undefined)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Instantiation & Destruction
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Instantiate a prefab.
   */
  instantiate(
    prefabId: string,
    position?: { x: number; y: number },
    parentId?: string
  ): EntityData | null {
    const prefab = this.prefabs.get(prefabId)
    if (!prefab) {
      console.warn(`[SceneManager] Prefab not found: ${prefabId}`)
      return null
    }

    // Clone the entity data with a new ID
    const newId = `${prefab.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const entity: EntityData = {
      ...JSON.parse(JSON.stringify(prefab.entity)),
      id: newId,
      position: position ?? prefab.entity.position,
      parent: parentId,
    }

    // Add to scene
    this.addEntity(entity)

    // Add to parent's children
    if (parentId) {
      const parent = this.entities.get(parentId)
      if (parent) {
        parent.children = parent.children ?? []
        parent.children.push(newId)
      }
    }

    // Emit spawn event
    const event = createGameEvent({
      type: 'Spawn',
      data: { entityId: newId, prefabId },
      source: { id: newId },
      routing: 'broadcast',
    })
    GameEventBus.emit(event)

    return entity
  }

  /**
   * Destroy an entity (optionally with delay).
   */
  destroy(entityId: string, delay = 0): void {
    if (delay > 0) {
      this.pendingDestroys.set(entityId, delay)
      return
    }

    const entity = this.entities.get(entityId)
    if (!entity) return

    // Emit destroy event before removal
    const event = createGameEvent({
      type: 'Destroy',
      data: { entityId },
      source: { id: entityId },
      routing: 'direct',
    })
    GameEventBus.emit(event)

    // Destroy children first
    if (entity.children) {
      for (const childId of [...entity.children]) {
        this.destroy(childId)
      }
    }

    // Remove from parent
    if (entity.parent) {
      const parent = this.entities.get(entity.parent)
      if (parent?.children) {
        parent.children = parent.children.filter(id => id !== entityId)
      }
    }

    // Remove entity
    this.removeEntity(entityId)
    this.pendingDestroys.delete(entityId)
  }

  /**
   * Update pending destroys. Call each frame.
   */
  update(deltaTime: number): void {
    for (const [entityId, remaining] of this.pendingDestroys) {
      const newRemaining = remaining - deltaTime
      if (newRemaining <= 0) {
        this.pendingDestroys.delete(entityId)
        this.destroy(entityId)
      } else {
        this.pendingDestroys.set(entityId, newRemaining)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entity State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set entity enabled state.
   */
  setEnabled(entityId: string, enabled: boolean): void {
    const entity = this.entities.get(entityId)
    if (entity) {
      entity.enabled = enabled

      const event = createGameEvent({
        type: enabled ? 'Enable' : 'Disable',
        data: { entityId },
        source: { id: entityId },
        routing: 'direct',
      })
      GameEventBus.emit(event)
    }
  }

  /**
   * Check if entity is enabled.
   */
  isEnabled(entityId: string): boolean {
    return this.entities.get(entityId)?.enabled ?? true
  }

  /**
   * Set entity position.
   */
  setPosition(entityId: string, x: number, y: number): void {
    const entity = this.entities.get(entityId)
    if (entity) {
      entity.position = { x, y }
    }
  }

  /**
   * Get entity position.
   */
  getPosition(entityId: string): { x: number; y: number } | undefined {
    return this.entities.get(entityId)?.position
  }

  /**
   * Translate entity by offset.
   */
  translate(entityId: string, dx: number, dy: number): void {
    const entity = this.entities.get(entityId)
    if (entity) {
      const pos = entity.position ?? { x: 0, y: 0 }
      entity.position = { x: pos.x + dx, y: pos.y + dy }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Spatial Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate distance between two entities.
   */
  distance(entityA: string, entityB: string): number {
    const posA = this.getPosition(entityA)
    const posB = this.getPosition(entityB)
    if (!posA || !posB) return Infinity

    const dx = posB.x - posA.x
    const dy = posB.y - posA.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Calculate direction from A to B.
   */
  direction(fromEntity: string, toEntity: string): { x: number; y: number; angle: number } | null {
    const posA = this.getPosition(fromEntity)
    const posB = this.getPosition(toEntity)
    if (!posA || !posB) return null

    const dx = posB.x - posA.x
    const dy = posB.y - posA.y
    const len = Math.sqrt(dx * dx + dy * dy)

    if (len === 0) {
      return { x: 0, y: 0, angle: 0 }
    }

    return {
      x: dx / len,
      y: dy / len,
      angle: Math.atan2(dy, dx),
    }
  }

  /**
   * Find entities within radius of a position.
   */
  findInRadius(x: number, y: number, radius: number): EntityData[] {
    const results: EntityData[] = []
    const radiusSq = radius * radius

    for (const entity of this.entities.values()) {
      if (!entity.position) continue
      const dx = entity.position.x - x
      const dy = entity.position.y - y
      if (dx * dx + dy * dy <= radiusSq) {
        results.push(entity)
      }
    }

    return results
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get entity count.
   */
  getEntityCount(): number {
    return this.entities.size
  }

  /**
   * Get all entity IDs.
   */
  getAllEntityIds(): string[] {
    return Array.from(this.entities.keys())
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Scene = new SceneManager()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

export function loadScene(name: string): Promise<boolean> {
  return Scene.loadScene(name)
}

export function reloadScene(): Promise<boolean> {
  return Scene.reloadScene()
}

export function getSceneName(): string | null {
  return Scene.getSceneName()
}

export function findEntity(name: string): EntityData | undefined {
  return Scene.findByName(name)
}

export function findEntitiesByTag(tag: string): EntityData[] {
  return Scene.findByTag(tag)
}

export function instantiate(
  prefabId: string,
  x?: number,
  y?: number,
  parentId?: string
): EntityData | null {
  return Scene.instantiate(
    prefabId,
    x !== undefined && y !== undefined ? { x, y } : undefined,
    parentId
  )
}

export function destroy(entityId: string, delay = 0): void {
  Scene.destroy(entityId, delay)
}
