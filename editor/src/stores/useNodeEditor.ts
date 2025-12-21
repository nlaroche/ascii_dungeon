// ═══════════════════════════════════════════════════════════════════════════
// Node Editor Store - Zustand store for persisting NodeEditor state
// Persists across window floating/docking
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { Node, Edge } from '@xyflow/react'

// Keys for storing pending graph in localStorage (shared across windows)
const PENDING_GRAPH_KEY = 'node-editor-pending-graph'
const PENDING_PROJECT_KEY = 'node-editor-pending-project'

// Set a pending graph to be loaded (called from main window)
export function setPendingGraph(path: string, projectRoot?: string): void {
  localStorage.setItem(PENDING_GRAPH_KEY, path)
  if (projectRoot) {
    localStorage.setItem(PENDING_PROJECT_KEY, projectRoot)
  }
}

// Get and clear pending graph info (called from floating window on mount)
export function consumePendingGraph(): { path: string; projectRoot: string | null } | null {
  const path = localStorage.getItem(PENDING_GRAPH_KEY)
  const projectRoot = localStorage.getItem(PENDING_PROJECT_KEY)
  if (path) {
    localStorage.removeItem(PENDING_GRAPH_KEY)
    localStorage.removeItem(PENDING_PROJECT_KEY)
    return { path, projectRoot }
  }
  return null
}

interface NodeEditorState {
  // Graph state
  nodes: Node[]
  edges: Edge[]
  nodeIdCounter: number

  // Current file
  currentGraphName: string
  currentGraphPath: string | null
  hasUnsavedChanges: boolean

  // Selection
  selectedNodeIds: string[]

  // Actions
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
  setNodeIdCounter: (counter: number) => void
  setCurrentGraph: (name: string, path: string | null) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  setSelectedNodeIds: (ids: string[]) => void

  // Convenience actions
  loadGraph: (nodes: Node[], edges: Edge[], name: string, path: string) => void
  newGraph: () => void
  markSaved: () => void
}

// Initial demo nodes
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 100 },
    data: { nodeTypeId: 'on-start' },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 300, y: 100 },
    data: { nodeTypeId: 'print', inputs: { message: 'Hello World!' } },
  },
]

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    sourceHandle: 'flow',
    target: '2',
    targetHandle: 'flow',
    type: 'smoothstep',
  },
]

export const useNodeEditorStore = create<NodeEditorState>((set, get) => ({
  // Initial state
  nodes: initialNodes,
  edges: initialEdges,
  nodeIdCounter: 3,
  currentGraphName: 'Untitled',
  currentGraphPath: null,
  hasUnsavedChanges: false,
  selectedNodeIds: [],

  // Actions
  setNodes: (nodesOrFn) => {
    set((state) => ({
      nodes: typeof nodesOrFn === 'function' ? nodesOrFn(state.nodes) : nodesOrFn,
      hasUnsavedChanges: true,
    }))
  },

  setEdges: (edgesOrFn) => {
    set((state) => ({
      edges: typeof edgesOrFn === 'function' ? edgesOrFn(state.edges) : edgesOrFn,
      hasUnsavedChanges: true,
    }))
  },

  setNodeIdCounter: (counter) => set({ nodeIdCounter: counter }),

  setCurrentGraph: (name, path) => set({
    currentGraphName: name,
    currentGraphPath: path,
  }),

  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  loadGraph: (nodes, edges, name, path) => {
    const maxId = Math.max(...nodes.map((n) => parseInt(n.id) || 0), 0)
    set({
      nodes,
      edges,
      currentGraphName: name,
      currentGraphPath: path,
      hasUnsavedChanges: false,
      nodeIdCounter: maxId + 1,
      selectedNodeIds: [],
    })
  },

  newGraph: () => set({
    nodes: [],
    edges: [],
    currentGraphName: 'Untitled',
    currentGraphPath: null,
    hasUnsavedChanges: false,
    nodeIdCounter: 1,
    selectedNodeIds: [],
  }),

  markSaved: () => set({ hasUnsavedChanges: false }),
}))

// Export hook for convenience
export const useNodeEditor = useNodeEditorStore
