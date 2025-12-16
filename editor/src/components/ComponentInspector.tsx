// ═══════════════════════════════════════════════════════════════════════════
// Component Inspector - Renders component properties using decorator metadata
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useTheme, useSelection, useNodes } from '../stores/useEngineState'
import {
  componentRegistry,
  getRegisteredComponents,
  type PropertyOptions,
  type ComponentMetadata,
} from '../scripting/decorators'
import type { Node, NodeComponent } from '../stores/engineState'

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

      {/* Transform (if present) - special built-in handling */}
      {selectedNode.transform && (
        <TransformSection node={selectedNode} setPath={setPath} getNodePath={getNodePath} />
      )}

      {/* Visual (if present) - special built-in handling */}
      {selectedNode.visual && (
        <VisualSection node={selectedNode} setPath={setPath} getNodePath={getNodePath} />
      )}

      {/* Components */}
      <ComponentsSection node={selectedNode} setPath={setPath} getNodePath={getNodePath} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Header
// ─────────────────────────────────────────────────────────────────────────────

function NodeHeader({ node }: { node: Node }) {
  const theme = useTheme()

  return (
    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
    >
      <span
        className="text-lg"
        style={{
          color: node.visual?.color
            ? `rgb(${node.visual.color.map((c) => c * 255).join(',')})`
            : theme.text,
        }}
      >
        {node.visual?.glyph || '○'}
      </span>
      <div>
        <div style={{ color: theme.text }}>{node.name}</div>
        <div style={{ color: theme.textDim }}>{node.type}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Section
// ─────────────────────────────────────────────────────────────────────────────

function TransformSection({
  node,
  setPath,
  getNodePath,
}: {
  node: Node
  setPath: (path: (string | number)[], value: unknown, description: string) => void
  getNodePath: (nodeId: string) => number[] | null
}) {
  const theme = useTheme()
  const nodePath = getNodePath(node.id)

  const updateTransform = (key: string, index: number, value: number) => {
    if (!nodePath) return
    const fullPath = ['scene', 'rootNode', ...nodePath.flatMap((i) => ['children', i]), 'transform', key, index]
    setPath(fullPath, value, `Update ${key}`)
  }

  if (!node.transform) return null

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
        Transform
      </div>
      <div className="space-y-2">
        <Vec3Input
          label="Position"
          value={node.transform.position}
          onChange={(i, v) => updateTransform('position', i, v)}
        />
        <Vec3Input
          label="Rotation"
          value={node.transform.rotation}
          onChange={(i, v) => updateTransform('rotation', i, v)}
        />
        <Vec3Input
          label="Scale"
          value={node.transform.scale}
          onChange={(i, v) => updateTransform('scale', i, v)}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual Section
// ─────────────────────────────────────────────────────────────────────────────

function VisualSection({
  node,
  setPath,
  getNodePath,
}: {
  node: Node
  setPath: (path: (string | number)[], value: unknown, description: string) => void
  getNodePath: (nodeId: string) => number[] | null
}) {
  const theme = useTheme()
  const nodePath = getNodePath(node.id)

  const updateVisual = (key: string, value: unknown) => {
    if (!nodePath) return
    const fullPath = ['scene', 'rootNode', ...nodePath.flatMap((i) => ['children', i]), 'visual', key]
    setPath(fullPath, value, `Update visual.${key}`)
  }

  if (!node.visual) return null

  return (
    <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
        Visual
      </div>
      <div className="space-y-2">
        <PropertyField
          label="Glyph"
          type="string"
          value={node.visual.glyph || ''}
          onChange={(v) => updateVisual('glyph', v)}
        />
        <PropertyField
          label="Color"
          type="color"
          value={node.visual.color}
          onChange={(v) => updateVisual('color', v)}
        />
        <PropertyField
          label="Visible"
          type="boolean"
          value={node.visual.visible}
          onChange={(v) => updateVisual('visible', v)}
        />
        <PropertyField
          label="Opacity"
          type="number"
          value={node.visual.opacity}
          onChange={(v) => updateVisual('opacity', v)}
          options={{ min: 0, max: 1, step: 0.1 }}
        />
      </div>
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
  const [showAddMenu, setShowAddMenu] = useState(false)
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

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Components ({node.components.length})
        </div>
        <button
          className="px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: theme.accent, color: theme.bg }}
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          + Add
        </button>
      </div>

      {/* Add component menu */}
      {showAddMenu && (
        <AddComponentMenu
          onAdd={(typeName) => {
            console.log('[ComponentInspector] Add component:', typeName)
            // TODO: Add component to node
            setShowAddMenu(false)
          }}
          onClose={() => setShowAddMenu(false)}
        />
      )}

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
            Object.entries(groupedProperties).map(([groupName, props]) => (
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
            ))
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
// Add Component Menu
// ─────────────────────────────────────────────────────────────────────────────

function AddComponentMenu({
  onAdd,
  onClose,
}: {
  onAdd: (typeName: string) => void
  onClose: () => void
}) {
  const theme = useTheme()
  const componentNames = getRegisteredComponents()

  return (
    <div
      className="mb-2 p-2 rounded"
      style={{
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div className="text-xs mb-2" style={{ color: theme.textMuted }}>
        Select component to add:
      </div>
      <div className="grid grid-cols-2 gap-1">
        {componentNames.map((name) => {
          const entry = componentRegistry.get(name)
          const meta = entry?.metadata
          return (
            <button
              key={name}
              className="px-2 py-1 rounded text-left text-xs hover:opacity-80"
              style={{ backgroundColor: theme.bgHover, color: theme.text }}
              onClick={() => onAdd(name)}
            >
              <span style={{ color: theme.accent }}>{meta?.icon || '▣'}</span> {name}
            </button>
          )
        })}
      </div>
      <button
        className="mt-2 w-full px-2 py-1 rounded text-xs"
        style={{ backgroundColor: theme.border, color: theme.textMuted }}
        onClick={onClose}
      >
        Cancel
      </button>
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

      case 'color':
        const colorArray = Array.isArray(value) ? value : [1, 1, 1]
        const hexColor = `#${colorArray
          .slice(0, 3)
          .map((c: number) => Math.round(c * 255).toString(16).padStart(2, '0'))
          .join('')}`

        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hexColor}
              onChange={(e) => {
                const hex = e.target.value
                const r = parseInt(hex.slice(1, 3), 16) / 255
                const g = parseInt(hex.slice(3, 5), 16) / 255
                const b = parseInt(hex.slice(5, 7), 16) / 255
                onChange([r, g, b])
              }}
              className="w-6 h-5 rounded cursor-pointer"
              style={{ border: `1px solid ${theme.border}` }}
            />
            <span style={{ color: theme.textMuted, fontSize: '10px' }}>{hexColor}</span>
          </div>
        )

      case 'vec2':
      case 'vec3':
        const vecValue = Array.isArray(value) ? value : type === 'vec2' ? [0, 0] : [0, 0, 0]
        return (
          <div className="flex gap-1">
            {vecValue.map((v: number, i: number) => (
              <input
                key={i}
                type="number"
                value={v}
                step={options?.step || 0.1}
                onChange={(e) => {
                  const newVec = [...vecValue]
                  newVec[i] = parseFloat(e.target.value) || 0
                  onChange(newVec)
                }}
                className="w-full px-1 py-0.5 rounded text-xs text-center"
                style={{
                  backgroundColor: theme.bg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}
              />
            ))}
          </div>
        )

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
// Vec3 Input Component
// ─────────────────────────────────────────────────────────────────────────────

function Vec3Input({
  label,
  value,
  onChange,
}: {
  label: string
  value: [number, number, number]
  onChange: (index: number, value: number) => void
}) {
  const theme = useTheme()

  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 w-16 text-xs" style={{ color: theme.textMuted }}>
        {label}
      </label>
      <div className="flex-1 flex gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="flex-1 flex items-center gap-1">
            <span style={{ color: ['#ef4444', '#22c55e', '#3b82f6'][i], fontSize: '10px' }}>
              {axis}
            </span>
            <input
              type="number"
              value={value[i]}
              step={0.1}
              onChange={(e) => onChange(i, parseFloat(e.target.value) || 0)}
              className="w-full px-1 py-0.5 rounded text-xs text-center"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            />
          </div>
        ))}
      </div>
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

  // Legacy format: extract from script path
  if (component.script) {
    if (component.script.startsWith('builtin:')) {
      const builtinType = component.script.replace('builtin:', '')
      const typeMap: Record<string, string> = {
        floor_generator: 'FloorGenerator',
      }
      return typeMap[builtinType] || null
    }

    const scriptName = component.script.split('/').pop()?.replace('.lua', '') || ''
    const scriptTypeMap: Record<string, string> = {
      player_controller: 'PlayerController',
      health: 'Health',
      enemy_ai: 'AI',
      flicker: 'Light',
      interactable: 'Interactable',
    }
    return scriptTypeMap[scriptName] || null
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
