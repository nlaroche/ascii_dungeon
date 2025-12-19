// =============================================================================
// Game Hooks - Connect visual scripting to game systems (animation, sound, etc)
// =============================================================================

import { ExprValue } from './expressions'
import { registerExecutor, NodeExecutorContext } from './nodeExecutors'
import { CameraBrain, CameraShakeComponent, CameraComponent } from '../components/CameraComponent'

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

// -----------------------------------------------------------------------------
// Node Executors for Game Hooks
// -----------------------------------------------------------------------------

export const gameHookExecutors: Record<
  string,
  (inputs: Record<string, ExprValue>, ctx: NodeExecutorContext) => ExprValue
> = {
  // Animation nodes
  'play-animation': (inputs) => {
    GameHooks.playAnimation({
      entityId: String(inputs.entity || inputs.self || ''),
      animationName: String(inputs.animation || inputs.name || ''),
      loop: Boolean(inputs.loop),
      speed: Number(inputs.speed) || 1,
    })
    return null
  },

  'stop-animation': (inputs) => {
    GameHooks.playAnimation({
      entityId: String(inputs.entity || ''),
      animationName: '__stop__',
    })
    return null
  },

  // Sound nodes
  'play-sound': (inputs) => {
    GameHooks.playSound({
      soundId: String(inputs.sound || inputs.id || ''),
      volume: Number(inputs.volume) ?? 1,
      pitch: Number(inputs.pitch) ?? 1,
      loop: Boolean(inputs.loop),
    })
    return null
  },

  'play-sound-at': (inputs) => {
    const pos = inputs.position as [number, number] | undefined
    GameHooks.playSound({
      soundId: String(inputs.sound || ''),
      volume: Number(inputs.volume) ?? 1,
      position: pos || [0, 0],
    })
    return null
  },

  'stop-sound': (inputs) => {
    GameHooks.playSound({
      soundId: String(inputs.sound || ''),
      volume: 0,
    })
    return null
  },

  // Particle nodes
  'spawn-particles': (inputs) => {
    const pos = inputs.position as [number, number] | undefined
    const color = inputs.color as [number, number, number] | undefined
    GameHooks.spawnParticle({
      effectId: String(inputs.effect || inputs.id || ''),
      position: pos || [0, 0],
      duration: Number(inputs.duration) || undefined,
      color,
    })
    return null
  },

  // Camera nodes - Basic hooks (fallback for games without full camera system)
  'camera-shake': (inputs) => {
    // Try to use the camera component system first
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const shake = brain.getShake(nodeId)
        if (shake) {
          shake.addTrauma(Number(inputs.intensity) || 0.5)
          return null
        }
      }
    }
    // Fallback to GameHooks
    GameHooks.cameraAction({
      action: 'shake',
      intensity: Number(inputs.intensity) || 1,
      duration: Number(inputs.duration) || 0.5,
    })
    return null
  },

  'camera-flash': (inputs) => {
    GameHooks.cameraAction({
      action: 'flash',
      duration: Number(inputs.duration) || 0.1,
    })
    return null
  },

  'camera-follow': (inputs) => {
    // Try to set the transposer target
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const transposer = brain.getTransposer(nodeId)
        if (transposer) {
          transposer.setTarget(String(inputs.target || ''))
          return null
        }
      }
    }
    // Fallback
    GameHooks.cameraAction({
      action: 'follow',
      target: String(inputs.target || ''),
    })
    return null
  },

  'camera-move-to': (inputs) => {
    const pos = inputs.position as [number, number] | undefined
    GameHooks.cameraAction({
      action: 'moveTo',
      target: pos,
      duration: Number(inputs.duration) || 1,
    })
    return null
  },

  // Camera component nodes - Direct control over camera system
  'camera-switch-to': (inputs) => {
    const brain = CameraBrain.getInstance()
    const cameraId = String(inputs.camera || inputs.nodeId || '')
    const immediate = Boolean(inputs.immediate)
    brain.switchToCamera(cameraId, immediate)
    return null
  },

  'camera-set-priority': (inputs) => {
    const brain = CameraBrain.getInstance()
    const cameras = brain.getAllCameras()
    const targetId = String(inputs.camera || '')
    for (const cam of cameras) {
      if (cam.getNode()?.id === targetId) {
        cam.setPriority(Number(inputs.priority) || 10)
        break
      }
    }
    return null
  },

  'camera-set-zoom': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      liveCamera.setZoom(Number(inputs.zoom) || 1)
    }
    return null
  },

  'camera-set-rotation': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      liveCamera.setRotation(Number(inputs.rotation) || 0)
    }
    return null
  },

  'camera-add-trauma': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const shake = brain.getShake(nodeId)
        if (shake) {
          shake.addTrauma(Number(inputs.amount) || 0.3)
        }
      }
    }
    return null
  },

  'camera-set-bounds': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const confiner = brain.getConfiner(nodeId)
        if (confiner) {
          confiner.setBounds(
            Number(inputs.minX) || 0,
            Number(inputs.minY) || 0,
            Number(inputs.maxX) || 100,
            Number(inputs.maxY) || 100
          )
        }
      }
    }
    return null
  },

  'camera-letterbox-show': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const letterbox = brain.getLetterbox(nodeId)
        if (letterbox) {
          letterbox.show()
        }
      }
    }
    return null
  },

  'camera-letterbox-hide': (inputs) => {
    const brain = CameraBrain.getInstance()
    const liveCamera = brain.getLiveCamera()
    if (liveCamera) {
      const nodeId = liveCamera.getNode()?.id
      if (nodeId) {
        const letterbox = brain.getLetterbox(nodeId)
        if (letterbox) {
          letterbox.hide()
        }
      }
    }
    return null
  },

  'camera-get-position': () => {
    const brain = CameraBrain.getInstance()
    const output = brain.getOutput()
    return [output.x, output.y]
  },

  'camera-get-zoom': () => {
    const brain = CameraBrain.getInstance()
    return brain.getOutput().zoom
  },

  // Custom event nodes
  'emit-event': (inputs) => {
    GameHooks.emitCustom(
      String(inputs.event || inputs.name || ''),
      inputs.data
    )
    return null
  },

  'trigger-event': (inputs) => {
    GameHooks.emitCustom(
      String(inputs.event || ''),
      inputs.data
    )
    return null
  },
}

// Register all game hook executors
export function registerGameHookExecutors(): void {
  for (const [nodeType, executor] of Object.entries(gameHookExecutors)) {
    registerExecutor(nodeType, executor)
  }
}

// Auto-register on import
registerGameHookExecutors()
