// ═══════════════════════════════════════════════════════════════════════════
// Runtime Manager - Game loop, input handling, and behavior execution
// Coordinates all scripting systems during gameplay
// ═══════════════════════════════════════════════════════════════════════════

import { GameEventBus, createGameEvent, TriplePhaseEventBus } from './events'
import { GlobalVariables } from './variables'
import { Component } from '../Component'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InputState {
  // Keyboard
  keysDown: Set<string>
  keysPressed: Set<string>  // Just pressed this frame
  keysReleased: Set<string> // Just released this frame

  // Mouse
  mouseX: number
  mouseY: number
  mouseWorldX: number
  mouseWorldY: number
  mouseButtons: Set<number>
  mousePressed: Set<number>
  mouseReleased: Set<number>
  mouseWheel: number

  // Touch (for mobile)
  touches: Array<{ id: number; x: number; y: number }>
}

export interface RuntimeStats {
  fps: number
  frameTime: number
  updateTime: number
  behaviorCount: number
  activeGraphs: number
}

type UpdateCallback = (deltaTime: number) => void
type RenderCallback = (interpolation: number) => void

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Manager
// ─────────────────────────────────────────────────────────────────────────────

export class RuntimeManager {
  private static instance: RuntimeManager

  // State
  private isRunning: boolean = false
  private isPaused: boolean = false
  private time: number = 0
  private frameCount: number = 0
  private deltaTime: number = 0
  private lastFrameTime: number = 0

  // Fixed timestep
  private fixedDeltaTime: number = 1 / 60
  private accumulator: number = 0
  private maxAccumulator: number = 0.25 // Prevent spiral of death

  // Input
  private input: InputState = {
    keysDown: new Set(),
    keysPressed: new Set(),
    keysReleased: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseButtons: new Set(),
    mousePressed: new Set(),
    mouseReleased: new Set(),
    mouseWheel: 0,
    touches: [],
  }

  // Components (behaviors)
  private behaviors: Set<Component> = new Set()

  // Callbacks
  private updateCallbacks: Set<UpdateCallback> = new Set()
  private fixedUpdateCallbacks: Set<UpdateCallback> = new Set()
  private lateUpdateCallbacks: Set<UpdateCallback> = new Set()
  private renderCallbacks: Set<RenderCallback> = new Set()

  // Stats
  private stats: RuntimeStats = {
    fps: 0,
    frameTime: 0,
    updateTime: 0,
    behaviorCount: 0,
    activeGraphs: 0,
  }
  private fpsFrames: number = 0
  private fpsTime: number = 0

  // Animation frame handle
  private frameHandle: number = 0

  // Event bus
  private eventBus: TriplePhaseEventBus

  static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager()
    }
    return RuntimeManager.instance
  }

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the runtime loop
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.isPaused = false
    this.lastFrameTime = performance.now()
    this.accumulator = 0

    // Setup input listeners
    this.setupInputListeners()

    // Emit runtime start event
    this.eventBus.emit(createGameEvent({
      type: 'runtime:start',
      source: { type: 'system', id: 'runtime' },
      data: {},
    }))

    // Start loop
    this.frameHandle = requestAnimationFrame(this.loop)

    console.log('[Runtime] Started')
  }

  /**
   * Stop the runtime loop
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    // Cancel animation frame
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle)
      this.frameHandle = 0
    }

    // Remove input listeners
    this.removeInputListeners()

    // Emit runtime stop event
    this.eventBus.emit(createGameEvent({
      type: 'runtime:stop',
      source: { type: 'system', id: 'runtime' },
      data: {},
    }))

    console.log('[Runtime] Stopped')
  }

  /**
   * Pause execution (keeps loop running but skips updates)
   */
  pause(): void {
    if (this.isPaused) return
    this.isPaused = true

    this.eventBus.emit(createGameEvent({
      type: 'runtime:pause',
      source: { type: 'system', id: 'runtime' },
      data: {},
    }))

    GlobalVariables.set('paused', 'global', true)
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (!this.isPaused) return
    this.isPaused = false
    this.lastFrameTime = performance.now() // Reset to avoid time jump

    this.eventBus.emit(createGameEvent({
      type: 'runtime:resume',
      source: { type: 'system', id: 'runtime' },
      data: {},
    }))

    GlobalVariables.set('paused', 'global', false)
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resume()
    } else {
      this.pause()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Loop
  // ─────────────────────────────────────────────────────────────────────────

  private loop = (timestamp: number): void => {
    if (!this.isRunning) return

    // Calculate delta time
    const rawDelta = (timestamp - this.lastFrameTime) / 1000
    this.deltaTime = Math.min(rawDelta, this.maxAccumulator)
    this.lastFrameTime = timestamp

    // Update stats
    this.updateStats(rawDelta)

    // Update global variables
    this.updateGlobalVariables()

    if (!this.isPaused) {
      const updateStart = performance.now()

      // Fixed update loop (physics, etc.)
      this.accumulator += this.deltaTime
      while (this.accumulator >= this.fixedDeltaTime) {
        this.fixedUpdate(this.fixedDeltaTime)
        this.accumulator -= this.fixedDeltaTime
      }

      // Variable update
      this.update(this.deltaTime)

      // Late update (camera follow, etc.)
      this.lateUpdate(this.deltaTime)

      this.stats.updateTime = performance.now() - updateStart
    }

    // Render (interpolation for smooth rendering between fixed updates)
    const interpolation = this.accumulator / this.fixedDeltaTime
    this.render(interpolation)

    // Clear per-frame input state
    this.clearFrameInput()

    // Schedule next frame
    this.frameHandle = requestAnimationFrame(this.loop)
  }

  private fixedUpdate(dt: number): void {
    // Emit FixedUpdate event
    this.eventBus.emit(createGameEvent({
      type: 'FixedUpdate',
      source: { type: 'system', id: 'runtime' },
      data: { deltaTime: dt },
    }))

    // Call fixed update callbacks
    for (const callback of this.fixedUpdateCallbacks) {
      callback(dt)
    }
  }

  private update(dt: number): void {
    // Emit Update event
    this.eventBus.emit(createGameEvent({
      type: 'Update',
      source: { type: 'system', id: 'runtime' },
      data: { deltaTime: dt },
    }))

    // Update all registered components
    for (const behavior of this.behaviors) {
      behavior.onUpdate?.(dt)
    }

    // Call update callbacks
    for (const callback of this.updateCallbacks) {
      callback(dt)
    }

    this.frameCount++
  }

  private lateUpdate(dt: number): void {
    // Emit LateUpdate event
    this.eventBus.emit(createGameEvent({
      type: 'LateUpdate',
      source: { type: 'system', id: 'runtime' },
      data: { deltaTime: dt },
    }))

    // Call late update callbacks
    for (const callback of this.lateUpdateCallbacks) {
      callback(dt)
    }
  }

  private render(interpolation: number): void {
    // Call render callbacks
    for (const callback of this.renderCallbacks) {
      callback(interpolation)
    }
  }

  private updateStats(rawDelta: number): void {
    this.stats.frameTime = rawDelta * 1000
    this.stats.behaviorCount = this.behaviors.size
    this.stats.activeGraphs = this.behaviors.size // All registered components are active

    // FPS calculation (averaged over 1 second)
    this.fpsFrames++
    this.fpsTime += rawDelta
    if (this.fpsTime >= 1) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsTime)
      this.fpsFrames = 0
      this.fpsTime = 0
    }
  }

  private updateGlobalVariables(): void {
    this.time += this.deltaTime
    GlobalVariables.set('time', 'global', this.time, undefined, 'runtime')
    GlobalVariables.set('deltaTime', 'global', this.deltaTime, undefined, 'runtime')
    GlobalVariables.set('frameCount', 'global', this.frameCount, undefined, 'runtime')
    GlobalVariables.set('mouseX', 'global', this.input.mouseX, undefined, 'runtime')
    GlobalVariables.set('mouseY', 'global', this.input.mouseY, undefined, 'runtime')
    GlobalVariables.set('mouseDown', 'global', this.input.mouseButtons.size > 0, undefined, 'runtime')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Behavior Registration
  // ─────────────────────────────────────────────────────────────────────────

  registerBehavior(behavior: Component): void {
    this.behaviors.add(behavior)
  }

  unregisterBehavior(behavior: Component): void {
    this.behaviors.delete(behavior)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Callback Registration
  // ─────────────────────────────────────────────────────────────────────────

  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback)
    return () => this.updateCallbacks.delete(callback)
  }

  onFixedUpdate(callback: UpdateCallback): () => void {
    this.fixedUpdateCallbacks.add(callback)
    return () => this.fixedUpdateCallbacks.delete(callback)
  }

  onLateUpdate(callback: UpdateCallback): () => void {
    this.lateUpdateCallbacks.add(callback)
    return () => this.lateUpdateCallbacks.delete(callback)
  }

  onRender(callback: RenderCallback): () => void {
    this.renderCallbacks.add(callback)
    return () => this.renderCallbacks.delete(callback)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Handling
  // ─────────────────────────────────────────────────────────────────────────

  private setupInputListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('wheel', this.handleWheel)
    window.addEventListener('contextmenu', this.handleContextMenu)
  }

  private removeInputListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mouseup', this.handleMouseUp)
    window.removeEventListener('mousemove', this.handleMouseMove)
    window.removeEventListener('wheel', this.handleWheel)
    window.removeEventListener('contextmenu', this.handleContextMenu)
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.code

    // Don't emit if key is already down (repeat)
    if (this.input.keysDown.has(key)) return

    this.input.keysDown.add(key)
    this.input.keysPressed.add(key)

    // Emit key press event
    this.eventBus.emit(createGameEvent({
      type: 'input:key-down',
      source: { type: 'system', id: 'input' },
      data: {
        key,
        code: e.code,
        keyCode: e.keyCode,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
    }))
  }

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.code

    this.input.keysDown.delete(key)
    this.input.keysReleased.add(key)

    // Emit key release event
    this.eventBus.emit(createGameEvent({
      type: 'input:key-up',
      source: { type: 'system', id: 'input' },
      data: {
        key,
        code: e.code,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
      },
    }))
  }

  private handleMouseDown = (e: MouseEvent): void => {
    this.input.mouseButtons.add(e.button)
    this.input.mousePressed.add(e.button)

    this.eventBus.emit(createGameEvent({
      type: 'input:mouse-down',
      source: { type: 'system', id: 'input' },
      data: {
        button: e.button,
        x: e.clientX,
        y: e.clientY,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
      },
    }))
  }

  private handleMouseUp = (e: MouseEvent): void => {
    this.input.mouseButtons.delete(e.button)
    this.input.mouseReleased.add(e.button)

    this.eventBus.emit(createGameEvent({
      type: 'input:mouse-up',
      source: { type: 'system', id: 'input' },
      data: {
        button: e.button,
        x: e.clientX,
        y: e.clientY,
      },
    }))
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.input.mouseX = e.clientX
    this.input.mouseY = e.clientY

    // Mouse move events are high frequency - only emit if significant movement
    // or if explicitly requested
  }

  private handleWheel = (e: WheelEvent): void => {
    this.input.mouseWheel = e.deltaY

    this.eventBus.emit(createGameEvent({
      type: 'input:mouse-wheel',
      source: { type: 'system', id: 'input' },
      data: {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
      },
    }))
  }

  private handleContextMenu = (e: MouseEvent): void => {
    // Prevent context menu in game view (optional)
    // e.preventDefault()
  }

  private clearFrameInput(): void {
    this.input.keysPressed.clear()
    this.input.keysReleased.clear()
    this.input.mousePressed.clear()
    this.input.mouseReleased.clear()
    this.input.mouseWheel = 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Query API
  // ─────────────────────────────────────────────────────────────────────────

  /** Check if a key is currently held down */
  isKeyDown(key: string): boolean {
    return this.input.keysDown.has(key)
  }

  /** Check if a key was just pressed this frame */
  isKeyPressed(key: string): boolean {
    return this.input.keysPressed.has(key)
  }

  /** Check if a key was just released this frame */
  isKeyReleased(key: string): boolean {
    return this.input.keysReleased.has(key)
  }

  /** Check if a mouse button is held down */
  isMouseDown(button: number = 0): boolean {
    return this.input.mouseButtons.has(button)
  }

  /** Check if a mouse button was just pressed */
  isMousePressed(button: number = 0): boolean {
    return this.input.mousePressed.has(button)
  }

  /** Check if a mouse button was just released */
  isMouseReleased(button: number = 0): boolean {
    return this.input.mouseReleased.has(button)
  }

  /** Get mouse position */
  getMousePosition(): { x: number; y: number } {
    return { x: this.input.mouseX, y: this.input.mouseY }
  }

  /** Get mouse wheel delta */
  getMouseWheel(): number {
    return this.input.mouseWheel
  }

  /** Get full input state (for advanced usage) */
  getInputState(): Readonly<InputState> {
    return this.input
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  getIsRunning(): boolean {
    return this.isRunning
  }

  getIsPaused(): boolean {
    return this.isPaused
  }

  getTime(): number {
    return this.time
  }

  getDeltaTime(): number {
    return this.deltaTime
  }

  getFrameCount(): number {
    return this.frameCount
  }

  getStats(): Readonly<RuntimeStats> {
    return this.stats
  }

  getFixedDeltaTime(): number {
    return this.fixedDeltaTime
  }

  setFixedDeltaTime(dt: number): void {
    this.fixedDeltaTime = Math.max(1 / 120, Math.min(1 / 10, dt))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Runtime = RuntimeManager.getInstance()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Start the runtime */
export const startRuntime = () => Runtime.start()

/** Stop the runtime */
export const stopRuntime = () => Runtime.stop()

/** Pause the runtime */
export const pauseRuntime = () => Runtime.pause()

/** Resume the runtime */
export const resumeRuntime = () => Runtime.resume()

/** Check if a key is held down */
export const isKeyDown = (key: string) => Runtime.isKeyDown(key)

/** Check if a key was just pressed */
export const isKeyPressed = (key: string) => Runtime.isKeyPressed(key)

/** Check if a mouse button is held */
export const isMouseDown = (button?: number) => Runtime.isMouseDown(button)

/** Get current time */
export const getTime = () => Runtime.getTime()

/** Get delta time */
export const getDeltaTime = () => Runtime.getDeltaTime()
