// ═══════════════════════════════════════════════════════════════════════════
// Drag State - Global drag state for prefab dragging
// Uses Zustand instead of HTML5 drag-drop to bypass rc-dock interception
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { Prefab } from './engineState'

// Drop position relative to a node
export type DropPosition = 'before' | 'inside' | 'after'

// Drop target information
export interface DropTarget {
  nodeId: string
  nodeName: string
  position: DropPosition
}

// Scene drop target (for placing in the 2D/3D view)
export interface SceneDropTarget {
  x: number
  y: number
}

interface DragStateStore {
  // Currently dragged prefab (null if not dragging)
  draggedPrefab: Prefab | null
  // Current mouse position during drag
  mouseX: number
  mouseY: number
  // Current drop target in hierarchy
  dropTarget: DropTarget | null
  // Current drop target in scene
  sceneDropTarget: SceneDropTarget | null
  // Whether we're over the scene canvas
  overScene: boolean
  // Start dragging a prefab
  startDrag: (prefab: Prefab) => void
  // Update mouse position
  updateMouse: (x: number, y: number) => void
  // Set drop target in hierarchy
  setDropTarget: (target: DropTarget | null) => void
  // Set scene drop target
  setSceneDropTarget: (target: SceneDropTarget | null) => void
  // Set whether over scene
  setOverScene: (over: boolean) => void
  // End dragging (clears all state)
  endDrag: () => void
}

export const useDragState = create<DragStateStore>((set) => ({
  draggedPrefab: null,
  mouseX: 0,
  mouseY: 0,
  dropTarget: null,
  sceneDropTarget: null,
  overScene: false,

  startDrag: (prefab) => set({
    draggedPrefab: prefab,
    dropTarget: null,
    sceneDropTarget: null,
    overScene: false,
  }),

  updateMouse: (x, y) => set({ mouseX: x, mouseY: y }),

  setDropTarget: (target) => set({ dropTarget: target }),

  setSceneDropTarget: (target) => set({ sceneDropTarget: target }),

  setOverScene: (over) => set({ overScene: over }),

  endDrag: () => set({
    draggedPrefab: null,
    dropTarget: null,
    sceneDropTarget: null,
    overScene: false,
  }),
}))
