// ═══════════════════════════════════════════════════════════════════════════
// Collider Component - Collision and physics properties
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select, signal, action } from '../decorators'
import { GameEventBus, createGameEvent } from '../runtime/events'

export type ColliderType = 'solid' | 'trigger' | 'none'

/** Collision event data passed to event handlers */
export interface CollisionEventData {
  /** ID of the other entity involved in the collision */
  otherId: string
  /** Layer of the other collider */
  otherLayer: string
  /** Type of collision event */
  type: 'enter' | 'exit' | 'stay'
  /** Delta time (only for 'stay' events) */
  deltaTime?: number
}

/**
 * ColliderComponent - Defines collision behavior for entities.
 *
 * Used for:
 * - Blocking movement (walls, obstacles)
 * - Blocking line of sight (for fog of war, vision)
 * - Trigger zones (doors, traps, pickups)
 */
@component({
  name: 'Collider',
  icon: '■',
  description: 'Collision and blocking properties'
})
export class ColliderComponent extends Component {
  @select(['solid', 'trigger', 'none'], {
    label: 'Type',
    group: 'Collision',
    tooltip: 'solid = blocks movement, trigger = detects overlap, none = disabled'
  })
  colliderType: ColliderType = 'solid'

  @property({
    type: 'boolean',
    label: 'Blocks Movement',
    group: 'Blocking',
    tooltip: 'Prevents entities from moving through'
  })
  blocksMovement: boolean = true

  @property({
    type: 'boolean',
    label: 'Blocks Vision',
    group: 'Blocking',
    tooltip: 'Prevents line of sight (for fog of war)'
  })
  blocksVision: boolean = true

  @property({
    type: 'boolean',
    label: 'Blocks Projectiles',
    group: 'Blocking',
    tooltip: 'Stops projectiles from passing through'
  })
  blocksProjectiles: boolean = true

  @property({
    type: 'string',
    label: 'Layer',
    group: 'Filtering',
    tooltip: 'Collision layer name for filtering'
  })
  layer: string = 'default'

  @property({
    type: 'string',
    label: 'Mask',
    group: 'Filtering',
    tooltip: 'Comma-separated list of layers this collides with'
  })
  mask: string = 'default'

  // ─────────────────────────────────────────────────────────────────────────
  // Signals - Visual scripting events
  // ─────────────────────────────────────────────────────────────────────────

  @signal({
    displayName: 'On Trigger Enter',
    description: 'Fired when another entity enters the trigger zone'
  })
  onTriggerEnter: ((data: CollisionEventData) => void) | null = null

  @signal({
    displayName: 'On Trigger Exit',
    description: 'Fired when another entity exits the trigger zone'
  })
  onTriggerExit: ((data: CollisionEventData) => void) | null = null

  @signal({
    displayName: 'On Trigger Stay',
    description: 'Fired each frame while another entity is in the trigger zone'
  })
  onTriggerStay: ((data: CollisionEventData) => void) | null = null

  @signal({
    displayName: 'On Collision',
    description: 'Fired when colliding with a solid collider'
  })
  onCollision: ((data: CollisionEventData) => void) | null = null

  // Legacy callbacks (kept for backwards compatibility)
  onEnter?: (entityId: string) => void
  onExit?: (entityId: string) => void
  onStay?: (entityId: string, dt: number) => void

  // Track entities currently overlapping (for triggers)
  private _overlapping: Set<string> = new Set()
  private _overlappingLayers: Map<string, string> = new Map()

  /**
   * Check if this is a solid collider.
   */
  isSolid(): boolean {
    return this.colliderType === 'solid'
  }

  /**
   * Check if this is a trigger collider.
   */
  isTrigger(): boolean {
    return this.colliderType === 'trigger'
  }

  /**
   * Check if collision is enabled.
   */
  isEnabled(): boolean {
    return this.colliderType !== 'none'
  }

  /**
   * Check if this collider interacts with a given layer.
   */
  collidesWithLayer(layer: string): boolean {
    if (!this.isEnabled()) return false
    const layers = this.mask.split(',').map(l => l.trim())
    return layers.includes(layer) || layers.includes('*')
  }

  /**
   * Register entity entering trigger zone.
   */
  registerEnter(entityId: string, otherLayer: string = 'default'): void {
    if (this._overlapping.has(entityId)) return
    this._overlapping.add(entityId)
    this._overlappingLayers.set(entityId, otherLayer)

    const eventData: CollisionEventData = {
      otherId: entityId,
      otherLayer,
      type: 'enter',
    }

    // Fire signal for visual scripting
    this.onTriggerEnter?.(eventData)

    // Fire legacy callback
    this.onEnter?.(entityId)

    // Emit global event for event bus listeners
    if (this.node?.id) {
      const event = createGameEvent({
        type: 'TriggerEnter',
        data: eventData,
        source: { id: this.node.id },
        routing: 'direct',
      })
      GameEventBus.emit(event)
    }
  }

  /**
   * Register entity exiting trigger zone.
   */
  registerExit(entityId: string): void {
    if (!this._overlapping.has(entityId)) return

    const otherLayer = this._overlappingLayers.get(entityId) || 'default'
    this._overlapping.delete(entityId)
    this._overlappingLayers.delete(entityId)

    const eventData: CollisionEventData = {
      otherId: entityId,
      otherLayer,
      type: 'exit',
    }

    // Fire signal for visual scripting
    this.onTriggerExit?.(eventData)

    // Fire legacy callback
    this.onExit?.(entityId)

    // Emit global event
    if (this.node?.id) {
      const event = createGameEvent({
        type: 'TriggerExit',
        data: eventData,
        source: { id: this.node.id },
        routing: 'direct',
      })
      GameEventBus.emit(event)
    }
  }

  /**
   * Update for entities staying in trigger zone.
   */
  updateOverlapping(dt: number): void {
    for (const entityId of this._overlapping) {
      const otherLayer = this._overlappingLayers.get(entityId) || 'default'

      const eventData: CollisionEventData = {
        otherId: entityId,
        otherLayer,
        type: 'stay',
        deltaTime: dt,
      }

      // Fire signal for visual scripting
      this.onTriggerStay?.(eventData)

      // Fire legacy callback
      this.onStay?.(entityId, dt)
    }
  }

  /**
   * Register a solid collision.
   */
  @action({
    displayName: 'Report Collision',
    category: 'Collision',
    description: 'Report a collision with another entity'
  })
  reportCollision(entityId: string, otherLayer: string = 'default'): void {
    const eventData: CollisionEventData = {
      otherId: entityId,
      otherLayer,
      type: 'enter', // Solid collisions are instantaneous
    }

    // Fire signal for visual scripting
    this.onCollision?.(eventData)

    // Emit global event
    if (this.node?.id) {
      const event = createGameEvent({
        type: 'Collision',
        data: eventData,
        source: { id: this.node.id },
        routing: 'direct',
      })
      GameEventBus.emit(event)
    }
  }

  /**
   * Get all entities currently overlapping this trigger.
   */
  getOverlapping(): string[] {
    return Array.from(this._overlapping)
  }

  /**
   * Check if a specific entity is overlapping.
   */
  isOverlapping(entityId: string): boolean {
    return this._overlapping.has(entityId)
  }

  /**
   * Clear all overlap state.
   */
  clearOverlapping(): void {
    for (const entityId of this._overlapping) {
      this.registerExit(entityId)
    }
    this._overlapping.clear()
    this._overlappingLayers.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      // Note: overlapping state is runtime-only, not serialized
    }
  }

  override deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)
    this._overlapping.clear()
  }
}
