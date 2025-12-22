// ═══════════════════════════════════════════════════════════════════════════
// EdgeTrigger Component - Detects player at map edges and triggers transitions
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, lifecycle } from '../decorators'
import { TransformCache } from '../runtime/TransformCache'

@component({ name: 'EdgeTrigger', icon: '🚪' })
export class EdgeTriggerComponent extends Component {
  @property({ type: 'number', label: 'Edge Threshold', min: 1, max: 5 })
  edgeThreshold: number = 2

  // Map bounds (for centered maps)
  @property({ type: 'number', label: 'Min X' })
  minX: number = -40

  @property({ type: 'number', label: 'Max X' })
  maxX: number = 39

  @property({ type: 'number', label: 'Min Y' })
  minY: number = -25

  @property({ type: 'number', label: 'Max Y' })
  maxY: number = 24

  @property({ type: 'number', label: 'Cooldown (seconds)' })
  cooldown: number = 0.5

  private lastTransitionTime: number = 0
  private initialized: boolean = false
  private storeAccessor: (() => any) | null = null

  setStoreAccessor(accessor: () => any): void {
    this.storeAccessor = accessor
  }

  @lifecycle('Execute:Init')
  onInit(): void {
    if (this.initialized) return
    this.initialized = true
    console.log(`[EdgeTrigger] Initialized - bounds: (${this.minX},${this.minY}) to (${this.maxX},${this.maxY}), threshold: ${this.edgeThreshold}`)
  }

  @lifecycle('Execute:Update')
  onUpdate(): void {
    // Check cooldown (use performance.now() for real time)
    const now = performance.now() / 1000  // Convert to seconds
    if (now - this.lastTransitionTime < this.cooldown) {
      return
    }

    // Find player
    const player = this.findPlayer()
    if (!player) return

    // Get player position
    const pos = TransformCache.getInstance().getWorldPosition(player.id)
    if (!pos) return

    // Check edges using actual map bounds
    let direction: 'north' | 'south' | 'east' | 'west' | null = null

    if (pos.x <= this.minX + this.edgeThreshold) {
      direction = 'west'
    } else if (pos.x >= this.maxX - this.edgeThreshold) {
      direction = 'east'
    } else if (pos.y <= this.minY + this.edgeThreshold) {
      direction = 'north'
    } else if (pos.y >= this.maxY - this.edgeThreshold) {
      direction = 'south'
    }

    if (direction) {
      console.log(`[EdgeTrigger] Player at ${direction} edge (pos: ${pos.x}, ${pos.y})`)
      this.triggerTransition(direction)
      this.lastTransitionTime = now
    }
  }

  private findPlayer(): { id: string; name: string; meta?: { isPlayer?: boolean } } | null {
    if (!this.storeAccessor) return null
    const state = this.storeAccessor()
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'Player' || node.meta?.isPlayer) {
        return node as { id: string; name: string; meta?: { isPlayer?: boolean } }
      }
    }
    return null
  }

  private triggerTransition(direction: 'north' | 'south' | 'east' | 'west'): void {
    // Find WorldManager component instance through the global
    const instances = (globalThis as any).__componentInstances as Map<string, Component> | undefined
    if (instances) {
      for (const [, instance] of instances) {
        if (instance.constructor.name === 'WorldManagerComponent' ||
            (instance as any).transitionTo) {
          (instance as any).transitionTo(direction)
          return
        }
      }
    }

    console.warn('[EdgeTrigger] Could not find WorldManager instance to call transitionTo')
  }
}
