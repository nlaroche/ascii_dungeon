// ═══════════════════════════════════════════════════════════════════════════
// Collider Component - Collision and physics properties
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type ColliderType = 'solid' | 'trigger' | 'none'

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

  // Callbacks for trigger events
  onEnter?: (entityId: string) => void
  onExit?: (entityId: string) => void
  onStay?: (entityId: string, dt: number) => void

  // Track entities currently overlapping (for triggers)
  private _overlapping: Set<string> = new Set()

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
  registerEnter(entityId: string): void {
    if (this._overlapping.has(entityId)) return
    this._overlapping.add(entityId)
    this.onEnter?.(entityId)
  }

  /**
   * Register entity exiting trigger zone.
   */
  registerExit(entityId: string): void {
    if (!this._overlapping.has(entityId)) return
    this._overlapping.delete(entityId)
    this.onExit?.(entityId)
  }

  /**
   * Update for entities staying in trigger zone.
   */
  updateOverlapping(dt: number): void {
    if (!this.onStay) return
    for (const entityId of this._overlapping) {
      this.onStay(entityId, dt)
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
      this.onExit?.(entityId)
    }
    this._overlapping.clear()
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
