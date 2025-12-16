// ═══════════════════════════════════════════════════════════════════════════
// Input System - Handles keyboard and mouse input
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, SystemPriority, type SystemUpdateContext } from '../System'
import { EventBus } from '../events'

export interface InputState {
  keys: Set<string>
  mouseButtons: Set<number>
  mousePosition: { x: number; y: number }
  mouseDelta: { x: number; y: number }
  wheelDelta: number
  modifiers: {
    ctrl: boolean
    shift: boolean
    alt: boolean
  }
}

/**
 * Input System - Centralizes input handling
 *
 * Hooks:
 * - onKeyDown: Called when a key is pressed
 * - onKeyUp: Called when a key is released
 * - onMouseDown: Called when mouse button pressed
 * - onMouseUp: Called when mouse button released
 * - onMouseMove: Called when mouse moves
 * - onWheel: Called when mouse wheel scrolls
 * - onShortcut: Called when a shortcut is triggered
 */
export class InputSystem extends EngineSystem {
  static readonly NAME = 'Input'

  private state: InputState = {
    keys: new Set(),
    mouseButtons: new Set(),
    mousePosition: { x: 0, y: 0 },
    mouseDelta: { x: 0, y: 0 },
    wheelDelta: 0,
    modifiers: { ctrl: false, shift: false, alt: false },
  }

  private shortcuts: Map<string, () => void> = new Map()
  private element: HTMLElement | null = null

  constructor() {
    super(InputSystem.NAME, SystemPriority.Input)

    // Define hooks
    this.defineHook('onKeyDown')
    this.defineHook('onKeyUp')
    this.defineHook('onMouseDown')
    this.defineHook('onMouseUp')
    this.defineHook('onMouseMove')
    this.defineHook('onWheel')
    this.defineHook('onShortcut')
  }

  initialize(): void {
    // Default shortcuts
    this.registerShortcut('v', () => EventBus.emit('tool:changed', { toolId: 'select', previousId: '' }))
    this.registerShortcut('g', () => EventBus.emit('tool:changed', { toolId: 'move', previousId: '' }))
    this.registerShortcut('r', () => EventBus.emit('tool:changed', { toolId: 'rotate', previousId: '' }))
    this.registerShortcut('s', () => EventBus.emit('tool:changed', { toolId: 'scale', previousId: '' }))
    this.registerShortcut('Escape', () => EventBus.emit('selection:changed', { nodeIds: [], previousIds: [] }))
  }

  update(_ctx: SystemUpdateContext): void {
    // Reset frame-specific state
    this.state.mouseDelta = { x: 0, y: 0 }
    this.state.wheelDelta = 0
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Binding
  // ─────────────────────────────────────────────────────────────────────────────

  /** Bind input events to an element */
  bindToElement(element: HTMLElement): () => void {
    this.element = element

    const handleKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)
    const handleKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e)
    const handleMouseDown = (e: MouseEvent) => this.handleMouseDown(e)
    const handleMouseUp = (e: MouseEvent) => this.handleMouseUp(e)
    const handleMouseMove = (e: MouseEvent) => this.handleMouseMove(e)
    const handleWheel = (e: WheelEvent) => this.handleWheel(e)
    const handleContextMenu = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    element.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('wheel', handleWheel, { passive: false })
    element.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      element.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('wheel', handleWheel)
      element.removeEventListener('contextmenu', handleContextMenu)
      this.element = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get current input state */
  getState(): Readonly<InputState> {
    return this.state
  }

  /** Check if a key is currently pressed */
  isKeyDown(key: string): boolean {
    return this.state.keys.has(key.toLowerCase())
  }

  /** Check if a mouse button is pressed */
  isMouseDown(button: number = 0): boolean {
    return this.state.mouseButtons.has(button)
  }

  /** Get mouse position relative to bound element */
  getMousePosition(): { x: number; y: number } {
    return { ...this.state.mousePosition }
  }

  /** Get mouse movement this frame */
  getMouseDelta(): { x: number; y: number } {
    return { ...this.state.mouseDelta }
  }

  /** Check if ctrl is held */
  isCtrlDown(): boolean {
    return this.state.modifiers.ctrl
  }

  /** Check if shift is held */
  isShiftDown(): boolean {
    return this.state.modifiers.shift
  }

  /** Check if alt is held */
  isAltDown(): boolean {
    return this.state.modifiers.alt
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  /** Register a keyboard shortcut */
  registerShortcut(key: string, callback: () => void): () => void {
    const normalizedKey = this.normalizeShortcut(key)
    this.shortcuts.set(normalizedKey, callback)

    return () => {
      this.shortcuts.delete(normalizedKey)
    }
  }

  /** Unregister a shortcut */
  unregisterShortcut(key: string): void {
    this.shortcuts.delete(this.normalizeShortcut(key))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase()
    this.state.keys.add(key)

    this.state.modifiers.ctrl = e.ctrlKey || e.metaKey
    this.state.modifiers.shift = e.shiftKey
    this.state.modifiers.alt = e.altKey

    // Check for shortcuts
    const shortcutKey = this.buildShortcutKey(e)
    const shortcutHandler = this.shortcuts.get(shortcutKey)
    if (shortcutHandler) {
      e.preventDefault()
      shortcutHandler()
      this.callHook('onShortcut', shortcutKey)
    }

    this.callHook('onKeyDown', key, this.state.modifiers)
    EventBus.emit('input:keyDown', {
      key,
      ctrl: this.state.modifiers.ctrl,
      shift: this.state.modifiers.shift,
      alt: this.state.modifiers.alt,
    })
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase()
    this.state.keys.delete(key)

    this.state.modifiers.ctrl = e.ctrlKey || e.metaKey
    this.state.modifiers.shift = e.shiftKey
    this.state.modifiers.alt = e.altKey

    this.callHook('onKeyUp', key)
    EventBus.emit('input:keyUp', { key })
  }

  private handleMouseDown(e: MouseEvent): void {
    this.state.mouseButtons.add(e.button)
    this.updateMousePosition(e)

    this.callHook('onMouseDown', e.button, this.state.mousePosition)
    EventBus.emit('input:mouseDown', {
      button: e.button,
      x: this.state.mousePosition.x,
      y: this.state.mousePosition.y,
    })
  }

  private handleMouseUp(e: MouseEvent): void {
    this.state.mouseButtons.delete(e.button)
    this.updateMousePosition(e)

    this.callHook('onMouseUp', e.button, this.state.mousePosition)
    EventBus.emit('input:mouseUp', {
      button: e.button,
      x: this.state.mousePosition.x,
      y: this.state.mousePosition.y,
    })
  }

  private handleMouseMove(e: MouseEvent): void {
    const prevX = this.state.mousePosition.x
    const prevY = this.state.mousePosition.y

    this.updateMousePosition(e)

    this.state.mouseDelta = {
      x: this.state.mousePosition.x - prevX,
      y: this.state.mousePosition.y - prevY,
    }

    this.callHook('onMouseMove', this.state.mousePosition, this.state.mouseDelta)
    EventBus.emit('input:mouseMove', {
      x: this.state.mousePosition.x,
      y: this.state.mousePosition.y,
      dx: this.state.mouseDelta.x,
      dy: this.state.mouseDelta.y,
    })
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault()
    this.state.wheelDelta = e.deltaY

    this.callHook('onWheel', e.deltaY, this.state.mousePosition)
    EventBus.emit('input:wheel', {
      delta: e.deltaY,
      x: this.state.mousePosition.x,
      y: this.state.mousePosition.y,
    })
  }

  private updateMousePosition(e: MouseEvent): void {
    if (this.element) {
      const rect = this.element.getBoundingClientRect()
      this.state.mousePosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  private normalizeShortcut(key: string): string {
    return key.toLowerCase().replace('meta', 'ctrl')
  }

  private buildShortcutKey(e: KeyboardEvent): string {
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')
    parts.push(e.key.toLowerCase())
    return parts.join('+')
  }
}
