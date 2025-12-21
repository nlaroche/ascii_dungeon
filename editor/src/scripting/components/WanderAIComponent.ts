// ═══════════════════════════════════════════════════════════════════════════
// WanderAI Component - Random wandering behavior for NPCs/creatures
// Moves randomly, pauses, then moves again
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'

type WanderState = 'idle' | 'moving' | 'waiting'

@component({
  name: 'WanderAI',
  icon: '🐑',
  description: 'Random wandering behavior for creatures'
})
export class WanderAIComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Move Speed',
    group: 'Movement',
    min: 0.5,
    max: 10,
    step: 0.5,
    tooltip: 'Movement speed in cells per second'
  })
  moveSpeed: number = 2

  @property({
    type: 'number',
    label: 'Min Wait Time',
    group: 'Timing',
    min: 0.5,
    max: 10,
    step: 0.5,
    tooltip: 'Minimum time to wait between moves'
  })
  minWaitTime: number = 1

  @property({
    type: 'number',
    label: 'Max Wait Time',
    group: 'Timing',
    min: 0.5,
    max: 10,
    step: 0.5,
    tooltip: 'Maximum time to wait between moves'
  })
  maxWaitTime: number = 3

  @property({
    type: 'number',
    label: 'Min Move Steps',
    group: 'Movement',
    min: 1,
    max: 10,
    step: 1,
    tooltip: 'Minimum steps to take before stopping'
  })
  minSteps: number = 1

  @property({
    type: 'number',
    label: 'Max Move Steps',
    group: 'Movement',
    min: 1,
    max: 10,
    step: 1,
    tooltip: 'Maximum steps to take before stopping'
  })
  maxSteps: number = 4

  @property({
    type: 'number',
    label: 'Wander Radius',
    group: 'Movement',
    min: 1,
    max: 50,
    step: 1,
    tooltip: 'Maximum distance from starting position'
  })
  wanderRadius: number = 10

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private state: WanderState = 'idle'
  private stateTimer: number = 0
  private moveTimer: number = 0
  private moveCooldown: number = 0.2 // Time between steps
  private stepsRemaining: number = 0
  private currentDirection: { dx: number; dy: number } = { dx: 0, dy: 0 }
  private startX: number = 0
  private startY: number = 0
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
    console.log('[WanderAI] Initialized on node:', this.node?.name)

    // Store starting position
    if (this.node && this.storeAccessor) {
      const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
      if (rect2DComp) {
        const state = this.storeAccessor()
        const storeComp = state.entities.components[rect2DComp.id]
        if (storeComp?.properties) {
          this.startX = (storeComp.properties.x as number) ?? 0
          this.startY = (storeComp.properties.y as number) ?? 0
        }
      }
    }

    // Start with a short wait
    this.enterWaiting()
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[WanderAI] Disposed')
  }

  /**
   * Called each frame during play mode
   */
  onUpdate(deltaTime: number): void {
    switch (this.state) {
      case 'waiting':
        this.updateWaiting(deltaTime)
        break
      case 'moving':
        this.updateMoving(deltaTime)
        break
      case 'idle':
        // Transition to waiting
        this.enterWaiting()
        break
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Machine
  // ─────────────────────────────────────────────────────────────────────────

  private enterWaiting(): void {
    this.state = 'waiting'
    this.stateTimer = this.randomRange(this.minWaitTime, this.maxWaitTime)
  }

  private updateWaiting(deltaTime: number): void {
    this.stateTimer -= deltaTime
    if (this.stateTimer <= 0) {
      this.enterMoving()
    }
  }

  private enterMoving(): void {
    this.state = 'moving'
    this.stepsRemaining = this.randomInt(this.minSteps, this.maxSteps)
    this.chooseDirection()
    this.moveTimer = 0
  }

  private updateMoving(deltaTime: number): void {
    this.moveTimer -= deltaTime

    if (this.moveTimer <= 0 && this.stepsRemaining > 0) {
      // Take a step
      if (this.tryMove()) {
        this.stepsRemaining--
        this.moveTimer = this.moveCooldown

        // Occasionally change direction mid-walk
        if (Math.random() < 0.2) {
          this.chooseDirection()
        }
      } else {
        // Hit boundary or obstacle, change direction
        this.chooseDirection()
      }
    }

    if (this.stepsRemaining <= 0) {
      this.enterWaiting()
    }
  }

  private chooseDirection(): void {
    // Pick a random cardinal direction
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ]
    this.currentDirection = directions[Math.floor(Math.random() * directions.length)]
  }

  private tryMove(): boolean {
    if (!this.node || !this.storeAccessor) return false

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return false

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp || !storeComp.properties) return false

    const currentX = (storeComp.properties.x as number) ?? 0
    const currentY = (storeComp.properties.y as number) ?? 0

    const newX = currentX + this.currentDirection.dx
    const newY = currentY + this.currentDirection.dy

    // Check wander radius
    const distFromStart = Math.abs(newX - this.startX) + Math.abs(newY - this.startY)
    if (distFromStart > this.wanderRadius) {
      // Try to move back toward start instead
      this.currentDirection = {
        dx: Math.sign(this.startX - currentX) || (Math.random() < 0.5 ? 1 : -1),
        dy: Math.sign(this.startY - currentY) || (Math.random() < 0.5 ? 1 : -1),
      }
      // Only use one axis
      if (Math.random() < 0.5) {
        this.currentDirection.dx = 0
      } else {
        this.currentDirection.dy = 0
      }
      return false
    }

    // Apply movement
    storeComp.properties.x = newX
    storeComp.properties.y = newY
    return true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1))
  }
}
