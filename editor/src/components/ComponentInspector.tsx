// ═══════════════════════════════════════════════════════════════════════════
// Component Inspector - Renders component properties using decorator metadata
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react'
import { useTheme, useSelection, useNodes, useEngineState } from '../stores/useEngineState'
import {
  componentRegistry,
  getRegisteredComponents,
  type PropertyOptions,
  type ComponentMetadata,
} from '../scripting/decorators'
import type { Node, NodeComponent } from '../stores/engineState'
import { Vec2Scrubber, Vec3Scrubber, ColorScrubber } from './ui/Scrubber'
import { SearchablePopup, type SearchableItem } from './ui/Popup'

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
  const projectPath = useEngineState((s) => s.project.path)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newComponentName, setNewComponentName] = useState('')
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

      console.log('[ComponentInspector] Created component:', filePath)
    } catch (err) {
      console.error('[ComponentInspector] Failed to create component:', err)
    }
  }, [projectPath])

  const handleAddComponent = useCallback((item: SearchableItem) => {
    if (item.id === CREATE_NEW_COMPONENT_ID) {
      // Show create dialog
      setShowAddMenu(false)
      setShowCreateDialog(true)
      setNewComponentName('')
    } else {
      console.log('[ComponentInspector] Add component:', item.id)
      // TODO: Add component to node
    }
  }, [])

  return (
    <div className="p-3">
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
              onPropertyChange={(key, value) => updateComponentProperty(compIndex, key, value)}
              onToggleEnabled={(enabled) => toggleComponentEnabled(compIndex, enabled)}
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
// Component Card
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentCardProps {
  component: NodeComponent
  onPropertyChange: (key: string, value: unknown) => void
  onToggleEnabled: (enabled: boolean) => void
}

function ComponentCard({ component, onPropertyChange, onToggleEnabled }: ComponentCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(true)

  // Get component metadata from registry
  const componentType = getComponentType(component)
  const metadata = componentType ? componentRegistry.get(componentType)?.metadata : null

  // Group properties by their group option
  const groupedProperties = metadata ? groupPropertiesByGroup(metadata) : null

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        backgroundColor: theme.bgHover,
        opacity: component.enabled ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1.5 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: theme.accent }}>
            {metadata?.icon || '▣'} {metadata?.name || componentType || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleEnabled(!component.enabled)
            }}
            style={{ color: component.enabled ? theme.success : theme.textDim }}
          >
            {component.enabled ? '●' : '○'}
          </button>
          <span style={{ color: theme.textDim }}>{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Properties */}
      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {metadata && groupedProperties ? (
            // Render with metadata (grouped)
            Object.entries(groupedProperties).map(([groupName, props]) => {
              // Special handling: combine Position (x,y) and Size (width,height) into Vec2Scrubbers
              const propKeys = props.map(([key]) => key)

              // Check if this is a Position group with x and y
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

              // Check if this is a Size group with width and height
              if (groupName === 'Size' && propKeys.includes('width') && propKeys.includes('height')) {
                const width = (component.properties.width as number) ?? 1
                const height = (component.properties.height as number) ?? 1
                const isAutoSize = component.properties.autoSize === true
                // Filter out width/height, but keep other Size properties (like autoSize)
                const otherProps = props.filter(([key]) => key !== 'width' && key !== 'height')
                return (
                  <div key={groupName} className="space-y-1">
                    <Vec2Scrubber
                      label="Size"
                      value={[width, height]}
                      onChange={([newW, newH]) => {
                        onPropertyChange('width', Math.max(1, newW))
                        onPropertyChange('height', Math.max(1, newH))
                      }}
                      step={1}
                      precision={0}
                      min={1}
                      labels={['W', 'H']}
                      disabled={isAutoSize}
                    />
                    {/* Render other Size group properties (like autoSize) */}
                    {otherProps.map(([propKey, propOptions]) => (
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
                )
              }

              // Check if this is a Padding group with paddingX and paddingY
              if (groupName === 'Padding' && propKeys.includes('paddingX') && propKeys.includes('paddingY')) {
                const px = (component.properties.paddingX as number) ?? 0
                const py = (component.properties.paddingY as number) ?? 0
                return (
                  <div key={groupName}>
                    <Vec2Scrubber
                      label="Padding"
                      value={[px, py]}
                      onChange={([newPx, newPy]) => {
                        onPropertyChange('paddingX', Math.max(0, newPx))
                        onPropertyChange('paddingY', Math.max(0, newPy))
                      }}
                      step={1}
                      precision={0}
                      min={0}
                      labels={['X', 'Y']}
                    />
                  </div>
                )
              }

              // Default group rendering
              return (
                <div key={groupName}>
                  {groupName !== 'default' && (
                    <div
                      className="text-xs uppercase tracking-wider mt-2 mb-1"
                      style={{ color: theme.textDim }}
                    >
                      {groupName}
                    </div>
                  )}
                  <div className="space-y-1">
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="accent-cyan-500"
            />
            <span style={{ color: value ? theme.text : theme.textMuted }}>
              {value ? 'Yes' : 'No'}
            </span>
          </label>
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

  // Check if script name is a registered core component type
  if (component.script) {
    // Core component types are just their name
    const coreTypes = [
      'Rect2D',
      'GlyphMap', 'GlyphImage', 'GlyphMapRenderer',  // Multi-char ASCII art
      'Glyph',           // Single character
      'Terrain',         // Grid of prefab IDs
      'Animator',        // Frame-based animation
      'Collider',        // Collision
      'Interactable',    // Can be activated
    ]
    if (coreTypes.includes(component.script)) {
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
