// ═══════════════════════════════════════════════════════════════════════════
// Animator Component - Frame-based character animation
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'

/**
 * AnimatorComponent - Animates a glyph through a sequence of characters.
 *
 * Use this for simple frame-based animations like:
 * - Flickering torches: "☀*+."
 * - Water waves: "~≈∼"
 * - Spinning objects: "|/-\\"
 */
@component({
  name: 'Animator',
  icon: '▶',
  description: 'Frame-based character animation'
})
export class AnimatorComponent extends Component {
  @property({
    type: 'string',
    label: 'Frames',
    group: 'Animation',
    tooltip: 'Characters to cycle through (e.g., "|/-\\\\")'
  })
  frames: string = '|/-\\'

  @property({
    type: 'number',
    label: 'FPS',
    group: 'Animation',
    min: 0.1,
    max: 60,
    step: 0.1,
    tooltip: 'Frames per second'
  })
  fps: number = 4

  @property({
    type: 'boolean',
    label: 'Playing',
    group: 'Animation'
  })
  playing: boolean = true

  @property({
    type: 'boolean',
    label: 'Loop',
    group: 'Animation'
  })
  loop: boolean = true

  @property({
    type: 'boolean',
    label: 'Ping Pong',
    group: 'Animation',
    tooltip: 'Reverse direction at end instead of looping'
  })
  pingPong: boolean = false

  @property({
    type: 'number',
    label: 'Random Offset',
    group: 'Variation',
    min: 0,
    max: 1,
    step: 0.1,
    tooltip: 'Random phase offset (0-1) for variation between instances'
  })
  randomOffset: number = 0

  // Internal state
  private _currentFrame: number = 0
  private _timer: number = 0
  private _direction: number = 1
  private _phaseOffset: number = 0

  constructor() {
    super()
    // Initialize random phase offset
    this._phaseOffset = Math.random()
  }

  /**
   * Get the current character to display.
   */
  getCurrentChar(time?: number): string {
    if (!this.frames || this.frames.length === 0) {
      return ' '
    }

    if (time !== undefined) {
      // Calculate frame from absolute time (for synchronized rendering)
      const effectiveTime = time + (this._phaseOffset * this.randomOffset)
      const frameIndex = Math.floor(effectiveTime * this.fps) % this.frames.length
      return this.frames[frameIndex]
    }

    return this.frames[this._currentFrame] || ' '
  }

  /**
   * Get the current frame index.
   */
  getCurrentFrameIndex(): number {
    return this._currentFrame
  }

  /**
   * Get total number of frames.
   */
  getFrameCount(): number {
    return this.frames.length
  }

  /**
   * Update animation state.
   */
  onUpdate(dt: number): void {
    if (!this.playing || !this.frames || this.frames.length <= 1) {
      return
    }

    this._timer += dt
    const frameDuration = 1 / this.fps

    while (this._timer >= frameDuration) {
      this._timer -= frameDuration
      this._advanceFrame()
    }
  }

  /**
   * Advance to next frame.
   */
  private _advanceFrame(): void {
    const frameCount = this.frames.length

    if (this.pingPong) {
      this._currentFrame += this._direction
      if (this._currentFrame >= frameCount - 1) {
        this._currentFrame = frameCount - 1
        this._direction = -1
      } else if (this._currentFrame <= 0) {
        this._currentFrame = 0
        this._direction = 1
        if (!this.loop) {
          this.playing = false
        }
      }
    } else {
      this._currentFrame = (this._currentFrame + 1) % frameCount
      if (this._currentFrame === 0 && !this.loop) {
        this.playing = false
        this._currentFrame = frameCount - 1
      }
    }
  }

  /**
   * Reset animation to first frame.
   */
  reset(): void {
    this._currentFrame = 0
    this._timer = 0
    this._direction = 1
  }

  /**
   * Play from beginning.
   */
  play(): void {
    this.reset()
    this.playing = true
  }

  /**
   * Stop at current frame.
   */
  stop(): void {
    this.playing = false
  }

  /**
   * Go to specific frame.
   */
  gotoFrame(index: number): void {
    this._currentFrame = Math.max(0, Math.min(index, this.frames.length - 1))
    this._timer = 0
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      currentFrame: this._currentFrame,
      timer: this._timer,
      direction: this._direction,
      phaseOffset: this._phaseOffset,
    }
  }

  override deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)
    if (typeof data.currentFrame === 'number') this._currentFrame = data.currentFrame
    if (typeof data.timer === 'number') this._timer = data.timer
    if (typeof data.direction === 'number') this._direction = data.direction
    if (typeof data.phaseOffset === 'number') this._phaseOffset = data.phaseOffset
  }
}
