// =============================================================================
// Script Behaviors - TypeScript-based behaviors that can be loaded via BehaviorComponent
// =============================================================================

import { ExprValue } from './expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Context passed to script behaviors
 */
export interface ScriptBehaviorContext {
  /** Entity ID this behavior is attached to */
  entityId: string
  /** Entity name */
  entityName: string
  /** Get entity position */
  getPosition: () => { x: number; y: number }
  /** Set entity position */
  setPosition: (x: number, y: number) => void
  /** Translate entity by delta */
  translate: (dx: number, dy: number) => void
  /** Get a property value */
  getProperty: (name: string) => unknown
  /** Set a property value */
  setProperty: (name: string, value: unknown) => void
  /** Log a message */
  log: (message: string) => void
}

/**
 * Base interface for script behaviors
 */
export interface ScriptBehavior {
  /** Called when behavior is initialized */
  onInit?(ctx: ScriptBehaviorContext): void
  /** Called each frame with delta time */
  onUpdate?(ctx: ScriptBehaviorContext, deltaTime: number): void
  /** Called when behavior is disposed */
  onDispose?(ctx: ScriptBehaviorContext): void
}

/**
 * Factory function for creating script behaviors
 */
export type ScriptBehaviorFactory = (config: Record<string, unknown>) => ScriptBehavior

// -----------------------------------------------------------------------------
// Script Behavior Registry
// -----------------------------------------------------------------------------

const scriptBehaviorRegistry = new Map<string, ScriptBehaviorFactory>()

/**
 * Register a script behavior factory
 */
export function registerScriptBehavior(id: string, factory: ScriptBehaviorFactory): void {
  scriptBehaviorRegistry.set(id, factory)
}

/**
 * Check if a script behavior exists
 */
export function hasScriptBehavior(id: string): boolean {
  return scriptBehaviorRegistry.has(id)
}

/**
 * Create a script behavior instance
 */
export function createScriptBehavior(id: string, config: Record<string, unknown>): ScriptBehavior | null {
  const factory = scriptBehaviorRegistry.get(id)
  if (!factory) return null
  return factory(config)
}

/**
 * Get all registered script behavior IDs
 */
export function getScriptBehaviorIds(): string[] {
  return Array.from(scriptBehaviorRegistry.keys())
}

// -----------------------------------------------------------------------------
// Built-in: Wander Behavior
// -----------------------------------------------------------------------------

type WanderState = 'idle' | 'waiting' | 'moving'

interface WanderConfig {
  moveSpeed?: number
  minWaitTime?: number
  maxWaitTime?: number
  minSteps?: number
  maxSteps?: number
  wanderRadius?: number
  moveCooldown?: number
}

function createWanderBehavior(config: WanderConfig): ScriptBehavior {
  // Configuration with defaults
  const moveSpeed = config.moveSpeed ?? 2
  const minWaitTime = config.minWaitTime ?? 1
  const maxWaitTime = config.maxWaitTime ?? 3
  const minSteps = config.minSteps ?? 1
  const maxSteps = config.maxSteps ?? 4
  const wanderRadius = config.wanderRadius ?? 10
  const moveCooldown = config.moveCooldown ?? 0.2

  // State
  let state: WanderState = 'idle'
  let stateTimer = 0
  let moveTimer = 0
  let stepsRemaining = 0
  let dirX = 0
  let dirY = 0
  let startX = 0
  let startY = 0

  // Helper functions
  const randomRange = (min: number, max: number) => min + Math.random() * (max - min)
  const randomInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1))

  const chooseDirection = () => {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ]
    const dir = directions[Math.floor(Math.random() * directions.length)]
    dirX = dir.dx
    dirY = dir.dy
  }

  const enterWaiting = () => {
    state = 'waiting'
    stateTimer = randomRange(minWaitTime, maxWaitTime)
  }

  const enterMoving = () => {
    state = 'moving'
    stepsRemaining = randomInt(minSteps, maxSteps)
    chooseDirection()
    moveTimer = 0
  }

  return {
    onInit(ctx: ScriptBehaviorContext): void {
      // Store starting position
      const pos = ctx.getPosition()
      startX = pos.x
      startY = pos.y

      // Start with a short wait
      enterWaiting()

      ctx.log(`[Wander] Initialized at (${startX}, ${startY}), radius=${wanderRadius}`)
    },

    onUpdate(ctx: ScriptBehaviorContext, deltaTime: number): void {
      switch (state) {
        case 'idle':
          enterWaiting()
          break

        case 'waiting':
          stateTimer -= deltaTime
          if (stateTimer <= 0) {
            enterMoving()
          }
          break

        case 'moving':
          moveTimer -= deltaTime
          if (moveTimer <= 0 && stepsRemaining > 0) {
            // Check if move would exceed radius
            const pos = ctx.getPosition()
            const newX = pos.x + dirX
            const newY = pos.y + dirY
            const distFromStart = Math.abs(newX - startX) + Math.abs(newY - startY)

            if (distFromStart <= wanderRadius) {
              // Move is valid
              ctx.translate(dirX, dirY)
              stepsRemaining--
              moveTimer = moveCooldown

              // Occasionally change direction
              if (Math.random() < 0.2) {
                chooseDirection()
              }
            } else {
              // Too far, redirect toward start
              dirX = Math.sign(startX - pos.x) || (Math.random() < 0.5 ? 1 : -1)
              dirY = Math.sign(startY - pos.y) || (Math.random() < 0.5 ? 1 : -1)
              // Only use one axis
              if (Math.random() < 0.5) {
                dirX = 0
              } else {
                dirY = 0
              }
            }
          }

          if (stepsRemaining <= 0) {
            enterWaiting()
          }
          break
      }
    },

    onDispose(ctx: ScriptBehaviorContext): void {
      ctx.log('[Wander] Disposed')
    },
  }
}

// Register the wander behavior
registerScriptBehavior('wander', createWanderBehavior)

// -----------------------------------------------------------------------------
// Built-in: Patrol Behavior
// -----------------------------------------------------------------------------

interface PatrolConfig {
  waypoints?: Array<{ x: number; y: number }>
  speed?: number
  waitTime?: number
  loop?: boolean
}

function createPatrolBehavior(config: PatrolConfig): ScriptBehavior {
  const waypoints = config.waypoints ?? []
  const speed = config.speed ?? 2
  const waitTime = config.waitTime ?? 1
  const loop = config.loop ?? true

  let currentIndex = 0
  let timer = 0
  let isWaiting = false

  return {
    onInit(ctx: ScriptBehaviorContext): void {
      if (waypoints.length === 0) {
        ctx.log('[Patrol] No waypoints defined')
      }
    },

    onUpdate(ctx: ScriptBehaviorContext, deltaTime: number): void {
      if (waypoints.length === 0) return

      if (isWaiting) {
        timer -= deltaTime
        if (timer <= 0) {
          isWaiting = false
          // Move to next waypoint
          currentIndex++
          if (currentIndex >= waypoints.length) {
            if (loop) {
              currentIndex = 0
            } else {
              currentIndex = waypoints.length - 1
            }
          }
        }
        return
      }

      const target = waypoints[currentIndex]
      const pos = ctx.getPosition()
      const dx = target.x - pos.x
      const dy = target.y - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 0.5) {
        // Reached waypoint
        isWaiting = true
        timer = waitTime
      } else {
        // Move toward waypoint
        const moveAmount = speed * deltaTime
        const ratio = moveAmount / dist
        ctx.translate(dx * ratio, dy * ratio)
      }
    },

    onDispose(): void {
      // Nothing to clean up
    },
  }
}

registerScriptBehavior('patrol', createPatrolBehavior)

// -----------------------------------------------------------------------------
// Built-in: Follow Behavior
// -----------------------------------------------------------------------------

interface FollowConfig {
  targetName?: string
  speed?: number
  minDistance?: number
  maxDistance?: number
}

function createFollowBehavior(config: FollowConfig): ScriptBehavior {
  const targetName = config.targetName ?? 'Player'
  const speed = config.speed ?? 3
  const minDistance = config.minDistance ?? 1
  const maxDistance = config.maxDistance ?? 20

  let targetPosition: { x: number; y: number } | null = null

  return {
    onInit(ctx: ScriptBehaviorContext): void {
      ctx.log(`[Follow] Following '${targetName}' at speed ${speed}`)
    },

    onUpdate(ctx: ScriptBehaviorContext, deltaTime: number): void {
      // In a real implementation, we'd look up the target entity
      // For now, this is a placeholder that would be connected to Scene.findByName
      if (!targetPosition) return

      const pos = ctx.getPosition()
      const dx = targetPosition.x - pos.x
      const dy = targetPosition.y - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > maxDistance) {
        // Too far, stop following
        return
      }

      if (dist > minDistance) {
        // Move toward target
        const moveAmount = speed * deltaTime
        const ratio = Math.min(moveAmount / dist, 1)
        ctx.translate(dx * ratio, dy * ratio)
      }
    },

    onDispose(): void {
      // Nothing to clean up
    },
  }
}

registerScriptBehavior('follow', createFollowBehavior)

// -----------------------------------------------------------------------------
// Export All
// -----------------------------------------------------------------------------

export {
  createWanderBehavior,
  createPatrolBehavior,
  createFollowBehavior,
}
