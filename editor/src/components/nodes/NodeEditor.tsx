// ═══════════════════════════════════════════════════════════════════════════
// Node Editor - Visual flow programming with react-flow
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useMemo, DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTheme } from '../../stores/useEngineState';
import { nodeTypes, CustomNodeData } from './CustomNode';
import {
  getAllNodeTypes,
  getNodesByCategory,
  NodeTypeDefinition,
  NodeCategory,
  PORT_COLORS,
} from '../../lib/nodes/types';

// ─────────────────────────────────────────────────────────────────────────────
// Initial demo nodes
// ─────────────────────────────────────────────────────────────────────────────

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 100 },
    data: { nodeTypeId: 'on-start' } as CustomNodeData,
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 350, y: 100 },
    data: { nodeTypeId: 'print', inputs: { message: 'Hello World!' } } as CustomNodeData,
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    sourceHandle: 'flow',
    target: '2',
    targetHandle: 'flow',
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Category Icons
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_INFO: Record<NodeCategory, { icon: string; label: string }> = {
  event: { icon: '⚡', label: 'Events' },
  action: { icon: '▶', label: 'Actions' },
  condition: { icon: '◇', label: 'Conditions' },
  data: { icon: '$', label: 'Data' },
  flow: { icon: '⋮', label: 'Flow' },
  custom: { icon: '★', label: 'Custom' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Node Palette Component
// ─────────────────────────────────────────────────────────────────────────────

interface NodePaletteProps {
  onAddNode: (nodeType: NodeTypeDefinition, position: { x: number; y: number }) => void;
}

function NodePalette({ onAddNode: _ }: NodePaletteProps) {
  const theme = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory>('event');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: NodeCategory[] = ['event', 'action', 'condition', 'data', 'flow', 'custom'];

  const filteredNodes = useMemo(() => {
    let nodes = getNodesByCategory(selectedCategory);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      nodes = getAllNodeTypes().filter(
        (n) =>
          n.name.toLowerCase().includes(query) ||
          n.description.toLowerCase().includes(query)
      );
    }
    return nodes;
  }, [selectedCategory, searchQuery]);

  const handleDragStart = (e: DragEvent, nodeType: NodeTypeDefinition) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="w-56 flex flex-col h-full"
      style={{
        backgroundColor: theme.bgPanel,
        borderRight: `1px solid ${theme.border}`,
      }}
    >
      {/* Search */}
      <div className="p-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes..."
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div
          className="flex flex-wrap gap-1 px-2 pb-2"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-2 py-1 rounded text-[10px] transition-colors"
              style={{
                backgroundColor: selectedCategory === cat ? theme.accent : theme.bgHover,
                color: selectedCategory === cat ? theme.bg : theme.textMuted,
              }}
              title={CATEGORY_INFO[cat].label}
            >
              {CATEGORY_INFO[cat].icon}
            </button>
          ))}
        </div>
      )}

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredNodes.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: theme.textDim }}>
            No nodes found
          </div>
        ) : (
          filteredNodes.map((nodeType) => (
            <div
              key={nodeType.id}
              draggable
              onDragStart={(e) => handleDragStart(e, nodeType)}
              className="px-2 py-1.5 rounded cursor-grab transition-colors hover:opacity-80"
              style={{
                backgroundColor: theme.bgHover,
                borderLeft: `3px solid ${nodeType.color}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: nodeType.color }}>{nodeType.icon}</span>
                <span className="text-xs" style={{ color: theme.text }}>
                  {nodeType.name}
                </span>
              </div>
              <div
                className="text-[10px] mt-0.5 ml-5"
                style={{ color: theme.textMuted }}
              >
                {nodeType.description}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-2 py-1.5 text-[10px]"
        style={{ borderTop: `1px solid ${theme.border}`, color: theme.textDim }}
      >
        Drag nodes onto the canvas
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Node Editor Component
// ─────────────────────────────────────────────────────────────────────────────

export function NodeEditor() {
  const theme = useTheme();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(3);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `e${connection.source}-${connection.target}`,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      } as Edge;
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // Add a new node
  const addNode = useCallback(
    (nodeType: NodeTypeDefinition, position: { x: number; y: number }) => {
      const newNode: Node = {
        id: String(nodeIdCounter),
        type: 'custom',
        position,
        data: { nodeTypeId: nodeType.id } as CustomNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setNodeIdCounter((c) => c + 1);
    },
    [nodeIdCounter, setNodes]
  );

  // Handle drop from palette
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const nodeType = JSON.parse(data) as NodeTypeDefinition;

      // Get the position relative to the react flow container
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 70,
        y: event.clientY - reactFlowBounds.top - 20,
      };

      addNode(nodeType, position);
    },
    [addNode]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Custom edge style
  const edgeOptions = useMemo(
    () => ({
      style: { stroke: theme.textMuted, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: theme.textMuted },
    }),
    [theme]
  );

  return (
    <div className="h-full flex" style={{ backgroundColor: theme.bg }}>
      {/* Node Palette */}
      <NodePalette onAddNode={addNode} />

      {/* Flow Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes as NodeTypes}
          defaultEdgeOptions={edgeOptions}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          style={{ backgroundColor: theme.bg }}
        >
          <Controls
            style={{
              backgroundColor: theme.bgPanel,
              borderRadius: 4,
              border: `1px solid ${theme.border}`,
            }}
          />
          <MiniMap
            style={{
              backgroundColor: theme.bgPanel,
              border: `1px solid ${theme.border}`,
            }}
            nodeColor={(node) => {
              const nodeType = getAllNodeTypes().find(
                (t) => t.id === (node.data as CustomNodeData)?.nodeTypeId
              );
              return nodeType?.color || theme.textMuted;
            }}
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color={theme.border}
          />

          {/* Top toolbar */}
          <Panel position="top-center">
            <div
              className="px-3 py-1.5 rounded flex items-center gap-4 text-xs"
              style={{
                backgroundColor: theme.bgPanel,
                border: `1px solid ${theme.border}`,
              }}
            >
              <span style={{ color: theme.textMuted }}>
                {nodes.length} nodes · {edges.length} connections
              </span>
              <button
                onClick={() => {
                  setNodes([]);
                  setEdges([]);
                }}
                className="px-2 py-0.5 rounded text-[10px]"
                style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
              >
                Clear
              </button>
            </div>
          </Panel>

          {/* Legend */}
          <Panel position="bottom-right">
            <div
              className="p-2 rounded text-[10px] space-y-1"
              style={{
                backgroundColor: theme.bgPanel + 'ee',
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ color: theme.textDim }}>Port Types:</div>
              {Object.entries(PORT_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color: theme.textMuted }}>{type}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default NodeEditor;
