// =============================================================================
// Variable Inspector - View and edit graph variables during execution
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../../stores/useEngineState'
import {
  GraphRunner,
  GraphRunnerEvent,
  GraphRunnerState,
} from '../../scripting/runtime/GraphRunner'
import { ExprValue } from '../../scripting/runtime/expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface VariableInspectorProps {
  graphRunner: GraphRunner
}

interface VariableEntry {
  name: string
  value: ExprValue
  type: string
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function VariableInspector({ graphRunner }: VariableInspectorProps) {
  const theme = useTheme()
  const [variables, setVariables] = useState<VariableEntry[]>([])
  const [state, setState] = useState<GraphRunnerState>('idle')
  const [editingVar, setEditingVar] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // Subscribe to runner events
  useEffect(() => {
    const updateVariables = () => {
      const allVars = graphRunner.getAllVariables()
      const entries: VariableEntry[] = Object.entries(allVars).map(([name, value]) => ({
        name,
        value,
        type: inferType(value),
      }))
      setVariables(entries)
    }

    const unsubscribe = graphRunner.addListener((event: GraphRunnerEvent) => {
      if (event.type === 'stateChange') {
        const { state: newState } = event.data as { state: GraphRunnerState }
        setState(newState)
        if (newState === 'running' || newState === 'paused') {
          updateVariables()
        }
      } else if (event.type === 'variableChange') {
        updateVariables()
      }
    })

    // Initial update
    updateVariables()

    // Poll for updates when running
    let pollInterval: ReturnType<typeof setInterval> | null = null
    if (state === 'running') {
      pollInterval = setInterval(updateVariables, 100)
    }

    return () => {
      unsubscribe()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [graphRunner, state])

  // Handle variable edit
  const handleStartEdit = (name: string, value: ExprValue) => {
    setEditingVar(name)
    setEditValue(valueToString(value))
  }

  const handleSaveEdit = useCallback(() => {
    if (!editingVar) return

    try {
      const parsedValue = parseValue(editValue)
      graphRunner.setVariable(editingVar, parsedValue)
    } catch (e) {
      console.error('[VariableInspector] Failed to parse value:', e)
    }

    setEditingVar(null)
    setEditValue('')
  }, [editingVar, editValue, graphRunner])

  const handleCancelEdit = () => {
    setEditingVar(null)
    setEditValue('')
  }

  return (
    <div className="text-xs">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <span style={{ color: theme.textMuted }}>
          Variables ({variables.length})
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor:
              state === 'running'
                ? '#22c55e20'
                : state === 'paused'
                ? '#f59e0b20'
                : theme.bgHover,
            color:
              state === 'running'
                ? '#22c55e'
                : state === 'paused'
                ? '#f59e0b'
                : theme.textDim,
          }}
        >
          {state}
        </span>
      </div>

      {/* Variable list */}
      {variables.length === 0 ? (
        <div className="p-4 text-center" style={{ color: theme.textDim }}>
          <div className="text-lg mb-1">{ }</div>
          <div className="text-[10px]">
            {state === 'idle'
              ? 'Start the graph to see variables'
              : 'No variables defined'}
          </div>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: theme.border }}>
          {variables.map((v) => (
            <VariableRow
              key={v.name}
              variable={v}
              isEditing={editingVar === v.name}
              editValue={editValue}
              onStartEdit={() => handleStartEdit(v.name, v.value)}
              onEditChange={setEditValue}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              disabled={state !== 'running' && state !== 'paused'}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      <div
        className="px-3 py-2 text-[10px]"
        style={{ borderTop: `1px solid ${theme.border}`, color: theme.textDim }}
      >
        Click a value to edit. Changes take effect immediately.
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Variable Row Component
// -----------------------------------------------------------------------------

interface VariableRowProps {
  variable: VariableEntry
  isEditing: boolean
  editValue: string
  onStartEdit: () => void
  onEditChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  disabled: boolean
}

function VariableRow({
  variable,
  isEditing,
  editValue,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
  disabled,
}: VariableRowProps) {
  const theme = useTheme()

  return (
    <div
      className="px-3 py-2 flex items-center gap-2"
      style={{ backgroundColor: isEditing ? theme.bgHover : 'transparent' }}
    >
      {/* Variable name */}
      <div className="flex-1">
        <div style={{ color: theme.text }}>{variable.name}</div>
        <div className="text-[10px]" style={{ color: theme.textDim }}>
          {variable.type}
        </div>
      </div>

      {/* Value */}
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
            autoFocus
            className="w-24 px-1 py-0.5 rounded text-xs"
            style={{
              backgroundColor: theme.bg,
              color: theme.text,
              border: `1px solid ${theme.accent}`,
            }}
          />
          <button
            onClick={onSave}
            className="px-1 py-0.5 rounded text-[10px]"
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            ✓
          </button>
          <button
            onClick={onCancel}
            className="px-1 py-0.5 rounded text-[10px]"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
          >
            ✗
          </button>
        </div>
      ) : (
        <button
          onClick={onStartEdit}
          disabled={disabled}
          className="px-2 py-0.5 rounded text-xs text-right transition-colors"
          style={{
            backgroundColor: disabled ? 'transparent' : theme.bgHover,
            color: getValueColor(variable.value, theme),
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
          title={disabled ? 'Start graph to edit' : 'Click to edit'}
        >
          {formatValue(variable.value)}
        </button>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function inferType(value: ExprValue): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === 'number') return 'vec2'
    if (value.length === 3 && typeof value[0] === 'number') return 'vec3'
    return 'array'
  }
  if (typeof value === 'object') return 'object'
  return 'unknown'
}

function valueToString(value: ExprValue): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseValue(str: string): ExprValue {
  const trimmed = str.trim()

  // Try as number
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    return parseFloat(trimmed)
  }

  // Try as boolean
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Try as null
  if (trimmed === 'null') return null

  // Try as JSON (arrays, objects)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Fall through to string
    }
  }

  // Default to string
  return str
}

function formatValue(value: ExprValue): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    // Format with limited precision
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  if (typeof value === 'string') {
    // Truncate long strings
    return value.length > 20 ? `"${value.slice(0, 17)}..."` : `"${value}"`
  }
  if (Array.isArray(value)) {
    if (value.length <= 3) {
      return `[${value.map((v) => formatValue(v)).join(', ')}]`
    }
    return `[${value.length} items]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return `{${keys.length} props}`
  }
  return String(value)
}

function getValueColor(value: ExprValue, theme: ReturnType<typeof useTheme>): string {
  if (value === null || value === undefined) return theme.textDim
  if (typeof value === 'boolean') return '#22c55e'
  if (typeof value === 'number') return '#3b82f6'
  if (typeof value === 'string') return '#f59e0b'
  if (Array.isArray(value)) return '#a855f7'
  return theme.text
}

export default VariableInspector
