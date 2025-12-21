// ═══════════════════════════════════════════════════════════════════════════
// PlayerController Component - WASD movement for player entities
// Responds to keyboard input during play mode
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'
import { Runtime } from '../runtime/RuntimeManager'

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
    tooltip: 'Movement speed in cells per second'
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
    type: 'number',
    label: 'Move Cooldown',
    group: 'Movement',
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: 'Minimum time between moves (for grid snap)'
  })
  moveCooldown: number = 0.15

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private cooldownTimer: number = 0
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
    console.log('[PlayerController] Initialized on node:', this.node?.name)
    this.cooldownTimer = 0
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[PlayerController] Disposed')
  }

  /**
   * Called each frame during play mode
   */
  onUpdate(deltaTime: number): void {
    // Update cooldown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime
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

    // Apply movement
    if ((dx !== 0 || dy !== 0) && this.cooldownTimer <= 0) {
      this.move(dx, dy, deltaTime)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Movement
  // ─────────────────────────────────────────────────────────────────────────

  private move(dx: number, dy: number, deltaTime: number): void {
    if (!this.node || !this.storeAccessor) return

    // Find Rect2D component on this node
    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    // Get the component from store
    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp || !storeComp.properties) return

    const currentX = (storeComp.properties.x as number) ?? 0
    const currentY = (storeComp.properties.y as number) ?? 0

    let newX: number
    let newY: number

    if (this.gridSnap) {
      // Grid-based movement: move by 1 cell
      newX = currentX + dx
      newY = currentY + dy
      this.cooldownTimer = this.moveCooldown
    } else {
      // Smooth movement
      newX = currentX + dx * this.moveSpeed * deltaTime
      newY = currentY + dy * this.moveSpeed * deltaTime
    }

    // Update position in store
    storeComp.properties.x = newX
    storeComp.properties.y = newY
  }
}
