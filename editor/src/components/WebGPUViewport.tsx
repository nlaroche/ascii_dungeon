// WebGPU Viewport - React component for the voxel renderer
// Uses subscription system for reactive updates

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebGPURenderer, Camera, Scene, Raycaster, GizmoInteraction, Terminal2DRenderer } from '../renderer'
import { PostProcessPipeline } from '../renderer/PostProcessPipeline'
import type { GizmoMode, GizmoAxis } from '../renderer'
import { useEngineState, useNormalizedEntities } from '../stores/useEngineState'
import type { Node, NormalizedNode, Transform } from '../stores/engineState'
import { entitySubscriptions } from '../stores/subscriptions'
import { useDragState } from '../stores/useDragState'

// 2D Editor tool types (matches store)
type EditorTool2D = 'pointer' | 'select' | 'draw' | 'erase'

interface WebGPUViewportProps {
  className?: string
}

export function WebGPUViewport({ className = '' }: WebGPUViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WebGPURenderer | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const animationIdRef = useRef<number>(0)

  // Terminal 2D renderer for ASCII grid mode
  const terminal2DRef = useRef<Terminal2DRenderer | null>(null)
  const terminalNeedsRefreshRef = useRef(false)  // Dirty flag for deferred refresh

  // Post-processing pipeline for CRT effects
  const postProcessRef = useRef<PostProcessPipeline | null>(null)
  const intermediateTextureRef = useRef<GPUTexture | null>(null)
  const timeRef = useRef(0)

  // 2D Editor state from global store
  const tool2D = useEngineState((s) => s.editor2D?.tool || 'pointer') as EditorTool2D
  const showGrid = useEngineState((s) => s.editor2D?.showGrid ?? true)
  const zoom = useEngineState((s) => s.editor2D?.zoom ?? 100)
  const currentChar = useEngineState((s) => s.editor2D?.currentChar || '#')
  const selection2D = useEngineState((s) => s.editor2D?.selection || null)
  const recenterTimestamp = useEngineState((s) => s.editor2D?.recenterTimestamp ?? 0)
  const centerOnNodeId = useEngineState((s) => s.editor2D?.centerOnNodeId ?? null)

  // Refs for internal 2D state
  const isDrawing2DRef = useRef(false)
  const isSelectingRef = useRef(false)  // For right-click selection
  const isPanning2DRef = useRef(false)  // For middle-mouse panning
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const originalSelectionRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // Input state
  const keysRef = useRef<Set<string>>(new Set())
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const clickStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastHoverCheckRef = useRef<number>(0)
  const hoverThrottleMs = 50 // Check hover every 50ms
  const clickThreshold = 5 // pixels - max movement to count as click
  const pointerCaptureElementRef = useRef<HTMLCanvasElement | null>(null)

  // Click-to-select state for 2D mode - track cell and cycle through hierarchy
  const lastClickedCellRef = useRef<{ x: number; y: number } | null>(null)
  const clickCycleIndexRef = useRef<number>(0)
  const clickCycleNodesRef = useRef<string[]>([])  // Nodes at clicked cell (deepest first)

  // Node dragging state for 2D mode
  const isDraggingNodeRef = useRef(false)
  const draggedNodeIdRef = useRef<string | null>(null)
  const dragStartCellRef = useRef<{ x: number; y: number } | null>(null)
  const dragOriginalPosRef = useRef<{ x: number; y: number } | null>(null)

  // Right-click context menu state
  const rightClickStartRef = useRef<{ x: number; y: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cell: [number, number] } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fps, setFps] = useState(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Mouse-based prefab drag state (bypasses HTML5 drag-drop)
  const {
    draggedPrefab,
    overScene: prefabOverScene,
    sceneDropTarget,
    setOverScene,
    setSceneDropTarget,
    endDrag,
  } = useDragState()

  // Gizmo state
  const gizmoInteractionRef = useRef<GizmoInteraction>(new GizmoInteraction())
  const [gizmoHoveredAxis, setGizmoHoveredAxis] = useState<GizmoAxis>(null)
  const isDraggingGizmoRef = useRef(false)

  // Get scene data from engine state - using normalized entities for O(1) lookups
  const rootNode = useEngineState((s) => s.scene.rootNode)
  const selectedNodes = useEngineState((s) => s.selection.nodes)
  const setPath = useEngineState((s) => s.setPath)
  const activeTool = useEngineState((s) => s.tools.active) as GizmoMode
  const toolSettings = useEngineState((s) => s.tools.available)

  // Camera mode from store (2d/3d)
  const cameraMode = useEngineState((s) => s.camera.mode)
  const cameraModeRef = useRef(cameraMode)

  // Lighting and environment settings
  const lightingState = useEngineState((s) => s.lighting)
  const environmentState = useEngineState((s) => s.environment)

  // Post-processing settings
  const globalPostProcess = useEngineState((s) => s.renderPipeline.globalPostProcess)
  const globalPostProcessRef = useRef(globalPostProcess)
  globalPostProcessRef.current = globalPostProcess

  // Normalized entities for O(1) lookups (replaces tree traversal)
  const { nodes: normalizedNodes, getNode: getNormalizedNode } = useNormalizedEntities()

  // Cached bounding boxes - updated reactively via subscriptions
  const boundsCache = useRef<Map<string, {
    position: [number, number, number]
    bounds: [number, number, number]
    rotation: [number, number, number]
  }>>(new Map())

  // Refs for values needed in render loop (updated by effects)
  // Using refs prevents callback recreation when these values change,
  // which would cause event listener re-registration and break active drags
  const activeToolRef = useRef<GizmoMode>('select')
  const selectedNodesRef = useRef<string[]>([])
  const gizmoHoveredAxisRef = useRef<GizmoAxis>(null)
  const selectedPositionRef = useRef<[number, number, number] | null>(null)
  const hoveredNodeRef = useRef<string | null>(null)
  const rootNodeRef = useRef<Node>(rootNode)
  const setPathRef = useRef(setPath)
  const batchUpdateRef = useRef(useEngineState.getState().batchUpdate)
  const toolSettingsRef = useRef(toolSettings)
  const normalizedNodesRef = useRef(normalizedNodes)

  // 2D tool refs for use in mouse handlers (avoids callback recreation)
  const tool2DRef = useRef<EditorTool2D>(tool2D)
  const currentCharRef = useRef(currentChar)
  const selection2DRef = useRef(selection2D)
  const showGridRef = useRef(showGrid)
  const zoomRef = useRef(zoom)

  // Keep refs in sync SYNCHRONOUSLY - useEffect is too slow for animation loop
  tool2DRef.current = tool2D
  currentCharRef.current = currentChar
  selection2DRef.current = selection2D
  showGridRef.current = showGrid
  zoomRef.current = zoom
  // These run during render, before animation frame callbacks
  rootNodeRef.current = rootNode
  setPathRef.current = setPath
  toolSettingsRef.current = toolSettings
  normalizedNodesRef.current = normalizedNodes

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  // Find path to a node in tree (returns array of indices)
  // Still uses tree for path building (needed for setPath)
  const findNodePath = useCallback((root: Node, targetId: string, path: number[] = []): number[] | null => {
    if (root.id === targetId) return path
    for (let i = 0; i < root.children.length; i++) {
      const result = findNodePath(root.children[i], targetId, [...path, i])
      if (result) return result
    }
    return null
  }, [])

  // Calculate visual bounds for a normalized node
  // Handles floor generator, glyphs, and regular transforms
  const calculateNodeBounds = useCallback((node: NormalizedNode): [number, number, number] => {
    // Check for floor generator component
    const floorCompId = node.componentIds.find(id => {
      const comp = useEngineState.getState().entities.components[id]
      return comp?.script === 'builtin:floor_generator'
    })
    if (floorCompId) {
      const comp = useEngineState.getState().entities.components[floorCompId]
      if (comp?.properties) {
        const props = comp.properties as { size?: [number, number]; tileSize?: number }
        const size = props.size || [21, 21]
        const tileSize = props.tileSize || 1
        return [size[0] * tileSize, 0.1, size[1] * tileSize]
      }
    }

    // For glyph nodes, bounds scale with the transform
    if (node.visual?.glyph && node.visual.glyph.length > 0) {
      const scale = node.transform?.scale || [1, 1, 1]
      // Glyph bounds: width=scaleX, height=scaleY*1.4 (glyph aspect), depth=scaleZ*0.4
      return [scale[0], scale[1] * 1.4, scale[2] * 0.4]
    }

    // Default: use transform scale directly
    return (node.transform?.scale as [number, number, number]) || [1, 1, 1]
  }, [])

  // Legacy helper for tree operations (still needed for setPath)
  const findNodeById = useCallback((root: Node, id: string): Node | null => {
    if (root.id === id) return root
    for (const child of root.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
    return null
  }, [])

  // Get ray from screen position
  const getRayFromScreen = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !cameraRef.current) return null

    const rect = canvasRef.current.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
    const aspect = rect.width / rect.height

    return cameraRef.current.screenToWorldRay(ndcX, ndcY, aspect)
  }, [])

  // Pick node at screen position using raycasting
  const pickNodeAtPosition = useCallback((clientX: number, clientY: number): string | null => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return null

    const ray = getRayFromScreen(clientX, clientY)
    if (!ray) return null

    // Get pickable instances from scene
    const pickables = sceneRef.current.getPickableInstances()

    // Perform raycasting
    const hit = Raycaster.pick(ray, pickables)

    return hit ? hit.nodeId : null
  }, [getRayFromScreen])

  // ═══════════════════════════════════════════════════════════════════════════
  // 2D Grid Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  // Convert screen coordinates to grid cell
  const screenToGridCell = useCallback((clientX: number, clientY: number): [number, number] | null => {
    if (!terminal2DRef.current || !canvasRef.current) return null

    const rect = canvasRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    return terminal2DRef.current.screenToCell(x, y)
  }, [])

  // Find all nodes at a grid cell position (from deepest child to root)
  // Returns array of node IDs sorted by depth (deepest first)
  const findNodesAtCell = useCallback((gridX: number, gridY: number): string[] => {
    if (!terminal2DRef.current) return []

    const gridSize = terminal2DRef.current.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)

    // Convert grid coords to world coords
    const worldX = gridX - WORLD_ORIGIN_X
    const worldY = gridY - WORLD_ORIGIN_Y

    const rootNode = rootNodeRef.current
    const foundNodes: { id: string; depth: number }[] = []

    // Recursively search for nodes containing the world position
    const searchNode = (node: Node, parentGlobalX: number, parentGlobalY: number, depth: number) => {
      if (node.meta?.visible === false) return

      // Get this node's global rect
      const rect2D = node.components.find(c => c.script === 'Rect2D')
      if (rect2D) {
        const props = rect2D.properties || {}
        const localX = (props.x as number) || 0
        const localY = (props.y as number) || 0
        const width = (props.width as number) || 1
        const height = (props.height as number) || 1
        const pivotX = (props.pivotX as number) ?? 0
        const pivotY = (props.pivotY as number) ?? 0

        const globalX = parentGlobalX + localX - Math.floor(width * pivotX)
        const globalY = parentGlobalY + localY - Math.floor(height * pivotY)

        // Check if world position is within this node's bounds
        if (worldX >= globalX && worldX < globalX + width &&
            worldY >= globalY && worldY < globalY + height) {
          // Only include nodes that have visual content (GlyphMap, GlyphImage, or Glyph)
          const hasVisualContent = node.components.some(c =>
            c.script === 'GlyphMap' || c.script === 'GlyphImage' || c.script === 'Glyph'
          )
          if (hasVisualContent) {
            foundNodes.push({ id: node.id, depth })
          }
        }

        // Search children with updated parent position
        for (const child of node.children) {
          searchNode(child, globalX, globalY, depth + 1)
        }
      } else {
        // No Rect2D - search children with same parent position
        for (const child of node.children) {
          searchNode(child, parentGlobalX, parentGlobalY, depth + 1)
        }
      }
    }

    // Search from root's children (they start at world origin 0,0)
    for (const child of rootNode.children) {
      searchNode(child, 0, 0, 0)
    }

    // Sort by depth (deepest first) and return just the IDs
    foundNodes.sort((a, b) => b.depth - a.depth)
    return foundNodes.map(n => n.id)
  }, [])

  // Get a node's position and path for updating
  // Returns null if node not found
  const getNodePositionInfo = useCallback((nodeId: string): {
    path: (string | number)[]
    x: number
    y: number
    rect2DIndex: number
  } | null => {
    const rootNode = rootNodeRef.current

    const searchNode = (
      node: Node,
      path: (string | number)[]
    ): { path: (string | number)[]; x: number; y: number; rect2DIndex: number } | null => {
      if (node.id === nodeId) {
        const rect2DIndex = node.components.findIndex(c => c.script === 'Rect2D')
        if (rect2DIndex === -1) return null
        const props = node.components[rect2DIndex].properties || {}
        return {
          path,
          x: (props.x as number) || 0,
          y: (props.y as number) || 0,
          rect2DIndex
        }
      }

      for (let i = 0; i < node.children.length; i++) {
        const result = searchNode(node.children[i], [...path, 'children', i])
        if (result) return result
      }
      return null
    }

    for (let i = 0; i < rootNode.children.length; i++) {
      const result = searchNode(rootNode.children[i], ['scene', 'rootNode', 'children', i])
      if (result) return result
    }
    return null
  }, [])

  // Draw a character at a grid cell (updates both terminal and engine state)
  // Handles local coordinate system with pivot support
  // x, y are in GRID coordinates (where grid center = world origin)
  const drawCharAtCell = useCallback((gridX: number, gridY: number, char: string) => {
    if (!terminal2DRef.current) return

    // Get selected node - drawing only works on selected nodes
    const selectedId = selectedNodesRef.current[0]
    if (!selectedId) {
      console.log('[drawCharAtCell] No node selected - cannot draw')
      return
    }

    // Grid center = world origin
    const gridSize = terminal2DRef.current.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)

    // Convert grid coords to world coords
    const worldX = gridX - WORLD_ORIGIN_X
    const worldY = gridY - WORLD_ORIGIN_Y

    // Find the selected node and calculate its global position (traversing parent chain)
    const rootNode = rootNodeRef.current

    type NodeResult = {
      node: Node
      path: (string | number)[]
      globalX: number  // Global position in world coords
      globalY: number
      width: number
      height: number
    }

    const findNodeAndGlobalPos = (
      node: Node,
      path: (string | number)[],
      parentGlobalX: number,
      parentGlobalY: number
    ): NodeResult | null => {
      const rect2D = node.components.find(c => c.script === 'Rect2D')
      const props = rect2D?.properties || {}
      const localX = (props.x as number) || 0
      const localY = (props.y as number) || 0
      const width = (props.width as number) || 1
      const height = (props.height as number) || 1
      const pivotX = (props.pivotX as number) ?? 0
      const pivotY = (props.pivotY as number) ?? 0

      // Calculate global position with pivot
      const globalX = parentGlobalX + localX - Math.floor(width * pivotX)
      const globalY = parentGlobalY + localY - Math.floor(height * pivotY)

      if (node.id === selectedId) {
        return { node, path, globalX, globalY, width, height }
      }

      // Search children
      for (let i = 0; i < node.children.length; i++) {
        const found = findNodeAndGlobalPos(
          node.children[i],
          [...path, 'children', i],
          globalX,
          globalY
        )
        if (found) return found
      }
      return null
    }

    // Search from root's children (which start at world origin 0,0)
    let result: NodeResult | null = null
    for (let i = 0; i < rootNode.children.length; i++) {
      result = findNodeAndGlobalPos(rootNode.children[i], ['scene', 'rootNode', 'children', i], 0, 0)
      if (result) break
    }

    if (!result) {
      console.log(`[drawCharAtCell] Selected node '${selectedId}' not found`)
      return
    }

    const { node: targetNode, path: nodePath, globalX, globalY, width: nodeWidth, height: nodeHeight } = result

    // Check if node is visible
    if (targetNode.meta?.visible === false) {
      console.log(`[drawCharAtCell] Node '${targetNode.name}' is hidden - cannot draw`)
      return
    }

    // Find GlyphMap component index for updating
    const glyphMapIndex = targetNode.components.findIndex(c => c.script === 'GlyphMap' || c.script === 'GlyphImage')
    if (glyphMapIndex === -1) {
      console.log(`[drawCharAtCell] Node '${targetNode.name}' has no GlyphMap component`)
      return
    }

    // Convert world coords to local position within the node's GlyphMap
    // The GlyphMap's (0,0) is at the node's global top-left corner
    const localX = worldX - globalX
    const localY = worldY - globalY

    // Check if within node bounds
    if (localX < 0 || localX >= nodeWidth || localY < 0 || localY >= nodeHeight) {
      console.log(`[drawCharAtCell] Position (${worldX}, ${worldY}) is outside node '${targetNode.name}' bounds`)
      return
    }

    // Update terminal display
    terminal2DRef.current.setCellChar(gridX, gridY, char)

    // Get or create cells data from GlyphMap component
    const glyphMap = targetNode.components[glyphMapIndex]
    let cells = (glyphMap.properties?.cells as string) || ''
    let lines = cells.split('\n')

    // Ensure we have enough lines
    while (lines.length < nodeHeight) {
      lines.push('.'.repeat(nodeWidth))
    }

    // Ensure each line is the right width
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length < nodeWidth) {
        lines[i] = lines[i] + '.'.repeat(nodeWidth - lines[i].length)
      }
    }

    // Replace character at position
    const line = lines[localY]
    lines[localY] = line.substring(0, localX) + char + line.substring(localX + 1)

    // Update GlyphMap component's cells property
    const newCells = lines.join('\n')
    setPathRef.current(
      [...nodePath, 'components', glyphMapIndex, 'properties', 'cells'],
      newCells,
      `Draw '${char}' at (${worldX}, ${worldY})`
    )
  }, [])

  // Erase a character at a grid cell (set to space)
  const eraseCharAtCell = useCallback((x: number, y: number) => {
    drawCharAtCell(x, y, ' ')
  }, [drawCharAtCell])

  // Convert selection to a new entity node
  // Extracts the ASCII from the selection and creates a new node with it
  const selectionToNode = useCallback(() => {
    if (!terminal2DRef.current || !selection2DRef.current) {
      console.log('[WebGPUViewport] No selection to convert')
      return
    }

    // Get the ASCII content from selection
    const ascii = terminal2DRef.current.getSelectionAscii()
    if (!ascii || ascii.trim().length === 0) {
      console.log('[WebGPUViewport] Selection is empty')
      return
    }

    const sel = selection2DRef.current

    // Create a new entity node with the selection
    const state = useEngineState.getState()
    const nodeId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

    // Find the first glyph character in the selection to use as the entity's glyph
    let glyph = '@'
    for (const line of ascii.split('\n')) {
      for (const char of line) {
        if (char !== ' ' && char !== '.') {
          glyph = char
          break
        }
      }
      if (glyph !== '@') break
    }

    // Calculate dimensions from selection
    const width = sel.x2 - sel.x1 + 1
    const height = sel.y2 - sel.y1 + 1

    // Create the new node with proper Rect2D and GlyphMap components
    const newNode: Node = {
      id: nodeId,
      name: `Entity from Selection`,
      type: 'GlyphMapNode',
      children: [],
      components: [
        {
          id: `${nodeId}_rect`,
          script: 'Rect2D',
          enabled: true,
          properties: {
            x: sel.x1,
            y: sel.y1,
            width,
            height,
            autoSize: false,
            paddingX: 0,
            paddingY: 0,
          },
        },
        {
          id: `${nodeId}_glyphmap`,
          script: 'GlyphMap',
          enabled: true,
          properties: {
            cells: ascii,
          },
        },
      ],
      meta: {},
    }

    // Add to root node's children
    const rootNode = state.scene.rootNode
    const newChildren = [...rootNode.children, newNode]

    setPathRef.current(
      ['scene', 'rootNode', 'children'],
      newChildren,
      'Create entity from selection'
    )

    // Select the new node
    setPathRef.current(['selection', 'nodes'], [nodeId], 'Select new entity')

    // Clear the terminal selection
    terminal2DRef.current.clearSelection()
    setPathRef.current(['editor2D', 'selection'], null, 'Clear selection')
    setPathRef.current(['editor2D', 'selectionAscii'], null, 'Clear selection ASCII')

    console.log(`[WebGPUViewport] Created entity '${nodeId}' from selection`)
  }, [])

  // Handle prefab drop from palette
  const handlePrefabDrop = useCallback((e: React.DragEvent) => {
    console.log('[WebGPUViewport] Drop event!')
    e.preventDefault()
    const prefabId = e.dataTransfer.getData('application/prefab-id')
    console.log('[WebGPUViewport] Prefab ID from drop:', prefabId)
    if (!prefabId || !terminal2DRef.current || cameraModeRef.current !== '2d') return

    // Get drop position in grid coordinates
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cell = terminal2DRef.current.screenToCell(x, y)
    if (!cell) return

    // Convert grid coords to world coords
    const gridSize = terminal2DRef.current.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)
    const worldX = cell[0] - WORLD_ORIGIN_X
    const worldY = cell[1] - WORLD_ORIGIN_Y

    // Get the prefab from store
    const prefab = useEngineState.getState().palette.prefabs[prefabId]
    if (!prefab) return

    // Clone the prefab template with new ID
    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cloneNode = (node: typeof prefab.template, newId: string): typeof prefab.template => {
      return {
        ...node,
        id: newId,
        name: `${node.name}`,
        children: node.children.map((child, i) =>
          cloneNode(child, `${newId}_child_${i}`)
        ),
        components: node.components.map(comp => ({
          ...comp,
          properties: { ...comp.properties }
        })),
      }
    }

    const newNode = cloneNode(prefab.template, newNodeId)

    // Update position to drop location
    const rect2D = newNode.components.find(c => c.script === 'Rect2D')
    if (rect2D) {
      rect2D.properties = { ...rect2D.properties, x: worldX, y: worldY }
    }

    // Add to scene under root
    const rootNode = rootNodeRef.current
    const newChildren = [...rootNode.children, newNode]
    setPathRef.current(['scene', 'rootNode', 'children'], newChildren, `Add prefab ${prefab.name}`)

    // Select the new node
    setPathRef.current(['selection', 'nodes'], [newNodeId], 'Select dropped prefab')

    console.log(`[WebGPUViewport] Dropped prefab '${prefab.name}' at (${worldX}, ${worldY})`)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    console.log('[WebGPUViewport] Drag over, types:', e.dataTransfer.types)
    if (e.dataTransfer.types.includes('application/prefab-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      console.log('[WebGPUViewport] Accepting prefab drop')
    }
  }, [])

  // Handle mouse-based prefab drop on scene (used by mouse-based drag system)
  const handleScenePrefabDrop = useCallback((clientX: number, clientY: number) => {
    const prefab = useDragState.getState().draggedPrefab
    if (!prefab || !terminal2DRef.current || cameraModeRef.current !== '2d') return

    // Get drop position in grid coordinates
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clientX - rect.left
    const y = clientY - rect.top
    const cell = terminal2DRef.current.screenToCell(x, y)
    if (!cell) return

    // Convert grid coords to world coords
    const gridSize = terminal2DRef.current.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)
    const worldX = cell[0] - WORLD_ORIGIN_X
    const worldY = cell[1] - WORLD_ORIGIN_Y

    // Clone the prefab template with new ID
    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cloneNode = (node: typeof prefab.template, newId: string): typeof prefab.template => {
      return {
        ...node,
        id: newId,
        name: `${node.name}`,
        children: node.children.map((child, i) =>
          cloneNode(child, `${newId}_child_${i}`)
        ),
        components: node.components.map(comp => ({
          ...comp,
          id: `${newId}_${comp.script}_${Math.random().toString(36).slice(2, 5)}`,
          properties: { ...comp.properties }
        })),
      }
    }

    const newNode = cloneNode(prefab.template, newNodeId)

    // Update position to drop location
    const rect2D = newNode.components.find(c => c.script === 'Rect2D')
    if (rect2D) {
      rect2D.properties = { ...rect2D.properties, x: worldX, y: worldY }
    }

    // Add to scene under root
    const rootNode = rootNodeRef.current
    const newChildren = [...rootNode.children, newNode]
    setPathRef.current(['scene', 'rootNode', 'children'], newChildren, `Add prefab ${prefab.name}`)

    // Select the new node
    setPathRef.current(['selection', 'nodes'], [newNodeId], 'Select dropped prefab')

    // End the drag
    useDragState.getState().endDrag()

    console.log(`[WebGPUViewport] Mouse-dropped prefab '${prefab.name}' at (${worldX}, ${worldY})`)
  }, [])

  // Handle keyboard input - only when not typing in an input
  // Uses refs for state to avoid callback recreation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture keys when typing in inputs, textareas, or contenteditable
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    // 2D Mode specific shortcuts
    if (cameraModeRef.current === '2d') {
      switch (e.key.toLowerCase()) {
        case 'v':
          setPathRef.current(['editor2D', 'tool'], 'pointer', 'Switch to Pointer tool')
          return
        case 'd':
          setPathRef.current(['editor2D', 'tool'], 'draw', 'Switch to Draw tool')
          return
        case 's':
          setPathRef.current(['editor2D', 'tool'], 'select', 'Switch to Select tool')
          return
        case 'x':
          setPathRef.current(['editor2D', 'tool'], 'erase', 'Switch to Erase tool')
          return
        case 'enter':
          // Convert selection to entity node
          if (selection2DRef.current) {
            e.preventDefault()
            selectionToNode()
          }
          return
        case 'escape':
          // Clear selection
          if (selection2DRef.current) {
            terminal2DRef.current?.clearSelection()
            setPathRef.current(['editor2D', 'selection'], null, 'Clear selection')
            setPathRef.current(['editor2D', 'selectionAscii'], null, 'Clear selection ASCII')
          }
          return
        case 'home':
          // Reset view to origin (0,0) at 100% zoom
          if (terminal2DRef.current && canvasRef.current) {
            const canvas = canvasRef.current
            terminal2DRef.current.resetView(canvas.width, canvas.height)
          }
          return
      }
    }

    // 3D Mode tool shortcuts
    switch (e.key.toLowerCase()) {
      case 'v':
        setPathRef.current(['tools', 'active'], 'select', 'Switch to Select tool')
        break
      case 'g':
        setPathRef.current(['tools', 'active'], 'move', 'Switch to Move tool')
        break
      case 'r':
        setPathRef.current(['tools', 'active'], 'rotate', 'Switch to Rotate tool')
        break
      // Note: 's' is used for backward movement, so we use 't' for scale
      // Or we could use only when not moving
      case 't':
        setPathRef.current(['tools', 'active'], 'scale', 'Switch to Scale tool')
        break
    }

    // Press '0' (zero): Shadow test scene (minimal scene for debugging shadows)
    if (e.key === '0' && sceneRef.current) {
      e.preventDefault()
      sceneRef.current.createShadowTestScene()
      console.log('[Viewport] Shadow test scene activated - press 0 again to refresh')
    }

    keysRef.current.add(e.key.toLowerCase())
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Always remove key from set on keyup to prevent stuck keys
    keysRef.current.delete(e.key.toLowerCase())
  }, [])

  // Handle pointer input - uses pointer capture for reliable dragging
  const handleMouseDown = useCallback((e: PointerEvent | MouseEvent) => {
    const canvas = canvasRef.current
    const pointerId = 'pointerId' in e ? e.pointerId : 1

    // ═══════════════════════════════════════════════════════════════════════════
    // 2D Mode handling
    // ═══════════════════════════════════════════════════════════════════════════
    if (cameraModeRef.current === '2d') {
      const cell = screenToGridCell(e.clientX, e.clientY)

      // Middle mouse button for panning
      if (e.button === 1) {
        isPanning2DRef.current = true
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        // Capture pointer for reliable drag handling
        if (canvas && 'setPointerCapture' in canvas) {
          try {
            canvas.setPointerCapture(pointerId)
            pointerCaptureElementRef.current = canvas
          } catch {
            // Ignore if capture fails
          }
        }
        e.preventDefault()
        return
      }

      // Right-click: track start for context menu vs lasso distinction
      if (e.button === 2) {
        if (cell) {
          const [cellX, cellY] = cell
          // Store right-click start position to detect drag vs click
          rightClickStartRef.current = { x: e.clientX, y: e.clientY }
          isSelectingRef.current = true
          selectionStartRef.current = { x: cellX, y: cellY }
          // Don't set selection yet - wait for drag or context menu

          // Capture pointer for reliable drag handling
          if (canvas && 'setPointerCapture' in canvas) {
            try {
              canvas.setPointerCapture(pointerId)
              pointerCaptureElementRef.current = canvas
            } catch {
              // Ignore if capture fails
            }
          }
        }
        return
      }

      // Left-click handling based on tool
      if (e.button === 0 && cell) {
        const [cellX, cellY] = cell
        const tool = tool2DRef.current
        console.log(`[2D Click] Tool: ${tool}, Cell: (${cellX}, ${cellY}), Char: ${currentCharRef.current}`)

        if (tool === 'draw') {
          // Start drawing
          isDrawing2DRef.current = true
          console.log(`[2D Draw] Drawing '${currentCharRef.current}' at (${cellX}, ${cellY})`)
          drawCharAtCell(cellX, cellY, currentCharRef.current)
        } else if (tool === 'select') {
          // Legacy select tool - same as right-click
          isSelectingRef.current = true
          selectionStartRef.current = { x: cellX, y: cellY }
          setPathRef.current(['editor2D', 'selection'], { x1: cellX, y1: cellY, x2: cellX, y2: cellY }, 'Start selection')
          terminal2DRef.current?.setSelection(cellX, cellY, cellX, cellY)
        } else if (tool === 'erase') {
          // Start erasing
          isDrawing2DRef.current = true
          eraseCharAtCell(cellX, cellY)
        } else if (tool === 'pointer') {
          // Pointer tool - click to select/cycle nodes, or drag to move
          // On mouse down, prepare for potential drag but don't start yet
          // Actual drag starts on mouse move, cycling happens on mouse up (if no drag)
          const nodesAtCell = findNodesAtCell(cellX, cellY)
          const selectedId = selectedNodesRef.current[0]

          // Store click info for potential drag or cycle
          lastClickedCellRef.current = { x: cellX, y: cellY }
          clickCycleNodesRef.current = nodesAtCell

          // If clicking on selected node, prepare for potential drag
          if (selectedId && nodesAtCell.includes(selectedId)) {
            const posInfo = getNodePositionInfo(selectedId)
            if (posInfo) {
              // Store drag info but don't start dragging yet (wait for mouse move)
              draggedNodeIdRef.current = selectedId
              dragStartCellRef.current = { x: cellX, y: cellY }
              dragOriginalPosRef.current = { x: posInfo.x, y: posInfo.y }
              // isDraggingNodeRef stays false - set to true on first mouse move
            }
          }
        }

        // Capture pointer for reliable drag handling
        if (canvas && 'setPointerCapture' in canvas) {
          try {
            canvas.setPointerCapture(pointerId)
            pointerCaptureElementRef.current = canvas
          } catch {
            // Ignore if capture fails
          }
        }
        return
      }
    }

    if (e.button === 0) { // Left click
      // Check if clicking on gizmo first
      const selectedId = selectedNodesRef.current[0]
      const cachedBounds = selectedId ? boundsCache.current.get(selectedId) : null
      if (cachedBounds && gizmoHoveredAxisRef.current) {
        // Start gizmo drag - gizmo at center of bounding box
        const gizmoCenter: [number, number, number] = [
          cachedBounds.position[0],
          cachedBounds.position[1] + cachedBounds.bounds[1] * 0.5,
          cachedBounds.position[2]
        ]
        const node = normalizedNodesRef.current[selectedId]
        if (node?.transform) {
          gizmoInteractionRef.current.beginDrag(
            gizmoHoveredAxisRef.current,
            [e.clientX, e.clientY],
            gizmoCenter,
            node.transform as Transform
          )
          isDraggingGizmoRef.current = true
          lastMouseRef.current = { x: e.clientX, y: e.clientY }
          // Capture pointer for reliable drag handling
          if (canvas && 'setPointerCapture' in canvas) {
            try {
              canvas.setPointerCapture(pointerId)
              pointerCaptureElementRef.current = canvas
            } catch {
              // Ignore if capture fails
            }
          }
          return
        }
      }

      // Not clicking on gizmo - track for selection
      clickStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() }
      isDraggingRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    } else if (e.button === 2) { // Right click - camera drag only
      isDraggingRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }, []) // Uses refs only - no dependencies needed

  const handleMouseUp = useCallback((e: PointerEvent | MouseEvent) => {
    const pointerId = 'pointerId' in e ? e.pointerId : 1

    // Release pointer capture if we had it
    if (pointerCaptureElementRef.current) {
      try {
        pointerCaptureElementRef.current.releasePointerCapture(pointerId)
      } catch {
        // Ignore - pointer capture may already be released
      }
      pointerCaptureElementRef.current = null
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2D Mode handling
    // ═══════════════════════════════════════════════════════════════════════════
    if (cameraModeRef.current === '2d') {
      if (isPanning2DRef.current) {
        isPanning2DRef.current = false
        return
      }
      // Handle pointer tool mouse up - either end drag or do selection/cycling
      if (lastClickedCellRef.current !== null && tool2DRef.current === 'pointer') {
        if (isDraggingNodeRef.current) {
          // Was actually dragging - just end drag
          console.log('[2D Pointer] Finished dragging node')
        } else {
          // Was a click, not a drag - do selection/cycling
          // Always clear lasso selection on left-click (node bounds will show instead)
          terminal2DRef.current?.clearSelection()
          setPathRef.current(['editor2D', 'selection'], null, 'Clear lasso selection')
          setPathRef.current(['editor2D', 'selectionAscii'], null, 'Clear selection ASCII')

          const nodesAtCell = clickCycleNodesRef.current
          const selectedId = selectedNodesRef.current[0]

          if (nodesAtCell.length > 0) {
            // Find current index of selected node in the list
            const currentIndex = nodesAtCell.indexOf(selectedId)

            if (currentIndex >= 0) {
              // Already have a node selected from this cell - cycle to next
              const nextIndex = (currentIndex + 1) % nodesAtCell.length
              const nextNodeId = nodesAtCell[nextIndex]
              setPathRef.current(['selection', 'nodes'], [nextNodeId], 'Select node (cycled)')
              clickCycleIndexRef.current = nextIndex
              console.log(`[2D Pointer] Cycled to node ${nextIndex + 1}/${nodesAtCell.length}: ${nextNodeId}`)
            } else {
              // Select first (deepest) node
              const nodeId = nodesAtCell[0]
              setPathRef.current(['selection', 'nodes'], [nodeId], 'Select node')
              clickCycleIndexRef.current = 0
              console.log(`[2D Pointer] Selected node 1/${nodesAtCell.length}: ${nodeId}`)
            }
          } else {
            // No nodes at this position - clear node selection too
            setPathRef.current(['selection', 'nodes'], [], 'Clear selection')
            console.log('[2D Pointer] No nodes at position, cleared selection')
          }
        }

        // Reset drag state
        isDraggingNodeRef.current = false
        draggedNodeIdRef.current = null
        dragStartCellRef.current = null
        dragOriginalPosRef.current = null
        lastClickedCellRef.current = null
        return
      }
      if (isDrawing2DRef.current) {
        isDrawing2DRef.current = false
        selectionStartRef.current = null
        originalSelectionRef.current = null
        return
      }
      if (isSelectingRef.current) {
        // Check if this was a right-click (no drag) - show context menu
        if (rightClickStartRef.current && selectionStartRef.current) {
          const dx = e.clientX - rightClickStartRef.current.x
          const dy = e.clientY - rightClickStartRef.current.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance <= clickThreshold) {
            // Was a click, not a drag - show context menu
            const cellX = selectionStartRef.current.x
            const cellY = selectionStartRef.current.y
            setContextMenu({ x: e.clientX, y: e.clientY, cell: [cellX, cellY] })
          }
          // If was a drag, lasso selection is already set - just clean up
        }

        isSelectingRef.current = false
        selectionStartRef.current = null
        rightClickStartRef.current = null
        return
      }
    }

    // Handle gizmo drag end
    if (isDraggingGizmoRef.current) {
      gizmoInteractionRef.current.endDrag()
      isDraggingGizmoRef.current = false
      return
    }

    isDraggingRef.current = false
    // Stop camera movement immediately when mouse released
    if (cameraRef.current) {
      cameraRef.current.stop()
    }

    // Check if this was a click (not a drag) on left mouse button
    if (e.button === 0 && clickStartRef.current) {
      const dx = e.clientX - clickStartRef.current.x
      const dy = e.clientY - clickStartRef.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < clickThreshold) {
        // This was a click - pick node
        const nodeId = pickNodeAtPosition(e.clientX, e.clientY)
        if (nodeId) {
          // Select the node
          setPathRef.current(['selection', 'nodes'], [nodeId], 'Select node')
          console.log('[WebGPUViewport] Selected node:', nodeId)
        } else {
          // Clicked empty space - clear selection
          setPathRef.current(['selection', 'nodes'], [], 'Clear selection')
          console.log('[WebGPUViewport] Cleared selection')
        }
      }
    }
    clickStartRef.current = null
  }, [pickNodeAtPosition])

  // Mouse move handler - uses refs to avoid callback recreation which would break drags
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 2D Mode handling
    // ═══════════════════════════════════════════════════════════════════════════
    if (cameraModeRef.current === '2d') {
      // Handle middle mouse panning
      if (isPanning2DRef.current && terminal2DRef.current && canvasRef.current) {
        const dx = e.clientX - lastMouseRef.current.x
        const dy = e.clientY - lastMouseRef.current.y
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        terminal2DRef.current.pan(dx, dy, canvasRef.current.width, canvasRef.current.height)
        return
      }

      const cell = screenToGridCell(e.clientX, e.clientY)

      // Handle node dragging (or start drag if prepared but not started)
      if (cell && dragStartCellRef.current && dragOriginalPosRef.current && draggedNodeIdRef.current) {
        const [cellX, cellY] = cell
        const deltaX = cellX - dragStartCellRef.current.x
        const deltaY = cellY - dragStartCellRef.current.y

        // Only start/continue dragging if mouse actually moved to different cell
        if (deltaX !== 0 || deltaY !== 0) {
          // Mark as actively dragging (distinguishes click from drag)
          isDraggingNodeRef.current = true

          // Calculate new position (snap to grid by rounding)
          const newX = Math.round(dragOriginalPosRef.current.x + deltaX)
          const newY = Math.round(dragOriginalPosRef.current.y + deltaY)

          // Get node path and update position
          const posInfo = getNodePositionInfo(draggedNodeIdRef.current)
          if (posInfo) {
            // Update x and y together using batchUpdate to avoid double re-render
            batchUpdateRef.current([
              { path: [...posInfo.path, 'components', posInfo.rect2DIndex, 'properties', 'x'], value: newX },
              { path: [...posInfo.path, 'components', posInfo.rect2DIndex, 'properties', 'y'], value: newY },
            ], 'Move node')
          }
        }
        return
      }

      // Update hover highlight
      if (cell) {
        terminal2DRef.current?.setHoveredCell(cell[0], cell[1])

        // Find which node contains this cell (for hover info display)
        const [cellX, cellY] = cell
        const rootNode = rootNodeRef.current
        let foundNodeId: string | null = null

        // Find node that contains this cell position
        const findNodeAtCell = (node: Node): string | null => {
          if (node.meta?.visible === false) return null

          // Check if node has Rect2D (defines bounds) and visual content
          const rect2D = node.components.find(c => c.script === 'Rect2D')
          const hasVisual = node.components.some(c =>
            c.script === 'GlyphMap' || c.script === 'GlyphImage' || c.script === 'Glyph'
          )

          if (rect2D && hasVisual) {
            const offsetX = (rect2D.properties?.x as number) || 0
            const offsetY = (rect2D.properties?.y as number) || 0
            const width = (rect2D.properties?.width as number) || 0
            const height = (rect2D.properties?.height as number) || 0

            // Check if cell is within this node's Rect2D bounds
            if (cellX >= offsetX && cellX < offsetX + width &&
                cellY >= offsetY && cellY < offsetY + height) {
              return node.id
            }
          }
          // Check children
          for (const child of node.children) {
            const found = findNodeAtCell(child)
            if (found) return found
          }
          return null
        }

        foundNodeId = findNodeAtCell(rootNode)
        if (foundNodeId !== hoveredNodeRef.current) {
          hoveredNodeRef.current = foundNodeId
          setHoveredNode(foundNodeId)
        }
      } else {
        terminal2DRef.current?.setHoveredCell(null, null)
        if (hoveredNodeRef.current !== null) {
          hoveredNodeRef.current = null
          setHoveredNode(null)
        }
      }

      // Handle right-click selection drag (only if dragged beyond threshold)
      if (isSelectingRef.current && cell && selectionStartRef.current && rightClickStartRef.current) {
        const dx = e.clientX - rightClickStartRef.current.x
        const dy = e.clientY - rightClickStartRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Only start lasso selection if dragged beyond threshold
        if (distance > clickThreshold) {
          const [cellX, cellY] = cell
          const start = selectionStartRef.current
          const newSelection = {
            x1: Math.min(start.x, cellX),
            y1: Math.min(start.y, cellY),
            x2: Math.max(start.x, cellX),
            y2: Math.max(start.y, cellY),
          }
          setPathRef.current(['editor2D', 'selection'], newSelection, 'Update selection')
          terminal2DRef.current?.setSelection(newSelection.x1, newSelection.y1, newSelection.x2, newSelection.y2)
          // Update selection ASCII content from terminal grid
          const ascii = terminal2DRef.current?.getSelectionAscii() || null
          setPathRef.current(['editor2D', 'selectionAscii'], ascii, 'Update selection ASCII')
        }
      }

      // Handle 2D tool dragging
      if (isDrawing2DRef.current && cell) {
        const [cellX, cellY] = cell
        const tool = tool2DRef.current

        if (tool === 'draw') {
          // Continue drawing
          drawCharAtCell(cellX, cellY, currentCharRef.current)
        } else if (tool === 'select' && selectionStartRef.current) {
          // Update selection rectangle (legacy select tool)
          const start = selectionStartRef.current
          const newSelection = {
            x1: Math.min(start.x, cellX),
            y1: Math.min(start.y, cellY),
            x2: Math.max(start.x, cellX),
            y2: Math.max(start.y, cellY),
          }
          setPathRef.current(['editor2D', 'selection'], newSelection, 'Update selection')
          terminal2DRef.current?.setSelection(newSelection.x1, newSelection.y1, newSelection.x2, newSelection.y2)
        } else if (tool === 'erase') {
          // Continue erasing
          eraseCharAtCell(cellX, cellY)
        } else if (tool === 'pointer' && selectionStartRef.current && originalSelectionRef.current) {
          // Drag-to-move: move selection from original position by total delta
          const startX = selectionStartRef.current.x
          const startY = selectionStartRef.current.y
          const deltaX = cellX - startX
          const deltaY = cellY - startY

          // Apply delta to ORIGINAL selection bounds (not current)
          const orig = originalSelectionRef.current
          const newSelection = {
            x1: orig.x1 + deltaX,
            y1: orig.y1 + deltaY,
            x2: orig.x2 + deltaX,
            y2: orig.y2 + deltaY,
          }

          // Update selection position
          setPathRef.current(['editor2D', 'selection'], newSelection, 'Move selection')
          terminal2DRef.current?.setSelection(newSelection.x1, newSelection.y1, newSelection.x2, newSelection.y2)

          // Don't update selectionStartRef - we always calculate delta from original drag start
        }
      }

      // Don't continue with 3D mode processing
      if (!isDraggingRef.current) return
    }

    // Get cached bounds for selected node (used in multiple places below)
    const selectedId = selectedNodesRef.current[0]
    const cachedBounds = selectedId ? boundsCache.current.get(selectedId) : null

    // Handle gizmo dragging
    if (isDraggingGizmoRef.current) {
      const ray = getRayFromScreen(e.clientX, e.clientY)
      if (!ray || !cachedBounds) return

      // Gizmo at center of bounding box
      const gizmoCenter: [number, number, number] = [
        cachedBounds.position[0],
        cachedBounds.position[1] + cachedBounds.bounds[1] * 0.5,
        cachedBounds.position[2]
      ]

      const tool = activeToolRef.current
      const mode = tool === 'select' ? 'move' : tool

      // Get snap settings based on tool (use ref to avoid callback recreation)
      const settings = toolSettingsRef.current as Record<string, { settings?: { snapToGrid?: boolean; gridSize?: number; snapAngle?: number } }>
      const moveSettings = settings.move?.settings
      const rotateSettings = settings.rotate?.settings
      const snap = {
        enabled: moveSettings?.snapToGrid ?? true,
        gridSize: moveSettings?.gridSize ?? 1,
        angleSnap: rotateSettings?.snapAngle ?? 15,
      }

      const newTransform = gizmoInteractionRef.current.updateDrag(mode, ray, gizmoCenter, snap)
      if (newTransform) {
        const nodePath = findNodePath(rootNodeRef.current, selectedId)
        if (nodePath) {
          // Build path to the node's transform
          const fullPath = ['scene', 'rootNode', ...nodePath.flatMap(i => ['children', i]), 'transform']
          setPathRef.current(fullPath, newTransform, 'Move node')
        }
      }
      return
    }

    // Handle camera controls when dragging
    if (isDraggingRef.current && cameraRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      lastMouseRef.current = { x: e.clientX, y: e.clientY }

      if (cameraModeRef.current === '2d') {
        // 2D mode: pan with any mouse button drag (or middle click, or Alt+drag)
        // Scale pan speed by orthoSize for consistent feel
        const panScale = cameraRef.current.orthoSize * 0.005
        cameraRef.current.pan2D(-dx * panScale, dy * panScale)
      } else {
        // 3D mode: Left mouse button (1) = rotate, Right mouse button (2) = pan
        if (e.buttons === 1) {
          // Rotate camera with mouse drag
          const sensitivity = 0.003
          cameraRef.current.rotate(-dx * sensitivity, -dy * sensitivity)
        } else if (e.buttons === 2) {
          // Pan camera - drag up to pan down (vertical inverted)
          const panSpeed = 0.02
          cameraRef.current.move(0, dx * panSpeed, dy * panSpeed)
        }
      }
      return
    }

    // Throttled hover detection when not dragging
    const now = performance.now()
    if (now - lastHoverCheckRef.current < hoverThrottleMs) return
    lastHoverCheckRef.current = now

    // Check gizmo hover first
    if (cachedBounds && cameraRef.current) {
      const ray = getRayFromScreen(e.clientX, e.clientY)
      if (ray) {
        // Gizmo at center of bounding box
        const gizmoCenter: [number, number, number] = [
          cachedBounds.position[0],
          cachedBounds.position[1] + cachedBounds.bounds[1] * 0.5,
          cachedBounds.position[2]
        ]

        const tool = activeToolRef.current
        const mode = tool === 'select' ? 'move' : tool
        // Calculate gizmo scale based on distance from camera
        const cameraPos = cameraRef.current.position
        const distToGizmo = Math.sqrt(
          (gizmoCenter[0] - cameraPos[0]) ** 2 +
          (gizmoCenter[1] - cameraPos[1]) ** 2 +
          (gizmoCenter[2] - cameraPos[2]) ** 2
        )
        const gizmoScale = distToGizmo * 0.15 // Scale gizmo based on distance

        const hoveredAxis = gizmoInteractionRef.current.hitTestGizmo(ray, gizmoCenter, mode, gizmoScale)
        if (hoveredAxis !== gizmoHoveredAxisRef.current) {
          gizmoHoveredAxisRef.current = hoveredAxis
          setGizmoHoveredAxis(hoveredAxis)
        }

        // If hovering gizmo, clear node hover and return
        if (hoveredAxis) {
          if (hoveredNodeRef.current !== null) {
            hoveredNodeRef.current = null
            setHoveredNode(null)
            if (sceneRef.current) {
              sceneRef.current.setHoveredNode(null)
            }
          }
          return
        }
      }
    }

    // Check node hover
    const nodeId = pickNodeAtPosition(e.clientX, e.clientY)

    // Check if this is a floor node - treat floor as empty space for hover (O(1) lookup)
    let effectiveHoverId: string | null = nodeId
    if (nodeId) {
      const node = normalizedNodesRef.current[nodeId]
      if (node?.meta?.isFloor) {
        effectiveHoverId = null  // Don't highlight floor on hover
      }
    }

    // Use ref for comparison to avoid recreating this callback on every hover change
    if (effectiveHoverId !== hoveredNodeRef.current) {
      hoveredNodeRef.current = effectiveHoverId
      setHoveredNode(effectiveHoverId)
      if (sceneRef.current) {
        sceneRef.current.setHoveredNode(effectiveHoverId)
      }
    }
  }, [pickNodeAtPosition, getRayFromScreen, findNodePath])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()

    if (cameraModeRef.current === '2d') {
      // 2D mode: Ctrl+wheel for stepped zoom toward mouse, regular wheel for pan
      if (e.ctrlKey && terminal2DRef.current && canvasRef.current) {
        // Get mouse position relative to canvas
        const rect = canvasRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Stepped zoom toward mouse position (with eased animation)
        if (e.deltaY < 0) {
          terminal2DRef.current.zoomInToward(mouseX, mouseY)
        } else {
          terminal2DRef.current.zoomOutToward(mouseX, mouseY)
        }

        // Update state to reflect target zoom (for UI display)
        const targetZoom = terminal2DRef.current.getTargetZoom()
        setPathRef.current(['editor2D', 'zoom'], Math.round(targetZoom * 100), 'Zoom')
      } else if (terminal2DRef.current && canvasRef.current) {
        // Pan with regular wheel (vertical scroll) - reduced speed
        // Shift+wheel for horizontal scroll
        const scrollSpeed = 0.3  // Reduce scroll intensity
        const { width, height } = canvasRef.current
        if (e.shiftKey) {
          terminal2DRef.current.pan(-e.deltaY * scrollSpeed, 0, width, height)
        } else {
          terminal2DRef.current.pan(0, -e.deltaY * scrollSpeed, width, height)
        }
      }
    } else if (cameraRef.current) {
      // 3D mode: move forward/back
      const moveAmount = -e.deltaY * 0.008
      cameraRef.current.move(moveAmount, 0, 0)
    }
  }, [])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault() // Prevent right-click menu
  }, [])

  const handleMouseLeave = useCallback(() => {
    // Clear 2D hover when mouse leaves canvas
    if (cameraModeRef.current === '2d') {
      terminal2DRef.current?.setHoveredCell(null, null)
    }

    // Clear hover when mouse leaves canvas
    if (hoveredNodeRef.current !== null) {
      hoveredNodeRef.current = null
      setHoveredNode(null)
      if (sceneRef.current) {
        sceneRef.current.setHoveredNode(null)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // Reactive Scene Updates via Subscriptions
  // ═══════════════════════════════════════════════════════════════════════════

  // Subscribe to entity changes for reactive scene updates
  useEffect(() => {
    if (!sceneRef.current || loading) return

    // Connect scene to subscription system
    sceneRef.current.connectToStore(() => {
      // Scene will set needsRebuild flag, render loop checks it
    })

    // Subscribe to entity changes to update bounds cache
    const unsubscribeEntities = entitySubscriptions.subscribeToEntities(
      (entities, changedNodeIds, _changedComponentIds) => {
        // Update bounds cache for changed nodes
        for (const nodeId of changedNodeIds) {
          const node = entities.nodes[nodeId]
          if (node?.transform) {
            boundsCache.current.set(nodeId, {
              position: node.transform.position,
              bounds: calculateNodeBounds(node),
              rotation: node.transform.rotation || [0, 0, 0]
            })
          } else {
            boundsCache.current.delete(nodeId)
          }
        }
      }
    )

    // Initial bounds cache population
    const entities = useEngineState.getState().entities
    for (const nodeId of entities.nodeOrder) {
      const node = entities.nodes[nodeId]
      if (node?.transform) {
        boundsCache.current.set(nodeId, {
          position: node.transform.position,
          bounds: calculateNodeBounds(node),
          rotation: node.transform.rotation || [0, 0, 0]
        })
      }
    }

    return () => {
      unsubscribeEntities()
      sceneRef.current?.disconnectFromStore()
    }
  }, [loading, calculateNodeBounds])


  // Update hover state separately (doesn't require full scene rebuild)
  useEffect(() => {
    if (!sceneRef.current || loading) return
    sceneRef.current.setHoveredNode(hoveredNode)
  }, [hoveredNode, loading])

  // Sync hovered node to global editor2D state for toolbar display
  useEffect(() => {
    if (cameraMode === '2d') {
      setPath(['editor2D', 'hoveredNode'], hoveredNode, 'Update hovered node')
    }
  }, [hoveredNode, cameraMode, setPath])

  // Sync lighting settings to renderer
  useEffect(() => {
    if (!rendererRef.current || loading) return
    rendererRef.current.updateLightingSettings({
      sun: {
        enabled: lightingState.sun.enabled,
        direction: lightingState.sun.direction as [number, number, number],
        color: lightingState.sun.color as [number, number, number],
        intensity: lightingState.sun.intensity,
      },
      ambient: {
        color: lightingState.ambient.color as [number, number, number],
        intensity: lightingState.ambient.intensity,
      },
    })
  }, [lightingState, loading])

  // Sync environment settings to renderer
  useEffect(() => {
    if (!rendererRef.current || loading) return
    rendererRef.current.updateEnvironmentSettings({
      sky: {
        zenithColor: environmentState.skybox.gradient.zenith as [number, number, number],
        horizonColor: environmentState.skybox.gradient.horizon as [number, number, number],
        groundColor: environmentState.skybox.gradient.ground as [number, number, number],
      },
    })
  }, [environmentState, loading])

  // Sync state to refs for render loop
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // Sync camera mode to Camera class
  useEffect(() => {
    cameraModeRef.current = cameraMode
    if (cameraRef.current) {
      cameraRef.current.setMode(cameraMode)
    }
  }, [cameraMode])

  useEffect(() => {
    selectedNodesRef.current = selectedNodes
    // Update selected position for gizmo from cache (O(1))
    if (selectedNodes.length > 0) {
      const cached = boundsCache.current.get(selectedNodes[0])
      selectedPositionRef.current = cached?.position || null
    } else {
      selectedPositionRef.current = null
    }
  }, [selectedNodes, normalizedNodes]) // normalizedNodes triggers when entities change

  useEffect(() => {
    gizmoHoveredAxisRef.current = gizmoHoveredAxis
  }, [gizmoHoveredAxis])

  // Helper to load tilemap data into Terminal2D renderer
  // Handles local coordinate system where (0,0) is world center
  const loadTilemapToTerminal = useCallback((terminal: Terminal2DRenderer, centerOnGameBounds = false) => {
    // Clear first (fills with void/dark background)
    terminal.clear()

    // Load visible nodes from tree structure
    const state = useEngineState.getState()
    const rootNode = state.scene.rootNode

    // Grid center = world origin (0,0)
    // Grid is 200x150, so center is (100, 75)
    const gridSize = terminal.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)  // 100
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)  // 75

    // Helper to convert world coords to grid coords (must be integers for cell lookup)
    const worldToGrid = (worldX: number, worldY: number): [number, number] => {
      return [Math.round(WORLD_ORIGIN_X + worldX), Math.round(WORLD_ORIGIN_Y + worldY)]
    }

    // Helper to get global position of a node (traverses parent chain)
    // Handles local coordinates and pivot points
    const getGlobalRect = (node: Node, parentGlobalX: number, parentGlobalY: number): { x: number; y: number; width: number; height: number } | null => {
      const rect2DComp = node.components.find(c => c.script === 'Rect2D')
      if (!rect2DComp) return null

      const props = rect2DComp.properties || {}
      const localX = (props.x as number) || 0
      const localY = (props.y as number) || 0
      const width = (props.width as number) || 1
      const height = (props.height as number) || 1
      const pivotX = (props.pivotX as number) ?? 0  // 0 = left, 0.5 = center, 1 = right
      const pivotY = (props.pivotY as number) ?? 0  // 0 = top, 0.5 = center, 1 = bottom

      // Calculate global position:
      // 1. Start with parent's global position
      // 2. Add local offset
      // 3. Subtract pivot offset (pivot shifts where the "origin" of the rect is)
      const globalX = parentGlobalX + localX - Math.floor(width * pivotX)
      const globalY = parentGlobalY + localY - Math.floor(height * pivotY)

      return { x: globalX, y: globalY, width, height }
    }

    // Track content bounds for centering (from first child with Rect2D)
    let contentBounds: { x: number; y: number; width: number; height: number } | null = null

    // Find content bounds from root's first child with Rect2D
    for (const child of rootNode.children) {
      if (child.meta?.visible === false) continue
      const globalRect = getGlobalRect(child, 0, 0)
      if (globalRect) {
        const [gridX, gridY] = worldToGrid(globalRect.x, globalRect.y)
        contentBounds = {
          x: gridX,
          y: gridY,
          width: globalRect.width,
          height: globalRect.height,
        }
        break
      }
    }

    // Set game bounds gizmo to content bounds (shows the main area being edited)
    // Will be replaced by Camera component bounds later
    if (contentBounds) {
      terminal.setGameBounds(contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height)
    } else {
      terminal.clearGameBounds()
    }

    // Recursively load visible nodes
    // parentGlobalX/Y are in WORLD coords (before grid conversion)
    const loadNode = (node: Node, parentGlobalX: number, parentGlobalY: number) => {
      // Skip hidden nodes
      if (node.meta?.visible === false) return

      // Get global rect (handles local coords and pivot)
      const globalRect = getGlobalRect(node, parentGlobalX, parentGlobalY)

      // Get GlyphMap/GlyphImage component for cells data (multi-character grid)
      const glyphMapComp = node.components.find(c => c.script === 'GlyphMap' || c.script === 'GlyphImage')
      const cells = glyphMapComp?.properties?.cells as string | undefined

      // Get Glyph component for single character
      const glyphComp = node.components.find(c => c.script === 'Glyph')
      const char = glyphComp?.properties?.char as string | undefined
      const emission = (glyphComp?.properties?.emission as number) ?? 0

      // If node has cells data in GlyphMap, load it at the global grid position
      if (cells && globalRect) {
        const [gridX, gridY] = worldToGrid(globalRect.x, globalRect.y)
        terminal.loadAscii(cells, gridX, gridY, emission)
      }
      // If node has a single Glyph character, render it at the position
      else if (char && globalRect) {
        const [gridX, gridY] = worldToGrid(globalRect.x, globalRect.y)
        terminal.setCellChar(gridX, gridY, char, 0, emission)
      }

      // Process children with this node's global position as parent offset
      const nodeGlobalX = globalRect?.x ?? parentGlobalX
      const nodeGlobalY = globalRect?.y ?? parentGlobalY
      for (const child of node.children) {
        loadNode(child, nodeGlobalX, nodeGlobalY)
      }
    }

    // Load root's children (the actual game content)
    // Root children start at world origin (0, 0) as their parent offset
    for (const child of rootNode.children) {
      loadNode(child, 0, 0)
    }

    // Center the viewport on the content bounds
    if (centerOnGameBounds && canvasRef.current && contentBounds) {
      terminal.centerOnBounds(canvasRef.current.width, canvasRef.current.height, contentBounds)
    }
  }, [])

  // Sync tilemap changes to terminal (deferred to render loop to avoid flickering)
  useEffect(() => {
    if (terminal2DRef.current && cameraMode === '2d') {
      // Just mark as needing refresh - the render loop will do the actual update
      // This prevents multiple clear+draw cycles between frames
      terminalNeedsRefreshRef.current = true
    }
  }, [normalizedNodes, rootNode, cameraMode])

  // Handle recenter requests (from button or keyboard)
  useEffect(() => {
    if (!terminal2DRef.current || cameraMode !== '2d' || !canvasRef.current) return
    if (recenterTimestamp === 0) return  // Skip initial mount

    // Recenter on content
    loadTilemapToTerminal(terminal2DRef.current, true)
    console.log('[WebGPUViewport] Recentered view')
  }, [recenterTimestamp, cameraMode, loadTilemapToTerminal])

  // Handle center on specific node requests
  useEffect(() => {
    if (!terminal2DRef.current || cameraMode !== '2d' || !canvasRef.current || !centerOnNodeId) return

    // Find the node and calculate its global position
    const findNodeGlobalBounds = (node: Node, parentX: number, parentY: number): { x: number; y: number; width: number; height: number } | null => {
      const rect2D = node.components.find(c => c.script === 'Rect2D')
      if (rect2D) {
        const props = rect2D.properties || {}
        const localX = (props.x as number) || 0
        const localY = (props.y as number) || 0
        const width = (props.width as number) || 1
        const height = (props.height as number) || 1
        const pivotX = (props.pivotX as number) ?? 0
        const pivotY = (props.pivotY as number) ?? 0
        const globalX = parentX + localX - Math.floor(width * pivotX)
        const globalY = parentY + localY - Math.floor(height * pivotY)

        if (node.id === centerOnNodeId) {
          return { x: globalX, y: globalY, width, height }
        }

        // Search children
        for (const child of node.children) {
          const result = findNodeGlobalBounds(child, globalX, globalY)
          if (result) return result
        }
      } else {
        // Search children without rect offset
        for (const child of node.children) {
          const result = findNodeGlobalBounds(child, parentX, parentY)
          if (result) return result
        }
      }
      return null
    }

    const bounds = findNodeGlobalBounds(rootNode, 0, 0)
    if (bounds) {
      const gridSize = terminal2DRef.current.getGridSize()
      const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
      const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)
      const gridBounds = {
        x: WORLD_ORIGIN_X + bounds.x,
        y: WORLD_ORIGIN_Y + bounds.y,
        width: bounds.width,
        height: bounds.height,
      }
      terminal2DRef.current.centerOnBounds(canvasRef.current.width, canvasRef.current.height, gridBounds)
      console.log('[WebGPUViewport] Centered on node:', centerOnNodeId)
    }

    // Clear the request
    setPath(['editor2D', 'centerOnNodeId'], null, 'Clear center request')
  }, [centerOnNodeId, cameraMode, rootNode, setPath])

  // Sync selected node bounds to terminal selection (shows which node you're editing)
  // Handles local coordinates and pivot points
  // NOTE: Don't overwrite if there's an active lasso selection (user-drawn rectangle)
  useEffect(() => {
    if (!terminal2DRef.current || cameraMode !== '2d') return

    // If there's an active lasso selection, don't overwrite it with node bounds
    if (selection2D) {
      return
    }

    const selectedId = selectedNodes[0]
    if (!selectedId) {
      terminal2DRef.current.clearSelection()
      return
    }

    // Grid center = world origin
    const gridSize = terminal2DRef.current.getGridSize()
    const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
    const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)

    // Helper to convert world coords to grid coords (must be integers for cell lookup)
    const worldToGrid = (worldX: number, worldY: number): [number, number] => {
      return [Math.round(WORLD_ORIGIN_X + worldX), Math.round(WORLD_ORIGIN_Y + worldY)]
    }

    // Find selected node and calculate its global position (traversing parent chain)
    const findNodeWithGlobalPos = (
      node: Node,
      parentGlobalX: number,
      parentGlobalY: number
    ): { node: Node; globalX: number; globalY: number; width: number; height: number } | null => {
      const rect2D = node.components.find(c => c.script === 'Rect2D')
      const props = rect2D?.properties || {}
      const localX = (props.x as number) || 0
      const localY = (props.y as number) || 0
      const width = (props.width as number) || 1
      const height = (props.height as number) || 1
      const pivotX = (props.pivotX as number) ?? 0
      const pivotY = (props.pivotY as number) ?? 0

      // Calculate global position with pivot
      const globalX = parentGlobalX + localX - Math.floor(width * pivotX)
      const globalY = parentGlobalY + localY - Math.floor(height * pivotY)

      if (node.id === selectedId) {
        return { node, globalX, globalY, width, height }
      }

      // Search children
      for (const child of node.children) {
        const found = findNodeWithGlobalPos(child, globalX, globalY)
        if (found) return found
      }
      return null
    }

    // Search from root's children (which start at world origin 0,0)
    let result: { node: Node; globalX: number; globalY: number; width: number; height: number } | null = null
    for (const child of rootNode.children) {
      result = findNodeWithGlobalPos(child, 0, 0)
      if (result) break
    }

    if (!result) {
      terminal2DRef.current.clearSelection()
      return
    }

    // Convert world coords to grid coords
    const [gridX, gridY] = worldToGrid(result.globalX, result.globalY)

    // Set selection to show node bounds
    terminal2DRef.current.setSelection(gridX, gridY, gridX + result.width - 1, gridY + result.height - 1)
  }, [selectedNodes, rootNode, cameraMode, selection2D])

  // Sync showGrid to Terminal2D renderer
  useEffect(() => {
    if (terminal2DRef.current && cameraMode === '2d') {
      terminal2DRef.current.setShowGrid(showGrid)
    }
  }, [showGrid, cameraMode])

  // Sync zoom from toolbar to renderer (with animation toward center)
  // Wheel zoom calls renderer directly, this handles toolbar zoom changes
  useEffect(() => {
    if (terminal2DRef.current && cameraMode === '2d' && canvasRef.current) {
      const canvas = canvasRef.current
      // setZoom already skips if already animating to this target
      terminal2DRef.current.setZoom(zoom / 100, canvas.width, canvas.height)
    }
  }, [zoom, cameraMode])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let mounted = true
    let lastTime = performance.now()
    let frameCount = 0
    let fpsUpdateTime = 0

    async function init() {
      try {
        // Check WebGPU support
        if (!navigator.gpu) {
          throw new Error('WebGPU is not supported in this browser')
        }

        // Set initial canvas size
        const rect = container!.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas!.width = rect.width * dpr
        canvas!.height = rect.height * dpr

        // Create renderer
        const renderer = new WebGPURenderer()
        await renderer.init(canvas!)

        if (!mounted) {
          renderer.destroy()
          return
        }

        rendererRef.current = renderer

        // Create camera - start looking at scene center
        const camera = new Camera()
        camera.lookAt(0, 0, 0)
        cameraRef.current = camera

        // Create scene from engine state nodes
        const scene = new Scene()
        sceneRef.current = scene

        // Scene will be built in the effect that watches rootNode/selectedNodes
        console.log('Scene created, waiting for node data...')

        // Create Terminal 2D renderer for ASCII grid mode
        // Use large grid (200x150) to support workspace expansion around game bounds
        const terminal2D = new Terminal2DRenderer({
          cellWidth: 12,
          cellHeight: 20,
        })
        await terminal2D.init(renderer.device!, renderer.context!, renderer.format)
        terminal2DRef.current = terminal2D

        // Load initial tilemap into terminal and center it
        loadTilemapToTerminal(terminal2D, true)

        // Initialize post-processing pipeline
        const postProcess = new PostProcessPipeline(renderer.device!, renderer.format)
        await postProcess.init()
        postProcessRef.current = postProcess

        console.log('[WebGPUViewport] Terminal2D and PostProcessPipeline initialized')

        setLoading(false)

        // Start render loop
        function animate() {
          if (!mounted) return

          const now = performance.now()
          const deltaTime = (now - lastTime) / 1000
          lastTime = now

          // Update FPS counter
          frameCount++
          fpsUpdateTime += deltaTime
          if (fpsUpdateTime >= 0.5) {
            setFps(Math.round(frameCount / fpsUpdateTime))
            frameCount = 0
            fpsUpdateTime = 0
          }

          // Handle keyboard input and update camera
          if (cameraRef.current) {
            if (cameraModeRef.current === '2d') {
              // 2D mode: WASD for panning
              const panSpeed = cameraRef.current.orthoSize * 2 * deltaTime
              let panX = 0, panZ = 0

              if (keysRef.current.has('w')) panZ -= panSpeed
              if (keysRef.current.has('s')) panZ += panSpeed
              if (keysRef.current.has('a')) panX -= panSpeed
              if (keysRef.current.has('d')) panX += panSpeed

              // Shift for faster panning
              if (keysRef.current.has('shift')) {
                panX *= 3
                panZ *= 3
              }

              if (panX !== 0 || panZ !== 0) {
                cameraRef.current.pan2D(panX, panZ)
              }
            } else {
              // 3D mode: WASD for movement
              const moveSpeed = 10 * deltaTime
              let forward = 0, right = 0, up = 0

              if (keysRef.current.has('w')) forward += moveSpeed
              if (keysRef.current.has('s')) forward -= moveSpeed
              if (keysRef.current.has('a')) right += moveSpeed
              if (keysRef.current.has('d')) right -= moveSpeed

              // Q/E for up/down
              if (keysRef.current.has('q')) up -= moveSpeed
              if (keysRef.current.has('e')) up += moveSpeed

              // Shift for faster movement
              if (keysRef.current.has('shift')) {
                forward *= 3
                right *= 3
                up *= 3
              }

              if (forward !== 0 || right !== 0 || up !== 0) {
                cameraRef.current.move(forward, right, up)
              }
            }

            // Update camera
            cameraRef.current.update(deltaTime)
          }

          // Update scene - check if rebuild needed (reactive via subscriptions)
          if (sceneRef.current) {
            sceneRef.current.update(deltaTime)

            // Check if scene needs rebuild (set by subscription callback)
            if (sceneRef.current.needsSceneRebuild()) {
              sceneRef.current.rebuildFromCachedEntities()
            }
          }

          // Render based on camera mode
          if (cameraModeRef.current === '2d' && terminal2DRef.current && rendererRef.current) {
            // Refresh terminal if marked dirty (deferred from useEffect to prevent flickering)
            if (terminalNeedsRefreshRef.current) {
              terminalNeedsRefreshRef.current = false
              loadTilemapToTerminal(terminal2DRef.current)
            }

            // Update zoom animation (smooth eased transition)
            terminal2DRef.current.updateZoomAnimation(deltaTime)

            // Update time for post-processing effects
            timeRef.current += deltaTime

            // 2D Terminal mode - render ASCII grid with post-processing
            const device = rendererRef.current.device!
            const encoder = device.createCommandEncoder()
            const screenTexture = rendererRef.current.context!.getCurrentTexture()
            const screenView = screenTexture.createView()
            const width = canvas!.width
            const height = canvas!.height

            // Check if post-processing is needed
            const postSettings = globalPostProcessRef.current
            const postProcess = postProcessRef.current
            const needsPostProcess = postSettings.enabled && postSettings.crtEnabled && postProcess

            if (needsPostProcess) {
              // Create or resize intermediate texture if needed
              if (!intermediateTextureRef.current ||
                  intermediateTextureRef.current.width !== width ||
                  intermediateTextureRef.current.height !== height) {
                intermediateTextureRef.current?.destroy()
                intermediateTextureRef.current = device.createTexture({
                  size: { width, height },
                  format: rendererRef.current.format,
                  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                })
              }

              const intermediateView = intermediateTextureRef.current.createView()

              // Render terminal to intermediate texture
              terminal2DRef.current.render(encoder, intermediateView, width, height)

              // Apply post-processing from intermediate to screen
              postProcess.executeStack(
                encoder,
                intermediateView,
                screenView,
                {
                  enabled: postSettings.enabled,
                  crtEnabled: postSettings.crtEnabled,
                  crtSettings: postSettings.crtSettings,
                  effects: postSettings.effects || [],
                  preset: postSettings.preset,
                },
                width,
                height,
                timeRef.current
              )
            } else {
              // No post-processing - render directly to screen
              terminal2DRef.current.render(encoder, screenView, width, height)
            }

            device.queue.submit([encoder.finish()])
          } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
            // 3D mode - render voxels and glyphs
            rendererRef.current.render(sceneRef.current, cameraRef.current)

            // Build bounds array using CACHED bounds (O(1) lookups, not recalculated)
            const bounds: Array<{
              position: [number, number, number]
              scale: [number, number, number]
              color: [number, number, number, number]
            }> = []

            // Add hover bounds from cache (skip floor nodes)
            const hoveredId = hoveredNodeRef.current
            if (hoveredId && !selectedNodesRef.current.includes(hoveredId)) {
              const cachedBounds = boundsCache.current.get(hoveredId)
              const node = normalizedNodesRef.current[hoveredId]
              if (cachedBounds && node && !node.meta?.isFloor) {
                bounds.push({
                  position: cachedBounds.position,
                  scale: cachedBounds.bounds,
                  color: [1.0, 1.0, 1.0, 0.5] // White with alpha for hover
                })
              }
            }

            // Add selection bounds from cache
            const tool = activeToolRef.current
            if (selectedNodesRef.current.length > 0) {
              const selectedId = selectedNodesRef.current[0]
              const cachedBounds = boundsCache.current.get(selectedId)
              if (cachedBounds) {
                bounds.push({
                  position: cachedBounds.position,
                  scale: cachedBounds.bounds,
                  color: [1.0, 1.0, 1.0, 0.8] // White with alpha for selection
                })
              }
            }

            // Render all bounds
            if (bounds.length > 0) {
              rendererRef.current.renderSelectionBounds(cameraRef.current, bounds)
            }

            // Render gizmo if a node is selected (use cached position)
            if (selectedNodesRef.current.length > 0) {
              const selectedId = selectedNodesRef.current[0]
              const cachedBounds = boundsCache.current.get(selectedId)
              if (cachedBounds) {
                const pos = cachedBounds.position
                const gizmoMode = tool === 'select' ? 'move' : tool
                // Gizmo at center of bounding box (offset by half height)
                const gizmoCenter: [number, number, number] = [
                  pos[0],
                  pos[1] + cachedBounds.bounds[1] * 0.5,
                  pos[2]
                ]
                rendererRef.current.renderGizmo(
                  cameraRef.current,
                  gizmoMode,
                  gizmoCenter,
                  gizmoHoveredAxisRef.current
                )
              }
            }
          }

          animationIdRef.current = requestAnimationFrame(animate)
        }

        animate()
      } catch (err) {
        console.error('WebGPU initialization failed:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setLoading(false)
        }
      }
    }

    init()

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1

      if (canvas) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      if (rendererRef.current) {
        rendererRef.current.resize(width * dpr, height * dpr)
      }
    })

    resizeObserver.observe(container)

    return () => {
      mounted = false
      cancelAnimationFrame(animationIdRef.current)
      resizeObserver.disconnect()

      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, []) // No dependencies - init only once

  // Separate effect for event listeners to avoid re-registration
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Add event listeners - use window for drag events to capture outside canvas
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvas.addEventListener('pointerdown', handleMouseDown as EventListener)
    window.addEventListener('pointerup', handleMouseUp as EventListener)
    window.addEventListener('pointermove', handleMouseMove as EventListener)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('pointerdown', handleMouseDown as EventListener)
      window.removeEventListener('pointerup', handleMouseUp as EventListener)
      window.removeEventListener('pointermove', handleMouseMove as EventListener)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleMouseLeave, handleWheel, handleContextMenu])

  // Effect to handle mouse-based prefab drag over scene (bypasses HTML5 drag)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Track mouse over scene during prefab drag
    const handleSceneMouseMove = (e: MouseEvent) => {
      const prefab = useDragState.getState().draggedPrefab
      if (!prefab) return

      // Check if mouse is over the scene canvas
      const rect = container.getBoundingClientRect()
      const isOverScene = e.clientX >= rect.left && e.clientX <= rect.right &&
                          e.clientY >= rect.top && e.clientY <= rect.bottom

      setOverScene(isOverScene)

      // If over scene and in 2D mode, calculate drop target position
      if (isOverScene && cameraModeRef.current === '2d' && terminal2DRef.current) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const cell = terminal2DRef.current.screenToCell(x, y)
        if (cell) {
          const gridSize = terminal2DRef.current.getGridSize()
          const WORLD_ORIGIN_X = Math.floor(gridSize[0] / 2)
          const WORLD_ORIGIN_Y = Math.floor(gridSize[1] / 2)
          const worldX = cell[0] - WORLD_ORIGIN_X
          const worldY = cell[1] - WORLD_ORIGIN_Y
          setSceneDropTarget({ x: worldX, y: worldY })
        }
      } else {
        setSceneDropTarget(null)
      }
    }

    // Handle mouse up over scene to drop prefab
    const handleSceneMouseUp = (e: MouseEvent) => {
      const prefab = useDragState.getState().draggedPrefab
      if (!prefab) return

      // Check if mouse is over the scene canvas
      const rect = container.getBoundingClientRect()
      const isOverScene = e.clientX >= rect.left && e.clientX <= rect.right &&
                          e.clientY >= rect.top && e.clientY <= rect.bottom

      if (isOverScene) {
        console.log('[WebGPUViewport] Mouse up over scene with prefab')
        handleScenePrefabDrop(e.clientX, e.clientY)
      }
    }

    // Handle mouse leave scene to clear overScene
    const handleSceneMouseLeave = () => {
      if (useDragState.getState().draggedPrefab) {
        setOverScene(false)
        setSceneDropTarget(null)
      }
    }

    // Global listeners to track drag over scene
    document.addEventListener('mousemove', handleSceneMouseMove)
    document.addEventListener('mouseup', handleSceneMouseUp)
    container.addEventListener('mouseleave', handleSceneMouseLeave)

    return () => {
      document.removeEventListener('mousemove', handleSceneMouseMove)
      document.removeEventListener('mouseup', handleSceneMouseUp)
      container.removeEventListener('mouseleave', handleSceneMouseLeave)
    }
  }, [setOverScene, setSceneDropTarget, handleScenePrefabDrop])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-400 text-lg mb-2">WebGPU Error</div>
          <div className="text-zinc-400 text-sm mb-4">{error}</div>
          <div className="text-zinc-500 text-xs">
            Make sure you're using a browser that supports WebGPU
            (Chrome 113+, Edge 113+, or Firefox Nightly with flags enabled)
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full min-h-0 ${className}`}
      onDrop={handlePrefabDrop}
      onDragOver={handleDragOver}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
        onDrop={handlePrefabDrop}
        onDragOver={handleDragOver}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-zinc-400">Initializing WebGPU...</div>
        </div>
      )}

      {/* FPS counter */}
      {!loading && !error && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {fps} FPS
        </div>
      )}

      {/* Prefab drag indicator over scene */}
      {draggedPrefab && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: '2px dashed rgba(100, 200, 255, 0.6)',
            backgroundColor: 'rgba(100, 200, 255, 0.05)',
          }}
        >
          {prefabOverScene && sceneDropTarget && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-cyan-300 text-xs px-3 py-1.5 rounded">
              Drop to place at ({sceneDropTarget.x}, {sceneDropTarget.y})
            </div>
          )}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-600 rounded shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation()
              // Start lasso selection at this cell
              const [cellX, cellY] = contextMenu.cell
              setPathRef.current(['editor2D', 'selection'], { x1: cellX, y1: cellY, x2: cellX, y2: cellY }, 'Start selection')
              terminal2DRef.current?.setSelection(cellX, cellY, cellX, cellY)
              setContextMenu(null)
            }}
          >
            Select Rectangle
          </button>
          {selection2D && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation()
                selectionToNode()
                setContextMenu(null)
              }}
            >
              Create Node from Selection
            </button>
          )}
          <div className="border-t border-zinc-600 my-1" />
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation()
              // Center view on clicked cell
              const [cellX, cellY] = contextMenu.cell
              if (terminal2DRef.current && canvasRef.current) {
                const gridSize = terminal2DRef.current.getGridSize()
                const zoom = terminal2DRef.current.getZoom()
                const cellW = 12 * zoom
                const cellH = 20 * zoom
                const centerX = canvasRef.current.width / 2 - cellX * cellW
                const centerY = canvasRef.current.height / 2 - cellY * cellH
                terminal2DRef.current.setViewOffset(centerX, centerY)
              }
              setContextMenu(null)
            }}
          >
            Center View Here
          </button>
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu(null)
          }}
        />
      )}
    </div>
  )
}
