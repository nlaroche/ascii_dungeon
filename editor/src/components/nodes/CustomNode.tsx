// ═══════════════════════════════════════════════════════════════════════════
// Custom Node Component - Renders nodes in the flow editor
// Clean, readable design with consistent styling
// ═══════════════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useTheme } from '../../stores/useEngineState';
import { getNodeType, PORT_COLORS, NodePortDefinition } from '../../lib/nodes/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomNodeData extends Record<string, unknown> {
  nodeTypeId: string;
  label?: string;
  inputs?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Row Component - Single port with label
// ─────────────────────────────────────────────────────────────────────────────

interface PortRowProps {
  port: NodePortDefinition;
  type: 'input' | 'output';
  value?: unknown;
}

function PortRow({ port, type, value }: PortRowProps) {
  const theme = useTheme();
  const color = PORT_COLORS[port.type] || PORT_COLORS.any;
  const isFlow = port.type === 'flow';

  return (
    <div
      className="relative flex items-center gap-2 py-0.5"
      style={{
        justifyContent: type === 'input' ? 'flex-start' : 'flex-end',
        paddingLeft: type === 'input' ? 12 : 4,
        paddingRight: type === 'output' ? 12 : 4,
      }}
    >
      <Handle
        type={type === 'input' ? 'target' : 'source'}
        position={type === 'input' ? Position.Left : Position.Right}
        id={port.id}
        style={{
          position: 'absolute',
          [type === 'input' ? 'left' : 'right']: -4,
          top: '50%',
          transform: 'translateY(-50%)',
          width: isFlow ? 8 : 6,
          height: isFlow ? 8 : 6,
          backgroundColor: isFlow ? 'transparent' : color,
          border: `1.5px solid ${color}`,
          borderRadius: isFlow ? 1 : '50%',
        }}
      />
      {type === 'input' ? (
        <>
          <span className="text-[10px]" style={{ color: theme.textMuted }}>
            {port.label || port.id}
            {port.required && <span style={{ color: theme.error }}> *</span>}
          </span>
          {value !== undefined && (
            <span className="text-[10px] ml-auto" style={{ color: theme.accent }}>
              {formatValue(value)}
            </span>
          )}
        </>
      ) : (
        <span className="text-[10px]" style={{ color: theme.textMuted }}>
          {port.label || port.id}
        </span>
      )}
    </div>
  );
}

// Format value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.length > 12 ? value.slice(0, 12) + '…' : value;
  if (typeof value === 'number') return String(Math.round(value * 100) / 100);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value).slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Node Component
// ─────────────────────────────────────────────────────────────────────────────

function CustomNodeComponent({ data, selected }: NodeProps) {
  const theme = useTheme();
  const nodeData = data as CustomNodeData;
  const nodeType = useMemo(() => getNodeType(nodeData.nodeTypeId), [nodeData.nodeTypeId]);

  if (!nodeType) {
    return (
      <div
        className="px-3 py-2 rounded text-xs"
        style={{
          backgroundColor: '#1a1a1a',
          border: `2px solid ${theme.error}`,
          color: theme.error,
        }}
      >
        ⚠ Unknown: {nodeData.nodeTypeId}
      </div>
    );
  }

  // Separate flow and data ports
  const inputFlowPorts = nodeType.inputs.filter(p => p.type === 'flow');
  const inputDataPorts = nodeType.inputs.filter(p => p.type !== 'flow');
  const outputFlowPorts = nodeType.outputs.filter(p => p.type === 'flow');
  const outputDataPorts = nodeType.outputs.filter(p => p.type !== 'flow');

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        minWidth: 120,
        maxWidth: 200,
        backgroundColor: '#1e1e1e',
        border: `1.5px solid ${selected ? theme.accent : '#333'}`,
        boxShadow: selected ? `0 0 8px ${theme.accent}40` : '0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        className="px-2 py-1 flex items-center gap-1.5"
        style={{
          backgroundColor: '#252525',
          borderBottom: '1px solid #333',
        }}
      >
        {/* Category color indicator */}
        <div
          className="w-1.5 h-3 rounded-sm"
          style={{ backgroundColor: nodeType.color }}
        />
        <span className="text-[10px]" style={{ color: nodeType.color }}>
          {nodeType.icon}
        </span>
        <span className="text-[11px] font-medium truncate" style={{ color: '#e0e0e0' }}>
          {nodeData.label || nodeType.name}
        </span>
      </div>

      {/* Flow ports row (if any) */}
      {(inputFlowPorts.length > 0 || outputFlowPorts.length > 0) && (
        <div
          className="flex justify-between px-1"
          style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
        >
          <div>
            {inputFlowPorts.map((port) => (
              <PortRow key={port.id} port={port} type="input" />
            ))}
          </div>
          <div>
            {outputFlowPorts.map((port) => (
              <PortRow key={port.id} port={port} type="output" />
            ))}
          </div>
        </div>
      )}

      {/* Data ports */}
      {(inputDataPorts.length > 0 || outputDataPorts.length > 0) && (
        <div className="py-1">
          {/* Input data ports */}
          {inputDataPorts.map((port) => (
            <PortRow
              key={port.id}
              port={port}
              type="input"
              value={nodeData.inputs?.[port.id]}
            />
          ))}
          {/* Output data ports */}
          {outputDataPorts.map((port) => (
            <PortRow key={port.id} port={port} type="output" />
          ))}
        </div>
      )}

      {/* Empty node body spacer */}
      {inputDataPorts.length === 0 && outputDataPorts.length === 0 &&
       inputFlowPorts.length === 0 && outputFlowPorts.length === 0 && (
        <div className="py-2" />
      )}
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);

// ─────────────────────────────────────────────────────────────────────────────
// Node Types for React Flow
// ─────────────────────────────────────────────────────────────────────────────

export const nodeTypes = {
  custom: CustomNode,
};

export default CustomNode;
