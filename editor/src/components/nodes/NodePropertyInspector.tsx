// =============================================================================
// Node Property Inspector - Edit properties of selected visual scripting nodes
// =============================================================================

import { useState, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useTheme } from '../../stores/useEngineState'
import { getNodeType, NodePortDefinition, PORT_COLORS, ScriptNodeData, createDefaultScriptData } from '../../lib/nodes/types'
import type { CustomNodeData } from './CustomNode'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NodePropertyInspectorProps {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  onNodeChange: (nodeId: string, updates: Partial<Node>) => void
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NodePropertyInspector({
  nodes,
  edges,
  selectedNodeIds,
  onNodeChange,
}: NodePropertyInspectorProps) {
  const theme = useTheme()

  // Get selected node
  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0])
    : null

  if (!selectedNode) {
    return (
      <div
        className="p-4 text-center"
        style={{ color: theme.textDim }}
      >
        <div className="text-2xl mb-2">◇</div>
        <div className="text-xs">
          {selectedNodeIds.length === 0
            ? 'Select a node to edit properties'
            : 'Multiple nodes selected'}
        </div>
      </div>
    )
  }

  const nodeData = selectedNode.data as CustomNodeData
  const nodeType = getNodeType(nodeData.nodeTypeId)

  if (!nodeType) {
    return (
      <div className="p-4" style={{ color: theme.error }}>
        Unknown node type: {nodeData.nodeTypeId}
      </div>
    )
  }

  // Special handling for Script nodes
  if (nodeData.nodeTypeId === 'script') {
    return (
      <ScriptNodeInspector
        node={selectedNode}
        nodeData={nodeData as unknown as ScriptNodeData}
        onNodeChange={onNodeChange}
      />
    )
  }

  // Find which input ports have connections
  const connectedInputs = new Set(
    edges
      .filter((e) => e.target === selectedNode.id)
      .map((e) => e.targetHandle)
  )

  // Handle input value change
  const handleInputChange = (inputId: string, value: unknown) => {
    const currentInputs = nodeData.inputs || {}
    onNodeChange(selectedNode.id, {
      data: {
        ...nodeData,
        inputs: {
          ...currentInputs,
          [inputId]: value,
        },
      },
    })
  }

  // Handle label change
  const handleLabelChange = (label: string) => {
    onNodeChange(selectedNode.id, {
      data: {
        ...nodeData,
        label: label || undefined,
      },
    })
  }

  return (
    <div className="text-xs">
      {/* Node Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          backgroundColor: nodeType.color + '20',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span className="text-base" style={{ color: nodeType.color }}>
          {nodeType.icon}
        </span>
        <div className="flex-1">
          <div className="font-medium" style={{ color: theme.text }}>
            {nodeType.name}
          </div>
          <div className="text-[10px]" style={{ color: theme.textMuted }}>
            {nodeType.category}
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        className="px-3 py-2 text-[10px]"
        style={{ color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}
      >
        {nodeType.description}
      </div>

      {/* Custom Label */}
      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="mb-1" style={{ color: theme.textMuted }}>Label</div>
        <input
          type="text"
          value={nodeData.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={nodeType.name}
          className="w-full px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        />
      </div>

      {/* Input Ports */}
      {nodeType.inputs.length > 0 && (
        <div className="px-3 py-2" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="mb-2 uppercase tracking-wider" style={{ color: theme.textMuted }}>
            Inputs
          </div>
          <div className="space-y-2">
            {nodeType.inputs.map((input) => (
              <InputField
                key={input.id}
                port={input}
                value={nodeData.inputs?.[input.id]}
                onChange={(value) => handleInputChange(input.id, value)}
                isConnected={connectedInputs.has(input.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Output Ports (read-only info) */}
      {nodeType.outputs.length > 0 && (
        <div className="px-3 py-2">
          <div className="mb-2 uppercase tracking-wider" style={{ color: theme.textMuted }}>
            Outputs
          </div>
          <div className="space-y-1">
            {nodeType.outputs.map((output) => (
              <OutputInfo key={output.id} port={output} />
            ))}
          </div>
        </div>
      )}

      {/* Node Position */}
      <div className="px-3 py-2" style={{ borderTop: `1px solid ${theme.border}` }}>
        <div className="mb-1 uppercase tracking-wider" style={{ color: theme.textMuted }}>
          Position
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px]" style={{ color: theme.textDim }}>X</label>
            <input
              type="number"
              value={Math.round(selectedNode.position.x)}
              onChange={(e) => {
                onNodeChange(selectedNode.id, {
                  position: {
                    ...selectedNode.position,
                    x: parseInt(e.target.value) || 0,
                  },
                })
              }}
              className="w-full px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px]" style={{ color: theme.textDim }}>Y</label>
            <input
              type="number"
              value={Math.round(selectedNode.position.y)}
              onChange={(e) => {
                onNodeChange(selectedNode.id, {
                  position: {
                    ...selectedNode.position,
                    y: parseInt(e.target.value) || 0,
                  },
                })
              }}
              className="w-full px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Input Field Component
// -----------------------------------------------------------------------------

interface InputFieldProps {
  port: NodePortDefinition
  value: unknown
  onChange: (value: unknown) => void
  isConnected: boolean
}

function InputField({ port, value, onChange, isConnected }: InputFieldProps) {
  const theme = useTheme()
  const portColor = PORT_COLORS[port.type] || PORT_COLORS.any

  // If connected, show as read-only
  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: portColor }}
        />
        <span style={{ color: theme.textMuted }}>
          {port.label || port.id}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: theme.textDim }}>
          (connected)
        </span>
      </div>
    )
  }

  // Render input based on port type
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: portColor }}
        />
        <span style={{ color: theme.text }}>
          {port.label || port.id}
          {port.required && <span style={{ color: theme.error }}>*</span>}
        </span>
      </div>
      <div className="ml-4">
        {renderInputControl(port, value, onChange, theme)}
      </div>
    </div>
  )
}

function renderInputControl(
  port: NodePortDefinition,
  value: unknown,
  onChange: (value: unknown) => void,
  theme: ReturnType<typeof useTheme>
) {
  const inputStyle = {
    backgroundColor: theme.bg,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  }

  switch (port.type) {
    case 'number':
      return (
        <input
          type="number"
          value={value as number ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1 rounded text-xs"
          style={inputStyle}
        />
      )

    case 'string':
      return (
        <input
          type="text"
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={port.label || port.id}
          className="w-full px-2 py-1 rounded text-xs"
          style={inputStyle}
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
            {value ? 'True' : 'False'}
          </span>
        </label>
      )

    case 'flow':
      // Flow ports don't have editable values
      return null

    case 'entity':
      return (
        <input
          type="text"
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Entity ID or name"
          className="w-full px-2 py-1 rounded text-xs"
          style={inputStyle}
        />
      )

    case 'position':
      const pos = (value as [number, number]) ?? [0, 0]
      return (
        <div className="flex gap-1">
          <input
            type="number"
            value={pos[0]}
            onChange={(e) => onChange([parseFloat(e.target.value) || 0, pos[1]])}
            className="w-1/2 px-2 py-1 rounded text-xs"
            style={inputStyle}
            placeholder="X"
          />
          <input
            type="number"
            value={pos[1]}
            onChange={(e) => onChange([pos[0], parseFloat(e.target.value) || 0])}
            className="w-1/2 px-2 py-1 rounded text-xs"
            style={inputStyle}
            placeholder="Y"
          />
        </div>
      )

    default:
      // Generic input for 'any' type
      return (
        <input
          type="text"
          value={typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
          onChange={(e) => {
            // Try to parse as JSON, fallback to string
            try {
              const parsed = JSON.parse(e.target.value)
              onChange(parsed)
            } catch {
              onChange(e.target.value)
            }
          }}
          placeholder="Value"
          className="w-full px-2 py-1 rounded text-xs"
          style={inputStyle}
        />
      )
  }
}

// -----------------------------------------------------------------------------
// Output Info Component
// -----------------------------------------------------------------------------

interface OutputInfoProps {
  port: NodePortDefinition
}

function OutputInfo({ port }: OutputInfoProps) {
  const theme = useTheme()
  const portColor = PORT_COLORS[port.type] || PORT_COLORS.any

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2"
        style={{
          backgroundColor: port.type === 'flow' ? 'transparent' : portColor,
          border: `2px solid ${portColor}`,
          borderRadius: port.type === 'flow' ? 2 : '50%',
        }}
      />
      <span style={{ color: theme.textMuted }}>
        {port.label || port.id}
      </span>
      <span className="text-[10px] ml-auto" style={{ color: theme.textDim }}>
        {port.type}
      </span>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Script Node Inspector - Special editor for Script nodes
// -----------------------------------------------------------------------------

interface ScriptNodeInspectorProps {
  node: Node
  nodeData: ScriptNodeData
  onNodeChange: (nodeId: string, updates: Partial<Node>) => void
}

const PORT_TYPE_OPTIONS: Array<{ value: NodePortDefinition['type']; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'String' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'entity', label: 'Entity' },
  { value: 'position', label: 'Position' },
]

function ScriptNodeInspector({ node, nodeData, onNodeChange }: ScriptNodeInspectorProps) {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<'code' | 'inputs' | 'outputs' | 'signals'>('code')

  // Initialize script data if not present
  const scriptData: ScriptNodeData = {
    ...createDefaultScriptData(),
    ...nodeData,
  }

  const updateScriptData = useCallback((updates: Partial<ScriptNodeData>) => {
    onNodeChange(node.id, {
      data: {
        ...scriptData,
        ...updates,
      },
    })
  }, [node.id, scriptData, onNodeChange])

  // Add a new custom input
  const addCustomInput = () => {
    const newId = `input_${scriptData.customInputs.length + 1}`
    updateScriptData({
      customInputs: [
        ...scriptData.customInputs,
        { id: newId, label: 'New Input', type: 'any' },
      ],
    })
  }

  // Add a new custom output
  const addCustomOutput = () => {
    const newId = `output_${scriptData.customOutputs.length + 1}`
    updateScriptData({
      customOutputs: [
        ...scriptData.customOutputs,
        { id: newId, label: 'New Output', type: 'any' },
      ],
    })
  }

  // Remove a custom input
  const removeCustomInput = (index: number) => {
    const newInputs = [...scriptData.customInputs]
    newInputs.splice(index, 1)
    updateScriptData({ customInputs: newInputs })
  }

  // Remove a custom output
  const removeCustomOutput = (index: number) => {
    const newOutputs = [...scriptData.customOutputs]
    newOutputs.splice(index, 1)
    updateScriptData({ customOutputs: newOutputs })
  }

  // Update a custom input
  const updateCustomInput = (index: number, updates: Partial<NodePortDefinition>) => {
    const newInputs = [...scriptData.customInputs]
    newInputs[index] = { ...newInputs[index], ...updates }
    updateScriptData({ customInputs: newInputs })
  }

  // Update a custom output
  const updateCustomOutput = (index: number, updates: Partial<NodePortDefinition>) => {
    const newOutputs = [...scriptData.customOutputs]
    newOutputs[index] = { ...newOutputs[index], ...updates }
    updateScriptData({ customOutputs: newOutputs })
  }

  // Add a signal to listen
  const addListenSignal = () => {
    updateScriptData({
      listenSignals: [...scriptData.listenSignals, 'new-signal'],
    })
  }

  // Add a signal to emit
  const addEmitSignal = () => {
    updateScriptData({
      emitSignals: [...scriptData.emitSignals, 'new-signal'],
    })
  }

  // Update a listen signal
  const updateListenSignal = (index: number, value: string) => {
    const newSignals = [...scriptData.listenSignals]
    newSignals[index] = value
    updateScriptData({ listenSignals: newSignals })
  }

  // Update an emit signal
  const updateEmitSignal = (index: number, value: string) => {
    const newSignals = [...scriptData.emitSignals]
    newSignals[index] = value
    updateScriptData({ emitSignals: newSignals })
  }

  // Remove a listen signal
  const removeListenSignal = (index: number) => {
    const newSignals = [...scriptData.listenSignals]
    newSignals.splice(index, 1)
    updateScriptData({ listenSignals: newSignals })
  }

  // Remove an emit signal
  const removeEmitSignal = (index: number) => {
    const newSignals = [...scriptData.emitSignals]
    newSignals.splice(index, 1)
    updateScriptData({ emitSignals: newSignals })
  }

  return (
    <div className="text-xs">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{
          backgroundColor: '#6366f120',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span className="text-base" style={{ color: '#6366f1' }}>
          {'{ }'}
        </span>
        <div className="flex-1">
          <div className="font-medium" style={{ color: theme.text }}>
            Script Node
          </div>
          <div className="text-[10px]" style={{ color: theme.textMuted }}>
            Custom TypeScript
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {(['code', 'inputs', 'outputs', 'signals'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: activeTab === tab ? theme.bgHover : 'transparent',
              color: activeTab === tab ? theme.text : theme.textMuted,
              borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === 'code' && (
          <div>
            <div className="mb-2" style={{ color: theme.textMuted }}>
              TypeScript Code
            </div>
            <textarea
              value={scriptData.code}
              onChange={(e) => updateScriptData({ code: e.target.value })}
              className="w-full px-2 py-2 rounded text-xs font-mono resize-y"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                minHeight: 200,
              }}
              spellCheck={false}
            />
            <div className="mt-2 text-[10px]" style={{ color: theme.textDim }}>
              Available: inputs, ctx, self, emit(), Scene, Events, Timers
            </div>
          </div>
        )}

        {activeTab === 'inputs' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: theme.textMuted }}>Custom Inputs</span>
              <button
                onClick={addCustomInput}
                className="px-2 py-0.5 rounded text-[10px]"
                style={{
                  backgroundColor: theme.accent,
                  color: theme.bg,
                }}
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {scriptData.customInputs.map((input, i) => (
                <PortEditor
                  key={i}
                  port={input}
                  onUpdate={(updates) => updateCustomInput(i, updates)}
                  onRemove={() => removeCustomInput(i)}
                />
              ))}
              {scriptData.customInputs.length === 0 && (
                <div className="text-[10px] py-2 text-center" style={{ color: theme.textDim }}>
                  No custom inputs defined
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'outputs' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: theme.textMuted }}>Custom Outputs</span>
              <button
                onClick={addCustomOutput}
                className="px-2 py-0.5 rounded text-[10px]"
                style={{
                  backgroundColor: theme.accent,
                  color: theme.bg,
                }}
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {scriptData.customOutputs.map((output, i) => (
                <PortEditor
                  key={i}
                  port={output}
                  onUpdate={(updates) => updateCustomOutput(i, updates)}
                  onRemove={() => removeCustomOutput(i)}
                />
              ))}
              {scriptData.customOutputs.length === 0 && (
                <div className="text-[10px] py-2 text-center" style={{ color: theme.textDim }}>
                  No custom outputs defined
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-4">
            {/* Listen Signals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: theme.textMuted }}>Listen To</span>
                <button
                  onClick={addListenSignal}
                  className="px-2 py-0.5 rounded text-[10px]"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.bg,
                  }}
                >
                  + Add
                </button>
              </div>
              <div className="space-y-1">
                {scriptData.listenSignals.map((signal, i) => (
                  <div key={i} className="flex gap-1">
                    <input
                      type="text"
                      value={signal}
                      onChange={(e) => updateListenSignal(i, e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: theme.bg,
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                      }}
                      placeholder="signal-name"
                    />
                    <button
                      onClick={() => removeListenSignal(i)}
                      className="px-2 rounded"
                      style={{ color: theme.error }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {scriptData.listenSignals.length === 0 && (
                  <div className="text-[10px] py-2 text-center" style={{ color: theme.textDim }}>
                    No signals being listened to
                  </div>
                )}
              </div>
            </div>

            {/* Emit Signals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: theme.textMuted }}>Can Emit</span>
                <button
                  onClick={addEmitSignal}
                  className="px-2 py-0.5 rounded text-[10px]"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.bg,
                  }}
                >
                  + Add
                </button>
              </div>
              <div className="space-y-1">
                {scriptData.emitSignals.map((signal, i) => (
                  <div key={i} className="flex gap-1">
                    <input
                      type="text"
                      value={signal}
                      onChange={(e) => updateEmitSignal(i, e.target.value)}
                      className="flex-1 px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: theme.bg,
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                      }}
                      placeholder="signal-name"
                    />
                    <button
                      onClick={() => removeEmitSignal(i)}
                      className="px-2 rounded"
                      style={{ color: theme.error }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {scriptData.emitSignals.length === 0 && (
                  <div className="text-[10px] py-2 text-center" style={{ color: theme.textDim }}>
                    No emit signals defined
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Port Editor Component - For editing custom inputs/outputs
// -----------------------------------------------------------------------------

interface PortEditorProps {
  port: NodePortDefinition
  onUpdate: (updates: Partial<NodePortDefinition>) => void
  onRemove: () => void
}

function PortEditor({ port, onUpdate, onRemove }: PortEditorProps) {
  const theme = useTheme()
  const portColor = PORT_COLORS[port.type] || PORT_COLORS.any

  return (
    <div
      className="p-2 rounded"
      style={{
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: portColor }}
        />
        <input
          type="text"
          value={port.id}
          onChange={(e) => onUpdate({ id: e.target.value.replace(/\s+/g, '_') })}
          className="flex-1 px-1 py-0.5 rounded text-xs"
          style={{
            backgroundColor: theme.bgPanel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
          placeholder="port_id"
        />
        <button
          onClick={onRemove}
          className="px-1 rounded text-sm"
          style={{ color: theme.error }}
        >
          ×
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={port.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 px-1 py-0.5 rounded text-xs"
          style={{
            backgroundColor: theme.bgPanel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
          placeholder="Label"
        />
        <select
          value={port.type}
          onChange={(e) => onUpdate({ type: e.target.value as NodePortDefinition['type'] })}
          className="px-1 py-0.5 rounded text-xs"
          style={{
            backgroundColor: theme.bgPanel,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        >
          {PORT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default NodePropertyInspector
