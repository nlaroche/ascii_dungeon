// WebGPU Viewport - React component for the voxel renderer

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebGPURenderer, Camera, createDemoScene, Scene } from '../renderer'

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

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fps, setFps] = useState(0)

  // Handle keyboard input - only when not typing in an input
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
    keysRef.current.add(e.key.toLowerCase())
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Always remove key from set on keyup to prevent stuck keys
    keysRef.current.delete(e.key.toLowerCase())
  }, [])

  // Handle mouse input
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) { // Left or right click
      isDraggingRef.current = true
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    // Stop camera movement immediately when mouse released
    if (cameraRef.current) {
      cameraRef.current.stop()
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !cameraRef.current) return

    const dx = e.clientX - lastMouseRef.current.x
    const dy = e.clientY - lastMouseRef.current.y
    lastMouseRef.current = { x: e.clientX, y: e.clientY }

    // Rotate camera with mouse drag
    const sensitivity = 0.003
    cameraRef.current.rotate(-dx * sensitivity, -dy * sensitivity)
  }, [])

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
        camera.lookAt(5, 0, 5)
        cameraRef.current = camera

        // Create scene
        const scene = createDemoScene()
        sceneRef.current = scene

        // Debug: log instance counts
        console.log('Scene created:')
        console.log('  Total instances:', scene.getInstanceCount())
        console.log('  Non-water instances:', scene.getNonWaterInstanceCount())
        console.log('  Water instances:', scene.getWaterInstanceCount())

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

          // Update scene animation
          if (sceneRef.current) {
            sceneRef.current.update(deltaTime)
          }

          // Render
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current)
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

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

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

      // Remove event listeners
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)

      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleWheel, handleContextMenu])

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

      {/* FPS counter and controls hint */}
      {!loading && !error && (
        <>
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {fps} FPS
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-60">
            WASD: Move | Q/E: Up/Down | Drag: Look | Scroll: Forward | Shift: Fast
          </div>
        </>
      )}
    </div>
  )
}
