// ═══════════════════════════════════════════════════════════════════════════
// Camera Components - Cinematic camera system inspired by Cinemachine
// Priority-based virtual cameras with behaviors for following, confining, etc.
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, action, signal, lifecycle, number, boolean, vec2 } from '../decorators'
import type { Node, Transform as TransformData, PostProcessStack, CRTSettings } from '../../stores/engineState'
import { DEFAULT_CRT_SETTINGS, DEFAULT_POST_PROCESS_STACK } from '../../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Blend curve types for camera transitions */
export type BlendCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'cut'

/** Camera output after all behaviors are applied */
export interface CameraOutput {
  x: number
  y: number
  zoom: number
  rotation: number
  postProcess?: PostProcessStack
}

/** Event data for camera transitions */
export interface CameraTransitionEvent {
  fromCameraId: string | null
  toCameraId: string
  blendTime: number
  blendCurve: BlendCurve
}

/** Event data for camera shake */
export interface CameraShakeEvent {
  intensity: number
  duration: number
  componentId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Component - Virtual Camera
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'Camera',
  icon: '📷',
  description: 'Virtual camera with priority-based activation'
})
export class CameraComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Priority',
    group: 'Activation',
    min: 0,
    max: 100,
    step: 1,
    tooltip: 'Higher priority cameras take control. Default: 10'
  })
  priority: number = 10

  @property({
    type: 'boolean',
    label: 'Active',
    group: 'Activation',
    tooltip: 'Whether this camera is active and can take control'
  })
  active: boolean = true

  @property({
    type: 'number',
    label: 'Blend Time',
    group: 'Blending',
    min: 0,
    max: 5,
    step: 0.1,
    tooltip: 'Time in seconds to blend to this camera'
  })
  blendTime: number = 0.5

  @property({
    type: 'select',
    label: 'Blend Curve',
    group: 'Blending',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'cut'],
    tooltip: 'Easing curve for camera transitions'
  })
  blendCurve: BlendCurve = 'easeInOut'

  @property({
    type: 'number',
    label: 'Zoom',
    group: 'View',
    min: 0.1,
    max: 10,
    step: 0.1,
    tooltip: 'Zoom level (1 = default, 2 = zoomed in 2x)'
  })
  zoom: number = 1

  @property({
    type: 'number',
    label: 'Rotation',
    group: 'View',
    min: -180,
    max: 180,
    step: 1,
    tooltip: 'Camera rotation in degrees'
  })
  rotation: number = 0

  // ─────────────────────────────────────────────────────────────────────────
  // Post-Processing
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'object',
    label: 'Post Processing',
    group: 'Effects',
    tooltip: 'Per-camera post-processing effects stack'
  })
  postProcess: PostProcessStack = { ...DEFAULT_POST_PROCESS_STACK }

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Activate', description: 'Fired when this camera becomes active' })
  onActivate: (() => void) | null = null

  @signal({ displayName: 'On Deactivate', description: 'Fired when this camera is deactivated' })
  onDeactivate: (() => void) | null = null

  @signal({ displayName: 'On Blend Start', description: 'Fired when blending TO this camera starts' })
  onBlendStart: ((event: CameraTransitionEvent) => void) | null = null

  @signal({ displayName: 'On Blend Complete', description: 'Fired when blending TO this camera completes' })
  onBlendComplete: (() => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private _isLiveCamera: boolean = false

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Activate', category: 'Control', description: 'Activate this camera' })
  activate(): void {
    this.active = true
    CameraBrain.getInstance().evaluateCameras()
  }

  @action({ displayName: 'Deactivate', category: 'Control', description: 'Deactivate this camera' })
  deactivate(): void {
    this.active = false
    CameraBrain.getInstance().evaluateCameras()
  }

  @action({ displayName: 'Set Priority', category: 'Control', description: 'Set camera priority' })
  setPriority(priority: number): void {
    this.priority = Math.max(0, Math.min(100, priority))
    CameraBrain.getInstance().evaluateCameras()
  }

  @action({ displayName: 'Boost Priority', category: 'Control', description: 'Temporarily boost priority' })
  boostPriority(amount: number, duration: number): void {
    const originalPriority = this.priority
    this.priority += amount
    CameraBrain.getInstance().evaluateCameras()

    setTimeout(() => {
      this.priority = originalPriority
      CameraBrain.getInstance().evaluateCameras()
    }, duration * 1000)
  }

  @action({ displayName: 'Set Zoom', category: 'View', description: 'Set camera zoom level' })
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(10, zoom))
  }

  @action({ displayName: 'Set Rotation', category: 'View', description: 'Set camera rotation in degrees' })
  setRotation(degrees: number): void {
    this.rotation = degrees % 360
  }

  @action({ displayName: 'Enable Post-Processing', category: 'Effects', description: 'Enable camera post-processing' })
  enablePostProcess(): void {
    this.postProcess = { ...this.postProcess, enabled: true }
  }

  @action({ displayName: 'Disable Post-Processing', category: 'Effects', description: 'Disable camera post-processing' })
  disablePostProcess(): void {
    this.postProcess = { ...this.postProcess, enabled: false }
  }

  @action({ displayName: 'Set CRT Effect', category: 'Effects', description: 'Set a CRT effect value (0-1)' })
  setCRTEffect(effect: keyof CRTSettings, value: number): void {
    this.postProcess = {
      ...this.postProcess,
      crtEnabled: true,
      crtSettings: {
        ...this.postProcess.crtSettings,
        [effect]: value,
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerCamera(this)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterCamera(this)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /** Check if this is the live camera */
  isLive(): boolean {
    return this._isLiveCamera
  }

  /** Called by CameraBrain when this becomes the live camera */
  _setLive(isLive: boolean): void {
    const wasLive = this._isLiveCamera
    this._isLiveCamera = isLive

    if (isLive && !wasLive) {
      this.onActivate?.()
    } else if (!isLive && wasLive) {
      this.onDeactivate?.()
    }
  }

  /** Get the computed camera output (position from transform + behaviors) */
  getOutput(): CameraOutput {
    const node = this.getNode()

    // Get world position (includes parent transforms) via entity resolver
    // Fall back to local transform if resolver not available
    let baseX = 0
    let baseY = 0

    if (node) {
      const worldPos = CameraBrain.getInstance().getEntityPosition(node.id)
      if (worldPos) {
        baseX = worldPos.x
        baseY = worldPos.y
      } else {
        // Fallback to local transform
        const transform = this.getTransform()
        baseX = transform?.position?.[0] ?? 0
        baseY = transform?.position?.[1] ?? 0
      }
    }

    // Start with world position
    let output: CameraOutput = {
      x: baseX,
      y: baseY,
      zoom: this.zoom,
      rotation: this.rotation,
      postProcess: this.postProcess,
    }

    // Apply behaviors from sibling components
    if (node) {
      // Find and apply transposer
      const transposer = CameraBrain.getInstance().getTransposer(node.id)
      if (transposer) {
        const transposerOutput = transposer.apply(output)
        output = { ...output, ...transposerOutput }
      }

      // Find and apply composer
      const composer = CameraBrain.getInstance().getComposer(node.id)
      if (composer) {
        const composerOutput = composer.apply(output)
        output = { ...output, ...composerOutput }
      }

      // Find and apply confiner
      const confiner = CameraBrain.getInstance().getConfiner(node.id)
      if (confiner) {
        const confinerOutput = confiner.apply(output)
        output = { ...output, ...confinerOutput }
      }

      // Find and apply shake
      const shake = CameraBrain.getInstance().getShake(node.id)
      if (shake) {
        const shakeOutput = shake.apply(output)
        output = { ...output, ...shakeOutput }
      }
    }

    return output
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Transposer - Follow Behavior
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'CameraTransposer',
  icon: '↗',
  description: 'Makes camera follow a target with offset and damping'
})
export class CameraTransposerComponent extends Component {
  @property({
    type: 'entity',
    label: 'Follow Target',
    group: 'Target',
    tooltip: 'Entity to follow'
  })
  followTarget: string | null = null

  @property({
    type: 'vec2',
    label: 'Offset',
    group: 'Offset',
    tooltip: 'Position offset from target (in cells)'
  })
  offset: [number, number] = [0, 0]

  @property({
    type: 'number',
    label: 'Damping X',
    group: 'Damping',
    min: 0,
    max: 10,
    step: 0.1,
    tooltip: 'Horizontal follow smoothing (0 = instant, 10 = very slow)'
  })
  dampingX: number = 1

  @property({
    type: 'number',
    label: 'Damping Y',
    group: 'Damping',
    min: 0,
    max: 10,
    step: 0.1,
    tooltip: 'Vertical follow smoothing (0 = instant, 10 = very slow)'
  })
  dampingY: number = 1

  @property({
    type: 'select',
    label: 'Binding Mode',
    group: 'Behavior',
    options: ['lockToTarget', 'lockToTargetWithOffset', 'worldSpace'],
    tooltip: 'How the camera follows the target'
  })
  bindingMode: 'lockToTarget' | 'lockToTargetWithOffset' | 'worldSpace' = 'lockToTargetWithOffset'

  // Internal state for smooth follow
  private currentX: number = 0
  private currentY: number = 0
  private initialized: boolean = false

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Set Target', category: 'Target', description: 'Set the follow target' })
  setTarget(entityId: string): void {
    this.followTarget = entityId
  }

  @action({ displayName: 'Clear Target', category: 'Target', description: 'Clear the follow target' })
  clearTarget(): void {
    this.followTarget = null
  }

  @action({ displayName: 'Set Offset', category: 'Offset', description: 'Set position offset' })
  setOffset(x: number, y: number): void {
    this.offset = [x, y]
  }

  @action({ displayName: 'Set Damping', category: 'Damping', description: 'Set damping values' })
  setDamping(x: number, y: number): void {
    this.dampingX = Math.max(0, Math.min(10, x))
    this.dampingY = Math.max(0, Math.min(10, y))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerTransposer(this)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterTransposer(this)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply Behavior
  // ─────────────────────────────────────────────────────────────────────────

  apply(input: CameraOutput): Partial<CameraOutput> {
    if (!this.followTarget) {
      return {}
    }

    // Get target position from scene
    const target = CameraBrain.getInstance().getEntityPosition(this.followTarget)
    if (!target) {
      return {}
    }

    // Calculate goal position
    let goalX = target.x + this.offset[0]
    let goalY = target.y + this.offset[1]

    // Initialize if first frame
    if (!this.initialized) {
      this.currentX = goalX
      this.currentY = goalY
      this.initialized = true
    }

    // Apply damping (simple exponential smoothing)
    const dt = CameraBrain.getInstance().getDeltaTime()

    if (this.dampingX > 0) {
      const t = 1 - Math.exp(-dt * (10 / this.dampingX))
      this.currentX += (goalX - this.currentX) * t
    } else {
      this.currentX = goalX
    }

    if (this.dampingY > 0) {
      const t = 1 - Math.exp(-dt * (10 / this.dampingY))
      this.currentY += (goalY - this.currentY) * t
    } else {
      this.currentY = goalY
    }

    return {
      x: this.currentX,
      y: this.currentY,
    }
  }

  /** Reset to target position immediately */
  snapToTarget(): void {
    if (!this.followTarget) return

    const target = CameraBrain.getInstance().getEntityPosition(this.followTarget)
    if (target) {
      this.currentX = target.x + this.offset[0]
      this.currentY = target.y + this.offset[1]
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Composer - Look-At Behavior (for ASCII, this centers differently)
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'CameraComposer',
  icon: '⊕',
  description: 'Fine-tune camera framing with dead zones and screen position'
})
export class CameraComposerComponent extends Component {
  @property({
    type: 'entity',
    label: 'Look At Target',
    group: 'Target',
    tooltip: 'Entity to keep in frame'
  })
  lookAtTarget: string | null = null

  @property({
    type: 'vec2',
    label: 'Screen Position',
    group: 'Framing',
    tooltip: 'Where to position target on screen (0-1, center is 0.5, 0.5)'
  })
  screenPosition: [number, number] = [0.5, 0.5]

  @property({
    type: 'vec2',
    label: 'Dead Zone Size',
    group: 'Dead Zone',
    tooltip: 'Size of dead zone where camera does not move (0-1)'
  })
  deadZoneSize: [number, number] = [0.1, 0.1]

  @property({
    type: 'vec2',
    label: 'Soft Zone Size',
    group: 'Soft Zone',
    tooltip: 'Size of soft zone where camera moves slowly (0-1)'
  })
  softZoneSize: [number, number] = [0.4, 0.4]

  @property({
    type: 'number',
    label: 'Soft Zone Bias',
    group: 'Soft Zone',
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: 'How fast camera reacts in soft zone (0 = slow, 1 = instant)'
  })
  softZoneBias: number = 0.5

  @property({
    type: 'number',
    label: 'Lookahead Time',
    group: 'Lookahead',
    min: 0,
    max: 2,
    step: 0.1,
    tooltip: 'Look ahead based on target velocity'
  })
  lookaheadTime: number = 0

  // Internal state
  private lastTargetX: number = 0
  private lastTargetY: number = 0
  private velocityX: number = 0
  private velocityY: number = 0

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerComposer(this)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterComposer(this)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply Behavior
  // ─────────────────────────────────────────────────────────────────────────

  apply(input: CameraOutput): Partial<CameraOutput> {
    if (!this.lookAtTarget) {
      return {}
    }

    const target = CameraBrain.getInstance().getEntityPosition(this.lookAtTarget)
    if (!target) {
      return {}
    }

    // Calculate target velocity for lookahead
    const dt = CameraBrain.getInstance().getDeltaTime()
    if (dt > 0) {
      this.velocityX = (target.x - this.lastTargetX) / dt
      this.velocityY = (target.y - this.lastTargetY) / dt
    }
    this.lastTargetX = target.x
    this.lastTargetY = target.y

    // Apply lookahead
    let goalX = target.x + this.velocityX * this.lookaheadTime
    let goalY = target.y + this.velocityY * this.lookaheadTime

    // Offset based on screen position (e.g., 0.3 = left third of screen)
    const viewport = CameraBrain.getInstance().getViewportSize()
    goalX -= (this.screenPosition[0] - 0.5) * viewport.width
    goalY -= (this.screenPosition[1] - 0.5) * viewport.height

    // For ASCII, we'll simplify dead zone handling
    // In a full implementation, you'd calculate screen-space position

    return {
      x: goalX,
      y: goalY,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Confiner - Boundary Constraints
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'CameraConfiner',
  icon: '⬚',
  description: 'Constrains camera to a rectangular boundary'
})
export class CameraConfinerComponent extends Component {
  @property({
    type: 'vec2',
    label: 'Bounds Min',
    group: 'Bounds',
    tooltip: 'Top-left corner of camera bounds'
  })
  boundsMin: [number, number] = [0, 0]

  @property({
    type: 'vec2',
    label: 'Bounds Max',
    group: 'Bounds',
    tooltip: 'Bottom-right corner of camera bounds'
  })
  boundsMax: [number, number] = [100, 100]

  @property({
    type: 'number',
    label: 'Damping',
    group: 'Behavior',
    min: 0,
    max: 2,
    step: 0.1,
    tooltip: 'Smoothing when hitting bounds'
  })
  damping: number = 0.2

  @property({
    type: 'boolean',
    label: 'Confine Screen Edges',
    group: 'Behavior',
    tooltip: 'Prevent screen edges from going outside bounds'
  })
  confineScreenEdges: boolean = true

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Set Bounds', category: 'Bounds', description: 'Set camera boundary' })
  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.boundsMin = [minX, minY]
    this.boundsMax = [maxX, maxY]
  }

  @action({ displayName: 'Expand Bounds', category: 'Bounds', description: 'Expand bounds by amount' })
  expandBounds(amount: number): void {
    this.boundsMin = [this.boundsMin[0] - amount, this.boundsMin[1] - amount]
    this.boundsMax = [this.boundsMax[0] + amount, this.boundsMax[1] + amount]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerConfiner(this)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterConfiner(this)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply Behavior
  // ─────────────────────────────────────────────────────────────────────────

  apply(input: CameraOutput): Partial<CameraOutput> {
    const viewport = CameraBrain.getInstance().getViewportSize()

    let x = input.x
    let y = input.y

    if (this.confineScreenEdges) {
      // Account for viewport size when confining
      const halfWidth = (viewport.width / 2) / input.zoom
      const halfHeight = (viewport.height / 2) / input.zoom

      // Clamp position so viewport edges stay within bounds
      const minX = this.boundsMin[0] + halfWidth
      const maxX = this.boundsMax[0] - halfWidth
      const minY = this.boundsMin[1] + halfHeight
      const maxY = this.boundsMax[1] - halfHeight

      // Handle case where bounds are smaller than viewport
      if (maxX < minX) {
        x = (this.boundsMin[0] + this.boundsMax[0]) / 2
      } else {
        x = Math.max(minX, Math.min(maxX, x))
      }

      if (maxY < minY) {
        y = (this.boundsMin[1] + this.boundsMax[1]) / 2
      } else {
        y = Math.max(minY, Math.min(maxY, y))
      }
    } else {
      // Simple clamp to bounds
      x = Math.max(this.boundsMin[0], Math.min(this.boundsMax[0], x))
      y = Math.max(this.boundsMin[1], Math.min(this.boundsMax[1], y))
    }

    return { x, y }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Shake - Trauma-based Screen Shake
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'CameraShake',
  icon: '〰',
  description: 'Trauma-based screen shake effect'
})
export class CameraShakeComponent extends Component {
  @property({
    type: 'number',
    label: 'Max Offset X',
    group: 'Intensity',
    min: 0,
    max: 10,
    step: 0.5,
    tooltip: 'Maximum horizontal shake offset (in cells)'
  })
  maxOffsetX: number = 2

  @property({
    type: 'number',
    label: 'Max Offset Y',
    group: 'Intensity',
    min: 0,
    max: 10,
    step: 0.5,
    tooltip: 'Maximum vertical shake offset (in cells)'
  })
  maxOffsetY: number = 2

  @property({
    type: 'number',
    label: 'Max Rotation',
    group: 'Intensity',
    min: 0,
    max: 45,
    step: 1,
    tooltip: 'Maximum rotation shake (in degrees)'
  })
  maxRotation: number = 5

  @property({
    type: 'number',
    label: 'Frequency',
    group: 'Behavior',
    min: 1,
    max: 60,
    step: 1,
    tooltip: 'Shake frequency (oscillations per second)'
  })
  frequency: number = 20

  @property({
    type: 'number',
    label: 'Decay Rate',
    group: 'Behavior',
    min: 0.1,
    max: 5,
    step: 0.1,
    tooltip: 'How fast trauma decays (per second)'
  })
  decayRate: number = 1.5

  @property({
    type: 'number',
    label: 'Trauma Exponent',
    group: 'Behavior',
    min: 1,
    max: 4,
    step: 0.5,
    tooltip: 'Shake intensity curve (2 = quadratic, feels natural)'
  })
  traumaExponent: number = 2

  // Internal state
  private trauma: number = 0
  private time: number = 0
  private seed: number = Math.random() * 1000

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Shake Start', description: 'Fired when shake starts' })
  onShakeStart: ((event: CameraShakeEvent) => void) | null = null

  @signal({ displayName: 'On Shake End', description: 'Fired when shake ends (trauma reaches 0)' })
  onShakeEnd: (() => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Add Trauma', category: 'Shake', description: 'Add trauma (0-1, clamped)' })
  addTrauma(amount: number): void {
    const wasZero = this.trauma <= 0
    this.trauma = Math.min(1, this.trauma + amount)

    if (wasZero && this.trauma > 0) {
      this.onShakeStart?.({
        intensity: amount,
        duration: amount / this.decayRate,
        componentId: this.id,
      })
    }
  }

  @action({ displayName: 'Set Trauma', category: 'Shake', description: 'Set trauma directly (0-1)' })
  setTrauma(amount: number): void {
    const wasZero = this.trauma <= 0
    this.trauma = Math.max(0, Math.min(1, amount))

    if (wasZero && this.trauma > 0) {
      this.onShakeStart?.({
        intensity: amount,
        duration: amount / this.decayRate,
        componentId: this.id,
      })
    }
  }

  @action({ displayName: 'Clear Trauma', category: 'Shake', description: 'Immediately stop shaking' })
  clearTrauma(): void {
    if (this.trauma > 0) {
      this.trauma = 0
      this.onShakeEnd?.()
    }
  }

  @action({ displayName: 'Shake', category: 'Shake', description: 'Apply a shake with intensity (0-1)' })
  shake(intensity: number): void {
    this.addTrauma(intensity)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerShake(this)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterShake(this)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply Behavior
  // ─────────────────────────────────────────────────────────────────────────

  apply(input: CameraOutput): Partial<CameraOutput> {
    const dt = CameraBrain.getInstance().getDeltaTime()

    // Decay trauma
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.decayRate * dt)
      if (this.trauma <= 0) {
        this.onShakeEnd?.()
      }
    }

    if (this.trauma <= 0) {
      return {}
    }

    // Calculate shake amount (trauma ^ exponent)
    const shake = Math.pow(this.trauma, this.traumaExponent)

    // Update time for noise
    this.time += dt

    // Use Perlin-like noise (simplified as sin with different frequencies)
    const offsetX = this.maxOffsetX * shake * this.noise(this.time * this.frequency, this.seed)
    const offsetY = this.maxOffsetY * shake * this.noise(this.time * this.frequency, this.seed + 100)
    const rotation = this.maxRotation * shake * this.noise(this.time * this.frequency, this.seed + 200)

    return {
      x: input.x + offsetX,
      y: input.y + offsetY,
      rotation: input.rotation + rotation,
    }
  }

  /** Simple noise function for shake */
  private noise(t: number, seed: number): number {
    // Combine multiple sine waves for pseudo-random feel
    return (
      Math.sin(t * 1.0 + seed) * 0.5 +
      Math.sin(t * 2.3 + seed * 1.7) * 0.3 +
      Math.sin(t * 5.1 + seed * 2.3) * 0.2
    )
  }

  /** Get current trauma level */
  getTrauma(): number {
    return this.trauma
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Letterbox - Cinematic Bars
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'CameraLetterbox',
  icon: '▬',
  description: 'Cinematic letterbox bars for cutscenes'
})
export class CameraLetterboxComponent extends Component {
  @property({
    type: 'number',
    label: 'Target Ratio',
    group: 'Letterbox',
    min: 1,
    max: 3,
    step: 0.1,
    tooltip: 'Target aspect ratio (2.35 = cinemascope)'
  })
  targetRatio: number = 2.35

  @property({
    type: 'boolean',
    label: 'Enabled',
    group: 'Letterbox',
    tooltip: 'Whether letterbox is active'
  })
  letterboxEnabled: boolean = false

  @property({
    type: 'number',
    label: 'Transition Time',
    group: 'Animation',
    min: 0,
    max: 2,
    step: 0.1,
    tooltip: 'Time to animate bars in/out'
  })
  transitionTime: number = 0.5

  @property({
    type: 'color',
    label: 'Bar Color',
    group: 'Appearance',
    tooltip: 'Color of letterbox bars'
  })
  barColor: [number, number, number] = [0, 0, 0]

  // Internal state
  private currentAmount: number = 0
  private targetAmount: number = 0

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Bars Closed', description: 'Fired when letterbox is fully visible' })
  onBarsClosed: (() => void) | null = null

  @signal({ displayName: 'On Bars Open', description: 'Fired when letterbox is fully hidden' })
  onBarsOpen: (() => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Show Bars', category: 'Letterbox', description: 'Show letterbox bars' })
  show(): void {
    this.letterboxEnabled = true
    this.targetAmount = 1
  }

  @action({ displayName: 'Hide Bars', category: 'Letterbox', description: 'Hide letterbox bars' })
  hide(): void {
    this.letterboxEnabled = false
    this.targetAmount = 0
  }

  @action({ displayName: 'Toggle Bars', category: 'Letterbox', description: 'Toggle letterbox bars' })
  toggle(): void {
    this.letterboxEnabled = !this.letterboxEnabled
    this.targetAmount = this.letterboxEnabled ? 1 : 0
  }

  @action({ displayName: 'Set Ratio', category: 'Letterbox', description: 'Set target aspect ratio' })
  setRatio(ratio: number): void {
    this.targetRatio = Math.max(1, Math.min(3, ratio))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    CameraBrain.getInstance().registerLetterbox(this)
    this.targetAmount = this.letterboxEnabled ? 1 : 0
    this.currentAmount = this.targetAmount
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    CameraBrain.getInstance().unregisterLetterbox(this)
  }

  @lifecycle('Execute:Update')
  onUpdate(): void {
    const dt = CameraBrain.getInstance().getDeltaTime()

    // Animate towards target
    if (this.currentAmount !== this.targetAmount) {
      const speed = this.transitionTime > 0 ? 1 / this.transitionTime : 100
      const diff = this.targetAmount - this.currentAmount
      const step = Math.sign(diff) * speed * dt

      if (Math.abs(step) >= Math.abs(diff)) {
        this.currentAmount = this.targetAmount

        // Emit events
        if (this.currentAmount >= 1) {
          this.onBarsClosed?.()
        } else if (this.currentAmount <= 0) {
          this.onBarsOpen?.()
        }
      } else {
        this.currentAmount += step
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /** Get current letterbox amount (0-1) */
  getAmount(): number {
    return this.currentAmount
  }

  /** Calculate bar height for rendering */
  getBarHeight(viewportHeight: number): number {
    if (this.currentAmount <= 0) return 0

    const viewport = CameraBrain.getInstance().getViewportSize()
    const currentRatio = viewport.width / viewport.height

    if (currentRatio <= this.targetRatio) return 0

    // Calculate how much height to crop for target ratio
    const targetHeight = viewport.width / this.targetRatio
    const barHeight = (viewport.height - targetHeight) / 2

    return barHeight * this.currentAmount
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Brain - Singleton Manager
// ─────────────────────────────────────────────────────────────────────────────

/** Listener for camera output updates */
type CameraOutputListener = (output: CameraOutput) => void

export class CameraBrain {
  private static instance: CameraBrain

  // Registered cameras and behaviors
  private cameras: Map<string, CameraComponent> = new Map()
  private transposers: Map<string, CameraTransposerComponent> = new Map()
  private composers: Map<string, CameraComposerComponent> = new Map()
  private confiners: Map<string, CameraConfinerComponent> = new Map()
  private shakes: Map<string, CameraShakeComponent> = new Map()
  private letterboxes: Map<string, CameraLetterboxComponent> = new Map()

  // Current state
  private liveCameraId: string | null = null
  private blendingFrom: string | null = null
  private blendProgress: number = 1
  private blendDuration: number = 0
  private blendCurve: BlendCurve = 'easeInOut'
  private previousOutput: CameraOutput = { x: 0, y: 0, zoom: 1, rotation: 0 }

  // Time tracking
  private deltaTime: number = 0
  private lastTime: number = 0

  // Viewport
  private viewportWidth: number = 80
  private viewportHeight: number = 40

  // Entity position resolver (injected)
  private entityResolver: ((id: string) => { x: number; y: number } | null) | null = null

  // Output listeners
  private listeners: Set<CameraOutputListener> = new Set()

  static getInstance(): CameraBrain {
    if (!CameraBrain.instance) {
      CameraBrain.instance = new CameraBrain()
    }
    return CameraBrain.instance
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /** Set the entity position resolver function */
  setEntityResolver(resolver: (id: string) => { x: number; y: number } | null): void {
    this.entityResolver = resolver
  }

  /** Set viewport size */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
  }

  /** Get viewport size */
  getViewportSize(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight }
  }

  /** Get entity position */
  getEntityPosition(entityId: string): { x: number; y: number } | null {
    return this.entityResolver?.(entityId) ?? null
  }

  /** Get delta time */
  getDeltaTime(): number {
    return this.deltaTime
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  registerCamera(camera: CameraComponent): void {
    const nodeId = camera.getNode()?.id
    if (nodeId) {
      this.cameras.set(nodeId, camera)
      this.evaluateCameras()
    }
  }

  unregisterCamera(camera: CameraComponent): void {
    const nodeId = camera.getNode()?.id
    if (nodeId) {
      this.cameras.delete(nodeId)
      if (this.liveCameraId === nodeId) {
        this.liveCameraId = null
        this.evaluateCameras()
      }
    }
  }

  registerTransposer(transposer: CameraTransposerComponent): void {
    const nodeId = transposer.getNode()?.id
    if (nodeId) this.transposers.set(nodeId, transposer)
  }

  unregisterTransposer(transposer: CameraTransposerComponent): void {
    const nodeId = transposer.getNode()?.id
    if (nodeId) this.transposers.delete(nodeId)
  }

  registerComposer(composer: CameraComposerComponent): void {
    const nodeId = composer.getNode()?.id
    if (nodeId) this.composers.set(nodeId, composer)
  }

  unregisterComposer(composer: CameraComposerComponent): void {
    const nodeId = composer.getNode()?.id
    if (nodeId) this.composers.delete(nodeId)
  }

  registerConfiner(confiner: CameraConfinerComponent): void {
    const nodeId = confiner.getNode()?.id
    if (nodeId) this.confiners.set(nodeId, confiner)
  }

  unregisterConfiner(confiner: CameraConfinerComponent): void {
    const nodeId = confiner.getNode()?.id
    if (nodeId) this.confiners.delete(nodeId)
  }

  registerShake(shake: CameraShakeComponent): void {
    const nodeId = shake.getNode()?.id
    if (nodeId) this.shakes.set(nodeId, shake)
  }

  unregisterShake(shake: CameraShakeComponent): void {
    const nodeId = shake.getNode()?.id
    if (nodeId) this.shakes.delete(nodeId)
  }

  registerLetterbox(letterbox: CameraLetterboxComponent): void {
    const nodeId = letterbox.getNode()?.id
    if (nodeId) this.letterboxes.set(nodeId, letterbox)
  }

  unregisterLetterbox(letterbox: CameraLetterboxComponent): void {
    const nodeId = letterbox.getNode()?.id
    if (nodeId) this.letterboxes.delete(nodeId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Behavior Accessors
  // ─────────────────────────────────────────────────────────────────────────

  getTransposer(nodeId: string): CameraTransposerComponent | undefined {
    return this.transposers.get(nodeId)
  }

  getComposer(nodeId: string): CameraComposerComponent | undefined {
    return this.composers.get(nodeId)
  }

  getConfiner(nodeId: string): CameraConfinerComponent | undefined {
    return this.confiners.get(nodeId)
  }

  getShake(nodeId: string): CameraShakeComponent | undefined {
    return this.shakes.get(nodeId)
  }

  getLetterbox(nodeId: string): CameraLetterboxComponent | undefined {
    return this.letterboxes.get(nodeId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera Selection
  // ─────────────────────────────────────────────────────────────────────────

  /** Re-evaluate which camera should be live */
  evaluateCameras(): void {
    let bestCamera: CameraComponent | null = null
    let bestPriority = -Infinity

    for (const camera of this.cameras.values()) {
      if (camera.enabled && camera.active && camera.priority > bestPriority) {
        bestCamera = camera
        bestPriority = camera.priority
      }
    }

    const newLiveCameraId = bestCamera?.getNode()?.id ?? null

    if (newLiveCameraId !== this.liveCameraId) {
      const oldCamera = this.liveCameraId ? this.cameras.get(this.liveCameraId) : null

      // Start blending
      if (bestCamera) {
        this.blendingFrom = this.liveCameraId
        this.blendProgress = 0
        this.blendDuration = bestCamera.blendTime
        this.blendCurve = bestCamera.blendCurve

        // Fire blend start event
        bestCamera.onBlendStart?.({
          fromCameraId: this.blendingFrom,
          toCameraId: newLiveCameraId!,
          blendTime: this.blendDuration,
          blendCurve: this.blendCurve,
        })
      }

      // Update live status
      oldCamera?._setLive(false)
      bestCamera?._setLive(true)

      this.liveCameraId = newLiveCameraId
    }
  }

  /** Get the currently live camera */
  getLiveCamera(): CameraComponent | null {
    return this.liveCameraId ? this.cameras.get(this.liveCameraId) ?? null : null
  }

  /** Get all registered cameras */
  getAllCameras(): CameraComponent[] {
    return Array.from(this.cameras.values())
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  /** Update camera brain (call each frame) */
  update(time: number): CameraOutput {
    // Calculate delta time
    this.deltaTime = this.lastTime === 0 ? 0.016 : (time - this.lastTime) / 1000
    this.lastTime = time

    // Get live camera output
    const liveCamera = this.getLiveCamera()
    if (!liveCamera) {
      return this.previousOutput
    }

    const liveOutput = liveCamera.getOutput()

    // Handle blending
    let output: CameraOutput
    if (this.blendProgress < 1 && this.blendingFrom) {
      const fromCamera = this.cameras.get(this.blendingFrom)
      const fromOutput = fromCamera?.getOutput() ?? this.previousOutput

      // Update blend progress
      if (this.blendDuration > 0) {
        this.blendProgress = Math.min(1, this.blendProgress + this.deltaTime / this.blendDuration)
      } else {
        this.blendProgress = 1
      }

      // Apply easing
      const t = this.applyEasing(this.blendProgress, this.blendCurve)

      // Lerp between cameras
      output = {
        x: fromOutput.x + (liveOutput.x - fromOutput.x) * t,
        y: fromOutput.y + (liveOutput.y - fromOutput.y) * t,
        zoom: fromOutput.zoom + (liveOutput.zoom - fromOutput.zoom) * t,
        rotation: fromOutput.rotation + (liveOutput.rotation - fromOutput.rotation) * t,
      }

      // Fire blend complete event
      if (this.blendProgress >= 1) {
        liveCamera.onBlendComplete?.()
        this.blendingFrom = null
      }
    } else {
      output = liveOutput
    }

    this.previousOutput = output

    // Notify listeners
    for (const listener of this.listeners) {
      listener(output)
    }

    return output
  }

  /** Apply easing curve */
  private applyEasing(t: number, curve: BlendCurve): number {
    switch (curve) {
      case 'linear':
        return t
      case 'easeIn':
        return t * t
      case 'easeOut':
        return 1 - (1 - t) * (1 - t)
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      case 'cut':
        return 1
      default:
        return t
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Output Listeners
  // ─────────────────────────────────────────────────────────────────────────

  /** Subscribe to camera output updates */
  addListener(listener: CameraOutputListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Get the current camera output */
  getOutput(): CameraOutput {
    return { ...this.previousOutput }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /** Force switch to a specific camera */
  switchToCamera(nodeId: string, immediate: boolean = false): void {
    const camera = this.cameras.get(nodeId)
    if (!camera) return

    // Boost priority to ensure this camera wins
    const maxPriority = Math.max(...Array.from(this.cameras.values()).map(c => c.priority))
    camera.priority = maxPriority + 1

    if (immediate) {
      this.blendProgress = 1
      this.blendingFrom = null
      camera._setLive(true)
      this.liveCameraId = nodeId
    } else {
      this.evaluateCameras()
    }
  }

  /** Clear all cameras and reset state */
  reset(): void {
    this.cameras.clear()
    this.transposers.clear()
    this.composers.clear()
    this.confiners.clear()
    this.shakes.clear()
    this.letterboxes.clear()
    this.liveCameraId = null
    this.blendingFrom = null
    this.blendProgress = 1
    this.previousOutput = { x: 0, y: 0, zoom: 1, rotation: 0 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Global camera convenience object */
export const GameCamera = {
  /** Get the camera brain */
  getBrain: () => CameraBrain.getInstance(),

  /** Get the current camera output */
  getOutput: () => CameraBrain.getInstance().getOutput(),

  /** Get the live camera */
  getLiveCamera: () => CameraBrain.getInstance().getLiveCamera(),

  /** Switch to a specific camera */
  switchTo: (nodeId: string, immediate?: boolean) =>
    CameraBrain.getInstance().switchToCamera(nodeId, immediate),

  /** Add camera output listener */
  onUpdate: (listener: CameraOutputListener) =>
    CameraBrain.getInstance().addListener(listener),

  /** Update camera system (call each frame) */
  update: (time: number) => CameraBrain.getInstance().update(time),

  /** Set viewport size */
  setViewport: (width: number, height: number) =>
    CameraBrain.getInstance().setViewportSize(width, height),

  /** Set entity position resolver */
  setEntityResolver: (resolver: (id: string) => { x: number; y: number } | null) =>
    CameraBrain.getInstance().setEntityResolver(resolver),

  /** Reset camera system */
  reset: () => CameraBrain.getInstance().reset(),
}
