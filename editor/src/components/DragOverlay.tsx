// ═══════════════════════════════════════════════════════════════════════════
// DragOverlay - Shows a ghost of the dragged prefab following the cursor
// ═══════════════════════════════════════════════════════════════════════════

import { useDragState } from '../stores/useDragState'
import { useTheme } from '../stores/useEngineState'

export function DragOverlay() {
  const theme = useTheme()
  const { draggedPrefab, mouseX, mouseY, dropTarget, overScene, sceneDropTarget } = useDragState()

  // Debug logging
  if (draggedPrefab) {
    console.log('[DragOverlay] Rendering:', draggedPrefab.name, 'at', mouseX, mouseY, 'dropTarget:', dropTarget?.nodeName)
  }

  if (!draggedPrefab) return null

  // Get ASCII preview for the prefab
  const getPreview = () => {
    const glyphMap = draggedPrefab.template.components.find(c => c.script === 'GlyphMap' || c.script === 'GlyphImage')
    if (glyphMap?.properties?.cells) {
      const cells = glyphMap.properties.cells as string
      const lines = cells.split('\n').slice(0, 3)
      return lines.map(l => l.slice(0, 6)).join('\n')
    }

    const glyph = draggedPrefab.template.components.find(c => c.script === 'Glyph')
    if (glyph?.properties?.char) {
      return glyph.properties.char as string
    }

    return draggedPrefab.name.charAt(0).toUpperCase()
  }

  // Show drop target info
  const getDropInfo = () => {
    if (overScene && sceneDropTarget) {
      return `Place at (${sceneDropTarget.x}, ${sceneDropTarget.y})`
    }
    if (dropTarget) {
      const posLabel = dropTarget.position === 'inside'
        ? `into ${dropTarget.nodeName}`
        : dropTarget.position === 'before'
          ? `before ${dropTarget.nodeName}`
          : `after ${dropTarget.nodeName}`
      return posLabel
    }
    return 'Drop in Hierarchy or Scene'
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: mouseX + 16,
        top: mouseY + 16,
        pointerEvents: 'none',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {/* Prefab preview */}
      <div
        style={{
          padding: '4px 8px',
          backgroundColor: theme.bgPanel,
          border: `1px solid ${theme.accent}`,
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#fff',
            backgroundColor: '#000',
            padding: '2px 4px',
            whiteSpace: 'pre',
            lineHeight: 1.2,
          }}
        >
          {getPreview()}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: theme.text,
            fontWeight: 500,
          }}
        >
          {draggedPrefab.name}
        </div>
      </div>

      {/* Drop target hint */}
      <div
        style={{
          fontSize: '10px',
          color: dropTarget || overScene ? theme.accent : theme.textDim,
          backgroundColor: theme.bg,
          padding: '2px 6px',
          borderRadius: '2px',
          opacity: 0.9,
        }}
      >
        {getDropInfo()}
      </div>
    </div>
  )
}
