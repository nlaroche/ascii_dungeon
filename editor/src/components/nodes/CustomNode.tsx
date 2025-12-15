// ═══════════════════════════════════════════════════════════════════════════
// Custom Node Component - Renders nodes in the flow editor
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
// Port Component
// ─────────────────────────────────────────────────────────────────────────────

interface PortProps {
  port: NodePortDefinition;
  type: 'input' | 'output';
  index: number;
  total: number;
}

function Port({ port, type, index, total }: PortProps) {
  const theme = useTheme();
  const color = PORT_COLORS[port.type] || PORT_COLORS.any;
  const isFlow = port.type === 'flow';

  // Calculate vertical position based on index
  const topPercent = total === 1 ? 50 : 20 + (index / (total - 1)) * 60;

  return (
    <>
      <Handle
        type={type === 'input' ? 'target' : 'source'}
        position={type === 'input' ? Position.Left : Position.Right}
        id={port.id}
        style={{
          top: `${topPercent}%`,
          width: isFlow ? 10 : 8,
          height: isFlow ? 10 : 8,
          backgroundColor: isFlow ? 'transparent' : color,
          border: `2px solid ${color}`,
          borderRadius: isFlow ? 2 : '50%',
        }}
      />
      {port.label && (
        <div
          className="absolute text-[10px] whitespace-nowrap"
          style={{
            top: `${topPercent}%`,
            transform: 'translateY(-50%)',
            [type === 'input' ? 'left' : 'right']: 16,
            color: theme.textMuted,
          }}
        >
          {port.label}
          {port.required && <span style={{ color: theme.error }}>*</span>}
        </div>
      )}
    </>
  );
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
          backgroundColor: theme.error,
          color: '#fff',
        }}
      >
        Unknown: {nodeData.nodeTypeId}
      </div>
    );
  }

  const borderColor = selected ? theme.accent : nodeType.color;

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        minWidth: 140,
        backgroundColor: theme.bgPanel,
        border: `2px solid ${borderColor}`,
        boxShadow: selected ? `0 0 0 2px ${theme.accent}40` : 'none',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          backgroundColor: nodeType.color + '20',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ color: nodeType.color }}>{nodeType.icon}</span>
        <span className="text-xs font-medium" style={{ color: theme.text }}>
          {nodeData.label || nodeType.name}
        </span>
      </div>

      {/* Body with ports */}
      <div
        className="relative px-3 py-3"
        style={{
          minHeight: Math.max(nodeType.inputs.length, nodeType.outputs.length) * 24 + 16,
        }}
      >
        {/* Input ports */}
        {nodeType.inputs.map((port, i) => (
          <Port
            key={port.id}
            port={port}
            type="input"
            index={i}
            total={nodeType.inputs.length}
          />
        ))}

        {/* Output ports */}
        {nodeType.outputs.map((port, i) => (
          <Port
            key={port.id}
            port={port}
            type="output"
            index={i}
            total={nodeType.outputs.length}
          />
        ))}

        {/* Input values (for data nodes) */}
        {nodeData.inputs && Object.keys(nodeData.inputs).length > 0 && (
          <div className="space-y-1 mt-1">
            {Object.entries(nodeData.inputs).map(([key, value]) => (
              <div key={key} className="text-[10px]" style={{ color: theme.textMuted }}>
                {key}: <span style={{ color: theme.accent }}>{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category indicator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: nodeType.color }}
      />
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
