// ═══════════════════════════════════════════════════════════════════════════
// AI Component - Basic AI behavior for NPCs and enemies
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'dead'
export type AIBehavior = 'passive' | 'neutral' | 'aggressive' | 'cowardly'

@component({ name: 'AI', icon: '🧠', description: 'AI behavior and decision making' })
export class AIComponent extends Component {
  @select(['passive', 'neutral', 'aggressive', 'cowardly'], { label: 'Behavior', group: 'AI' })
  behavior: AIBehavior = 'neutral'

  @property({ type: 'number', label: 'Aggro Range', group: 'Detection', min: 1, max: 50, step: 1 })
  aggroRange: number = 8

  @property({ type: 'number', label: 'Attack Range', group: 'Combat', min: 0.5, max: 10, step: 0.5 })
  attackRange: number = 1.5

  @property({ type: 'number', label: 'Attack Damage', group: 'Combat', min: 0, step: 1 })
  attackDamage: number = 10

  @property({ type: 'number', label: 'Attack Speed', group: 'Combat', min: 0.1, max: 5, step: 0.1, tooltip: 'Attacks per second' })
  attackSpeed: number = 1

  @property({ type: 'number', label: 'Move Speed', group: 'Movement', min: 0, max: 20, step: 0.5 })
  moveSpeed: number = 3

  @property({ type: 'number', label: 'Flee Health', group: 'Behavior', min: 0, max: 100, step: 5, tooltip: 'Health % to trigger flee (for cowardly)' })
  fleeHealthThreshold: number = 25

  @property({ type: 'boolean', label: 'Can Patrol', group: 'Patrol' })
  canPatrol: boolean = true

  @property({ type: 'number', label: 'Patrol Radius', group: 'Patrol', min: 1, max: 20, step: 1 })
  patrolRadius: number = 5

  @property({ type: 'number', label: 'Idle Duration', group: 'Patrol', min: 0, max: 10, step: 0.5, tooltip: 'Seconds to wait at patrol points' })
  idleDuration: number = 2

  // Internal state
  private state: AIState = 'idle'
  private target: string | null = null
  private patrolOrigin: [number, number, number] = [0, 0, 0]
  private patrolTarget: [number, number, number] | null = null
  private lastAttackTime: number = 0
  private idleTimer: number = 0

  // Callbacks
  onStateChange?: (oldState: AIState, newState: AIState) => void
  onTargetAcquired?: (targetId: string) => void
  onTargetLost?: () => void
  onAttack?: (targetId: string, damage: number) => void

  /** Get current AI state */
  getState(): AIState {
    return this.state
  }

  /** Set AI state */
  setState(newState: AIState): void {
    if (this.state !== newState) {
      const oldState = this.state
      this.state = newState
      this.onStateChange?.(oldState, newState)
    }
  }

  /** Get current target ID */
  getTarget(): string | null {
    return this.target
  }

  /** Set target */
  setTarget(targetId: string | null): void {
    if (this.target !== targetId) {
      const hadTarget = this.target !== null
      this.target = targetId

      if (targetId) {
        this.onTargetAcquired?.(targetId)
      } else if (hadTarget) {
        this.onTargetLost?.()
      }
    }
  }

  /** Check if can attack */
  canAttack(): boolean {
    const now = Date.now() / 1000
    return now - this.lastAttackTime >= 1 / this.attackSpeed
  }

  /** Perform attack */
  performAttack(): number {
    if (!this.canAttack() || !this.target) return 0

    this.lastAttackTime = Date.now() / 1000
    this.onAttack?.(this.target, this.attackDamage)
    return this.attackDamage
  }

  /** Calculate distance to a position */
  distanceTo(position: [number, number, number]): number {
    const transform = this.getTransform()
    if (!transform) return Infinity

    const dx = position[0] - transform.position[0]
    const dy = position[1] - transform.position[1]
    const dz = position[2] - transform.position[2]

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /** Check if position is in aggro range */
  isInAggroRange(position: [number, number, number]): boolean {
    return this.distanceTo(position) <= this.aggroRange
  }

  /** Check if position is in attack range */
  isInAttackRange(position: [number, number, number]): boolean {
    return this.distanceTo(position) <= this.attackRange
  }

  /** Get direction to move toward a position */
  getDirectionTo(position: [number, number, number]): [number, number, number] {
    const transform = this.getTransform()
    if (!transform) return [0, 0, 0]

    const dx = position[0] - transform.position[0]
    const dz = position[2] - transform.position[2]
    const length = Math.sqrt(dx * dx + dz * dz)

    if (length < 0.001) return [0, 0, 0]

    return [dx / length, 0, dz / length]
  }

  /** Initialize patrol from current position */
  initPatrol(): void {
    const transform = this.getTransform()
    if (transform) {
      this.patrolOrigin = [...transform.position]
    }
  }

  /** Get next patrol target */
  getPatrolTarget(): [number, number, number] {
    if (!this.patrolTarget) {
      // Generate random patrol point within radius
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * this.patrolRadius

      this.patrolTarget = [
        this.patrolOrigin[0] + Math.cos(angle) * distance,
        this.patrolOrigin[1],
        this.patrolOrigin[2] + Math.sin(angle) * distance,
      ]
    }

    return this.patrolTarget
  }

  /** Clear current patrol target (generates new one next call) */
  clearPatrolTarget(): void {
    this.patrolTarget = null
  }

  /** Decide what to do based on behavior and health */
  decideState(
    hasTarget: boolean,
    distanceToTarget: number,
    currentHealthPercent: number
  ): AIState {
    // Check for flee condition
    if (this.behavior === 'cowardly' && currentHealthPercent <= this.fleeHealthThreshold) {
      return 'flee'
    }

    // Check behavior-specific reactions
    if (hasTarget && distanceToTarget <= this.aggroRange) {
      switch (this.behavior) {
        case 'passive':
          return 'idle' // Never aggro

        case 'cowardly':
          return 'flee'

        case 'neutral':
        case 'aggressive':
          if (distanceToTarget <= this.attackRange) {
            return 'attack'
          }
          return 'chase'
      }
    }

    // No target or out of range
    if (this.canPatrol) {
      return 'patrol'
    }

    return 'idle'
  }

  onUpdate(dt: number): void {
    // Handle idle timer
    if (this.state === 'idle') {
      this.idleTimer += dt
      if (this.idleTimer >= this.idleDuration && this.canPatrol) {
        this.idleTimer = 0
        this.setState('patrol')
      }
    }
  }
}
