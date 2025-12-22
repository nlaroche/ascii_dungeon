// ═══════════════════════════════════════════════════════════════════════════
// TransformCache - Efficient world position caching with dirty flag propagation
// Provides O(1) world position lookups with lazy recalculation
// ═══════════════════════════════════════════════════════════════════════════

import type { EntityMaps, NormalizedNode, NormalizedComponent } from '../../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CachedWorldPosition {
  x: number
  y: number
  version: number  // Frame version when this was computed
}

// ─────────────────────────────────────────────────────────────────────────────
// TransformCache
// ─────────────────────────────────────────────────────────────────────────────

export class TransformCache {
  private static instance: TransformCache

  // Cache of world positions by node ID
  private worldPositions: Map<string, CachedWorldPosition> = new Map()

  // Set of nodes that need recalculation
  private dirtyNodes: Set<string> = new Set()

  // Frame version - incremented each frame to detect stale cache entries
  private frameVersion: number = 0

  // Entity accessor - injected by PlayModeManager
  private getEntities: (() => EntityMaps) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Singleton
  // ─────────────────────────────────────────────────────────────────────────

  static getInstance(): TransformCache {
    if (!TransformCache.instance) {
      TransformCache.instance = new TransformCache()
    }
    return TransformCache.instance
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set the entity accessor function
   * Called by PlayModeManager during initialization
   */
  setEntitiesAccessor(getEntities: () => EntityMaps): void {
    this.getEntities = getEntities
  }

  /**
   * Reset the cache (called when play mode starts/stops)
   */
  reset(): void {
    this.worldPositions.clear()
    this.dirtyNodes.clear()
    this.frameVersion = 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Frame Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called at the start of each frame
   * Increments the version to detect stale cache entries
   */
  beginFrame(): void {
    this.frameVersion++
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dirty Flag Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark a node and all its descendants as dirty
   * Called when a node's position changes
   */
  markDirty(nodeId: string): void {
    this.dirtyNodes.add(nodeId)

    // Propagate to all descendants
    const entities = this.getEntities?.()
    if (entities) {
      this.markDescendantsDirty(nodeId, entities)
    }
  }

  /**
   * Recursively mark all descendants as dirty
   */
  private markDescendantsDirty(nodeId: string, entities: EntityMaps): void {
    const node = entities.nodes[nodeId]
    if (!node) return

    for (const childId of node.childIds) {
      this.dirtyNodes.add(childId)
      this.markDescendantsDirty(childId, entities)
    }
  }

  /**
   * Check if a node is dirty (needs recalculation)
   */
  private isDirty(nodeId: string): boolean {
    return this.dirtyNodes.has(nodeId)
  }

  /**
   * Clear the dirty flag for a node
   */
  private clearDirty(nodeId: string): void {
    this.dirtyNodes.delete(nodeId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // World Position Access
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the world position of a node
   * O(1) if cached and clean, O(depth) if dirty or stale
   */
  getWorldPosition(nodeId: string): { x: number; y: number } | null {
    const entities = this.getEntities?.()
    if (!entities) return null

    const node = entities.nodes[nodeId]
    if (!node) return null

    // Check cache
    const cached = this.worldPositions.get(nodeId)
    if (cached && cached.version === this.frameVersion && !this.isDirty(nodeId)) {
      // Cache hit - return immediately
      return { x: cached.x, y: cached.y }
    }

    // Cache miss or stale - recalculate
    return this.recalculateWorldPosition(nodeId, entities)
  }

  /**
   * Recalculate world position by walking up the parent chain
   * Caches all intermediate results for efficiency
   *
   * World position formula with anchor/pivot:
   * worldPos = parentWorldPos + (anchor * parentSize) - (pivot * ownSize) + localOffset
   */
  private recalculateWorldPosition(
    nodeId: string,
    entities: EntityMaps
  ): { x: number; y: number } | null {
    const node = entities.nodes[nodeId]
    if (!node) return null

    // Build the ancestor chain (from node to root)
    const chain: string[] = []
    let currentId: string | null = nodeId
    while (currentId) {
      chain.push(currentId)
      const current: NormalizedNode | undefined = entities.nodes[currentId]
      currentId = current?.parentId ?? null
    }

    // Process from root to node, accumulating positions
    let worldX = 0
    let worldY = 0
    let parentWidth = 0
    let parentHeight = 0

    // Reverse to go root -> node
    for (let i = chain.length - 1; i >= 0; i--) {
      const id = chain[i]
      const n = entities.nodes[id]
      if (!n) continue

      // Check if this ancestor has a valid cache (optimization)
      const ancestorCache = this.worldPositions.get(id)
      if (ancestorCache &&
          ancestorCache.version === this.frameVersion &&
          !this.isDirty(id) &&
          i !== chain.length - 1) {  // Not the root
        // Can skip calculation for this ancestor
        worldX = ancestorCache.x
        worldY = ancestorCache.y
        // Get size for next iteration
        const rect = this.getRect(n, entities)
        parentWidth = rect.width
        parentHeight = rect.height
        continue
      }

      // Get rect properties (x, y, width, height, anchor, pivot)
      const rect = this.getRect(n, entities)

      // Calculate position with anchor/pivot
      // anchor: where on parent to attach (0=left/top, 0.5=center, 1=right/bottom)
      // pivot: local origin point (0=left/top, 0.5=center, 1=right/bottom)
      const anchorOffsetX = rect.anchorX * parentWidth
      const anchorOffsetY = rect.anchorY * parentHeight
      const pivotOffsetX = rect.pivotX * rect.width
      const pivotOffsetY = rect.pivotY * rect.height

      worldX += anchorOffsetX - pivotOffsetX + rect.x
      worldY += anchorOffsetY - pivotOffsetY + rect.y

      // Store size for next iteration (child will use this as parent size)
      parentWidth = rect.width
      parentHeight = rect.height

      // Cache this node's world position
      this.worldPositions.set(id, {
        x: worldX,
        y: worldY,
        version: this.frameVersion,
      })

      // Clear dirty flag
      this.clearDirty(id)
    }

    return { x: worldX, y: worldY }
  }

  /**
   * Get rect properties from a node's Rect2D component
   */
  private getRect(
    node: NormalizedNode,
    entities: EntityMaps
  ): {
    x: number
    y: number
    width: number
    height: number
    anchorX: number
    anchorY: number
    pivotX: number
    pivotY: number
  } {
    // Find Rect2D component
    for (const compId of node.componentIds) {
      const comp = entities.components[compId]
      if (comp?.script === 'Rect2D' && comp.enabled !== false) {
        const props = comp.properties ?? {}
        return {
          x: (props.x as number) ?? 0,
          y: (props.y as number) ?? 0,
          width: (props.width as number) ?? 1,
          height: (props.height as number) ?? 1,
          anchorX: (props.anchorX as number) ?? 0,
          anchorY: (props.anchorY as number) ?? 0,
          pivotX: (props.pivotX as number) ?? 0,
          pivotY: (props.pivotY as number) ?? 0,
        }
      }
    }

    return { x: 0, y: 0, width: 1, height: 1, anchorX: 0, anchorY: 0, pivotX: 0, pivotY: 0 }
  }

  /**
   * Get the local position of a node from its Rect2D component (legacy helper)
   */
  private getLocalPosition(
    node: NormalizedNode,
    entities: EntityMaps
  ): { x: number; y: number } {
    const rect = this.getRect(node, entities)
    return { x: rect.x, y: rect.y }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Static Helper: Set Entity Position
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update an entity's position and mark its transform as dirty
   * This is the preferred way to update positions during play mode
   */
  static setEntityPosition(
    nodeId: string,
    x: number,
    y: number,
    getEntities: () => EntityMaps
  ): boolean {
    const entities = getEntities()
    const node = entities.nodes[nodeId]
    if (!node) return false

    // Find Rect2D component
    for (const compId of node.componentIds) {
      const comp = entities.components[compId]
      if (comp?.script === 'Rect2D' && comp.enabled !== false) {
        // Update position
        if (comp.properties) {
          comp.properties.x = x
          comp.properties.y = y
        }

        // Mark dirty (this node and all descendants)
        TransformCache.getInstance().markDirty(nodeId)
        return true
      }
    }

    return false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debug
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get cache statistics for debugging
   */
  getStats(): { cacheSize: number; dirtyCount: number; frameVersion: number } {
    return {
      cacheSize: this.worldPositions.size,
      dirtyCount: this.dirtyNodes.size,
      frameVersion: this.frameVersion,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

export const getWorldPosition = (nodeId: string) =>
  TransformCache.getInstance().getWorldPosition(nodeId)

export const markTransformDirty = (nodeId: string) =>
  TransformCache.getInstance().markDirty(nodeId)
