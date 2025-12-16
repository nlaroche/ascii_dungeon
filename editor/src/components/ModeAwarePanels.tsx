// Mode-Aware Panels
// These components check editor mode internally and render appropriate content
// This approach works around rc-dock's content caching

import { useEditorMode } from '../stores/useEngineState'
import { NodeTree } from './NodeTree'
import { TypeInspector } from './TypeInspector'
import { EntityCollection } from './TypeCollectionPanel'
import { ComponentInspector } from './ComponentInspector'

/**
 * Entities/Nodes panel - shows NodeTree in Engine mode, EntityCollection in Template mode
 */
export function EntitiesPanel() {
  const { isTemplateMode } = useEditorMode()

  // Each render checks the mode directly
  return isTemplateMode ? <EntityCollection /> : <NodeTree />
}

/**
 * Properties panel - shows ComponentInspector in Engine mode, TypeInspector in Template mode
 */
export function ModeAwarePropertiesPanel() {
  const { isTemplateMode } = useEditorMode()

  return isTemplateMode ? <TypeInspector /> : <ComponentInspector />
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Mode Properties Panel (full node inspection)
// ─────────────────────────────────────────────────────────────────────────────

function EnginePropertiesPanel() {
  const theme = useTheme()
  const { selection } = useSelection()
  const { getNode } = useNodes()

  const selectedNode = selection.nodes.length > 0 ? getNode(selection.nodes[0]) : null

  // No selection state
  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2">{ }</div>
          <div className="text-xs">Select a node to inspect</div>
          <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
            Engine Mode - Raw node view
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {/* Node Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
      >
        <span className="text-lg" style={{
          color: selectedNode.visual?.color
            ? `rgb(${selectedNode.visual.color.map(c => c * 255).join(',')})`
            : theme.text
        }}>
          {selectedNode.visual?.glyph || '○'}
        </span>
        <div>
          <div style={{ color: theme.text }}>{selectedNode.name}</div>
          <div style={{ color: theme.textDim }}>{selectedNode.type}</div>
        </div>
      </div>

      {/* Transform (if present) */}
      {selectedNode.transform && (
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
            Transform
          </div>
          <div className="space-y-1.5">
            <PropertyRow label="Position" value={selectedNode.transform.position.map((n) => n.toFixed(1)).join(', ')} />
            <PropertyRow label="Rotation" value={selectedNode.transform.rotation.map((n) => n.toFixed(1)).join(', ')} />
            <PropertyRow label="Scale" value={selectedNode.transform.scale.map((n) => n.toFixed(1)).join(', ')} />
          </div>
        </div>
      )}

      {/* Visual (if present) */}
      {selectedNode.visual && (
        <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
            Visual
          </div>
          <div className="space-y-1.5">
            {selectedNode.visual.glyph && (
              <PropertyRow label="Glyph" value={selectedNode.visual.glyph} />
            )}
            <PropertyRow
              label="Color"
              value={
                <div
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: `rgb(${selectedNode.visual.color.map((c) => c * 255).join(',')})`,
                    borderColor: theme.border,
                  }}
                />
              }
            />
            <PropertyRow label="Visible" value={selectedNode.visual.visible ? 'Yes' : 'No'} />
          </div>
        </div>
      )}

      {/* Components */}
      <div className="p-3">
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
          Components ({selectedNode.components.length})
        </div>
        {selectedNode.components.length === 0 ? (
          <div style={{ color: theme.textDim }}>No components</div>
        ) : (
          <div className="space-y-2">
            {selectedNode.components.map((comp) => (
              <div
                key={comp.id}
                className="px-2 py-1.5 rounded"
                style={{ backgroundColor: theme.bgHover, opacity: comp.enabled ? 1 : 0.5 }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: theme.accent }}>
                    {comp.script.split('/').pop()?.replace('.lua', '')}
                  </span>
                  <span style={{ color: theme.textDim }}>
                    {comp.enabled ? '●' : '○'}
                  </span>
                </div>
                {Object.keys(comp.properties).length > 0 && (
                  <div className="mt-1 space-y-0.5" style={{ color: theme.textMuted }}>
                    {Object.entries(comp.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span style={{ color: theme.text }}>{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta (custom data) */}
      {Object.keys(selectedNode.meta).length > 0 && (
        <div className="p-3" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
            Meta
          </div>
          <div className="space-y-0.5" style={{ color: theme.textMuted }}>
            {Object.entries(selectedNode.meta).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span style={{ color: theme.text }}>{JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: React.ReactNode }) {
  const theme = useTheme()
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: theme.textMuted }}>{label}</span>
      <span style={{ color: theme.text }}>{value}</span>
    </div>
  )
}
