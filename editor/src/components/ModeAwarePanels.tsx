// Mode-Aware Panels
// These components check editor mode internally and render appropriate content
// This approach works around rc-dock's content caching

import { useEditorMode, useEngineState, useTheme } from '../stores/useEngineState'
import { NodeTree } from './NodeTree'
import { TypeInspector } from './TypeInspector'
import { EntityCollection } from './TypeCollectionPanel'
import { ComponentInspector } from './ComponentInspector'
import { Palette } from './Palette'

/**
 * Entities/Nodes panel - shows NodeTree in Engine mode, EntityCollection in Template mode
 * In 2D mode, shows NodeTree on top and Palette on bottom
 */
export function EntitiesPanel() {
  const { isTemplateMode } = useEditorMode()
  const cameraMode = useEngineState((s) => s.camera.mode)
  const theme = useTheme()

  if (isTemplateMode) {
    return <EntityCollection />
  }

  // In 2D mode, split into NodeTree (top) and Palette (bottom)
  if (cameraMode === '2d') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <NodeTree />
        </div>
        <div className="h-[45%] min-h-[200px] shrink-0">
          <Palette />
        </div>
      </div>
    )
  }

  return <NodeTree />
}

/**
 * Properties panel - shows ComponentInspector in Engine mode, TypeInspector in Template mode
 * In 2D editor mode, also shows selection preview at the bottom
 */
export function ModeAwarePropertiesPanel() {
  const { isTemplateMode } = useEditorMode()
  const cameraMode = useEngineState((s) => s.camera.mode)

  if (isTemplateMode) {
    return <TypeInspector />
  }

  // In 2D mode, show component inspector with selection preview
  if (cameraMode === '2d') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <ComponentInspector />
        </div>
        <SelectionPreview />
      </div>
    )
  }

  return <ComponentInspector />
}

/**
 * Selection Preview - Shows ASCII preview of selected region in 2D editor
 * Uses selectionAscii from store (populated from terminal grid during lasso selection)
 */
function SelectionPreview() {
  const theme = useTheme()
  const selection = useEngineState((s) => s.editor2D?.selection)
  const selectionAscii = useEngineState((s) => s.editor2D?.selectionAscii)

  if (!selection || !selectionAscii) {
    return null
  }

  const width = selection.x2 - selection.x1 + 1
  const height = selection.y2 - selection.y1 + 1

  return (
    <div
      className="shrink-0 p-3"
      style={{ borderTop: `1px solid ${theme.border}` }}
    >
      <div className="text-xs uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: theme.textMuted }}>
        <span>Selection Preview</span>
        <span style={{ color: theme.textDim }}>{width}×{height}</span>
      </div>
      <div
        className="p-2 rounded font-mono text-xs leading-tight overflow-auto"
        style={{
          height: '120px',
          backgroundColor: '#000',
          border: `1px solid ${theme.border}`,
          whiteSpace: 'pre',
          color: '#fff',
        }}
      >
        {selectionAscii || '(empty)'}
      </div>
      <div className="mt-2 text-xs" style={{ color: theme.textDim }}>
        Press <kbd className="px-1 rounded" style={{ backgroundColor: theme.bgHover }}>Enter</kbd> to create entity
      </div>
    </div>
  )
}

