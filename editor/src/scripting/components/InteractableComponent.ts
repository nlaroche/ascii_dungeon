// ═══════════════════════════════════════════════════════════════════════════
// Interactable Component - Objects the player can interact with
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type InteractionType = 'press' | 'hold' | 'toggle' | 'automatic'

@component({ name: 'Interactable', icon: '⚡', description: 'Allows player interaction with this object' })
export class InteractableComponent extends Component {
  @select(['press', 'hold', 'toggle', 'automatic'], { label: 'Type', group: 'Interaction' })
  interactionType: InteractionType = 'press'

  @property({ type: 'string', label: 'Action', group: 'Interaction', tooltip: 'Action identifier for scripting' })
  action: string = 'use'

  @property({ type: 'string', label: 'Prompt', group: 'UI', tooltip: 'Text shown when player can interact' })
  prompt: string = 'Press E to interact'

  @property({ type: 'number', label: 'Range', group: 'Detection', min: 0.5, max: 10, step: 0.5 })
  range: number = 2

  @property({ type: 'boolean', label: 'Require Line of Sight', group: 'Detection' })
  requireLineOfSight: boolean = false

  @property({ type: 'number', label: 'Hold Duration', group: 'Hold', min: 0, max: 5, step: 0.1, tooltip: 'Seconds to hold for hold-type interactions' })
  holdDuration: number = 1

  @property({ type: 'number', label: 'Cooldown', group: 'Timing', min: 0, max: 10, step: 0.1 })
  cooldown: number = 0

  @property({ type: 'boolean', label: 'Single Use', group: 'Timing' })
  singleUse: boolean = false

  @property({ type: 'boolean', label: 'Enabled', group: 'State' })
  interactable: boolean = true

  // Internal state
  private lastInteractionTime: number = 0
  private hasBeenUsed: boolean = false
  private currentHoldProgress: number = 0
  private isToggled: boolean = false

  // Callbacks
  onInteract?: (action: string) => void
  onHoldStart?: () => void
  onHoldProgress?: (progress: number) => void
  onHoldComplete?: () => void
  onHoldCancel?: () => void
  onToggle?: (state: boolean) => void

  /** Check if interaction is currently available */
  canInteract(): boolean {
    if (!this.interactable) return false
    if (this.singleUse && this.hasBeenUsed) return false

    const now = Date.now() / 1000
    if (now - this.lastInteractionTime < this.cooldown) return false

    return true
  }

  /** Get remaining cooldown time */
  getCooldownRemaining(): number {
    const now = Date.now() / 1000
    return Math.max(0, this.cooldown - (now - this.lastInteractionTime))
  }

  /** Check if player is in range */
  isInRange(playerPosition: [number, number, number]): boolean {
    const transform = this.getTransform()
    if (!transform) return false

    const dx = playerPosition[0] - transform.position[0]
    const dy = playerPosition[1] - transform.position[1]
    const dz = playerPosition[2] - transform.position[2]

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    return distance <= this.range
  }

  /** Trigger press interaction */
  interact(): boolean {
    if (!this.canInteract()) return false

    if (this.interactionType === 'press') {
      this.lastInteractionTime = Date.now() / 1000
      this.hasBeenUsed = true
      this.onInteract?.(this.action)
      return true
    }

    if (this.interactionType === 'toggle') {
      this.isToggled = !this.isToggled
      this.lastInteractionTime = Date.now() / 1000
      this.onToggle?.(this.isToggled)
      this.onInteract?.(this.action)
      return true
    }

    return false
  }

  /** Start hold interaction */
  startHold(): boolean {
    if (!this.canInteract()) return false
    if (this.interactionType !== 'hold') return false

    this.currentHoldProgress = 0
    this.onHoldStart?.()
    return true
  }

  /** Update hold progress (call every frame while holding) */
  updateHold(dt: number): boolean {
    if (this.interactionType !== 'hold') return false

    this.currentHoldProgress += dt / this.holdDuration
    this.onHoldProgress?.(Math.min(1, this.currentHoldProgress))

    if (this.currentHoldProgress >= 1) {
      this.completeHold()
      return true
    }

    return false
  }

  /** Complete hold interaction */
  private completeHold(): void {
    this.lastInteractionTime = Date.now() / 1000
    this.hasBeenUsed = true
    this.currentHoldProgress = 0
    this.onHoldComplete?.()
    this.onInteract?.(this.action)
  }

  /** Cancel hold interaction */
  cancelHold(): void {
    if (this.currentHoldProgress > 0) {
      this.currentHoldProgress = 0
      this.onHoldCancel?.()
    }
  }

  /** Get current toggle state */
  getToggleState(): boolean {
    return this.isToggled
  }

  /** Set toggle state programmatically */
  setToggleState(state: boolean): void {
    if (this.isToggled !== state) {
      this.isToggled = state
      this.onToggle?.(state)
    }
  }

  /** Reset single-use state */
  reset(): void {
    this.hasBeenUsed = false
    this.currentHoldProgress = 0
    this.isToggled = false
  }
}
