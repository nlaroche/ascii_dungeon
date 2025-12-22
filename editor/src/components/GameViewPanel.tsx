// ═══════════════════════════════════════════════════════════════════════════
// GameViewPanel - Renders the game from the camera's perspective
// Shows exactly what the player would see in-game
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback } from 'react'
import { useEngineState, useTheme, usePlayMode } from '../stores/useEngineState'
import { Terminal2DRenderer } from '../renderer/Terminal2DRenderer'
import { PostProcessPipeline } from '../renderer/PostProcessPipeline'
import { CameraBrain } from '../scripting/components/CameraComponent'
import type { Node } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Debug logging
// ─────────────────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[GVP]'
let instanceCount = 0

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args)
}

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
  const instanceId = useRef(++instanceCount)
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
  const frameCountRef = useRef(0)

  // Play mode state
  const { isPlaying, isPaused, isStopped, isRunning, elapsedTime, frameCount, start, stop, pause, resume } = usePlayMode()

  // Scene data
  const globalPostProcess = useEngineState((s) => s.renderPipeline.globalPostProcess)
  const globalPostProcessRef = useRef(globalPostProcess)

  // Log component mount/unmount
  useEffect(() => {
    log(`#${instanceId.current} MOUNTED`)
    return () => {
      log(`#${instanceId.current} UNMOUNTED`)
    }
  }, [])

  // Keep ref in sync
  useEffect(() => {
    globalPostProcessRef.current = globalPostProcess
  }, [globalPostProcess])

  // Find active camera and its bounds
  const findActiveCamera = useCallback((timestamp: number): CameraBounds | null => {
    const currentRootNode = useEngineState.getState().scene.rootNode
    const entities = useEngineState.getState().entities
    if (!currentRootNode) {
      return null
    }

    // During play mode, use CameraBrain
    if (isRunning) {
      const cameraOutput = CameraBrain.getInstance().update(timestamp)
      const liveCamera = CameraBrain.getInstance().getLiveCamera()
      if (liveCamera) {
        const node = liveCamera.getNode()
        if (node) {
          const normalizedNode = entities.nodes[node.id]
          let width = 40
          let height = 30

          if (normalizedNode) {
            const rect2DId = normalizedNode.componentIds?.find(compId => {
              const comp = entities.components[compId]
              return comp?.script === 'Rect2D' && comp.enabled !== false
            })
            if (rect2DId) {
              const rect2D = entities.components[rect2DId]
              if (rect2D?.properties) {
                width = (rect2D.properties.width as number) ?? 40
                height = (rect2D.properties.height as number) ?? 30
              }
            }
          } else {
            const rectComp = node.components.find(c => c.script === 'Rect2D' && c.enabled !== false)
            if (rectComp?.properties) {
              width = (rectComp.properties.width as number) ?? 40
              height = (rectComp.properties.height as number) ?? 30
            }
          }

          return { x: cameraOutput.x, y: cameraOutput.y, width, height }
        }
      }
    }

    // Fallback: Find camera in scene tree
    const findCamera = (node: Node): CameraBounds | null => {
      const cameraComp = node.components.find(c => c.script === 'Camera' && c.enabled !== false)
      if (cameraComp) {
        const rectComp = node.components.find(c => c.script === 'Rect2D' && c.enabled !== false)
        const x = (rectComp?.properties?.x as number) ?? 0
        const y = (rectComp?.properties?.y as number) ?? 0
        const width = (rectComp?.properties?.width as number) ?? 40
        const height = (rectComp?.properties?.height as number) ?? 30
        return { x, y, width, height }
      }
      for (const child of node.children) {
        const result = findCamera(child)
        if (result) return result
      }
      return null
    }

    return findCamera(currentRootNode)
  }, [isRunning])

  // Pack RGB color to uint32
  const packColor = (rgb: [number, number, number]): number => {
    const r = Math.floor(rgb[0] * 255) & 0xFF
    const g = Math.floor(rgb[1] * 255) & 0xFF
    const b = Math.floor(rgb[2] * 255) & 0xFF
    return (255 << 24) | (b << 16) | (g << 8) | r
  }

  // Load scene into terminal
  const loadSceneToTerminal = useCallback((terminal: Terminal2DRenderer, cameraBounds: CameraBounds, isCentered: boolean) => {
    const currentRootNode = useEngineState.getState().scene.rootNode
    if (!currentRootNode) return 0

    terminal.clear()
    const [gridWidth, gridHeight] = terminal.getGridSize()
    let cellCount = 0

    let visibleMinX: number, visibleMaxX: number, visibleMinY: number, visibleMaxY: number
    let offsetX: number, offsetY: number

    if (isCentered) {
      const halfWidth = Math.floor(cameraBounds.width / 2)
      const halfHeight = Math.floor(cameraBounds.height / 2)
      visibleMinX = cameraBounds.x - halfWidth
      visibleMaxX = cameraBounds.x + halfWidth
      visibleMinY = cameraBounds.y - halfHeight
      visibleMaxY = cameraBounds.y + halfHeight
      offsetX = -visibleMinX
      offsetY = -visibleMinY
    } else {
      visibleMinX = cameraBounds.x
      visibleMaxX = cameraBounds.x + cameraBounds.width
      visibleMinY = cameraBounds.y
      visibleMaxY = cameraBounds.y + cameraBounds.height
      offsetX = -cameraBounds.x
      offsetY = -cameraBounds.y
    }

    const processNode = (node: Node) => {
      if (node.meta?.disabled) return

      const rectComp = node.components.find(c => c.script === 'Rect2D' && c.enabled !== false)
      if (!rectComp) {
        node.children.forEach(processNode)
        return
      }

      const nodeX = (rectComp.properties?.x as number) ?? 0
      const nodeY = (rectComp.properties?.y as number) ?? 0
      const nodeWidth = (rectComp.properties?.width as number) ?? 1
      const nodeHeight = (rectComp.properties?.height as number) ?? 1

      if (nodeX + nodeWidth < visibleMinX || nodeX > visibleMaxX ||
          nodeY + nodeHeight < visibleMinY || nodeY > visibleMaxY) {
        node.children.forEach(processNode)
        return
      }

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
                if (worldX >= visibleMinX && worldX < visibleMaxX &&
                    worldY >= visibleMinY && worldY < visibleMaxY) {
                  const gridX = Math.floor(worldX + offsetX)
                  const gridY = Math.floor(worldY + offsetY)
                  if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                    terminal.setCell(gridX, gridY, char)
                    cellCount++
                  }
                }
              }
            }
          })
        }
      }

      const glyphComp = node.components.find(c => c.script === 'Glyph' && c.enabled !== false)
      if (glyphComp && !glyphMapComp) {
        const char = (glyphComp.properties?.char as string) ?? '@'
        const fg = glyphComp.properties?.fg as [number, number, number] | undefined
        const bg = glyphComp.properties?.bg as [number, number, number] | undefined
        const emission = (glyphComp.properties?.emission as number) ?? 0

        if (nodeX >= visibleMinX && nodeX < visibleMaxX &&
            nodeY >= visibleMinY && nodeY < visibleMaxY) {
          const gridX = Math.floor(nodeX + offsetX)
          const gridY = Math.floor(nodeY + offsetY)
          if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
            const fgColor = fg ? packColor(fg) : undefined
            const bgColor = bg ? packColor(bg) : undefined
            terminal.setCell(gridX, gridY, char, fgColor, bgColor, 0, emission)
            cellCount++
          }
        }
      }

      node.children.forEach(processNode)
    }

    processNode(currentRootNode)
    return cellCount
  }, [])

  // Initialize WebGPU
  useEffect(() => {
    log(`#${instanceId.current} INIT EFFECT START`)
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas) {
      log(`#${instanceId.current} INIT: canvas is null`)
      return
    }
    if (!container) {
      log(`#${instanceId.current} INIT: container is null`)
      return
    }

    let mounted = true
    let initAttemptId: number | null = null

    const tryInit = async () => {
      const rect = container.getBoundingClientRect()
      log(`#${instanceId.current} INIT: container rect = ${rect.width}x${rect.height}`)

      if (rect.width <= 0 || rect.height <= 0) {
        initAttemptId = requestAnimationFrame(tryInit)
        return
      }

      if (!navigator.gpu) {
        log(`#${instanceId.current} INIT: WebGPU not supported`)
        return
      }

      log(`#${instanceId.current} INIT: requesting adapter...`)
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter || !mounted) {
        log(`#${instanceId.current} INIT: no adapter or unmounted`)
        return
      }

      log(`#${instanceId.current} INIT: requesting device...`)
      const device = await adapter.requestDevice()
      if (!mounted) return

      log(`#${instanceId.current} INIT: getting webgpu context...`)
      const context = canvas.getContext('webgpu')
      if (!context) {
        log(`#${instanceId.current} INIT: no WebGPU context`)
        return
      }

      const width = Math.floor(rect.width * devicePixelRatio)
      const height = Math.floor(rect.height * devicePixelRatio)
      canvas.width = width
      canvas.height = height
      log(`#${instanceId.current} INIT: canvas size = ${width}x${height}`)

      const format = navigator.gpu.getPreferredCanvasFormat()
      context.configure({ device, format, alphaMode: 'premultiplied' })
      log(`#${instanceId.current} INIT: context configured`)

      if (!mounted) return

      gpuRef.current = { device, context }

      log(`#${instanceId.current} INIT: creating terminal...`)
      const terminal = new Terminal2DRenderer()
      await terminal.init(device, context, format)
      terminalRef.current = terminal
      log(`#${instanceId.current} INIT: terminal created`)

      log(`#${instanceId.current} INIT: creating post-process...`)
      const postProcess = new PostProcessPipeline(device, format)
      await postProcess.init()
      postProcessRef.current = postProcess
      log(`#${instanceId.current} INIT: post-process created`)

      lastValidSizeRef.current = { width, height }
      isInitializedRef.current = true
      log(`#${instanceId.current} INIT: COMPLETE - isInitialized=true`)
    }

    tryInit()

    return () => {
      log(`#${instanceId.current} INIT EFFECT CLEANUP`)
      mounted = false
      isInitializedRef.current = false
      if (initAttemptId) cancelAnimationFrame(initAttemptId)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
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
    log(`#${instanceId.current} RENDER LOOP EFFECT START`)

    const render = (timestamp: number) => {
      frameCountRef.current++
      const frame = frameCountRef.current

      // Log every 60 frames
      if (frame % 60 === 1) {
        log(`#${instanceId.current} FRAME ${frame}: init=${isInitializedRef.current}, gpu=${!!gpuRef.current}, terminal=${!!terminalRef.current}`)
      }

      if (!isInitializedRef.current) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      const gpu = gpuRef.current
      const terminal = terminalRef.current
      const canvas = canvasRef.current
      const container = containerRef.current

      if (!gpu || !terminal || !canvas || !container) {
        if (frame % 60 === 1) {
          log(`#${instanceId.current} FRAME ${frame}: missing refs - gpu=${!!gpu} terminal=${!!terminal} canvas=${!!canvas} container=${!!container}`)
        }
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      const { device, context } = gpu
      const cameraBounds = findActiveCamera(timestamp)

      if (!cameraBounds) {
        if (frame % 60 === 1) {
          log(`#${instanceId.current} FRAME ${frame}: no camera bounds`)
        }
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      if (frame === 1) {
        log(`#${instanceId.current} FIRST FRAME: cameraBounds =`, cameraBounds)
      }

      const rect = container.getBoundingClientRect()
      let width = Math.floor(rect.width * devicePixelRatio)
      let height = Math.floor(rect.height * devicePixelRatio)

      if (width <= 0 || height <= 0) {
        if (lastValidSizeRef.current.width > 0 && lastValidSizeRef.current.height > 0) {
          width = lastValidSizeRef.current.width
          height = lastValidSizeRef.current.height
        } else {
          animationFrameRef.current = requestAnimationFrame(render)
          return
        }
      } else {
        lastValidSizeRef.current = { width, height }
      }

      if ((canvas.width !== width || canvas.height !== height) && width > 0 && height > 0) {
        canvas.width = width
        canvas.height = height
        context.configure({
          device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: 'premultiplied',
        })
      }

      timeRef.current += 1/60

      const playModeState = useEngineState.getState().playMode
      const isInPlayMode = playModeState.status === 'playing' || playModeState.status === 'paused'

      if (frame === 1) {
        log(`#${instanceId.current} FIRST FRAME: playMode=${playModeState.status}, isInPlayMode=${isInPlayMode}`)
      }

      terminal.setGameBounds(0, 0, cameraBounds.width, cameraBounds.height)
      terminal.centerOnBounds(width, height, {
        x: 0,
        y: 0,
        width: cameraBounds.width,
        height: cameraBounds.height
      })

      // In play mode, use camera-centered coordinates
      const cellCount = loadSceneToTerminal(terminal, cameraBounds, isInPlayMode)

      if (frame === 1) {
        log(`#${instanceId.current} FIRST FRAME: loaded ${cellCount} cells, playMode=${isInPlayMode}`)
      }

      const encoder = device.createCommandEncoder()
      const postProcess = postProcessRef.current
      const postSettings = globalPostProcessRef.current
      const needsPostProcess = postSettings?.enabled && postSettings?.crtEnabled && postProcess

      let targetView: GPUTextureView

      if (needsPostProcess && width > 0 && height > 0) {
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
        if (canvas.width <= 0 || canvas.height <= 0) {
          animationFrameRef.current = requestAnimationFrame(render)
          return
        }
        targetView = context.getCurrentTexture().createView()
      }

      terminal.render(encoder, targetView, width, height)

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

      if (frame === 1) {
        log(`#${instanceId.current} FIRST FRAME: GPU submit complete`)
      }

      animationFrameRef.current = requestAnimationFrame(render)
    }

    animationFrameRef.current = requestAnimationFrame(render)

    return () => {
      log(`#${instanceId.current} RENDER LOOP EFFECT CLEANUP`)
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
        {findActiveCamera(performance.now()) && (
          <span className="text-xs" style={{ color: theme.textMuted }}>
            Camera: {findActiveCamera(performance.now())?.width}x{findActiveCamera(performance.now())?.height}
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
