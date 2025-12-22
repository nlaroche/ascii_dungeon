// ═══════════════════════════════════════════════════════════════════════════
// GameData Component - Persistent game state that survives screen transitions
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'

@component({ name: 'GameData', icon: '💾' })
export class GameDataComponent extends Component {
  // Player stats
  @property({ type: 'number', label: 'Health' })
  health: number = 100

  @property({ type: 'number', label: 'Max Health' })
  maxHealth: number = 100

  @property({ type: 'number', label: 'Gold' })
  gold: number = 0

  // Runtime state (not serialized as properties)
  private inventory: string[] = []
  private visitedScreens: Set<string> = new Set()
  private screenChanges: Map<string, object[]> = new Map()

  @lifecycle('Execute:Init')
  onInit(): void {
    // Mark starting screen as visited
    this.visitedScreens.add('0_0')
    console.log('[GameData] Initialized - starting at screen 0,0')
  }

  // Screen tracking
  markScreenVisited(worldX: number, worldY: number): void {
    const key = `${worldX}_${worldY}`
    this.visitedScreens.add(key)
  }

  isScreenVisited(worldX: number, worldY: number): boolean {
    return this.visitedScreens.has(`${worldX}_${worldY}`)
  }

  getVisitedCount(): number {
    return this.visitedScreens.size
  }

  // Screen changes (for persistent modifications like opened chests)
  recordScreenChange(worldX: number, worldY: number, change: object): void {
    const key = `${worldX}_${worldY}`
    const changes = this.screenChanges.get(key) || []
    changes.push(change)
    this.screenChanges.set(key, changes)
  }

  getScreenChanges(worldX: number, worldY: number): object[] {
    return this.screenChanges.get(`${worldX}_${worldY}`) || []
  }

  // Inventory management
  addItem(itemId: string): void {
    this.inventory.push(itemId)
  }

  removeItem(itemId: string): boolean {
    const index = this.inventory.indexOf(itemId)
    if (index >= 0) {
      this.inventory.splice(index, 1)
      return true
    }
    return false
  }

  hasItem(itemId: string): boolean {
    return this.inventory.includes(itemId)
  }

  getInventory(): string[] {
    return [...this.inventory]
  }

  // Health management
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount)
    return this.health > 0
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  isDead(): boolean {
    return this.health <= 0
  }

  // Gold management
  addGold(amount: number): void {
    this.gold += amount
  }

  spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount
      return true
    }
    return false
  }
}
