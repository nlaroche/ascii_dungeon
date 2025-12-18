// Palette Panel - File-based prefab browser and management
// Loads prefabs from project's palettes/ folder structure

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useEngineState, useTheme } from '../stores/useEngineState'
import { usePalette } from '../hooks/usePalette'
import { useProject } from '../hooks/useProject'
import { useDragState } from '../stores/useDragState'
import type { Prefab, Node } from '../stores/engineState'

interface PaletteProps {
  className?: string
}

export function Palette({ className = '' }: PaletteProps) {
  const theme = useTheme()
  const palette = useEngineState((s) => s.palette)
  const setPath = useEngineState((s) => s.setPath)
  const selectedNodeIds = useEngineState((s) => s.selection.nodes)
  const rootNode = useEngineState((s) => s.scene.rootNode)

  // Get project path from useProject hook
  const { projectPath, hasProject } = useProject()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Compute palette path from project path
  const palettePath = useMemo(() => {
    if (!projectPath) return null
    // Normalize path separators
    const normalized = projectPath.replace(/\\/g, '/')
    return `${normalized}/palettes`
  }, [projectPath])

  // Clear palette when project changes or closes
  useEffect(() => {
    if (!hasProject) {
      // Clear palette state when no project is open
      setPath(['palette', 'categories'], {}, 'Clear palette categories')
      setPath(['palette', 'prefabs'], {}, 'Clear palette prefabs')
      setPath(['palette', 'rootCategories'], [], 'Clear root categories')
    }
  }, [hasProject, setPath])

  // File-based palette loading (only when project is open)
  const {
    loading,
    error,
    loadPalette,
    savePrefab,
  } = usePalette({
    palettePath: palettePath || '',
    autoLoad: hasProject && !!palettePath,
    watchForChanges: hasProject && !!palettePath,
  })

  // Filter prefabs based on search and category
  const filteredPrefabs = useMemo(() => {
    const allPrefabs = Object.values(palette.prefabs)

    return allPrefabs.filter(prefab => {
      // Filter by category
      if (selectedCategory && !prefab.category.includes(selectedCategory)) {
        return false
      }

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          prefab.name.toLowerCase().includes(query) ||
          prefab.tags.some(tag => tag.toLowerCase().includes(query)) ||
          prefab.category.some(cat => cat.toLowerCase().includes(query))
        )
      }

      return true
    })
  }, [palette.prefabs, selectedCategory, searchQuery])

  // Get root categories for tabs
  const rootCategories = useMemo(() => {
    return palette.rootCategories.map(id => palette.categories[id]).filter(Boolean)
  }, [palette.categories, palette.rootCategories])

  // Drag state for mouse-based dragging (bypasses rc-dock)
  const { startDrag, updateMouse } = useDragState()

  // Handle mouse down for prefab - start custom drag
  const handlePrefabMouseDown = useCallback((e: React.MouseEvent, prefab: Prefab) => {
    // Only left click
    if (e.button !== 0) return

    console.log('[Palette] Mouse down on prefab:', prefab.id, prefab.name)
    startDrag(prefab)
    updateMouse(e.clientX, e.clientY)
    console.log('[Palette] Drag started, state:', useDragState.getState().draggedPrefab?.name)

    // Declare handlers first so cleanup can reference them
    let handleMouseMove: (e: MouseEvent) => void
    let handleMouseUp: () => void
    let handleBlur: () => void
    let handleKeyDown: (e: KeyboardEvent) => void

    // Clean up function to remove all listeners
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('keydown', handleKeyDown)
    }

    // Track mouse move globally to update position
    handleMouseMove = (e: MouseEvent) => {
      updateMouse(e.clientX, e.clientY)
    }

    // Track mouse up anywhere to end drag
    handleMouseUp = () => {
      console.log('[Palette] Mouse up - ending drag')
      cleanup()

      // Give drop targets 50ms to handle the drop, then clear if still dragging
      setTimeout(() => {
        const state = useDragState.getState()
        if (state.draggedPrefab) {
          console.log('[Palette] No drop target handled - clearing drag')
          state.endDrag()
        }
      }, 50)
    }

    // Handle window blur (user clicks outside browser) - immediately end drag
    handleBlur = () => {
      console.log('[Palette] Window blur - clearing drag')
      cleanup()
      useDragState.getState().endDrag()
    }

    // Handle Escape key to cancel drag
    handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[Palette] Escape pressed - cancelling drag')
        cleanup()
        useDragState.getState().endDrag()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('keydown', handleKeyDown)

    // Prevent text selection during drag
    e.preventDefault()
  }, [startDrag, updateMouse])

  // Find a node by ID recursively
  const findNodeById = useCallback((node: Node, id: string): Node | null => {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
    return null
  }, [])

  // Get the currently selected node
  const selectedNode = useMemo(() => {
    const id = selectedNodeIds[0]
    if (!id) return null
    return findNodeById(rootNode, id)
  }, [selectedNodeIds, rootNode, findNodeById])

  // Create a prefab from selected node and save to file
  const handleCreatePrefab = useCallback(async () => {
    if (!selectedNode) {
      console.log('No node selected')
      return
    }

    // Deep clone the node for the prefab template
    const cloneNode = (node: Node): Node => ({
      ...node,
      id: `prefab_template_${node.id}`,
      children: node.children.map(cloneNode),
      components: node.components.map(comp => ({
        ...comp,
        properties: { ...comp.properties }
      })),
    })

    const newPrefab: Prefab = {
      id: `prefab_${Date.now()}`,
      name: selectedNode.name,
      category: selectedCategory ? [selectedCategory] : ['environment'],
      tags: [],
      template: cloneNode(selectedNode),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    }

    // Save to file
    const categoryId = selectedCategory || 'environment'
    try {
      await savePrefab(newPrefab, categoryId)
      console.log(`[Palette] Saved prefab '${selectedNode.name}' to ${categoryId}`)
    } catch (err) {
      console.error('[Palette] Failed to save prefab:', err)
      // Fallback: add to in-memory store
      setPath(['palette', 'prefabs', newPrefab.id], newPrefab, `Create prefab '${selectedNode.name}'`)
    }
  }, [selectedNode, selectedCategory, savePrefab, setPath])

  // Get ASCII preview for a prefab's GlyphMap
  const getPrefabPreview = useCallback((prefab: Prefab) => {
    const glyphMap = prefab.template.components.find(c => c.script === 'GlyphMap' || c.script === 'GlyphImage')
    if (glyphMap?.properties?.cells) {
      const cells = glyphMap.properties.cells as string
      const lines = cells.split('\n').slice(0, 3)  // First 3 lines
      return lines.map(l => l.slice(0, 8)).join('\n')  // First 8 chars
    }

    // Check for Glyph component
    const glyph = prefab.template.components.find(c => c.script === 'Glyph')
    if (glyph?.properties?.char) {
      return glyph.properties.char as string
    }

    return '?'
  }, [])

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ backgroundColor: theme.bgPanel }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
            Palette
          </span>
          {loading && (
            <span className="text-xs" style={{ color: theme.textDim }}>Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: theme.bgHover,
              color: theme.textDim
            }}
            onClick={() => loadPalette()}
            title="Reload palette from disk"
          >
            R
          </button>
          <button
            className="text-xs px-2 py-0.5 rounded"
            style={{
              backgroundColor: theme.bgHover,
              color: theme.text
            }}
            onClick={handleCreatePrefab}
            title="Create prefab from selected node (saves to disk)"
          >
            + Prefab
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-2 py-1 text-xs" style={{ color: theme.error, backgroundColor: theme.bgHover }}>
          {error}
        </div>
      )}

      {/* Search */}
      <div className="px-2 py-2 shrink-0">
        <input
          type="text"
          placeholder="Search prefabs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded"
          style={{
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.text,
          }}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 px-2 pb-2 shrink-0 flex-wrap">
        <button
          className="text-xs px-2 py-1 rounded"
          style={{
            backgroundColor: selectedCategory === null ? theme.accent : theme.bgHover,
            color: selectedCategory === null ? '#fff' : theme.text,
          }}
          onClick={() => setSelectedCategory(null)}
        >
          All
        </button>
        {rootCategories.map(category => (
          <button
            key={category.id}
            className="text-xs px-2 py-1 rounded font-mono"
            style={{
              backgroundColor: selectedCategory === category.id ? theme.accent : theme.bgHover,
              color: selectedCategory === category.id ? '#fff' : theme.text,
            }}
            onClick={() => setSelectedCategory(category.id)}
            title={category.name}
          >
            {category.icon || category.name.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Prefab Grid */}
      <div className="flex-1 min-h-0 overflow-auto px-2 pb-2">
        {!hasProject ? (
          <div
            className="text-xs text-center py-8 whitespace-pre-line"
            style={{ color: theme.textMuted }}
          >
            No project open.
            {'\n\n'}Open or create a project to use palettes.
          </div>
        ) : filteredPrefabs.length === 0 ? (
          <div
            className="text-xs text-center py-8 whitespace-pre-line"
            style={{ color: theme.textMuted }}
          >
            {Object.keys(palette.prefabs).length === 0
              ? `No prefabs found.\n\nAdd .prefab.json files to:\n${palettePath}/<category>/`
              : 'No prefabs match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredPrefabs.map(prefab => (
              <div
                key={prefab.id}
                onMouseDown={(e) => handlePrefabMouseDown(e, prefab)}
                className="cursor-grab active:cursor-grabbing rounded p-1 hover:ring-1 select-none"
                style={{
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                }}
                title={prefab.name + (prefab.description ? `\n${prefab.description}` : '')}
              >
                {/* ASCII Preview */}
                <div
                  className="font-mono text-xs leading-tight text-center py-1 overflow-hidden"
                  style={{
                    color: '#fff',
                    backgroundColor: '#000',
                    height: '36px',
                    whiteSpace: 'pre',
                  }}
                >
                  {getPrefabPreview(prefab)}
                </div>
                {/* Name */}
                <div
                  className="text-xs truncate text-center mt-1"
                  style={{ color: theme.text }}
                >
                  {prefab.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
