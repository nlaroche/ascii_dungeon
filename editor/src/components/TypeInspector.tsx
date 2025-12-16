// TypeInspector - Template Mode property inspector
// Shows type-specific fields based on TypeDefinition instead of raw node properties

import { useTheme, useSelection, useNodes } from '../stores/useEngineState'
import { TypeRegistry, type TypeDefinition, type TypeFieldDef } from '../lib/types/TypeRegistry'
import type { Node } from '../stores/engineState'

// Component type from engineState
interface ComponentData {
  id: string
  script: string
  enabled: boolean
  properties: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Inspector Panel
// ─────────────────────────────────────────────────────────────────────────────

export function TypeInspector() {
  const theme = useTheme()
  const { selection } = useSelection()
  const { getNode } = useNodes()

  const selectedNode = selection.nodes.length > 0 ? getNode(selection.nodes[0]) : null

  // No selection state
  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2">[ ]</div>
          <div className="text-xs">Select an entity to inspect</div>
          <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
            Template Mode - Type-based view
          </div>
        </div>
      </div>
    )
  }

  // Get types that apply to this node
  const nodeTypes = TypeRegistry.getNodeTypes(selectedNode)

  // If no types match, show basic info
  if (nodeTypes.length === 0) {
    return (
      <div className="h-full overflow-y-auto text-xs">
        <NodeHeader node={selectedNode} />
        <div className="p-4" style={{ color: theme.textDim }}>
          <div className="text-center">
            <div className="text-2xl mb-2">?</div>
            <div>No Type component attached</div>
            <div className="mt-2 text-xs" style={{ color: theme.textMuted }}>
              Add a Type component (Entity, Item, etc.) to enable type-specific editing
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render inspector for each type
  return (
    <div className="h-full overflow-y-auto text-xs">
      <NodeHeader node={selectedNode} />

      {nodeTypes.map((typeName) => {
        const typeDef = TypeRegistry.get(typeName)
        if (!typeDef) return null

        const component = TypeRegistry.getTypeComponent(selectedNode, typeName)

        return (
          <TypeSection
            key={typeName}
            node={selectedNode}
            typeDef={typeDef}
            component={component}
          />
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Header
// ─────────────────────────────────────────────────────────────────────────────

function NodeHeader({ node }: { node: Node }) {
  const theme = useTheme()
  const nodeTypes = TypeRegistry.getNodeTypes(node)
  const primaryType = nodeTypes.length > 0 ? TypeRegistry.get(nodeTypes[0]) : null

  return (
    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{
        borderBottom: `1px solid ${theme.border}`,
        backgroundColor: theme.bgHover,
      }}
    >
      <span
        className="text-lg"
        style={{ color: primaryType?.color || theme.text }}
      >
        {primaryType?.icon || node.visual?.glyph || '?'}
      </span>
      <div>
        <div style={{ color: theme.text }}>{node.name}</div>
        <div style={{ color: theme.textDim }}>
          {primaryType?.name || node.type}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Section - Renders fields for a specific type
// ─────────────────────────────────────────────────────────────────────────────

interface TypeSectionProps {
  node: Node
  typeDef: TypeDefinition
  component: ComponentData | null
}

function TypeSection({ node: _node, typeDef, component }: TypeSectionProps) {
  const theme = useTheme()
  // Note: setPath would be used to update component properties
  // const setPath = useNodes().setPath

  // Get component properties or empty object
  const properties = component?.properties || {}

  // Render sections from type definition
  return (
    <div>
      {typeDef.inspector.map((section) => (
        <div
          key={section.id}
          className="border-b"
          style={{ borderColor: theme.border }}
        >
          {/* Section header */}
          <div
            className="px-3 py-1.5 text-xs uppercase tracking-wider"
            style={{ color: theme.textMuted, backgroundColor: theme.bgHover + '50' }}
          >
            {section.label}
          </div>

          {/* Section fields */}
          <div className="p-3 space-y-2">
            {section.fields.map((fieldName) => {
              const fieldDef = typeDef.fields[fieldName]
              if (!fieldDef) return null

              const value = properties[fieldName] ?? fieldDef.default

              return (
                <TypeField
                  key={fieldName}
                  name={fieldName}
                  def={fieldDef}
                  value={value}
                  onChange={(newValue) => {
                    // In a real implementation, this would update the component properties
                    // through the engine state setPath function
                    console.log(`[TypeInspector] Field changed: ${fieldName} =`, newValue)
                    // TODO: Implement property update
                    // setPath(['scene', 'rootNode', ...pathToNode, 'components', compIndex, 'properties', fieldName], newValue)
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Field - Renders a single field based on its type
// ─────────────────────────────────────────────────────────────────────────────

interface TypeFieldProps {
  name: string
  def: TypeFieldDef
  value: unknown
  onChange: (value: unknown) => void
}

function TypeField({ name: _name, def, value, onChange }: TypeFieldProps) {
  const theme = useTheme()

  const renderInput = () => {
    switch (def.type) {
      case 'string':
        return (
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.bgHover,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={Number(value) || 0}
            min={def.min}
            max={def.max}
            step={def.step || 1}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.bgHover,
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

      case 'select':
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.bgHover,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          >
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )

      case 'color':
        const colorArray = Array.isArray(value) ? value : [1, 1, 1]
        const hexColor = `#${colorArray.slice(0, 3).map((c: number) =>
          Math.round(c * 255).toString(16).padStart(2, '0')
        ).join('')}`

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
              className="w-8 h-6 rounded cursor-pointer"
              style={{ border: `1px solid ${theme.border}` }}
            />
            <span style={{ color: theme.textMuted }}>{hexColor}</span>
          </div>
        )

      case 'script-ref':
      case 'node-ref':
      case 'asset-ref':
        return (
          <div
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.bgHover,
              color: value ? theme.text : theme.textDim,
              border: `1px solid ${theme.border}`,
            }}
          >
            {String(value || 'None')}
          </div>
        )

      default:
        return (
          <div style={{ color: theme.textDim }}>
            Unknown field type: {def.type}
          </div>
        )
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label
        className="shrink-0"
        style={{ color: theme.textMuted, minWidth: '80px' }}
        title={def.description}
      >
        {def.label}
        {def.required && <span style={{ color: theme.error }}>*</span>}
      </label>
      <div className="flex-1">{renderInput()}</div>
    </div>
  )
}
