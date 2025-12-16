// ═══════════════════════════════════════════════════════════════════════════
// Selection System - Handles node selection and hover states
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, SystemPriority, type SystemUpdateContext } from '../System'
import { EventBus } from '../events'

/**
 * Selection System - Manages what's selected and hovered in the editor
 *
 * Hooks:
 * - onSelectionChange: Called when selection changes
 * - onHoverChange: Called when hovered node changes
 * - onMultiSelect: Called when multi-selection occurs
 * - onSelectionBounds: Override to provide custom selection bounds
 */
export class SelectionSystem extends EngineSystem {
  static readonly NAME = 'Selection'

  private selectedIds: Set<string> = new Set()
  private hoveredId: string | null = null
  private lastClickedId: string | null = null
  private multiSelectMode: boolean = false

  constructor() {
    super(SelectionSystem.NAME, SystemPriority.Editor)

    // Define hooks
    this.defineHook('onSelectionChange')
    this.defineHook('onHoverChange')
    this.defineHook('onMultiSelect')
    this.defineHook('onSelectionBounds')
  }

  update(ctx: SystemUpdateContext): void {
    // Sync with engine state if needed
    const stateSelection = new Set(ctx.state.selection.nodes)

    // Check if state changed externally
    if (!this.setsEqual(this.selectedIds, stateSelection)) {
      const previousIds = Array.from(this.selectedIds)
      this.selectedIds = stateSelection
      this.callHook('onSelectionChange', Array.from(this.selectedIds), previousIds)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get all selected node IDs */
  getSelectedIds(): string[] {
    return Array.from(this.selectedIds)
  }

  /** Check if a node is selected */
  isSelected(nodeId: string): boolean {
    return this.selectedIds.has(nodeId)
  }

  /** Get the number of selected nodes */
  getSelectionCount(): number {
    return this.selectedIds.size
  }

  /** Get the primary (first) selected node */
  getPrimarySelection(): string | null {
    return this.selectedIds.size > 0 ? Array.from(this.selectedIds)[0] : null
  }

  /** Select a single node (clears previous selection) */
  select(nodeId: string, ctx?: SystemUpdateContext): void {
    const previousIds = Array.from(this.selectedIds)
    this.selectedIds.clear()
    this.selectedIds.add(nodeId)
    this.lastClickedId = nodeId

    this.notifySelectionChange(previousIds, ctx)
  }

  /** Add a node to selection */
  addToSelection(nodeId: string, ctx?: SystemUpdateContext): void {
    if (this.selectedIds.has(nodeId)) return

    const previousIds = Array.from(this.selectedIds)
    this.selectedIds.add(nodeId)
    this.lastClickedId = nodeId

    this.callHook('onMultiSelect', nodeId, 'add')
    this.notifySelectionChange(previousIds, ctx)
  }

  /** Remove a node from selection */
  removeFromSelection(nodeId: string, ctx?: SystemUpdateContext): void {
    if (!this.selectedIds.has(nodeId)) return

    const previousIds = Array.from(this.selectedIds)
    this.selectedIds.delete(nodeId)

    this.callHook('onMultiSelect', nodeId, 'remove')
    this.notifySelectionChange(previousIds, ctx)
  }

  /** Toggle a node's selection state */
  toggleSelection(nodeId: string, ctx?: SystemUpdateContext): void {
    if (this.selectedIds.has(nodeId)) {
      this.removeFromSelection(nodeId, ctx)
    } else {
      this.addToSelection(nodeId, ctx)
    }
  }

  /** Select multiple nodes */
  selectMultiple(nodeIds: string[], ctx?: SystemUpdateContext): void {
    const previousIds = Array.from(this.selectedIds)
    this.selectedIds = new Set(nodeIds)

    this.notifySelectionChange(previousIds, ctx)
  }

  /** Clear all selection */
  clearSelection(ctx?: SystemUpdateContext): void {
    if (this.selectedIds.size === 0) return

    const previousIds = Array.from(this.selectedIds)
    this.selectedIds.clear()
    this.lastClickedId = null

    this.notifySelectionChange(previousIds, ctx)
  }

  /** Handle click on a node (respects modifier keys) */
  handleClick(nodeId: string | null, shiftHeld: boolean, ctrlHeld: boolean, ctx?: SystemUpdateContext): void {
    if (nodeId === null) {
      // Clicked on empty space
      if (!shiftHeld && !ctrlHeld) {
        this.clearSelection(ctx)
      }
      return
    }

    if (ctrlHeld) {
      // Toggle selection
      this.toggleSelection(nodeId, ctx)
    } else if (shiftHeld && this.lastClickedId) {
      // Range select (would need node order from scene graph)
      this.addToSelection(nodeId, ctx)
    } else {
      // Simple select
      this.select(nodeId, ctx)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Hover
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get currently hovered node */
  getHoveredId(): string | null {
    return this.hoveredId
  }

  /** Set hovered node */
  setHovered(nodeId: string | null, ctx?: SystemUpdateContext): void {
    if (this.hoveredId === nodeId) return

    const previousId = this.hoveredId
    this.hoveredId = nodeId

    this.callHook('onHoverChange', nodeId, previousId)
    EventBus.emit('selection:hover', { nodeId, previousId })

    // Update engine state
    if (ctx) {
      ctx.setState(['selection', 'hoveredNode'], nodeId, 'Hover node')
    }
  }

  /** Check if a node is hovered */
  isHovered(nodeId: string): boolean {
    return this.hoveredId === nodeId
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Multi-select mode
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable/disable multi-select mode (for box selection) */
  setMultiSelectMode(enabled: boolean): void {
    this.multiSelectMode = enabled
  }

  /** Check if in multi-select mode */
  isMultiSelectMode(): boolean {
    return this.multiSelectMode
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private notifySelectionChange(previousIds: string[], ctx?: SystemUpdateContext): void {
    const nodeIds = Array.from(this.selectedIds)

    this.callHook('onSelectionChange', nodeIds, previousIds)
    EventBus.emit('selection:changed', { nodeIds, previousIds })

    // Update engine state
    if (ctx) {
      ctx.setState(['selection', 'nodes'], nodeIds, 'Selection changed')
    }
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false
    for (const item of a) {
      if (!b.has(item)) return false
    }
    return true
  }
}
