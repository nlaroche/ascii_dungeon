// ═══════════════════════════════════════════════════════════════════════════
// Component Inspector - Renders component properties using decorator metadata
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTheme, useSelection, useNodes, useEngineState } from '../stores/useEngineState'
import {
  componentRegistry,
  getRegisteredComponents,
  type PropertyOptions,
  type ComponentMetadata,
} from '../scripting/decorators'
import type { Node, NodeComponent } from '../stores/engineState'
import { Vec2Scrubber, Vec3Scrubber, ColorScrubber, ToggleCheckbox, StackItem } from './ui/Scrubber'
import { SearchablePopup, type SearchableItem } from './ui/Popup'
// Graph picker removed - visual scripting system has been removed

// Special ID for "Create New Component" item
const CREATE_NEW_COMPONENT_ID = '__create_new__'

// ─────────────────────────────────────────────────────────────────────────────
// Main Component Inspector
// ─────────────────────────────────────────────────────────────────────────────

export function ComponentInspector() {
  const theme = useTheme()
  const { selection } = useSelection()
  const { getNode, setPath, getNodePath } = useNodes()

  const selectedNode = selection.nodes.length > 0 ? getNode(selection.nodes[0]) : null

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2">[ ]</div>
          <div className="text-xs">Select a node to inspect components</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {/* Node Header */}
      <NodeHeader node={selectedNode} />

      {/* Components (includes Rect2D, Glyph, etc.) */}
      <ComponentsSection node={selectedNode} setPath={setPath} getNodePath={getNodePath} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Header
// ─────────────────────────────────────────────────────────────────────────────

function NodeHeader({ node }: { node: Node }) {
  const theme = useTheme()

  // Find GlyphComponent for display
  const glyphComp = node.components.find(c => c.script === 'Glyph')
  const char = glyphComp?.properties?.char as string | undefined
  const fg = glyphComp?.properties?.fg as [number, number, number] | undefined

  return (
    <div
      className="px-3 h-8 flex items-center gap-2"
      style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
    >
      <span
        className="text-base"
        style={{
          color: fg ? `rgb(${fg.map(c => c * 255).join(',')})` : theme.text,
        }}
      >
        {char || '○'}
      </span>
      <span className="text-xs truncate" style={{ color: theme.text }}>{node.name}</span>
      <span className="text-[10px]" style={{ color: theme.textDim }}>({node.type})</span>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Components Section
// ─────────────────────────────────────────────────────────────────────────────

function ComponentsSection({
  node,
  setPath,
  getNodePath,
}: {
  node: Node
  setPath: (path: (string | number)[], value: unknown, description: string) => void
  getNodePath: (nodeId: string) => number[] | null
}) {
  const theme = useTheme()
  const projectPath = useEngineState((s) => s.project.root)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newComponentName, setNewComponentName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const nodePath = getNodePath(node.id)

  const updateComponentProperty = (compIndex: number, propKey: string, value: unknown) => {
    if (!nodePath) return
    const fullPath = [
      'scene',
      'rootNode',
      ...nodePath.flatMap((i) => ['children', i]),
      'components',
      compIndex,
      'properties',
      propKey,
    ]
    setPath(fullPath, value, `Update ${propKey}`)
  }

  const toggleComponentEnabled = (compIndex: number, enabled: boolean) => {
    if (!nodePath) return
    const fullPath = [
      'scene',
      'rootNode',
      ...nodePath.flatMap((i) => ['children', i]),
      'components',
      compIndex,
      'enabled',
    ]
    setPath(fullPath, enabled, enabled ? 'Enable component' : 'Disable component')
  }

  const removeComponent = (compIndex: number) => {
    if (!nodePath) return
    const newComponents = node.components.filter((_, i) => i !== compIndex)
    const fullPath = [
      'scene',
      'rootNode',
      ...nodePath.flatMap((i) => ['children', i]),
      'components',
    ]
    setPath(fullPath, newComponents, `Remove ${node.components[compIndex].script} component`)
  }

  const moveComponentToNode = (targetNodeId: string, component: NodeComponent, sourceNodeId: string, sourceIndex: number) => {
    // Get source node path
    const sourceNodePath = getNodePath(sourceNodeId)
    if (!sourceNodePath) return

    // Get target node path
    const targetNodePath = getNodePath(targetNodeId)
    if (!targetNodePath) return

    // Get source and target nodes from scene
    const rootNode = useEngineState.getState().scene.rootNode
    if (!rootNode) return

    // Navigate to source node
    let sourceNode: Node = rootNode
    for (const idx of sourceNodePath) {
      sourceNode = sourceNode.children[idx]
    }

    // Navigate to target node
    let targetNode: Node = rootNode
    for (const idx of targetNodePath) {
      targetNode = targetNode.children[idx]
    }

    // Remove from source
    const newSourceComponents = sourceNode.components.filter((_, i) => i !== sourceIndex)
    const sourcePath = [
      'scene',
      'rootNode',
      ...sourceNodePath.flatMap((i) => ['children', i]),
      'components',
    ]
    setPath(sourcePath, newSourceComponents, `Move ${component.script} to ${targetNode.name}`)

    // Add to target (use setTimeout to ensure source update completes first)
    setTimeout(() => {
      // Re-get target node to get updated state
      const updatedRootNode = useEngineState.getState().scene.rootNode
      if (!updatedRootNode) return
      let updatedTargetNode: Node = updatedRootNode
      for (const idx of targetNodePath) {
        updatedTargetNode = updatedTargetNode.children[idx]
      }

      const newTargetComponents = [...updatedTargetNode.components, { ...component, id: crypto.randomUUID() }]
      const targetPath = [
        'scene',
        'rootNode',
        ...targetNodePath.flatMap((i) => ['children', i]),
        'components',
      ]
      setPath(targetPath, newTargetComponents, `Add ${component.script} from ${sourceNode.name}`)
    }, 0)
  }

  // Drag over handlers for drop zone
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedComponent && draggedComponent.sourceNodeId !== node.id) {
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (draggedComponent && draggedComponent.sourceNodeId !== node.id) {
      moveComponentToNode(node.id, draggedComponent.component, draggedComponent.sourceNodeId, draggedComponent.sourceIndex)
    }
  }

  // Build searchable items from component registry
  const componentItems: SearchableItem[] = [
    // Add "Create New Component" at the top
    {
      id: CREATE_NEW_COMPONENT_ID,
      label: '+ Create New Component',
      icon: '✎',
      description: 'Create a new TypeScript component',
    },
    // Then existing components
    ...getRegisteredComponents().map((name) => {
      const entry = componentRegistry.get(name)
      const meta = entry?.metadata
      return {
        id: name,
        label: name,
        icon: meta?.icon || '▣',
        description: meta?.description,
      }
    }),
  ]

  // Create a new component file
  const createNewComponent = useCallback(async (name: string) => {
    if (!name || !projectPath) return

    // Ensure name is PascalCase
    const componentName = name.charAt(0).toUpperCase() + name.slice(1)
    const fileName = `${componentName}Component.ts`
    const filePath = `${projectPath}/src/components/${fileName}`

    // Component template
    const template = `import { Component, component, property } from '@ascii-dungeon/scripting'

@component({
  name: '${componentName}',
  icon: '●',
  description: 'Custom ${componentName} component'
})
export class ${componentName}Component extends Component {
  @property({
    type: 'number',
    label: 'Example Property',
    min: 0,
    max: 100,
  })
  exampleProperty: number = 0

  onAttach(): void {
    console.log('${componentName} attached')
  }

  onUpdate(deltaTime: number): void {
    // Update logic here
  }
}
`

    try {
      // Create the file
      const { getFileSystem } = await import('../lib/filesystem')
      const fs = await getFileSystem()

      // Ensure src/components directory exists
      try {
        await fs.createDirectory(`${projectPath}/src`)
      } catch { /* ignore if exists */ }
      try {
        await fs.createDirectory(`${projectPath}/src/components`)
      } catch { /* ignore if exists */ }

      await fs.writeFile(filePath, template)

      // Open in code editor
      window.dispatchEvent(new CustomEvent('code-editor-open-file', {
        detail: { path: filePath }
      }))
    } catch {
      // Component creation failed silently
    }
  }, [projectPath])

  const handleAddComponent = useCallback((item: SearchableItem) => {
    if (item.id === CREATE_NEW_COMPONENT_ID) {
      // Show create dialog
      setShowAddMenu(false)
      setShowCreateDialog(true)
      setNewComponentName('')
    } else {
      // Add component to node
      if (!nodePath) return

      // Get default properties from component metadata
      const metadata = componentRegistry.get(item.id)
      const defaultProps: Record<string, unknown> = {}
      if (metadata?.properties) {
        for (const [key, propMeta] of Object.entries(metadata.properties)) {
          if (propMeta.default !== undefined) {
            defaultProps[key] = propMeta.default
          }
        }
      }

      const newComponent: NodeComponent = {
        id: `${item.id.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        script: item.id,
        enabled: true,
        properties: defaultProps,
      }

      const newComponents = [...node.components, newComponent]
      const fullPath = [
        'scene',
        'rootNode',
        ...nodePath.flatMap((i) => ['children', i]),
        'components',
      ]
      setPath(fullPath, newComponents, `Add ${item.label} component`)
      setShowAddMenu(false)
    }
  }, [node.components, nodePath, setPath])

  return (
    <div
      className="p-3"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        backgroundColor: isDragOver ? theme.accent + '20' : 'transparent',
        border: isDragOver ? `2px dashed ${theme.accent}` : '2px dashed transparent',
        transition: 'all 0.15s ease',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Components ({node.components.length})
        </div>
        <button
          ref={addButtonRef}
          className="px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: theme.accent, color: theme.bg }}
          onClick={() => setShowAddMenu(true)}
        >
          + Add
        </button>
      </div>

      {/* Drop zone indicator when dragging */}
      {isDragOver && (
        <div
          className="text-xs text-center py-2 mb-2 rounded"
          style={{ backgroundColor: theme.accent + '30', color: theme.accent }}
        >
          Drop to add component here
        </div>
      )}

      {/* Add component popup */}
      <SearchablePopup
        anchorRef={addButtonRef}
        isOpen={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onSelect={handleAddComponent}
        items={componentItems}
        placeholder="Search components..."
        title="Add Component"
        width={220}
      />

      {/* Component list */}
      {node.components.length === 0 ? (
        <div style={{ color: theme.textDim }}>No components attached</div>
      ) : (
        <div className="space-y-2">
          {node.components.map((comp, compIndex) => (
            <ComponentCard
              key={comp.id}
              component={comp}
              compIndex={compIndex}
              nodeId={node.id}
              onPropertyChange={(key, value) => updateComponentProperty(compIndex, key, value)}
              onToggleEnabled={(enabled) => toggleComponentEnabled(compIndex, enabled)}
              onRemove={() => removeComponent(compIndex)}
              onMoveComponent={moveComponentToNode}
            />
          ))}
        </div>
      )}

      {/* Create New Component Dialog */}
      {showCreateDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10001 }}
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            className="rounded p-4 w-80"
            style={{ backgroundColor: theme.bgPanel, border: `1px solid ${theme.border}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm mb-3" style={{ color: theme.text }}>Create New Component</div>
            <input
              type="text"
              value={newComponentName}
              onChange={e => setNewComponentName(e.target.value)}
              placeholder="ComponentName (e.g. Health, Inventory)"
              autoFocus
              className="w-full px-3 py-2 rounded text-sm mb-3"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && newComponentName.trim()) {
                  createNewComponent(newComponentName.trim())
                  setShowCreateDialog(false)
                }
                if (e.key === 'Escape') {
                  setShowCreateDialog(false)
                }
              }}
            />
            <div className="text-xs mb-3" style={{ color: theme.textDim }}>
              Will be created at: src/components/{newComponentName || 'Name'}Component.ts
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 rounded text-xs"
                style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs"
                style={{
                  backgroundColor: newComponentName.trim() ? theme.accent : theme.bgHover,
                  color: newComponentName.trim() ? theme.bg : theme.textDim,
                }}
                disabled={!newComponentName.trim()}
                onClick={() => {
                  if (newComponentName.trim()) {
                    createNewComponent(newComponentName.trim())
                    setShowCreateDialog(false)
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Drag State (global for cross-node dragging)
// Uses custom mouse-based dragging since HTML5 drag doesn't work in Tauri
// ─────────────────────────────────────────────────────────────────────────────

interface DraggedComponent {
  component: NodeComponent
  sourceNodeId: string
  sourceIndex: number
}

// Global drag state
let draggedComponent: DraggedComponent | null = null
let dragPreviewElement: HTMLDivElement | null = null

// Dispatch event when component drag ends (for NodeTree to listen)
function emitComponentDragState(component: DraggedComponent | null) {
  window.dispatchEvent(new CustomEvent('component-drag-state', {
    detail: component
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Card
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentCardProps {
  component: NodeComponent
  compIndex: number
  nodeId: string
  onPropertyChange: (key: string, value: unknown) => void
  onToggleEnabled: (enabled: boolean) => void
  onRemove: () => void
  onMoveComponent: (targetNodeId: string, component: NodeComponent, sourceNodeId: string, sourceIndex: number) => void
}

function ComponentCard({ component, compIndex, nodeId, onPropertyChange, onToggleEnabled, onRemove, onMoveComponent }: ComponentCardProps) {
  const theme = useTheme()
  const projectPath = useEngineState((s) => s.project.root)
  const [expanded, setExpanded] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const wasDraggingRef = useRef(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Get component metadata from registry
  const componentType = getComponentType(component)
  const metadata = componentType ? componentRegistry.get(componentType)?.metadata : null
  const registryEntry = componentType ? componentRegistry.get(componentType) : null

  // Group properties by their group option
  const groupedProperties = metadata ? groupPropertiesByGroup(metadata) : null

  // Open script file in VS Code
  const handleOpenScript = useCallback(async () => {
    if (!projectPath || !componentType) return
    // Check if it's a user component with a file path
    const filePath = registryEntry?.filePath
    if (filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_in_external_editor', { path: filePath })
      } catch (err) {
        console.error('Failed to open script in VS Code:', err)
      }
    } else {
      // For built-in components, try to find in scripts folder
      const scriptPath = `${projectPath}/scripts/${componentType}.ts`
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_in_external_editor', { path: scriptPath })
      } catch (err) {
        console.error('Failed to open script in VS Code:', err)
      }
    }
  }, [projectPath, componentType, registryEntry])

  // Mouse-based drag handlers (HTML5 drag doesn't work in Tauri)
  // Uses a movement threshold to distinguish drag from click
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag on left mouse button, and not on buttons/inputs
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return

    const startX = e.clientX
    const startY = e.clientY
    const DRAG_THRESHOLD = 5 // pixels before drag starts
    let hasDragStarted = false

    // Mouse move handler - only start drag after threshold
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (!hasDragStarted && distance >= DRAG_THRESHOLD) {
        hasDragStarted = true
        wasDraggingRef.current = true

        // Set up drag state
        draggedComponent = {
          component,
          sourceNodeId: nodeId,
          sourceIndex: compIndex,
        }
        setIsDragging(true)
        emitComponentDragState(draggedComponent)

        // Create visual preview
        const preview = document.createElement('div')
        preview.className = 'fixed pointer-events-none z-[9999] px-3 py-2 rounded text-xs'
        preview.style.cssText = `
          background: ${theme.bgPanel};
          border: 2px solid ${theme.accent};
          color: ${theme.text};
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
        `
        preview.innerHTML = `<span style="color:${theme.accent}">${metadata?.icon || '▣'}</span> ${metadata?.name || componentType || 'Component'}`
        document.body.appendChild(preview)
        dragPreviewElement = preview
      }

      if (hasDragStarted && dragPreviewElement) {
        dragPreviewElement.style.left = `${moveEvent.clientX}px`
        dragPreviewElement.style.top = `${moveEvent.clientY}px`
      }
    }

    // Mouse up handler
    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      // Remove preview
      if (dragPreviewElement) {
        dragPreviewElement.remove()
        dragPreviewElement = null
      }

      // Emit drop event with position (only if drag actually started)
      if (hasDragStarted && draggedComponent) {
        window.dispatchEvent(new CustomEvent('component-drag-drop', {
          detail: {
            ...draggedComponent,
            x: upEvent.clientX,
            y: upEvent.clientY,
          }
        }))
      }

      draggedComponent = null
      setIsDragging(false)
      emitComponentDragState(null)

      // Reset drag flag after a short delay (after click would fire)
      setTimeout(() => {
        wasDraggingRef.current = false
      }, 10)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Click handler that respects drag state
  const handleClick = () => {
    if (wasDraggingRef.current) return // Don't toggle after drag
    setExpanded(!expanded)
  }

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = () => setContextMenu(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  return (
    <div
      className="rounded overflow-hidden transition-all"
      onContextMenu={handleContextMenu}
      style={{
        // Neutral panel style: subtle surface difference when enabled, depressed when not
        backgroundColor: component.enabled ? theme.bgHover : theme.bg,
        border: `1px solid ${theme.border}`,
        boxShadow: component.enabled ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.15)',
        opacity: isDragging ? 0.5 : (component.enabled ? 1 : 0.7),
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1.5 flex items-center justify-between cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2">
          {/* Toggle checkbox using shared component */}
          <ToggleCheckbox
            checked={component.enabled}
            onChange={(enabled) => onToggleEnabled(enabled)}
          />
          <span style={{ color: component.enabled ? theme.text : theme.textMuted }}>
            {metadata?.icon || '▣'}
          </span>
          <span className="text-xs" style={{ color: component.enabled ? theme.text : theme.textMuted }}>
            {metadata?.name || componentType || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-1 rounded opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: theme.error }}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            title="Remove component"
          >
            ×
          </button>
          <span style={{ color: theme.textDim }}>{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Properties */}
      {expanded && component.enabled && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {metadata && groupedProperties ? (
            // Render with metadata (grouped)
            Object.entries(groupedProperties).map(([groupName, props]) => {
              const propKeys = props.map(([key]) => key)

              // Transform group - Position and Size on separate rows
              if (groupName === 'Transform') {
                const x = (component.properties.x as number) ?? 0
                const y = (component.properties.y as number) ?? 0
                const w = (component.properties.width as number) ?? 1
                const h = (component.properties.height as number) ?? 1
                return (
                  <div key={groupName} className="space-y-1.5">
                    <Vec2Scrubber
                      label="Position"
                      value={[x, y]}
                      onChange={([newX, newY]) => {
                        onPropertyChange('x', newX)
                        onPropertyChange('y', newY)
                      }}
                      step={1}
                      precision={0}
                      labels={['X', 'Y']}
                    />
                    <Vec2Scrubber
                      label="Size"
                      value={[w, h]}
                      onChange={([newW, newH]) => {
                        onPropertyChange('width', Math.max(0, newW))
                        onPropertyChange('height', Math.max(0, newH))
                      }}
                      step={1}
                      precision={0}
                      min={0}
                      labels={['W', 'H']}
                    />
                  </div>
                )
              }

              // Anchor group - visual 3x3 preset grid
              if (groupName === 'Anchor') {
                const ax = (component.properties.anchorX as number) ?? 0
                const ay = (component.properties.anchorY as number) ?? 0
                return (
                  <AnchorPivotGrid
                    key={groupName}
                    label="Anchor"
                    valueX={ax}
                    valueY={ay}
                    onChange={(newX, newY) => {
                      onPropertyChange('anchorX', newX)
                      onPropertyChange('anchorY', newY)
                    }}
                  />
                )
              }

              // Pivot group - visual 3x3 preset grid
              if (groupName === 'Pivot') {
                const px = (component.properties.pivotX as number) ?? 0
                const py = (component.properties.pivotY as number) ?? 0
                return (
                  <AnchorPivotGrid
                    key={groupName}
                    label="Pivot"
                    valueX={px}
                    valueY={py}
                    onChange={(newX, newY) => {
                      onPropertyChange('pivotX', newX)
                      onPropertyChange('pivotY', newY)
                    }}
                  />
                )
              }

              // Stretch group - inline toggle buttons
              if (groupName === 'Stretch') {
                const sx = component.properties.stretchX === true
                const sy = component.properties.stretchY === true
                return (
                  <StretchToggles
                    key={groupName}
                    stretchX={sx}
                    stretchY={sy}
                    onChange={(axis, value) => {
                      onPropertyChange(axis === 'x' ? 'stretchX' : 'stretchY', value)
                    }}
                  />
                )
              }

              // Padding group - 4 values in cross layout
              if (groupName === 'Padding' && propKeys.some(k => k.startsWith('padding'))) {
                const pl = (component.properties.paddingLeft as number) ?? 0
                const pr = (component.properties.paddingRight as number) ?? 0
                const pt = (component.properties.paddingTop as number) ?? 0
                const pb = (component.properties.paddingBottom as number) ?? 0
                return (
                  <PaddingEditor
                    key={groupName}
                    left={pl}
                    right={pr}
                    top={pt}
                    bottom={pb}
                    onChange={(side, value) => {
                      const key = `padding${side.charAt(0).toUpperCase() + side.slice(1)}`
                      onPropertyChange(key, Math.max(0, value))
                    }}
                  />
                )
              }

              // Size group (for components that have autoSize without transform)
              if (groupName === 'Size' && propKeys.includes('autoSize')) {
                return (
                  <div key={groupName} className="flex items-center gap-2">
                    <span className="text-[10px] w-12" style={{ color: theme.textDim }}>Auto</span>
                    <ToggleCheckbox
                      checked={component.properties.autoSize === true}
                      onChange={(value) => onPropertyChange('autoSize', value)}
                    />
                  </div>
                )
              }

              // Legacy Position group (for non-Rect2D components)
              if (groupName === 'Position' && propKeys.includes('x') && propKeys.includes('y')) {
                const x = (component.properties.x as number) ?? 0
                const y = (component.properties.y as number) ?? 0
                return (
                  <div key={groupName}>
                    <Vec2Scrubber
                      label="Position"
                      value={[x, y]}
                      onChange={([newX, newY]) => {
                        onPropertyChange('x', newX)
                        onPropertyChange('y', newY)
                      }}
                      step={1}
                      precision={0}
                    />
                  </div>
                )
              }

              // Default group rendering
              return (
                <div key={groupName}>
                  {groupName !== 'default' && (
                    <div
                      className="text-[10px] uppercase tracking-wider mt-2 mb-0.5"
                      style={{ color: theme.textDim }}
                    >
                      {groupName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {props.map(([propKey, propOptions]) => (
                      <PropertyField
                        key={propKey}
                        label={propOptions.label || propKey}
                        type={propOptions.type}
                        value={component.properties[propKey]}
                        onChange={(value) => onPropertyChange(propKey, value)}
                        options={propOptions}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            // Fallback: render raw properties
            Object.entries(component.properties).map(([key, value]) => (
              <PropertyField
                key={key}
                label={key}
                type={inferPropertyType(value)}
                value={value}
                onChange={(newValue) => onPropertyChange(key, newValue)}
              />
            ))
          )}
        </div>
      )}

      {/* Context Menu - matches MenuBar styling */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#27272a',
            border: '1px solid #52525b',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)',
            padding: '4px',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full h-7 px-3 text-left text-xs rounded transition-colors"
            style={{ color: theme.text }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#52525b'
              e.currentTarget.style.color = theme.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.text
            }}
            onClick={() => {
              setExpanded(!expanded)
              setContextMenu(null)
            }}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button
            className="w-full h-7 px-3 text-left text-xs rounded transition-colors"
            style={{ color: theme.text }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#52525b'
              e.currentTarget.style.color = theme.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.text
            }}
            onClick={() => {
              onToggleEnabled(!component.enabled)
              setContextMenu(null)
            }}
          >
            {component.enabled ? 'Disable' : 'Enable'}
          </button>
          <div className="my-1 mx-2" style={{ borderTop: '1px solid #52525b', height: '1px' }} />
          <button
            className="w-full h-7 px-3 text-left text-xs rounded transition-colors"
            style={{ color: theme.text }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#52525b'
              e.currentTarget.style.color = theme.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = theme.text
            }}
            onClick={() => {
              handleOpenScript()
              setContextMenu(null)
            }}
          >
            Open Script
          </button>
          <div className="my-1 mx-2" style={{ borderTop: '1px solid #52525b', height: '1px' }} />
          <button
            className="w-full h-7 px-3 text-left text-xs rounded transition-colors"
            style={{ color: theme.error }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#52525b'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onClick={() => {
              onRemove()
              setContextMenu(null)
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Anchor/Pivot Grid - Visual 3x3 preset selector
// ─────────────────────────────────────────────────────────────────────────────

interface AnchorPivotGridProps {
  label: string
  valueX: number
  valueY: number
  onChange: (x: number, y: number) => void
}

function AnchorPivotGrid({ label, valueX, valueY, onChange }: AnchorPivotGridProps) {
  const theme = useTheme()
  const [hovered, setHovered] = useState<number | null>(null)

  // 3x3 grid of presets: (0,0), (0.5,0), (1,0), etc.
  const presets = [
    [0, 0], [0.5, 0], [1, 0],
    [0, 0.5], [0.5, 0.5], [1, 0.5],
    [0, 1], [0.5, 1], [1, 1],
  ] as const

  const isSelected = (px: number, py: number) =>
    Math.abs(valueX - px) < 0.01 && Math.abs(valueY - py) < 0.01

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-14 shrink-0" style={{ color: theme.textMuted }}>{label}</span>
      <div
        className="grid grid-cols-3 gap-0.5 p-1 rounded"
        style={{ backgroundColor: theme.border }}
      >
        {presets.map(([px, py], i) => {
          const selected = isSelected(px, py)
          const isHovered = hovered === i
          return (
            <button
              key={i}
              className="w-5 h-5 rounded transition-all"
              style={{
                backgroundColor: selected ? theme.accent : isHovered ? theme.accent + '60' : theme.bg,
                transform: isHovered && !selected ? 'scale(1.1)' : 'scale(1)',
              }}
              onClick={() => onChange(px, py)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              title={`${px}, ${py}`}
            >
              {selected && (
                <span className="block w-2 h-2 rounded-full mx-auto" style={{ backgroundColor: theme.bg }} />
              )}
              {isHovered && !selected && (
                <span className="block w-1.5 h-1.5 rounded-full mx-auto" style={{ backgroundColor: theme.accent, opacity: 0.8 }} />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-1 text-xs" style={{ color: theme.textDim }}>
        <input
          type="number"
          value={valueX}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0, valueY)}
          className="w-12 px-1.5 py-0.5 rounded text-xs text-center"
          style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
          step={0.1}
          min={0}
          max={1}
        />
        <input
          type="number"
          value={valueY}
          onChange={(e) => onChange(valueX, parseFloat(e.target.value) || 0)}
          className="w-12 px-1.5 py-0.5 rounded text-xs text-center"
          style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
          step={0.1}
          min={0}
          max={1}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stretch Toggles - Horizontal/Vertical stretch buttons
// ─────────────────────────────────────────────────────────────────────────────

interface StretchTogglesProps {
  stretchX: boolean
  stretchY: boolean
  onChange: (axis: 'x' | 'y', value: boolean) => void
}

function StretchToggles({ stretchX, stretchY, onChange }: StretchTogglesProps) {
  const theme = useTheme()

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-14 shrink-0" style={{ color: theme.textMuted }}>Stretch</span>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 rounded text-xs transition-all"
          style={{
            backgroundColor: stretchX ? theme.accent : theme.bg,
            color: stretchX ? theme.bg : theme.textMuted,
            border: `1px solid ${stretchX ? theme.accent : theme.border}`,
          }}
          onClick={() => onChange('x', !stretchX)}
          title="Stretch horizontally to fill parent width"
        >
          ↔ Horizontal
        </button>
        <button
          className="px-3 py-1 rounded text-xs transition-all"
          style={{
            backgroundColor: stretchY ? theme.accent : theme.bg,
            color: stretchY ? theme.bg : theme.textMuted,
            border: `1px solid ${stretchY ? theme.accent : theme.border}`,
          }}
          onClick={() => onChange('y', !stretchY)}
          title="Stretch vertically to fill parent height"
        >
          ↕ Vertical
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Padding Editor - Compact 4-value padding input
// ─────────────────────────────────────────────────────────────────────────────

interface PaddingEditorProps {
  left: number
  right: number
  top: number
  bottom: number
  onChange: (side: 'left' | 'right' | 'top' | 'bottom', value: number) => void
}

function PaddingEditor({ left, right, top, bottom, onChange }: PaddingEditorProps) {
  const theme = useTheme()

  const PaddingInput = ({ value, side, label }: { value: number; side: 'left' | 'right' | 'top' | 'bottom'; label: string }) => (
    <div className="flex items-center gap-1">
      <span className="text-xs w-3" style={{ color: theme.textDim }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(side, parseInt(e.target.value) || 0)}
        className="w-12 px-1.5 py-0.5 text-center text-xs rounded"
        style={{
          backgroundColor: theme.bg,
          color: theme.text,
          border: `1px solid ${theme.border}`,
        }}
        title={`Padding ${side}`}
        min={0}
      />
    </div>
  )

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-14 shrink-0" style={{ color: theme.textMuted }}>Padding</span>
      <div className="flex gap-3">
        <PaddingInput value={left} side="left" label="L" />
        <PaddingInput value={right} side="right" label="R" />
        <PaddingInput value={top} side="top" label="T" />
        <PaddingInput value={bottom} side="bottom" label="B" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Field Renderer
// ─────────────────────────────────────────────────────────────────────────────

interface PropertyFieldProps {
  label: string
  type: string
  value: unknown
  onChange: (value: unknown) => void
  options?: Partial<PropertyOptions>
}

function PropertyField({ label, type, value, onChange, options }: PropertyFieldProps) {
  const theme = useTheme()

  const renderInput = () => {
    switch (type) {
      case 'number':
        return (
          <input
            type="number"
            value={Number(value) || 0}
            min={options?.min}
            max={options?.max}
            step={options?.step || 1}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: theme.bg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          />
        )

      case 'string':
        return (
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: theme.bg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          />
        )

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <ToggleCheckbox
              checked={Boolean(value)}
              onChange={(checked) => onChange(checked)}
            />
            <span className="text-xs" style={{ color: value ? theme.text : theme.textMuted }}>
              {value ? 'Yes' : 'No'}
            </span>
          </div>
        )

      case 'color': {
        const colorArray = Array.isArray(value) ? value : [1, 1, 1]
        const colorValue: [number, number, number] = [
          Number(colorArray[0]) || 0,
          Number(colorArray[1]) || 0,
          Number(colorArray[2]) || 0,
        ]
        return (
          <ColorScrubber
            value={colorValue}
            onChange={(newColor) => onChange(newColor)}
          />
        )
      }

      case 'vec2': {
        const arr = Array.isArray(value) ? value : [0, 0]
        const vec2Value: [number, number] = [Number(arr[0]) || 0, Number(arr[1]) || 0]
        return (
          <Vec2Scrubber
            value={vec2Value}
            onChange={(newVec) => onChange(newVec)}
            step={options?.step || 1}
            precision={options?.precision ?? 0}
            min={options?.min}
            max={options?.max}
          />
        )
      }

      case 'vec3': {
        const arr = Array.isArray(value) ? value : [0, 0, 0]
        const vec3Value: [number, number, number] = [Number(arr[0]) || 0, Number(arr[1]) || 0, Number(arr[2]) || 0]
        return (
          <Vec3Scrubber
            value={vec3Value}
            onChange={(newVec) => onChange(newVec)}
            step={options?.step || 1}
            precision={options?.precision ?? 0}
            min={options?.min}
            max={options?.max}
          />
        )
      }

      case 'select':
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: theme.bg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          >
            {options?.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )

      case 'graphPicker':
        // Graph picker removed - visual scripting has been removed
        return (
          <span style={{ color: theme.textDim }}>
            (Visual scripting removed)
          </span>
        )

      default:
        // Fallback for unknown types
        return (
          <span style={{ color: theme.textDim }}>
            {JSON.stringify(value)}
          </span>
        )
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label
        className="shrink-0 text-xs"
        style={{ color: theme.textMuted, minWidth: '70px' }}
        title={options?.tooltip}
      >
        {label}
      </label>
      <div className="flex-1">{renderInput()}</div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the component type name from a NodeComponent
 */
function getComponentType(component: NodeComponent): string | null {
  // New format: has 'type' property
  if ('type' in component && typeof (component as { type?: string }).type === 'string') {
    return (component as { type: string }).type
  }

  // Check if script name is registered in the component registry
  if (component.script) {
    // Look up in the component registry - includes both built-in and user components
    if (componentRegistry.has(component.script)) {
      return component.script
    }

    // Legacy builtin format
    if (component.script.startsWith('builtin:')) {
      const builtinType = component.script.replace('builtin:', '')
      const typeMap: Record<string, string> = {
        floor_generator: 'FloorGenerator',
        tilemap_renderer: 'GlyphMap',
      }
      return typeMap[builtinType] || null
    }
  }

  return null
}

/**
 * Group properties by their group option
 */
function groupPropertiesByGroup(
  metadata: ComponentMetadata
): Record<string, Array<[string, PropertyOptions]>> {
  const groups: Record<string, Array<[string, PropertyOptions]>> = {}

  for (const [key, options] of metadata.properties) {
    const groupName = options.group || 'default'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push([key, options])
  }

  return groups
}

/**
 * Infer property type from value
 */
function inferPropertyType(value: unknown): string {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length === 2) return 'vec2'
    if (value.length === 3) return 'vec3'
  }
  return 'unknown'
}
