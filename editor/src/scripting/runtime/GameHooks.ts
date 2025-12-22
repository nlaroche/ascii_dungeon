// =============================================================================
// Game Hooks - Connect scripting to game systems (animation, sound, etc)
// =============================================================================

import { CameraBrain } from '../components/CameraComponent'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AnimationRequest {
  entityId: string
  animationName: string
  loop?: boolean
  speed?: number
  onComplete?: () => void
}

export interface SoundRequest {
  soundId: string
  volume?: number
  pitch?: number
  loop?: boolean
  position?: [number, number]
}

export interface ParticleRequest {
  effectId: string
  position: [number, number]
  duration?: number
  color?: [number, number, number]
}

export interface CameraRequest {
  action: 'shake' | 'flash' | 'follow' | 'moveTo'
  target?: string | [number, number]
  duration?: number
  intensity?: number
}

export type GameHookHandler<T> = (request: T) => void | Promise<void>

// -----------------------------------------------------------------------------
// Game Hooks Registry
// -----------------------------------------------------------------------------

class GameHooksRegistry {
  private animationHandler: GameHookHandler<AnimationRequest> | null = null
  private soundHandler: GameHookHandler<SoundRequest> | null = null
  private particleHandler: GameHookHandler<ParticleRequest> | null = null
  private cameraHandler: GameHookHandler<CameraRequest> | null = null
  private customHandlers: Map<string, GameHookHandler<unknown>> = new Map()

  // Animation hooks
  onAnimation(handler: GameHookHandler<AnimationRequest>): () => void {
    this.animationHandler = handler
    return () => { this.animationHandler = null }
  }

  playAnimation(request: AnimationRequest): void {
    if (this.animationHandler) {
      this.animationHandler(request)
    } else {
      console.log('[GameHooks] Animation:', request.animationName, 'on', request.entityId)
    }
  }

  // Sound hooks
  onSound(handler: GameHookHandler<SoundRequest>): () => void {
    this.soundHandler = handler
    return () => { this.soundHandler = null }
  }

  playSound(request: SoundRequest): void {
    if (this.soundHandler) {
      this.soundHandler(request)
    } else {
      console.log('[GameHooks] Sound:', request.soundId)
    }
  }

  // Particle hooks
  onParticle(handler: GameHookHandler<ParticleRequest>): () => void {
    this.particleHandler = handler
    return () => { this.particleHandler = null }
  }

  spawnParticle(request: ParticleRequest): void {
    if (this.particleHandler) {
      this.particleHandler(request)
    } else {
      console.log('[GameHooks] Particle:', request.effectId, 'at', request.position)
    }
  }

  // Camera hooks
  onCamera(handler: GameHookHandler<CameraRequest>): () => void {
    this.cameraHandler = handler
    return () => { this.cameraHandler = null }
  }

  cameraAction(request: CameraRequest): void {
    if (this.cameraHandler) {
      this.cameraHandler(request)
    } else {
      console.log('[GameHooks] Camera:', request.action)
    }
  }

  // Camera shake helper
  shakeCamera(intensity: number = 0.5, duration?: number): void {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const shake = brain.getShake(nodeId)
        if (shake) {
          shake.addTrauma(intensity)
          return
        }
      }
    }
    // Fallback to GameHooks
    this.cameraAction({
      action: 'shake',
      intensity,
      duration: duration || 0.5,
    })
  }

  // Custom event hooks
  onCustom(eventName: string, handler: GameHookHandler<unknown>): () => void {
    this.customHandlers.set(eventName, handler)
    return () => { this.customHandlers.delete(eventName) }
  }

  emitCustom(eventName: string, data: unknown): void {
    const handler = this.customHandlers.get(eventName)
    if (handler) {
      handler(data)
    } else {
      console.log('[GameHooks] Custom event:', eventName, data)
    }
  }

  // Check if handlers are registered
  hasAnimationHandler(): boolean { return this.animationHandler !== null }
  hasSoundHandler(): boolean { return this.soundHandler !== null }
  hasParticleHandler(): boolean { return this.particleHandler !== null }
  hasCameraHandler(): boolean { return this.cameraHandler !== null }
  hasCustomHandler(name: string): boolean { return this.customHandlers.has(name) }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const GameHooks = new GameHooksRegistry()

// Placeholder exports for backward compatibility
export const gameHookExecutors = {}
export function registerGameHookExecutors(): void {
  // No-op - executors were part of the visual scripting system
}
