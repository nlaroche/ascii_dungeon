// ═══════════════════════════════════════════════════════════════════════════
// TickWanderAI Component - Roguelike tick-based wandering with smooth animation
// Only moves when the player moves (on tick), but animates smoothly
// Perfect for polished roguelike behavior
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'
import { Ticks, type EasingType } from '../runtime/TickSystem'
import { TransformCache } from '../runtime/TransformCache'

@component({
  name: 'TickWanderAI',
  icon: '🎲',
  description: 'Roguelike tick-based wandering with smooth animation'
})
export class TickWanderAIComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Move Chance',
    group: 'Movement',
    min: 0,
    max: 100,
    step: 5,
    tooltip: 'Percent chance to move each tick (0-100)'
  })
  moveChance: number = 50

  @property({
    type: 'number',
    label: 'Wander Radius',
    group: 'Movement',
    min: 1,
    max: 50,
    step: 1,
    tooltip: 'Maximum distance from starting position'
  })
  wanderRadius: number = 8

  @property({
    type: 'boolean',
    label: 'Diagonal Movement',
    group: 'Movement',
    tooltip: 'Allow diagonal movement'
  })
  allowDiagonal: boolean = false

  @property({
    type: 'select',
    label: 'Easing',
    group: 'Animation',
    options: ['linear', 'easeOut', 'easeOutQuad', 'easeInOut', 'easeOutBack', 'bounce'],
    tooltip: 'Movement animation easing'
  })
  easing: EasingType = 'easeOut'

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  // Home position (for wander radius calculation)
  private homeX: number = 0
  private homeY: number = 0

  // Animation state
  private lerpStartX: number = 0
  private lerpStartY: number = 0
  private lerpTargetX: number = 0
  private lerpTargetY: number = 0
  private isMoving: boolean = false

  private unsubscribe: (() => void) | null = null
  private storeAccessor: (() => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Store Integration
  // ─────────────────────────────────────────────────────────────────────────

  setStoreAccessor(accessor: () => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }): void {
    this.storeAccessor = accessor
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    console.log('[TickWanderAI] Initialized on node:', this.node?.name)

    // Store home position (for wander radius)
    if (this.node && this.storeAccessor) {
      const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
      if (rect2DComp) {
        const state = this.storeAccessor()
        const storeComp = state.entities.components[rect2DComp.id]
        if (storeComp?.properties) {
          this.homeX = (storeComp.properties.x as number) ?? 0
          this.homeY = (storeComp.properties.y as number) ?? 0
        }
      }
    }

    // Subscribe to tick events
    // When tick fires, we decide if we move and compute our target
    this.unsubscribe = Ticks.subscribe((_tickNumber) => {
      this.onTick()
    })
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[TickWanderAI] Disposed')
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tick Handler - Called when player moves
  // ─────────────────────────────────────────────────────────────────────────

  private onTick(): void {
    // Random chance to skip this tick (stand still)
    if (Math.random() * 100 > this.moveChance) {
      this.isMoving = false
      return
    }

    this.startMove()
  }

  /**
   * Record current position and compute target for this tick
   */
  private startMove(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    // Record start position
    this.lerpStartX = (storeComp.properties.x as number) ?? 0
    this.lerpStartY = (storeComp.properties.y as number) ?? 0

    // Pick a direction
    const direction = this.pickDirection(this.lerpStartX, this.lerpStartY)
    if (!direction) {
      this.isMoving = false
      return
    }

    // Compute target
    this.lerpTargetX = this.lerpStartX + direction.dx
    this.lerpTargetY = this.lerpStartY + direction.dy
    this.isMoving = true
  }

  /**
   * Pick a random direction within wander radius
   */
  private pickDirection(currentX: number, currentY: number): { dx: number; dy: number } | null {
    const directions: { dx: number; dy: number }[] = [
      { dx: 1, dy: 0 },   // Right
      { dx: -1, dy: 0 },  // Left
      { dx: 0, dy: 1 },   // Down
      { dx: 0, dy: -1 },  // Up
    ]

    if (this.allowDiagonal) {
      directions.push(
        { dx: 1, dy: 1 },   // Down-Right
        { dx: -1, dy: 1 },  // Down-Left
        { dx: 1, dy: -1 },  // Up-Right
        { dx: -1, dy: -1 }, // Up-Left
      )
    }

    // Filter by wander radius from home position
    const validDirections = directions.filter(dir => {
      const newX = currentX + dir.dx
      const newY = currentY + dir.dy
      const distFromHome = Math.abs(newX - this.homeX) + Math.abs(newY - this.homeY)
      return distFromHome <= this.wanderRadius
    })

    // If no valid directions, try to move back toward home
    if (validDirections.length === 0) {
      const towardHomeX = Math.sign(this.homeX - currentX)
      const towardHomeY = Math.sign(this.homeY - currentY)
      if (towardHomeX !== 0) return { dx: towardHomeX, dy: 0 }
      if (towardHomeY !== 0) return { dx: 0, dy: towardHomeY }
      return null
    }

    // Pick a random valid direction
    return validDirections[Math.floor(Math.random() * validDirections.length)]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update - Lerp position each frame during tick animation
  // ─────────────────────────────────────────────────────────────────────────

  onUpdate(_deltaTime: number): void {
    if (!this.isMoving) return
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    // Check if tick animation is in progress
    if (Ticks.isAnimating()) {
      // Lerp position based on global tick progress
      const t = Ticks.getEasedProgress(this.easing)
      const x = this.lerpStartX + (this.lerpTargetX - this.lerpStartX) * t
      const y = this.lerpStartY + (this.lerpTargetY - this.lerpStartY) * t

      storeComp.properties.x = x
      storeComp.properties.y = y

      TransformCache.getInstance().markDirty(this.node.id)
    } else {
      // Animation complete - snap to target
      storeComp.properties.x = this.lerpTargetX
      storeComp.properties.y = this.lerpTargetY
      this.isMoving = false

      TransformCache.getInstance().markDirty(this.node.id)
    }
  }
}
