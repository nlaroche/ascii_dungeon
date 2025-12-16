// WebGPU Viewport - React component for the voxel renderer
// Uses subscription system for reactive updates

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebGPURenderer, Camera, Scene, Raycaster, GizmoInteraction } from '../renderer'
import type { GizmoMode, GizmoAxis } from '../renderer'
import { useEngineState, useNormalizedEntities } from '../stores/useEngineState'
import type { Node, NormalizedNode, Transform } from '../stores/engineState'
import { entitySubscriptions } from '../stores/subscriptions'

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

  // Input state
  const keysRef = useRef<Set<string>>(new Set())
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const clickStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastHoverCheckRef = useRef<number>(0)
  const hoverThrottleMs = 50 // Check hover every 50ms
  const clickThreshold = 5 // pixels - max movement to count as click
  const pointerCaptureElementRef = useRef<HTMLCanvasElement | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fps, setFps] = useState(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

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
  const toolSettingsRef = useRef(toolSettings)
  const normalizedNodesRef = useRef(normalizedNodes)

  // Keep refs in sync SYNCHRONOUSLY - useEffect is too slow for animation loop
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

    // Tool shortcuts
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

      // Left mouse button (1) = rotate, Right mouse button (2) = pan
      if (e.buttons === 1) {
        // Rotate camera with mouse drag
        const sensitivity = 0.003
        cameraRef.current.rotate(-dx * sensitivity, -dy * sensitivity)
      } else if (e.buttons === 2) {
        // Pan camera (right/up movement)
        const panSpeed = 0.02
        cameraRef.current.move(0, dx * panSpeed, -dy * panSpeed)
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
    if (!cameraRef.current) return

    // Scroll to move forward/back
    const moveAmount = -e.deltaY * 0.02
    cameraRef.current.move(moveAmount, 0, 0)
  }, [])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault() // Prevent right-click menu
  }, [])

  const handleMouseLeave = useCallback(() => {
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

  // Sync state to refs for render loop
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

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
            const moveSpeed = 10 * deltaTime
            let forward = 0, right = 0, up = 0

            // WASD movement
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

          // Render
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
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
    <div ref={containerRef} className={`relative h-full w-full min-h-0 ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <div className="text-zinc-400">Initializing WebGPU...</div>
        </div>
      )}

      {/* FPS counter, tool indicator, and controls hint */}
      {!loading && !error && (
        <>
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {fps} FPS
          </div>
          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex gap-2">
            <span className={activeTool === 'select' ? 'text-cyan-400' : 'opacity-50'}>V:Select</span>
            <span className={activeTool === 'move' ? 'text-cyan-400' : 'opacity-50'}>G:Move</span>
            <span className={activeTool === 'rotate' ? 'text-cyan-400' : 'opacity-50'}>R:Rotate</span>
            <span className={activeTool === 'scale' ? 'text-cyan-400' : 'opacity-50'}>T:Scale</span>
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-60">
            WASD: Move | Q/E: Up/Down | LMB: Look | RMB: Pan | Scroll: Forward | Shift: Fast
          </div>
        </>
      )}
    </div>
  )
}
