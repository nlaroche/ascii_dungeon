// =============================================================================
// Graph History Hook - Undo/Redo for node graph editing
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GraphState {
  nodes: Node[]
  edges: Edge[]
  timestamp: number
}

interface GraphHistoryOptions {
  maxHistory?: number
  debounceMs?: number
}

interface GraphHistoryReturn {
  // State
  canUndo: boolean
  canRedo: boolean
  historyLength: number
  currentIndex: number

  // Actions
  pushState: (nodes: Node[], edges: Edge[]) => void
  undo: () => GraphState | null
  redo: () => GraphState | null
  clear: () => void
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useGraphHistory(
  options: GraphHistoryOptions = {}
): GraphHistoryReturn {
  const { maxHistory = 50, debounceMs = 300 } = options

  const [history, setHistory] = useState<GraphState[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushRef = useRef<number>(0)

  // Push a new state to history
  const pushState = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      const now = Date.now()

      // Debounce rapid changes
      if (now - lastPushRef.current < debounceMs) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
        debounceRef.current = setTimeout(() => {
          pushState(nodes, edges)
        }, debounceMs)
        return
      }

      lastPushRef.current = now

      setHistory((prev) => {
        // Remove any redo states
        const newHistory = prev.slice(0, currentIndex + 1)

        // Add new state
        const newState: GraphState = {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          timestamp: now,
        }
        newHistory.push(newState)

        // Limit history size
        if (newHistory.length > maxHistory) {
          newHistory.shift()
          return newHistory
        }

        return newHistory
      })

      setCurrentIndex((prev) => Math.min(prev + 1, maxHistory - 1))
    },
    [currentIndex, maxHistory, debounceMs]
  )

  // Undo
  const undo = useCallback((): GraphState | null => {
    if (currentIndex <= 0) return null

    const newIndex = currentIndex - 1
    setCurrentIndex(newIndex)
    return history[newIndex]
  }, [currentIndex, history])

  // Redo
  const redo = useCallback((): GraphState | null => {
    if (currentIndex >= history.length - 1) return null

    const newIndex = currentIndex + 1
    setCurrentIndex(newIndex)
    return history[newIndex]
  }, [currentIndex, history])

  // Clear history
  const clear = useCallback(() => {
    setHistory([])
    setCurrentIndex(-1)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    historyLength: history.length,
    currentIndex,
    pushState,
    undo,
    redo,
    clear,
  }
}

// -----------------------------------------------------------------------------
// Clipboard Hook - Copy/Paste for nodes
// -----------------------------------------------------------------------------

interface ClipboardData {
  nodes: Node[]
  edges: Edge[]
  timestamp: number
}

interface ClipboardReturn {
  hasClipboard: boolean
  copy: (nodes: Node[], edges: Edge[], selectedIds: string[]) => void
  paste: (offset?: { x: number; y: number }) => { nodes: Node[]; edges: Edge[] } | null
  cut: (nodes: Node[], edges: Edge[], selectedIds: string[]) => { nodes: Node[]; edges: Edge[] }
}

let globalClipboard: ClipboardData | null = null

export function useGraphClipboard(): ClipboardReturn {
  const [hasClipboard, setHasClipboard] = useState(globalClipboard !== null)

  // Copy selected nodes and their connecting edges
  const copy = useCallback(
    (nodes: Node[], edges: Edge[], selectedIds: string[]) => {
      if (selectedIds.length === 0) return

      const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id))
      const selectedNodeIds = new Set(selectedIds)

      // Only include edges that connect selected nodes
      const selectedEdges = edges.filter(
        (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
      )

      globalClipboard = {
        nodes: JSON.parse(JSON.stringify(selectedNodes)),
        edges: JSON.parse(JSON.stringify(selectedEdges)),
        timestamp: Date.now(),
      }

      setHasClipboard(true)
    },
    []
  )

  // Paste clipboard contents with new IDs
  const paste = useCallback(
    (offset: { x: number; y: number } = { x: 50, y: 50 }) => {
      if (!globalClipboard) return null

      const idMap = new Map<string, string>()
      const timestamp = Date.now()

      // Create new nodes with new IDs and offset positions
      const newNodes: Node[] = globalClipboard.nodes.map((node, index) => {
        const newId = `paste_${timestamp}_${index}`
        idMap.set(node.id, newId)

        return {
          ...node,
          id: newId,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          selected: true,
        }
      })

      // Create new edges with updated source/target IDs
      const newEdges: Edge[] = globalClipboard.edges.map((edge, index) => ({
        ...edge,
        id: `paste_edge_${timestamp}_${index}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }))

      return { nodes: newNodes, edges: newEdges }
    },
    []
  )

  // Cut = copy + return nodes/edges to remove
  const cut = useCallback(
    (nodes: Node[], edges: Edge[], selectedIds: string[]) => {
      copy(nodes, edges, selectedIds)

      const selectedNodeIds = new Set(selectedIds)
      const remainingNodes = nodes.filter((n) => !selectedNodeIds.has(n.id))
      const remainingEdges = edges.filter(
        (e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
      )

      return { nodes: remainingNodes, edges: remainingEdges }
    },
    [copy]
  )

  return {
    hasClipboard,
    copy,
    paste,
    cut,
  }
}

export default useGraphHistory
