// ═══════════════════════════════════════════════════════════════════════════
// PlayerController Component - WASD movement for player entities
// Responds to keyboard input during play mode
// Uses TickSystem's smooth tick for synchronized animations
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'
import { Runtime } from '../runtime/RuntimeManager'
import { TransformCache } from '../runtime/TransformCache'
import { Ticks, type EasingType } from '../runtime/TickSystem'

@component({
  name: 'PlayerController',
  icon: '🎮',
  description: 'WASD movement control for player character'
})
export class PlayerControllerComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Move Speed',
    group: 'Movement',
    min: 0.1,
    max: 20,
    step: 0.1,
    tooltip: 'Movement speed in cells per second (non-grid mode)'
  })
  moveSpeed: number = 5

  @property({
    type: 'boolean',
    label: 'Grid Snap',
    group: 'Movement',
    tooltip: 'Snap movement to grid cells'
  })
  gridSnap: boolean = true

  @property({
    type: 'select',
    label: 'Easing',
    group: 'Animation',
    options: ['linear', 'easeOut', 'easeOutQuad', 'easeInOut', 'easeOutBack', 'bounce'],
    tooltip: 'Movement animation easing (uses global tick duration)'
  })
  easing: EasingType = 'easeOut'

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private storeAccessor: (() => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }) | null = null

  // Smooth tick animation state
  private startX: number = 0
  private startY: number = 0
  private targetX: number = 0
  private targetY: number = 0
  private isMoving: boolean = false

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
    console.log('[PlayerController] Initialized on node:', this.node?.name)
    this.isMoving = false
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[PlayerController] Disposed')
  }

  /**
   * Called each frame during play mode
   */
  onUpdate(_deltaTime: number): void {
    // If currently animating a move, lerp position
    if (this.isMoving && Ticks.isAnimating()) {
      this.updateLerpPosition()
    } else if (this.isMoving && !Ticks.isAnimating()) {
      // Animation just finished - snap to target
      this.finishMove()
    }

    // Don't accept new input while tick is animating
    if (Ticks.isInputBlocked()) {
      return
    }

    // Check for movement input
    let dx = 0
    let dy = 0

    if (Runtime.isKeyDown('KeyW') || Runtime.isKeyDown('ArrowUp')) {
      dy = -1
    } else if (Runtime.isKeyDown('KeyS') || Runtime.isKeyDown('ArrowDown')) {
      dy = 1
    }

    if (Runtime.isKeyDown('KeyA') || Runtime.isKeyDown('ArrowLeft')) {
      dx = -1
    } else if (Runtime.isKeyDown('KeyD') || Runtime.isKeyDown('ArrowRight')) {
      dx = 1
    }

    // Initiate movement
    if (dx !== 0 || dy !== 0) {
      this.startMove(dx, dy)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smooth Movement
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a move - records start position, computes target, triggers tick
   */
  private startMove(dx: number, dy: number): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    // Record start position
    this.startX = (storeComp.properties.x as number) ?? 0
    this.startY = (storeComp.properties.y as number) ?? 0

    // Compute target position
    if (this.gridSnap) {
      this.targetX = this.startX + dx
      this.targetY = this.startY + dy
    } else {
      // For non-grid movement, move a fixed amount per tick
      this.targetX = this.startX + dx
      this.targetY = this.startY + dy
    }

    this.isMoving = true

    // Mark transform dirty (for children like Camera)
    TransformCache.getInstance().markDirty(this.node.id)

    // Trigger the tick - this starts the global animation timer
    // Other entities (sheep, etc.) will receive this tick and start their moves
    Ticks.tick()
  }

  /**
   * Update position by lerping based on tick progress
   */
  private updateLerpPosition(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    // Get eased progress (each entity can use different easing)
    const t = Ticks.getEasedProgress(this.easing)

    // Lerp position
    const x = this.startX + (this.targetX - this.startX) * t
    const y = this.startY + (this.targetY - this.startY) * t

    storeComp.properties.x = x
    storeComp.properties.y = y

    // Keep transform dirty during animation
    TransformCache.getInstance().markDirty(this.node.id)
  }

  /**
   * Finish move - snap to target position
   */
  private finishMove(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    // Snap to exact target
    storeComp.properties.x = this.targetX
    storeComp.properties.y = this.targetY

    this.isMoving = false

    TransformCache.getInstance().markDirty(this.node.id)
  }
}
