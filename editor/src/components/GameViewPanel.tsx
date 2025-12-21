// ═══════════════════════════════════════════════════════════════════════════
// GameViewPanel - Renders the game from the camera's perspective
// Shows exactly what the player would see in-game
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'react'
import { useEngineState, useTheme, usePlayMode } from '../stores/useEngineState'
import { Terminal2DRenderer } from '../renderer/Terminal2DRenderer'
import { PostProcessPipeline } from '../renderer/PostProcessPipeline'
import type { Node, Component } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CameraBounds {
  x: number
  y: number
  width: number
  height: number
}

// ─────────────────────────────────────────────────────────────────────────────
// GameViewPanel Component
// ─────────────────────────────────────────────────────────────────────────────

export function GameViewPanel() {
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal2DRenderer | null>(null)
  const postProcessRef = useRef<PostProcessPipeline | null>(null)
  const intermediateTextureRef = useRef<GPUTexture | null>(null)
  const gpuRef = useRef<{ device: GPUDevice; context: GPUCanvasContext } | null>(null)
  const animationFrameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const isInitializedRef = useRef(false)
  const lastValidSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  // Play mode state
  const { isPlaying, isPaused, isStopped, isRunning, elapsedTime, frameCount, start, stop, pause, resume } = usePlayMode()

  // Scene data
  const rootNode = useEngineState((s) => s.scene.rootNode)
  const globalPostProcess = useEngineState((s) => s.renderPipeline.globalPostProcess)
  const globalPostProcessRef = useRef(globalPostProcess)


  // Keep ref in sync
  useEffect(() => {
    globalPostProcessRef.current = globalPostProcess
  }, [globalPostProcess])

  // Find active camera and its bounds
  // Note: We read directly from store to ensure we get latest state during animation loop
  const findActiveCamera = useCallback((): CameraBounds | null => {
    const currentRootNode = useEngineState.getState().scene.rootNode
    if (!currentRootNode) return null

    const findCamera = (node: Node): CameraBounds | null => {
      // Check if this node has a Camera component
      const cameraComp = node.components.find(c => c.script === 'Camera' && c.enabled !== false)
      if (cameraComp) {
        // Get camera bounds from Rect2D - this defines the camera viewport area
        const rectComp = node.components.find(c => c.script === 'Rect2D' && c.enabled !== false)

        // The Rect2D x,y,width,height directly defines the camera's view bounds
        const x = (rectComp?.properties?.x as number) ?? 0
        const y = (rectComp?.properties?.y as number) ?? 0
        const width = (rectComp?.properties?.width as number) ?? 40
        const height = (rectComp?.properties?.height as number) ?? 30

        return { x, y, width, height }
      }

      // Check children
      for (const child of node.children) {
        const result = findCamera(child)
        if (result) return result
      }
      return null
    }

    return findCamera(currentRootNode)
  }, [])

  // Pack RGB color to uint32
  const packColor = (rgb: [number, number, number]): number => {
    const r = Math.floor(rgb[0] * 255) & 0xFF
    const g = Math.floor(rgb[1] * 255) & 0xFF
    const b = Math.floor(rgb[2] * 255) & 0xFF
    return (255 << 24) | (b << 16) | (g << 8) | r
  }

  // Load scene into terminal (camera-clipped)
  // Note: We read directly from store to ensure we get latest state during animation loop
  const loadSceneToTerminal = useCallback((terminal: Terminal2DRenderer, cameraBounds: CameraBounds) => {
    const currentRootNode = useEngineState.getState().scene.rootNode
    if (!currentRootNode) return

    terminal.clear()

    // Calculate grid offset - camera bounds define what we see
    const offsetX = -cameraBounds.x
    const offsetY = -cameraBounds.y

    const [gridWidth, gridHeight] = terminal.getGridSize()

    const processNode = (node: Node) => {
      // Skip disabled nodes
      if (node.meta?.disabled) return

      // Get Rect2D for position
      const rectComp = node.components.find(c => c.script === 'Rect2D' && c.enabled !== false)
      if (!rectComp) {
        // Process children anyway
        node.children.forEach(processNode)
        return
      }

      const nodeX = (rectComp.properties?.x as number) ?? 0
      const nodeY = (rectComp.properties?.y as number) ?? 0

      // Check if node is within camera bounds
      const nodeWidth = (rectComp.properties?.width as number) ?? 1
      const nodeHeight = (rectComp.properties?.height as number) ?? 1

      // Skip if completely outside camera
      if (nodeX + nodeWidth < cameraBounds.x ||
          nodeX > cameraBounds.x + cameraBounds.width ||
          nodeY + nodeHeight < cameraBounds.y ||
          nodeY > cameraBounds.y + cameraBounds.height) {
        node.children.forEach(processNode)
        return
      }

      // Handle GlyphMap component
      const glyphMapComp = node.components.find(c => c.script === 'GlyphMap' && c.enabled !== false)
      if (glyphMapComp) {
        const cells = glyphMapComp.properties?.cells as string
        if (cells) {
          const lines = cells.split('\n')
          lines.forEach((line, dy) => {
            for (let dx = 0; dx < line.length; dx++) {
              const char = line[dx]
              if (char && char !== ' ') {
                const worldX = nodeX + dx
                const worldY = nodeY + dy
                // Check if this cell is in camera bounds
                if (worldX >= cameraBounds.x && worldX < cameraBounds.x + cameraBounds.width &&
                    worldY >= cameraBounds.y && worldY < cameraBounds.y + cameraBounds.height) {
                  const gridX = Math.floor(worldX + offsetX)
                  const gridY = Math.floor(worldY + offsetY)
                  if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                    terminal.setCell(gridX, gridY, char)
                  }
                }
              }
            }
          })
        }
      }

      // Handle Glyph component
      const glyphComp = node.components.find(c => c.script === 'Glyph' && c.enabled !== false)
      if (glyphComp && !glyphMapComp) {
        const char = (glyphComp.properties?.char as string) ?? '@'
        const fg = glyphComp.properties?.fg as [number, number, number] | undefined
        const bg = glyphComp.properties?.bg as [number, number, number] | undefined
        const emission = (glyphComp.properties?.emission as number) ?? 0

        // Check if in camera bounds
        if (nodeX >= cameraBounds.x && nodeX < cameraBounds.x + cameraBounds.width &&
            nodeY >= cameraBounds.y && nodeY < cameraBounds.y + cameraBounds.height) {
          const gridX = Math.floor(nodeX + offsetX)
          const gridY = Math.floor(nodeY + offsetY)
          if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            const fgColor = fg ? packColor(fg) : undefined
            const bgColor = bg ? packColor(bg) : undefined
            terminal.setCell(gridX, gridY, char, fgColor, bgColor, 0, emission)
          }
        }
      }

      // Process children
      node.children.forEach(processNode)
    }

    processNode(currentRootNode)
  }, [])

  // Initialize WebGPU - wait for container to have valid size
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let mounted = true
    let initAttemptId: number | null = null

    const tryInit = async () => {
      // Wait until container has valid dimensions
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        // Retry next frame
        initAttemptId = requestAnimationFrame(tryInit)
        return
      }

      if (!navigator.gpu) {
        console.error('[GameView] WebGPU not supported')
        return
      }

      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter || !mounted) return

      const device = await adapter.requestDevice()
      if (!mounted) return

      const context = canvas.getContext('webgpu')
      if (!context) {
        console.error('[GameView] No WebGPU context')
        return
      }

      // Set canvas size before configuring
      const width = Math.floor(rect.width * devicePixelRatio)
      const height = Math.floor(rect.height * devicePixelRatio)
      canvas.width = width
      canvas.height = height

      const format = navigator.gpu.getPreferredCanvasFormat()
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      })

      if (!mounted) return

      gpuRef.current = { device, context }

      // Initialize terminal renderer
      try {
        const terminal = new Terminal2DRenderer()
        await terminal.init(device, context, format)
        terminalRef.current = terminal
      } catch (err) {
        console.error('[GameView] Terminal init failed:', err)
        return
      }

      // Initialize post-process pipeline
      try {
        const postProcess = new PostProcessPipeline(device, format)
        await postProcess.init()
        postProcessRef.current = postProcess
      } catch (err) {
        console.error('[GameView] PostProcess init failed:', err)
      }

      // Store the valid size we initialized with
      lastValidSizeRef.current = { width, height }
      isInitializedRef.current = true
    }

    tryInit()

    return () => {
      mounted = false
      isInitializedRef.current = false
      if (initAttemptId) {
        cancelAnimationFrame(initAttemptId)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (intermediateTextureRef.current) {
        intermediateTextureRef.current.destroy()
        intermediateTextureRef.current = null
      }
      terminalRef.current?.destroy()
      terminalRef.current = null
      gpuRef.current = null
    }
  }, [])

  // Render loop
  useEffect(() => {
    const render = () => {
      // Wait for initialization to complete
      if (!isInitializedRef.current) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      const gpu = gpuRef.current
      const terminal = terminalRef.current
      const canvas = canvasRef.current
      const container = containerRef.current

      if (!gpu || !terminal || !canvas || !container) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      const { device, context } = gpu
      const cameraBounds = findActiveCamera()

      if (!cameraBounds) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Get current container size
      const rect = container.getBoundingClientRect()
      let width = Math.floor(rect.width * devicePixelRatio)
      let height = Math.floor(rect.height * devicePixelRatio)

      // If current size is invalid, use last valid size (or skip)
      if (width <= 0 || height <= 0) {
        if (lastValidSizeRef.current.width > 0 && lastValidSizeRef.current.height > 0) {
          // Use last valid size to avoid 0-size textures
          width = lastValidSizeRef.current.width
          height = lastValidSizeRef.current.height
        } else {
          // No valid size yet, skip
          animationFrameRef.current = requestAnimationFrame(render)
          return
        }
      } else {
        // Update last valid size
        lastValidSizeRef.current = { width, height }
      }

      // Resize canvas if needed (only if size changed and is valid)
      if ((canvas.width !== width || canvas.height !== height) && width > 0 && height > 0) {
        canvas.width = width
        canvas.height = height
        context.configure({
          device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: 'premultiplied',
        })
      }

      // Update time
      timeRef.current += 1/60

      // Set game bounds so terminal knows what to render
      terminal.setGameBounds(0, 0, cameraBounds.width, cameraBounds.height)

      // Center view on the camera area
      terminal.centerOnBounds(width, height, {
        x: 0,
        y: 0,
        width: cameraBounds.width,
        height: cameraBounds.height
      })

      // Load scene data clipped to camera
      loadSceneToTerminal(terminal, cameraBounds)

      // Create command encoder
      const encoder = device.createCommandEncoder()

      // Check if we need post-processing
      const postProcess = postProcessRef.current
      const postSettings = globalPostProcessRef.current
      const needsPostProcess = postSettings?.enabled && postSettings?.crtEnabled && postProcess

      let targetView: GPUTextureView

      if (needsPostProcess && width > 0 && height > 0) {
        // Ensure intermediate texture exists with valid dimensions
        if (!intermediateTextureRef.current ||
            intermediateTextureRef.current.width !== width ||
            intermediateTextureRef.current.height !== height) {
          intermediateTextureRef.current?.destroy()
          intermediateTextureRef.current = device.createTexture({
            size: { width, height },
            format: navigator.gpu.getPreferredCanvasFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          })
        }
        targetView = intermediateTextureRef.current.createView()
      } else {
        // Only get swapchain texture if canvas has valid size
        if (canvas.width <= 0 || canvas.height <= 0) {
          animationFrameRef.current = requestAnimationFrame(render)
          return
        }
        targetView = context.getCurrentTexture().createView()
      }

      // Render terminal
      terminal.render(encoder, targetView, width, height)

      // Apply post-processing
      if (needsPostProcess && postProcess && intermediateTextureRef.current) {
        const screenView = context.getCurrentTexture().createView()
        postProcess.executeStack(
          encoder,
          intermediateTextureRef.current.createView(),
          screenView,
          postSettings!,
          width,
          height,
          timeRef.current
        )
      }

      device.queue.submit([encoder.finish()])

      animationFrameRef.current = requestAnimationFrame(render)
    }

    animationFrameRef.current = requestAnimationFrame(render)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [findActiveCamera, loadSceneToTerminal])

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: theme.bg }}>
      {/* Toolbar */}
      <div
        className="h-10 flex items-center gap-2 px-3 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {/* Play controls */}
        <div className="flex items-center gap-1">
          {isStopped ? (
            <button
              onClick={start}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: theme.success, color: theme.bg }}
              title="Play (F5)"
            >
              Play
            </button>
          ) : isPlaying ? (
            <button
              onClick={pause}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: theme.warning, color: theme.bg }}
              title="Pause (F6)"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={resume}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: theme.success, color: theme.bg }}
              title="Resume (F6)"
            >
              Resume
            </button>
          )}
          <button
            onClick={() => stop(false)}
            disabled={isStopped}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: isStopped ? theme.bgHover : theme.error,
              color: isStopped ? theme.textDim : theme.bg,
              opacity: isStopped ? 0.5 : 1,
            }}
            title="Stop (F8)"
          >
            Stop
          </button>
        </div>

        <div className="w-px h-5" style={{ backgroundColor: theme.border }} />

        {/* Status indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs" style={{ color: theme.textMuted }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isPlaying ? theme.success : theme.warning,
                animation: isPlaying ? 'pulse 1s infinite' : 'none',
              }}
            />
            <span style={{ color: theme.text }}>{formatTime(elapsedTime)}</span>
            <span>F{frameCount}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Camera info */}
        {findActiveCamera() && (
          <span className="text-xs" style={{ color: theme.textMuted }}>
            Camera: {findActiveCamera()?.width}x{findActiveCamera()?.height}
          </span>
        )}
      </div>

      {/* Game viewport */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Overlay when stopped */}
        {isStopped && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          >
            <div className="text-center">
              <div className="text-4xl mb-4" style={{ color: theme.accent }}>
                Game
              </div>
              <div className="text-sm mb-4" style={{ color: theme.textMuted }}>
                Press Play to start the game
              </div>
              <button
                onClick={start}
                className="px-6 py-2 rounded font-medium transition-colors"
                style={{ backgroundColor: theme.success, color: theme.bg }}
              >
                Play
              </button>
            </div>
          </div>
        )}

        {/* Paused overlay */}
        {isPaused && (
          <div
            className="absolute top-2 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded"
            style={{ backgroundColor: theme.warning, color: theme.bg }}
          >
            <span className="text-xs font-medium">PAUSED</span>
          </div>
        )}
      </div>

      {/* Pulse animation CSS */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default GameViewPanel
