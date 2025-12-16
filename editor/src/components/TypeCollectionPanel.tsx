// TypeCollectionPanel - Template Mode collection browser
// Shows all nodes of a specific Type with configurable columns and grouping

import { useMemo } from 'react'
import { useTheme, useSelection, useEngineState } from '../stores/useEngineState'
import { TypeRegistry, type TypeDefinition } from '../lib/types/TypeRegistry'
import type { Node } from '../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Type Collection Panel
// ─────────────────────────────────────────────────────────────────────────────

interface TypeCollectionPanelProps {
  typeName: string
}

export function TypeCollectionPanel({ typeName }: TypeCollectionPanelProps) {
  const theme = useTheme()
  const rootNode = useEngineState((s) => s.scene.rootNode)
  const { selection, selectNode } = useSelection()
  const typeDef = TypeRegistry.get(typeName)

  // Find all nodes of this type in the scene
  const nodesOfType = useMemo(() => {
    if (!typeDef) return []
    return TypeRegistry.findNodesOfType(rootNode, typeName)
  }, [rootNode, typeName, typeDef])

  // Group nodes if configured
  const groupedNodes = useMemo(() => {
    if (!typeDef?.collection?.groupBy) {
      return { 'All': nodesOfType }
    }

    const groups: Record<string, Node[]> = {}
    const groupField = typeDef.collection.groupBy

    for (const node of nodesOfType) {
      const component = TypeRegistry.getTypeComponent(node, typeName)
      const groupValue = String(component?.properties[groupField] || 'Other')

      if (!groups[groupValue]) {
        groups[groupValue] = []
      }
      groups[groupValue].push(node)
    }

    return groups
  }, [nodesOfType, typeDef, typeName])

  // No type definition found
  if (!typeDef) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-2xl mb-2">?</div>
          <div>Unknown type: {typeName}</div>
        </div>
      </div>
    )
  }

  // Empty state
  if (nodesOfType.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2" style={{ color: typeDef.color }}>
            {typeDef.icon}
          </div>
          <div className="font-medium" style={{ color: theme.text }}>
            No {typeDef.name}s
          </div>
          <div className="text-xs mt-1">
            Add a {typeDef.name} component to a node to see it here
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2 shrink-0"
        style={{
          borderBottom: `1px solid ${theme.border}`,
          backgroundColor: theme.bgHover,
        }}
      >
        <span style={{ color: typeDef.color }}>{typeDef.icon}</span>
        <span style={{ color: theme.text }}>{typeDef.name}s</span>
        <span
          className="px-1.5 py-0.5 rounded text-xs"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          {nodesOfType.length}
        </span>
      </div>

      {/* Content - grouped list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedNodes).map(([groupName, nodes]) => (
          <div key={groupName}>
            {/* Group header (only if grouping is enabled) */}
            {typeDef.collection?.groupBy && (
              <div
                className="px-3 py-1 text-xs uppercase tracking-wider sticky top-0"
                style={{
                  backgroundColor: theme.bg,
                  color: theme.textMuted,
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                {groupName} ({nodes.length})
              </div>
            )}

            {/* Nodes in group */}
            {nodes.map((node) => (
              <TypeCollectionItem
                key={node.id}
                node={node}
                typeDef={typeDef}
                typeName={typeName}
                isSelected={selection.nodes.includes(node.id)}
                onSelect={() => selectNode(node.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection Item
// ─────────────────────────────────────────────────────────────────────────────

interface TypeCollectionItemProps {
  node: Node
  typeDef: TypeDefinition
  typeName: string
  isSelected: boolean
  onSelect: () => void
}

function TypeCollectionItem({
  node,
  typeDef,
  typeName,
  isSelected,
  onSelect,
}: TypeCollectionItemProps) {
  const theme = useTheme()
  const component = TypeRegistry.getTypeComponent(node, typeName)
  const columns = typeDef.collection?.columns || []

  // Get display values for columns (always strings for rendering)
  const columnValues = columns.map((col) => {
    if (col.field === 'name' || col.field === 'entityName' || col.field === 'itemName') {
      const val = component?.properties[col.field]
      return String(val ?? node.name)
    }
    const val = component?.properties[col.field]
    return val !== undefined && val !== null ? String(val) : '-'
  })

  return (
    <div
      onClick={onSelect}
      className="px-3 py-2 cursor-pointer transition-colors"
      style={{
        backgroundColor: isSelected ? theme.accent + '20' : 'transparent',
        borderLeft: isSelected ? `2px solid ${theme.accent}` : '2px solid transparent',
        borderBottom: `1px solid ${theme.border}40`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = theme.bgHover
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
    >
      {/* Main row with icon and primary info */}
      <div className="flex items-center gap-2">
        <span
          style={{
            color: typeDef.color,
            fontSize: '14px',
          }}
        >
          {node.visual?.glyph || typeDef.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-xs truncate"
            style={{ color: isSelected ? theme.accent : theme.text }}
          >
            {columnValues[0] || node.name}
          </div>
          {columns.length > 1 && (
            <div className="flex gap-3 text-xs mt-0.5">
              {columns.slice(1).map((col, idx) => (
                <span key={col.field} style={{ color: theme.textMuted }}>
                  {col.label}: <span style={{ color: theme.textDim }}>{columnValues[idx + 1]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Components for Specific Types
// ─────────────────────────────────────────────────────────────────────────────

export function EntityCollection() {
  return <TypeCollectionPanel typeName="Entity" />
}

export function ItemCollection() {
  return <TypeCollectionPanel typeName="Item" />
}

export function TriggerCollection() {
  return <TypeCollectionPanel typeName="Trigger" />
}

export function LightCollection() {
  return <TypeCollectionPanel typeName="Light" />
}
