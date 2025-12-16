// ═══════════════════════════════════════════════════════════════════════════
// Gizmo System - Handles transform gizmos and manipulation
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, SystemPriority, type SystemUpdateContext } from '../System'
import { EventBus } from '../events'

export type GizmoMode = 'select' | 'move' | 'rotate' | 'scale'
export type GizmoAxis = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' | null

export interface GizmoState {
  mode: GizmoMode
  hoveredAxis: GizmoAxis
  draggingAxis: GizmoAxis
  position: [number, number, number]
  visible: boolean
}

/**
 * Gizmo System - Manages transform gizmos for node manipulation
 *
 * Hooks:
 * - onModeChange: Called when gizmo mode changes
 * - onDragStart: Called when drag begins
 * - onDragUpdate: Called during drag with delta
 * - onDragEnd: Called when drag ends
 * - onHoverChange: Called when hovered axis changes
 * - onCustomGizmo: Allows adding custom gizmo rendering
 */
export class GizmoSystem extends EngineSystem {
  static readonly NAME = 'Gizmo'

  private state: GizmoState = {
    mode: 'select',
    hoveredAxis: null,
    draggingAxis: null,
    position: [0, 0, 0],
    visible: false,
  }

  // Drag state
  private dragStartPosition: [number, number, number] | null = null
  private dragStartTransform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } | null = null

  // Settings
  private snapEnabled: boolean = true
  private gridSize: number = 1
  private rotationSnap: number = 15
  private scaleSnap: number = 0.25

  constructor() {
    super(GizmoSystem.NAME, SystemPriority.Editor)

    // Define hooks
    this.defineHook('onModeChange')
    this.defineHook('onDragStart')
    this.defineHook('onDragUpdate')
    this.defineHook('onDragEnd')
    this.defineHook('onHoverChange')
    this.defineHook('onCustomGizmo')
  }

  initialize(): void {
    // Listen to tool changes
    EventBus.on('tool:changed', ({ toolId }) => {
      const modeMap: Record<string, GizmoMode> = {
        select: 'select',
        move: 'move',
        rotate: 'rotate',
        scale: 'scale',
      }
      if (modeMap[toolId]) {
        this.setMode(modeMap[toolId])
      }
    })

    // Listen to selection changes
    EventBus.on('selection:changed', ({ nodeIds }) => {
      this.state.visible = nodeIds.length > 0 && this.state.mode !== 'select'
    })
  }

  update(ctx: SystemUpdateContext): void {
    // Update gizmo visibility based on selection
    const selection = ctx.state.selection.nodes
    this.state.visible = selection.length > 0 && this.state.mode !== 'select'

    // If we have a selection, update gizmo position to selected node
    if (selection.length > 0 && ctx.state.scene) {
      // Get first selected node's position
      // This would need to be wired up to the scene graph
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get current gizmo mode */
  getMode(): GizmoMode {
    return this.state.mode
  }

  /** Set gizmo mode */
  setMode(mode: GizmoMode): void {
    if (this.state.mode !== mode) {
      const previous = this.state.mode
      this.state.mode = mode
      this.callHook('onModeChange', mode, previous)
      EventBus.emit('tool:changed', { toolId: mode, previousId: previous })
    }
  }

  /** Get current gizmo state */
  getState(): Readonly<GizmoState> {
    return this.state
  }

  /** Check if currently dragging */
  isDragging(): boolean {
    return this.state.draggingAxis !== null
  }

  /** Get hovered axis */
  getHoveredAxis(): GizmoAxis {
    return this.state.hoveredAxis
  }

  /** Set hovered axis */
  setHoveredAxis(axis: GizmoAxis): void {
    if (this.state.hoveredAxis !== axis) {
      const previous = this.state.hoveredAxis
      this.state.hoveredAxis = axis
      this.callHook('onHoverChange', axis, previous)
      EventBus.emit('gizmo:hover', { axis })
    }
  }

  /** Start a drag operation */
  beginDrag(axis: GizmoAxis, position: [number, number, number], transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }): void {
    if (!axis) return

    this.state.draggingAxis = axis
    this.dragStartPosition = [...position]
    this.dragStartTransform = {
      position: [...transform.position],
      rotation: [...transform.rotation],
      scale: [...transform.scale],
    }

    this.callHook('onDragStart', axis, position, transform)
    EventBus.emit('gizmo:dragStart', { axis, nodeId: '' })
  }

  /** Update drag with new position */
  updateDrag(currentPosition: [number, number, number]): { position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] } | null {
    if (!this.state.draggingAxis || !this.dragStartPosition || !this.dragStartTransform) {
      return null
    }

    const delta: [number, number, number] = [
      currentPosition[0] - this.dragStartPosition[0],
      currentPosition[1] - this.dragStartPosition[1],
      currentPosition[2] - this.dragStartPosition[2],
    ]

    let result: { position?: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] } = {}

    switch (this.state.mode) {
      case 'move':
        result.position = this.calculateMoveResult(delta)
        break
      case 'rotate':
        result.rotation = this.calculateRotateResult(delta)
        break
      case 'scale':
        result.scale = this.calculateScaleResult(delta)
        break
    }

    this.callHook('onDragUpdate', this.state.draggingAxis, delta, result)
    EventBus.emit('gizmo:dragUpdate', { axis: this.state.draggingAxis, delta })

    return result
  }

  /** End drag operation */
  endDrag(): void {
    if (!this.state.draggingAxis) return

    const axis = this.state.draggingAxis
    this.state.draggingAxis = null
    this.dragStartPosition = null
    this.dragStartTransform = null

    this.callHook('onDragEnd', axis)
    EventBus.emit('gizmo:dragEnd', { axis, nodeId: '' })
  }

  /** Set gizmo position */
  setPosition(position: [number, number, number]): void {
    this.state.position = [...position]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable/disable snapping */
  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled
  }

  /** Set grid size for move snapping */
  setGridSize(size: number): void {
    this.gridSize = size
  }

  /** Set rotation snap angle (degrees) */
  setRotationSnap(degrees: number): void {
    this.rotationSnap = degrees
  }

  /** Set scale snap increment */
  setScaleSnap(snap: number): void {
    this.scaleSnap = snap
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private calculateMoveResult(delta: [number, number, number]): [number, number, number] {
    if (!this.dragStartTransform) return [0, 0, 0]

    const mask = this.getAxisMask(this.state.draggingAxis!)
    let result: [number, number, number] = [
      this.dragStartTransform.position[0] + delta[0] * mask[0],
      this.dragStartTransform.position[1] + delta[1] * mask[1],
      this.dragStartTransform.position[2] + delta[2] * mask[2],
    ]

    if (this.snapEnabled) {
      result = [
        Math.round(result[0] / this.gridSize) * this.gridSize,
        Math.round(result[1] / this.gridSize) * this.gridSize,
        Math.round(result[2] / this.gridSize) * this.gridSize,
      ]
    }

    return result
  }

  private calculateRotateResult(delta: [number, number, number]): [number, number, number] {
    if (!this.dragStartTransform) return [0, 0, 0]

    // Convert mouse delta to rotation (rough approximation)
    const rotationSpeed = 100
    const mask = this.getAxisMask(this.state.draggingAxis!)

    let result: [number, number, number] = [
      this.dragStartTransform.rotation[0] + (delta[1] + delta[2]) * rotationSpeed * mask[0],
      this.dragStartTransform.rotation[1] + (delta[0] + delta[2]) * rotationSpeed * mask[1],
      this.dragStartTransform.rotation[2] + (delta[0] + delta[1]) * rotationSpeed * mask[2],
    ]

    if (this.snapEnabled) {
      result = [
        Math.round(result[0] / this.rotationSnap) * this.rotationSnap,
        Math.round(result[1] / this.rotationSnap) * this.rotationSnap,
        Math.round(result[2] / this.rotationSnap) * this.rotationSnap,
      ]
    }

    return result
  }

  private calculateScaleResult(delta: [number, number, number]): [number, number, number] {
    if (!this.dragStartTransform) return [1, 1, 1]

    const scaleSpeed = 2
    const mask = this.getAxisMask(this.state.draggingAxis!)

    // For uniform scale (xyz), use average delta
    const avgDelta = (delta[0] + delta[1] + delta[2]) / 3

    let result: [number, number, number] = [
      this.dragStartTransform.scale[0] + (mask[0] ? (this.state.draggingAxis === 'xyz' ? avgDelta : delta[0]) * scaleSpeed : 0),
      this.dragStartTransform.scale[1] + (mask[1] ? (this.state.draggingAxis === 'xyz' ? avgDelta : delta[1]) * scaleSpeed : 0),
      this.dragStartTransform.scale[2] + (mask[2] ? (this.state.draggingAxis === 'xyz' ? avgDelta : delta[2]) * scaleSpeed : 0),
    ]

    // Clamp to minimum scale
    result = [
      Math.max(0.01, result[0]),
      Math.max(0.01, result[1]),
      Math.max(0.01, result[2]),
    ]

    if (this.snapEnabled) {
      result = [
        Math.round(result[0] / this.scaleSnap) * this.scaleSnap,
        Math.round(result[1] / this.scaleSnap) * this.scaleSnap,
        Math.round(result[2] / this.scaleSnap) * this.scaleSnap,
      ]
    }

    return result
  }

  private getAxisMask(axis: GizmoAxis): [number, number, number] {
    switch (axis) {
      case 'x': return [1, 0, 0]
      case 'y': return [0, 1, 0]
      case 'z': return [0, 0, 1]
      case 'xy': return [1, 1, 0]
      case 'xz': return [1, 0, 1]
      case 'yz': return [0, 1, 1]
      case 'xyz': return [1, 1, 1]
      default: return [0, 0, 0]
    }
  }
}
