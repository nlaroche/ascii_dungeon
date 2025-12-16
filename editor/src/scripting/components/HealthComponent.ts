// ═══════════════════════════════════════════════════════════════════════════
// Health Component - Hit points and damage handling
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'

@component({ name: 'Health', icon: '♥', description: 'Health points, damage, and death handling' })
export class HealthComponent extends Component {
  @property({ type: 'number', label: 'Current HP', group: 'Health', min: 0, step: 1 })
  current: number = 100

  @property({ type: 'number', label: 'Max HP', group: 'Health', min: 1, step: 1 })
  max: number = 100

  @property({ type: 'number', label: 'Regen Rate', group: 'Regeneration', min: 0, step: 0.1, tooltip: 'HP per second' })
  regenRate: number = 0

  @property({ type: 'number', label: 'Regen Delay', group: 'Regeneration', min: 0, step: 0.1, tooltip: 'Seconds after damage before regen starts' })
  regenDelay: number = 3

  @property({ type: 'boolean', label: 'Invulnerable', group: 'Combat' })
  invulnerable: boolean = false

  @property({ type: 'number', label: 'Armor', group: 'Combat', min: 0, step: 1, tooltip: 'Flat damage reduction' })
  armor: number = 0

  // Internal state (not exposed to inspector)
  private timeSinceDamage: number = 0
  private isDead: boolean = false

  // Callbacks
  onDamage?: (amount: number, source?: string) => void
  onHeal?: (amount: number) => void
  onDeath?: () => void
  onRevive?: () => void

  /** Get current health percentage (0-1) */
  getHealthPercent(): number {
    return this.max > 0 ? this.current / this.max : 0
  }

  /** Check if at full health */
  isFullHealth(): boolean {
    return this.current >= this.max
  }

  /** Check if dead */
  getIsDead(): boolean {
    return this.isDead
  }

  /** Deal damage to this entity */
  damage(amount: number, source?: string): number {
    if (this.invulnerable || this.isDead) return 0

    // Apply armor reduction
    const actualDamage = Math.max(0, amount - this.armor)

    const oldHealth = this.current
    this.current = Math.max(0, this.current - actualDamage)
    this.timeSinceDamage = 0

    this.onDamage?.(actualDamage, source)
    this.onPropertyChanged?.('current', oldHealth, this.current)

    if (this.current <= 0 && !this.isDead) {
      this.isDead = true
      this.onDeath?.()
    }

    return actualDamage
  }

  /** Heal this entity */
  heal(amount: number): number {
    if (this.isDead) return 0

    const oldHealth = this.current
    const actualHeal = Math.min(amount, this.max - this.current)
    this.current = Math.min(this.max, this.current + amount)

    if (actualHeal > 0) {
      this.onHeal?.(actualHeal)
      this.onPropertyChanged?.('current', oldHealth, this.current)
    }

    return actualHeal
  }

  /** Revive from death with optional health amount */
  revive(health?: number): void {
    if (!this.isDead) return

    this.isDead = false
    this.current = health ?? Math.floor(this.max * 0.5)
    this.timeSinceDamage = this.regenDelay // Allow immediate regen

    this.onRevive?.()
    this.onPropertyChanged?.('current', 0, this.current)
  }

  /** Set to full health */
  fullHeal(): void {
    this.heal(this.max - this.current)
  }

  /** Kill instantly */
  kill(): void {
    this.damage(this.current + 1)
  }

  onUpdate(dt: number): void {
    if (this.isDead || this.regenRate <= 0 || this.isFullHealth()) return

    this.timeSinceDamage += dt

    if (this.timeSinceDamage >= this.regenDelay) {
      this.heal(this.regenRate * dt)
    }
  }
}
