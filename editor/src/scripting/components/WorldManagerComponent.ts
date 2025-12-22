// ═══════════════════════════════════════════════════════════════════════════
// WorldManager Component - Handles screen transitions and world navigation
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'
import { TransformCache } from '../runtime/TransformCache'

interface SerializedNode {
  id: string
  name: string
  type: string
  components: Array<{ id: string; script: string; enabled: boolean; properties: Record<string, unknown> }>
  children: SerializedNode[]
  meta?: Record<string, unknown>
}

@component({ name: 'WorldManager', icon: '🗺️' })
export class WorldManagerComponent extends Component {
  @property({ type: 'number', label: 'World X' })
  worldX: number = 0

  @property({ type: 'number', label: 'World Y' })
  worldY: number = 0

  @property({ type: 'number', label: 'Screen Width' })
  screenWidth: number = 80

  @property({ type: 'number', label: 'Screen Height' })
  screenHeight: number = 50

  // Map bounds (for centered maps)
  @property({ type: 'number', label: 'Min X' })
  minX: number = -40

  @property({ type: 'number', label: 'Max X' })
  maxX: number = 39

  @property({ type: 'number', label: 'Min Y' })
  minY: number = -25

  @property({ type: 'number', label: 'Max Y' })
  maxY: number = 24

  // Screen cache
  private screenCache: Map<string, SerializedNode[]> = new Map()
  private initialized: boolean = false
  private storeAccessor: (() => any) | null = null

  setStoreAccessor(accessor: () => any): void {
    this.storeAccessor = accessor
  }

  @lifecycle('Execute:Init')
  onInit(): void {
    if (this.initialized) return
    this.initialized = true

    // Cache the initial screen (home base)
    this.cacheCurrentScreen()
    console.log(`[WorldManager] Initialized at world position (${this.worldX}, ${this.worldY})`)
  }

  /**
   * Transition to an adjacent screen
   */
  transitionTo(direction: 'north' | 'south' | 'east' | 'west'): void {
    console.log(`[WorldManager] Transitioning ${direction} from (${this.worldX}, ${this.worldY})`)

    // 1. Cache current screen
    this.cacheCurrentScreen()

    // 2. Update world coordinates
    const deltas: Record<string, [number, number]> = {
      north: [0, -1],
      south: [0, 1],
      east: [1, 0],
      west: [-1, 0]
    }
    const [dx, dy] = deltas[direction]
    this.worldX += dx
    this.worldY += dy

    // Update the component property in store
    if (!this.storeAccessor) return
    const state = this.storeAccessor()
    const comp = state.entities.components[this.componentId]
    if (comp?.properties) {
      comp.properties.worldX = this.worldX
      comp.properties.worldY = this.worldY
    }

    // 3. Clear and repopulate screen layer
    const key = `${this.worldX}_${this.worldY}`
    if (this.screenCache.has(key)) {
      console.log(`[WorldManager] Loading cached screen ${key}`)
      this.loadCachedScreen(key)
    } else {
      console.log(`[WorldManager] Generating new screen ${key}`)
      this.generateScreen()
    }

    // 4. Reposition player at opposite edge
    this.repositionPlayer(direction)

    console.log(`[WorldManager] Transition complete - now at (${this.worldX}, ${this.worldY})`)
  }

  private cacheCurrentScreen(): void {
    const key = `${this.worldX}_${this.worldY}`
    const screenLayer = this.findScreenLayer()
    if (!screenLayer) {
      console.warn('[WorldManager] Could not find ScreenLayer to cache')
      return
    }

    const serialized = this.serializeChildren(screenLayer)
    this.screenCache.set(key, serialized)
    console.log(`[WorldManager] Cached screen ${key} with ${serialized.length} children`)
  }

  private findScreenLayer(): any {
    if (!this.storeAccessor) return null
    const state = this.storeAccessor()
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'ScreenLayer') {
        return node
      }
    }
    return null
  }

  private findPlayer(): any {
    if (!this.storeAccessor) return null
    const state = this.storeAccessor()
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'Player' || node.meta?.isPlayer) {
        return node
      }
    }
    return null
  }

  private serializeChildren(node: any): SerializedNode[] {
    if (!this.storeAccessor) return []
    const state = this.storeAccessor()
    const result: SerializedNode[] = []

    for (const childId of node.children || []) {
      const child = state.entities.nodes[childId]
      if (!child) continue

      result.push({
        id: child.id,
        name: child.name,
        type: child.type || 'Node',
        components: (child.components || []).map((compId: string) => {
          const comp = state.entities.components[compId]
          return comp ? {
            id: comp.id,
            script: comp.script,
            enabled: comp.enabled,
            properties: { ...comp.properties }
          } : null
        }).filter(Boolean),
        children: this.serializeChildren(child),
        meta: child.meta ? { ...child.meta } : undefined
      })
    }

    return result
  }

  private loadCachedScreen(key: string): void {
    const cached = this.screenCache.get(key)
    if (!cached) return

    const screenLayer = this.findScreenLayer()
    if (!screenLayer) return

    // Clear current children
    this.clearScreenLayer(screenLayer)

    // Recreate nodes from cache
    if (!this.storeAccessor) return
    const state = this.storeAccessor()
    for (const nodeData of cached) {
      this.instantiateNode(nodeData, screenLayer.id, state)
    }
  }

  private clearScreenLayer(screenLayer: any): void {
    if (!this.storeAccessor) return
    const state = this.storeAccessor()

    // Remove all children recursively
    const removeRecursive = (nodeId: string) => {
      const node = state.entities.nodes[nodeId]
      if (!node) return

      // Remove children first
      for (const childId of [...(node.children || [])]) {
        removeRecursive(childId)
      }

      // Remove components
      for (const compId of node.components || []) {
        delete state.entities.components[compId]
      }

      // Remove node
      delete state.entities.nodes[nodeId]
    }

    // Clear all screen layer children
    for (const childId of [...(screenLayer.children || [])]) {
      removeRecursive(childId)
    }
    screenLayer.children = []
  }

  private instantiateNode(data: SerializedNode, parentId: string, state: any): void {
    // Create new IDs
    const newId = `${data.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`

    // Create components with new IDs
    const componentIds: string[] = []
    for (const compData of data.components) {
      const newCompId = `${compData.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
      state.entities.components[newCompId] = {
        id: newCompId,
        script: compData.script,
        enabled: compData.enabled,
        properties: { ...compData.properties }
      }
      componentIds.push(newCompId)
    }

    // Create node
    state.entities.nodes[newId] = {
      id: newId,
      name: data.name,
      type: data.type,
      children: [],
      components: componentIds,
      meta: data.meta ? { ...data.meta } : undefined
    }

    // Add to parent
    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(newId)
    }

    // Recursively instantiate children
    for (const childData of data.children || []) {
      this.instantiateNode(childData, newId, state)
    }
  }

  private generateScreen(): void {
    const screenLayer = this.findScreenLayer()
    if (!screenLayer) return

    // Clear existing content
    this.clearScreenLayer(screenLayer)

    if (!this.storeAccessor) return
    const state = this.storeAccessor()

    // Seeded random for consistent generation
    const seed = this.worldX * 10000 + this.worldY
    const rng = this.seededRandom(seed)

    // Generate terrain (grass background with some variation)
    const terrainId = `terrain_${Date.now()}`
    const terrainGlyphId = `terrain_glyph_${Date.now()}`
    const terrainRectId = `terrain_rect_${Date.now()}`

    // Create terrain glyph map data (using centered coordinates)
    const cells: any[] = []
    for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
        const grassChars = ['.', ',', "'", '`']
        const char = grassChars[Math.floor(rng() * grassChars.length)]
        const greenVariation = 0.2 + rng() * 0.3
        cells.push({
          x, y, char,
          fg: [0.1, greenVariation, 0.1],
          bg: [0.02, 0.05, 0.02]
        })
      }
    }

    state.entities.components[terrainRectId] = {
      id: terrainRectId, script: 'Rect2D', enabled: true,
      properties: { x: this.minX, y: this.minY, width: this.screenWidth, height: this.screenHeight }
    }
    state.entities.components[terrainGlyphId] = {
      id: terrainGlyphId, script: 'GlyphMap', enabled: true,
      properties: { cells, zIndex: 0 }
    }
    state.entities.nodes[terrainId] = {
      id: terrainId, name: 'Terrain', type: 'GlyphNode',
      children: [], components: [terrainRectId, terrainGlyphId]
    }
    screenLayer.children.push(terrainId)

    // Generate trees (avoid edges where player might spawn, use centered coords)
    const treeCount = Math.floor(5 + rng() * 15)
    for (let i = 0; i < treeCount; i++) {
      const x = Math.floor(this.minX + 5 + rng() * (this.screenWidth - 10))
      const y = Math.floor(this.minY + 5 + rng() * (this.screenHeight - 10))
      this.createTree(screenLayer.id, x, y, state, rng)
    }

    // Generate rocks (use centered coords)
    const rockCount = Math.floor(2 + rng() * 8)
    for (let i = 0; i < rockCount; i++) {
      const x = Math.floor(this.minX + 3 + rng() * (this.screenWidth - 6))
      const y = Math.floor(this.minY + 3 + rng() * (this.screenHeight - 6))
      this.createRock(screenLayer.id, x, y, state)
    }

    console.log(`[WorldManager] Generated screen with ${treeCount} trees and ${rockCount} rocks`)
  }

  private createTree(parentId: string, x: number, y: number, state: any, rng: () => number): void {
    const id = `tree_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    const rectId = `${id}_rect`
    const glyphId = `${id}_glyph`
    const colliderId = `${id}_collider`

    const treeChars = ['♣', '♠', '▲', 'T']
    const char = treeChars[Math.floor(rng() * treeChars.length)]
    const greenShade = 0.3 + rng() * 0.4

    state.entities.components[rectId] = {
      id: rectId, script: 'Rect2D', enabled: true,
      properties: { x, y, width: 1, height: 1 }
    }
    state.entities.components[glyphId] = {
      id: glyphId, script: 'Glyph', enabled: true,
      properties: { char, fg: [0.1, greenShade, 0.1], bg: [0, 0, 0], zIndex: 5 }
    }
    state.entities.components[colliderId] = {
      id: colliderId, script: 'Collider', enabled: true,
      properties: { solid: true, shape: 'box' }
    }
    state.entities.nodes[id] = {
      id, name: 'Tree', type: 'GlyphNode',
      children: [], components: [rectId, glyphId, colliderId]
    }

    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(id)
    }
  }

  private createRock(parentId: string, x: number, y: number, state: any): void {
    const id = `rock_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    const rectId = `${id}_rect`
    const glyphId = `${id}_glyph`
    const colliderId = `${id}_collider`

    state.entities.components[rectId] = {
      id: rectId, script: 'Rect2D', enabled: true,
      properties: { x, y, width: 1, height: 1 }
    }
    state.entities.components[glyphId] = {
      id: glyphId, script: 'Glyph', enabled: true,
      properties: { char: '●', fg: [0.5, 0.5, 0.5], bg: [0, 0, 0], zIndex: 5 }
    }
    state.entities.components[colliderId] = {
      id: colliderId, script: 'Collider', enabled: true,
      properties: { solid: true, shape: 'box' }
    }
    state.entities.nodes[id] = {
      id, name: 'Rock', type: 'GlyphNode',
      children: [], components: [rectId, glyphId, colliderId]
    }

    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(id)
    }
  }

  private repositionPlayer(fromDirection: string): void {
    const player = this.findPlayer()
    if (!player) return

    // Find player's Rect2D component
    if (!this.storeAccessor) return
    const state = this.storeAccessor()
    let rect2DComp: any = null
    for (const compId of player.components || []) {
      const comp = state.entities.components[compId]
      if (comp?.script === 'Rect2D') {
        rect2DComp = comp
        break
      }
    }
    if (!rect2DComp) return

    // Place player at opposite edge
    const opposites: Record<string, string> = {
      north: 'south', south: 'north', east: 'west', west: 'east'
    }
    const entryEdge = opposites[fromDirection]

    // Positions using centered coordinates
    const positions: Record<string, [number, number]> = {
      north: [0, this.minY + 3],   // Center X, near north edge
      south: [0, this.maxY - 3],   // Center X, near south edge
      east: [this.maxX - 3, 0],    // Near east edge, center Y
      west: [this.minX + 3, 0]     // Near west edge, center Y
    }

    const [x, y] = positions[entryEdge]
    rect2DComp.properties.x = x
    rect2DComp.properties.y = y

    // Mark transform dirty
    TransformCache.getInstance().markDirty(player.id)

    console.log(`[WorldManager] Repositioned player to (${x}, ${y}) on ${entryEdge} edge`)
  }

  private seededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }
  }

  // Public getter for edge trigger
  getWorldPosition(): { x: number; y: number } {
    return { x: this.worldX, y: this.worldY }
  }
}
