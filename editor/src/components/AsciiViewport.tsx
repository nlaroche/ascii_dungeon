// ═══════════════════════════════════════════════════════════════════════════
// ASCII Viewport - 2D Grid-based ASCII Scene Editor
// Pure character grid rendering with draw/select/move/erase tools
// Based on the draw-to-node workflow from ascii-scene-editor-spec.md
// For 3D view with post-processing, use WebGPUViewport
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useEngineState } from '../stores/useEngineState'
import { useTheme, useSelection, useNodes } from '../stores/useEngineState'
import type { Node } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Cell {
  char: string
  fg: string
  bg: string
}

interface Selection {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Tool = 'draw' | 'select' | 'move' | 'erase'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GRID_WIDTH = 60
const GRID_HEIGHT = 24
const CELL_WIDTH = 10
const CELL_HEIGHT = 18

const PRESETS = {
  wall: { char: '#', fg: '#888888' },
  floor: { char: '.', fg: '#444444' },
  grass: { char: ',', fg: '#44aa44' },
  water: { char: '~', fg: '#4488ff' },
  tree: { char: '^', fg: '#228822' },
  path: { char: '=', fg: '#996655' },
  door: { char: '+', fg: '#aa8844' },
  player: { char: '@', fg: '#44ff88' },
  enemy: { char: 'g', fg: '#88aa44' },
  treasure: { char: '$', fg: '#ffcc00' },
  stairs: { char: '>', fg: '#aaaaaa' },
}

const COLORS = ['#888888', '#44aa44', '#4488ff', '#ff4444', '#ffff00', '#ffffff', '#ff88ff', '#996655', '#44ff88', '#ffcc00']

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Find tilemap node
// ─────────────────────────────────────────────────────────────────────────────

function findTilemapNode(rootNode: Node): { node: Node | null; index: number } {
  const index = rootNode.children.findIndex(n => n.type === 'tilemap')
  return { node: index >= 0 ? rootNode.children[index] : null, index }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface AsciiViewportProps {
  className?: string
}

export function AsciiViewport({ className = '' }: AsciiViewportProps) {
  const theme = useTheme()
  const setPath = useEngineState((s) => s.setPath)
  const rootNode = useEngineState((s) => s.scene.rootNode)
  const { selection: nodeSelection, selectNode, clearSelection } = useSelection()
  const { getAllNodes } = useNodes()

  // Local state
  const [tool, setTool] = useState<Tool>('draw')
  const [currentChar, setCurrentChar] = useState('#')
  const [currentFg, setCurrentFg] = useState('#888888')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [showGrid, setShowGrid] = useState(true)

  // Zoom/pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const gridRef = useRef<HTMLDivElement>(null)

  // Get tilemap data
  const { node: tilemapNode, index: tilemapIndex } = useMemo(() => findTilemapNode(rootNode), [rootNode])
  const tilemapCells = tilemapNode?.meta?.cells as string | undefined

  // Parse tilemap string into 2D grid
  const baseTilemap = useMemo((): Cell[][] => {
    const cells: Cell[][] = []

    if (tilemapCells) {
      const lines = tilemapCells.split('\n')
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const row: Cell[] = []
        const line = lines[y] || ''
        for (let x = 0; x < GRID_WIDTH; x++) {
          const char = line[x] || ' '
          row.push({
            char,
            fg: char === '#' ? '#888888' : char === '.' ? '#444444' : char === ',' ? '#44aa44' : '#666666',
            bg: '#111111',
          })
        }
        cells.push(row)
      }
    } else {
      // Default tilemap with border
      for (let y = 0; y < GRID_HEIGHT; y++) {
        const row: Cell[] = []
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
            row.push({ char: '#', fg: '#888888', bg: '#111111' })
          } else {
            row.push({ char: ',', fg: '#44aa44', bg: '#111111' })
          }
        }
        cells.push(row)
      }
    }

    return cells
  }, [tilemapCells])

  // Get all sprite/glyph nodes and render them on top of tilemap
  const renderedGrid = useMemo((): Cell[][] => {
    // Start with base tilemap
    const grid = baseTilemap.map(row => row.map(cell => ({ ...cell })))

    // Get sprite nodes from hierarchy (skip tilemap itself)
    const nodes = getAllNodes().filter(n =>
      n.type === 'sprite' || n.type === 'glyph' || n.type === 'entity'
    )

    // Sort by zIndex
    const sortedNodes = nodes
      .filter(n => n.visual?.visible !== false)
      .sort((a, b) => {
        const aZ = (a.meta?.zIndex as number) ?? 0
        const bZ = (b.meta?.zIndex as number) ?? 0
        return aZ - bZ
      })

    // Stamp each node onto the grid
    for (const node of sortedNodes) {
      const pos = node.transform?.position ?? [0, 0, 0]
      const x = Math.round(pos[0])
      const y = Math.round(pos[2]) // Z is row in 2D mode

      if (node.visual?.glyph) {
        // Single glyph
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
          const [r, g, b] = node.visual.color ?? [1, 1, 1]
          grid[y][x] = {
            char: node.visual.glyph,
            fg: `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`,
            bg: grid[y][x].bg,
          }
        }
      } else if (node.meta?.art) {
        // Multi-line sprite
        const lines = (node.meta.art as string).split('\n')
        const fg = (node.meta?.fg as string) || '#ffffff'
        lines.forEach((line, dy) => {
          ;[...line].forEach((char, dx) => {
            if (char !== ' ') {
              const gx = x + dx
              const gy = y + dy
              if (gx >= 0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT) {
                grid[gy][gx] = { char, fg, bg: grid[gy][gx].bg }
              }
            }
          })
        })
      }
    }

    return grid
  }, [baseTilemap, getAllNodes])

  // Get cell coordinates from mouse event
  const getCellCoords = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null

    const cellW = CELL_WIDTH * zoom
    const cellH = CELL_HEIGHT * zoom

    const x = Math.floor((e.clientX - rect.left - pan.x) / cellW)
    const y = Math.floor((e.clientY - rect.top - pan.y) / cellH)

    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return null
    return { x, y }
  }, [zoom, pan])

  // Update tilemap in engine state
  const updateTilemap = useCallback((x: number, y: number, char: string) => {
    if (tilemapIndex < 0) {
      // Create tilemap node if it doesn't exist
      const defaultCells = baseTilemap.map(row => row.map(c => c.char).join('')).join('\n')
      const newTilemap = {
        id: 'tilemap_base',
        name: 'TileMap',
        type: 'tilemap',
        children: [],
        components: [],
        meta: { cells: defaultCells },
      }
      setPath(['scene', 'rootNode', 'children'], [newTilemap, ...rootNode.children], 'Create tilemap')
      return
    }

    // Get current cells
    const currentCells = tilemapCells || baseTilemap.map(row => row.map(c => c.char).join('')).join('\n')
    const lines = currentCells.split('\n')

    // Ensure we have enough lines
    while (lines.length <= y) {
      lines.push(' '.repeat(GRID_WIDTH))
    }

    // Update the character
    const line = lines[y].padEnd(GRID_WIDTH, ' ')
    lines[y] = line.substring(0, x) + char + line.substring(x + 1)

    // Update via setPath
    setPath(
      ['scene', 'rootNode', 'children', tilemapIndex, 'meta', 'cells'],
      lines.join('\n'),
      `Draw '${char}' at (${x}, ${y})`
    )
  }, [tilemapIndex, tilemapCells, baseTilemap, rootNode, setPath])

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle click or Alt+click = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
      return
    }

    const coords = getCellCoords(e)
    if (!coords) return

    if (tool === 'draw') {
      setIsDrawing(true)
      updateTilemap(coords.x, coords.y, currentChar)
    } else if (tool === 'erase') {
      setIsDrawing(true)
      updateTilemap(coords.x, coords.y, '.')
    } else if (tool === 'select') {
      setIsSelecting(true)
      setSelectionStart(coords)
      setSelection({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y })
    } else if (tool === 'move') {
      // Check if clicking on a node
      const nodes = getAllNodes()
      for (const node of nodes) {
        if (node.type === 'sprite' || node.type === 'glyph' || node.type === 'entity') {
          const pos = node.transform?.position ?? [0, 0, 0]
          const nx = Math.round(pos[0])
          const ny = Math.round(pos[2])

          // Simple hit test
          if (coords.x === nx && coords.y === ny) {
            selectNode(node.id)
            setIsDrawing(true)
            return
          }
        }
      }
      clearSelection()
    }
  }, [tool, currentChar, getCellCoords, updateTilemap, pan, getAllNodes, selectNode, clearSelection])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }

    const coords = getCellCoords(e)
    if (!coords) return

    if (isDrawing && tool === 'draw') {
      updateTilemap(coords.x, coords.y, currentChar)
    } else if (isDrawing && tool === 'erase') {
      updateTilemap(coords.x, coords.y, '.')
    } else if (isSelecting && selectionStart) {
      setSelection({
        x1: Math.min(selectionStart.x, coords.x),
        y1: Math.min(selectionStart.y, coords.y),
        x2: Math.max(selectionStart.x, coords.x),
        y2: Math.max(selectionStart.y, coords.y),
      })
    } else if (isDrawing && tool === 'move' && nodeSelection.nodes.length > 0) {
      // Move selected node
      const nodeId = nodeSelection.nodes[0]
      const nodeIndex = rootNode.children.findIndex(n => n.id === nodeId)
      if (nodeIndex >= 0) {
        setPath(
          ['scene', 'rootNode', 'children', nodeIndex, 'transform', 'position'],
          [coords.x, 0.5, coords.y],
          `Move to (${coords.x}, ${coords.y})`
        )
      }
    }
  }, [isPanning, panStart, isDrawing, isSelecting, tool, currentChar, getCellCoords, updateTilemap, selectionStart, nodeSelection, rootNode, setPath])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    setIsSelecting(false)
    setSelectionStart(null)
    setIsPanning(false)
  }, [])

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.max(0.5, Math.min(3, z * delta)))
  }, [])

  // Create node from selection
  const createNodeFromSelection = useCallback(() => {
    if (!selection) return

    const { x1, y1, x2, y2 } = selection

    // Extract art from selection
    let art = ''
    for (let y = y1; y <= y2; y++) {
      let line = ''
      for (let x = x1; x <= x2; x++) {
        line += renderedGrid[y]?.[x]?.char ?? ' '
      }
      art += line + (y < y2 ? '\n' : '')
    }

    // Get dominant foreground color
    const fg = renderedGrid[y1]?.[x1]?.fg ?? '#ffffff'

    // Create new sprite node
    const newId = `sprite_${Date.now()}`
    const newNode = {
      id: newId,
      name: `Sprite ${rootNode.children.length}`,
      type: 'sprite',
      children: [],
      components: [],
      transform: { position: [x1, 0.5, y1], rotation: [0, 0, 0], scale: [1, 1, 1] },
      visual: { visible: true, color: [1, 1, 1], opacity: 1 },
      meta: { art, fg, layer: 'objects', zIndex: 0 },
    }

    // Add to scene
    setPath(
      ['scene', 'rootNode', 'children'],
      [...rootNode.children, newNode],
      `Create sprite from selection`
    )

    // Clear selection area from tilemap
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        updateTilemap(x, y, ',')
      }
    }

    setSelection(null)
    selectNode(newId)
  }, [selection, renderedGrid, rootNode, setPath, updateTilemap, selectNode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      if (e.key === 'Escape') {
        setSelection(null)
        clearSelection()
      } else if (e.key === 'd' && !e.ctrlKey) setTool('draw')
      else if (e.key === 's' && !e.ctrlKey) setTool('select')
      else if (e.key === 'm') setTool('move')
      else if (e.key === 'e' && !e.ctrlKey) setTool('erase')
      else if (e.key === 'g') setShowGrid(g => !g)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [clearSelection])

  const selectedNode = nodeSelection.nodes.length > 0
    ? getAllNodes().find(n => n.id === nodeSelection.nodes[0])
    : null

  return (
    <div className={`flex h-full ${className}`} style={{ backgroundColor: theme.bg }}>
      {/* Left Panel - Tools */}
      <div
        className="w-44 p-3 flex flex-col gap-3 overflow-y-auto shrink-0"
        style={{ backgroundColor: theme.bgPanel, borderRight: `1px solid ${theme.border}` }}
      >
        <div className="text-xs font-bold" style={{ color: theme.accent }}>TOOLS</div>

        <div className="flex flex-wrap gap-1">
          {(['draw', 'select', 'move', 'erase'] as Tool[]).map(t => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className="px-2 py-1 rounded text-xs capitalize"
              style={{
                backgroundColor: tool === t ? theme.accent : theme.bgHover,
                color: tool === t ? theme.bg : theme.textMuted,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tool === 'draw' && (
          <>
            <div>
              <div className="text-[10px] mb-1" style={{ color: theme.textDim }}>CHARACTER</div>
              <input
                type="text"
                maxLength={1}
                value={currentChar}
                onChange={(e) => setCurrentChar(e.target.value || ' ')}
                className="w-10 h-10 text-center text-xl rounded font-mono"
                style={{ backgroundColor: theme.bgHover, color: currentFg, border: `1px solid ${theme.border}` }}
              />
            </div>

            <div>
              <div className="text-[10px] mb-1" style={{ color: theme.textDim }}>COLOR</div>
              <div className="flex gap-1 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrentFg(c)}
                    className="w-5 h-5 rounded"
                    style={{
                      backgroundColor: c,
                      border: currentFg === c ? '2px solid white' : '1px solid #333',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] mb-1" style={{ color: theme.textDim }}>PRESETS</div>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(PRESETS).map(([name, p]) => (
                  <button
                    key={name}
                    onClick={() => { setCurrentChar(p.char); setCurrentFg(p.fg) }}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: theme.bgHover }}
                    title={name}
                  >
                    <span style={{ color: p.fg }}>{p.char}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {selection && (
          <div className="p-2 rounded" style={{ backgroundColor: theme.bgHover }}>
            <div className="text-[10px] mb-2" style={{ color: theme.warning }}>
              SELECTION ({selection.x2 - selection.x1 + 1}x{selection.y2 - selection.y1 + 1})
            </div>
            <button
              onClick={createNodeFromSelection}
              className="w-full py-1.5 rounded text-xs mb-1"
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              Create Node
            </button>
            <button
              onClick={() => setSelection(null)}
              className="w-full py-1 rounded text-xs"
              style={{ backgroundColor: theme.bgPanel, color: theme.textMuted }}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="mt-auto">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: theme.textMuted }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            Show Grid
          </label>
        </div>
      </div>

      {/* Center - Grid View */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="h-8 flex items-center px-4 gap-4 text-xs shrink-0"
          style={{ backgroundColor: theme.bgPanel, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted }}
        >
          <span style={{ color: theme.text }}>Scene View (2D)</span>
          <span>|</span>
          <span>{GRID_WIDTH}x{GRID_HEIGHT}</span>
          <span>|</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>|</span>
          <span className="text-[10px]">D=Draw S=Select M=Move E=Erase G=Grid</span>
        </div>

        <div
          className="flex-1 overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: '#0a0a0a' }}
        >
          <div
            ref={gridRef}
            className="relative select-none"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_WIDTH}, ${CELL_WIDTH * zoom}px)`,
              gridTemplateRows: `repeat(${GRID_HEIGHT}, ${CELL_HEIGHT * zoom}px)`,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              cursor: tool === 'draw' ? 'crosshair' : tool === 'select' ? 'cell' : tool === 'move' ? 'move' : 'pointer',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {renderedGrid.map((row, y) =>
              row.map((cell, x) => (
                <div
                  key={`${x}-${y}`}
                  className="flex items-center justify-center font-mono"
                  style={{
                    fontSize: `${11 * zoom}px`,
                    lineHeight: 1,
                    color: cell.fg,
                    backgroundColor: showGrid
                      ? ((x + y) % 2 === 0 ? '#0c0c0c' : '#0a0a0a')
                      : cell.bg,
                  }}
                >
                  {cell.char}
                </div>
              ))
            )}

            {/* Selection overlay */}
            {selection && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: selection.x1 * CELL_WIDTH * zoom,
                  top: selection.y1 * CELL_HEIGHT * zoom,
                  width: (selection.x2 - selection.x1 + 1) * CELL_WIDTH * zoom,
                  height: (selection.y2 - selection.y1 + 1) * CELL_HEIGHT * zoom,
                  border: `2px solid ${theme.warning}`,
                  backgroundColor: `${theme.warning}20`,
                }}
              />
            )}

            {/* Selected node highlight */}
            {selectedNode && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: (selectedNode.transform?.position[0] ?? 0) * CELL_WIDTH * zoom - 2,
                  top: (selectedNode.transform?.position[2] ?? 0) * CELL_HEIGHT * zoom - 2,
                  width: CELL_WIDTH * zoom + 4,
                  height: CELL_HEIGHT * zoom + 4,
                  border: `2px solid ${theme.accent}`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
