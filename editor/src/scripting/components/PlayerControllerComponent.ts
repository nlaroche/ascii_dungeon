// ═══════════════════════════════════════════════════════════════════════════
// Player Controller Component - Input handling and player movement
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type MovementMode = 'free' | 'gridBased' | 'topdown' | 'platformer'

@component({ name: 'PlayerController', icon: '🎮', description: 'Player input handling and movement' })
export class PlayerControllerComponent extends Component {
  @select(['free', 'gridBased', 'topdown', 'platformer'], { label: 'Movement Mode', group: 'Movement' })
  movementMode: MovementMode = 'free'

  @property({ type: 'number', label: 'Move Speed', group: 'Movement', min: 0, max: 50, step: 0.5 })
  speed: number = 5

  @property({ type: 'number', label: 'Sprint Multiplier', group: 'Movement', min: 1, max: 3, step: 0.1 })
  sprintMultiplier: number = 1.5

  @property({ type: 'boolean', label: 'Can Sprint', group: 'Movement' })
  canSprint: boolean = true

  @property({ type: 'number', label: 'Turn Speed', group: 'Movement', min: 0, max: 720, step: 10, tooltip: 'Degrees per second' })
  turnSpeed: number = 360

  @property({ type: 'number', label: 'Jump Force', group: 'Jumping', min: 0, max: 20, step: 0.5 })
  jumpForce: number = 8

  @property({ type: 'boolean', label: 'Can Double Jump', group: 'Jumping' })
  canDoubleJump: boolean = false

  @property({ type: 'number', label: 'Grid Size', group: 'Grid Movement', min: 0.5, max: 4, step: 0.5 })
  gridSize: number = 1

  @property({ type: 'number', label: 'Move Delay', group: 'Grid Movement', min: 0, max: 1, step: 0.05, tooltip: 'Seconds between grid moves' })
  gridMoveDelay: number = 0.15

  @property({ type: 'number', label: 'Interact Range', group: 'Interaction', min: 0.5, max: 5, step: 0.5 })
  interactRange: number = 2

  // Internal state
  private velocity: [number, number, number] = [0, 0, 0]
  private isGrounded: boolean = true
  private jumpsRemaining: number = 1
  private isSprinting: boolean = false
  private lastGridMoveTime: number = 0
  private inputDirection: [number, number] = [0, 0]
  private facingAngle: number = 0

  // Input state
  private inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    interact: false,
  }

  // Callbacks
  onMove?: (position: [number, number, number]) => void
  onJump?: () => void
  onLand?: () => void
  onInteract?: () => void

  /** Set input state from key events */
  setInput(key: keyof typeof this.inputState, pressed: boolean): void {
    this.inputState[key] = pressed
  }

  /** Get current velocity */
  getVelocity(): [number, number, number] {
    return [...this.velocity]
  }

  /** Check if currently grounded */
  isOnGround(): boolean {
    return this.isGrounded
  }

  /** Set grounded state */
  setGrounded(grounded: boolean): void {
    const wasGrounded = this.isGrounded
    this.isGrounded = grounded

    if (grounded && !wasGrounded) {
      this.jumpsRemaining = this.canDoubleJump ? 2 : 1
      this.velocity[1] = 0
      this.onLand?.()
    }
  }

  /** Get current facing direction (radians) */
  getFacingAngle(): number {
    return this.facingAngle * Math.PI / 180
  }

  /** Get forward vector based on facing */
  getForward(): [number, number, number] {
    const rad = this.getFacingAngle()
    return [Math.sin(rad), 0, -Math.cos(rad)]
  }

  /** Get current effective speed */
  getCurrentSpeed(): number {
    return this.isSprinting && this.canSprint
      ? this.speed * this.sprintMultiplier
      : this.speed
  }

  /** Process movement input and return desired movement delta */
  processMovement(dt: number): [number, number, number] {
    // Calculate input direction
    this.inputDirection = [0, 0]
    if (this.inputState.forward) this.inputDirection[1] -= 1
    if (this.inputState.backward) this.inputDirection[1] += 1
    if (this.inputState.left) this.inputDirection[0] -= 1
    if (this.inputState.right) this.inputDirection[0] += 1

    // Normalize diagonal movement
    const inputLength = Math.sqrt(
      this.inputDirection[0] ** 2 + this.inputDirection[1] ** 2
    )
    if (inputLength > 1) {
      this.inputDirection[0] /= inputLength
      this.inputDirection[1] /= inputLength
    }

    // Update sprint state
    this.isSprinting = this.inputState.sprint && inputLength > 0

    const speed = this.getCurrentSpeed()

    switch (this.movementMode) {
      case 'free':
        return this.processFreeMovement(dt, speed)

      case 'gridBased':
        return this.processGridMovement(dt)

      case 'topdown':
        return this.processTopdownMovement(dt, speed)

      case 'platformer':
        return this.processPlatformerMovement(dt, speed)

      default:
        return [0, 0, 0]
    }
  }

  private processFreeMovement(dt: number, speed: number): [number, number, number] {
    // Update facing based on movement
    if (this.inputDirection[0] !== 0 || this.inputDirection[1] !== 0) {
      const targetAngle = Math.atan2(this.inputDirection[0], -this.inputDirection[1]) * 180 / Math.PI
      const angleDiff = ((targetAngle - this.facingAngle + 180) % 360) - 180
      const maxTurn = this.turnSpeed * dt
      this.facingAngle += Math.max(-maxTurn, Math.min(maxTurn, angleDiff))
    }

    return [
      this.inputDirection[0] * speed * dt,
      0,
      this.inputDirection[1] * speed * dt,
    ]
  }

  private processGridMovement(dt: number): [number, number, number] {
    const now = Date.now() / 1000
    if (now - this.lastGridMoveTime < this.gridMoveDelay) {
      return [0, 0, 0]
    }

    if (this.inputDirection[0] === 0 && this.inputDirection[1] === 0) {
      return [0, 0, 0]
    }

    this.lastGridMoveTime = now

    // Move one grid unit in primary direction
    let dx = 0, dz = 0
    if (Math.abs(this.inputDirection[0]) > Math.abs(this.inputDirection[1])) {
      dx = Math.sign(this.inputDirection[0]) * this.gridSize
    } else {
      dz = Math.sign(this.inputDirection[1]) * this.gridSize
    }

    // Update facing
    this.facingAngle = Math.atan2(dx, -dz) * 180 / Math.PI

    this.onMove?.(this.getTransform()?.position ?? [0, 0, 0])
    return [dx, 0, dz]
  }

  private processTopdownMovement(dt: number, speed: number): [number, number, number] {
    // Top-down: X is right, Z is down, no vertical movement
    return [
      this.inputDirection[0] * speed * dt,
      0,
      this.inputDirection[1] * speed * dt,
    ]
  }

  private processPlatformerMovement(dt: number, speed: number): [number, number, number] {
    // Horizontal movement only (X axis)
    const dx = this.inputDirection[0] * speed * dt

    // Gravity applied to velocity
    if (!this.isGrounded) {
      this.velocity[1] -= 20 * dt // Gravity
    }

    return [dx, this.velocity[1] * dt, 0]
  }

  /** Process jump input */
  processJump(): boolean {
    if (!this.inputState.jump) return false

    if (this.jumpsRemaining > 0) {
      this.velocity[1] = this.jumpForce
      this.jumpsRemaining--
      this.isGrounded = false
      this.onJump?.()
      return true
    }

    return false
  }

  /** Check for interaction */
  tryInteract(): boolean {
    if (this.inputState.interact) {
      this.inputState.interact = false // Consume input
      this.onInteract?.()
      return true
    }
    return false
  }

  onUpdate(dt: number): void {
    // Process jump
    if (this.inputState.jump) {
      this.processJump()
      this.inputState.jump = false // Consume jump input
    }
  }
}
