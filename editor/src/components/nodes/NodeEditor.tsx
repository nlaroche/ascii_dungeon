// ═══════════════════════════════════════════════════════════════════════════
// Node Editor - Visual flow programming with react-flow
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useMemo, useEffect, DragEvent } from 'react';
import {
  ReactFlow,
  Controls,
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
  OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTheme, useEngineState } from '../../stores/useEngineState';
import { nodeTypes, CustomNodeData } from './CustomNode';
import { ExecutionControls } from './ExecutionControls';
import { NodePropertyInspector } from './NodePropertyInspector';
import { VariableInspector } from './VariableInspector';
import { GraphRunner } from '../../scripting/runtime/GraphRunner';
import { graphStorage, GraphListEntry, SavedGraph } from '../../scripting/runtime/GraphStorage';
import { useGraphHistory, useGraphClipboard } from './useGraphHistory';
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
  const projectPath = useEngineState((s) => s.project.path);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(3);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [showInspector, setShowInspector] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'variables'>('properties');
  const [graphRunner] = useState(() => new GraphRunner());

  // History and clipboard
  const { canUndo, canRedo, pushState, undo, redo } = useGraphHistory();
  const { hasClipboard, copy, paste, cut } = useGraphClipboard();

  // Graph file state
  const [currentGraphName, setCurrentGraphName] = useState<string>('Untitled');
  const [currentGraphPath, setCurrentGraphPath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<GraphListEntry[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');

  // Set up graph storage path when project changes
  useEffect(() => {
    if (projectPath) {
      graphStorage.setBasePath(projectPath);
    }
  }, [projectPath]);

  // Track unsaved changes and push to history
  useEffect(() => {
    setHasUnsavedChanges(true);
    pushState(nodes, edges);
  }, [nodes, edges, pushState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const state = undo();
        if (state) {
          setNodes(state.nodes);
          setEdges(state.edges);
        }
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
        e.preventDefault();
        const state = redo();
        if (state) {
          setNodes(state.nodes);
          setEdges(state.edges);
        }
      }

      // Copy: Ctrl+C
      if (isMod && e.key === 'c') {
        e.preventDefault();
        copy(nodes, edges, selectedNodeIds);
      }

      // Cut: Ctrl+X
      if (isMod && e.key === 'x') {
        e.preventDefault();
        const result = cut(nodes, edges, selectedNodeIds);
        setNodes(result.nodes);
        setEdges(result.edges);
      }

      // Paste: Ctrl+V
      if (isMod && e.key === 'v') {
        e.preventDefault();
        const pasted = paste();
        if (pasted) {
          setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), ...pasted.nodes]);
          setEdges((eds) => [...eds, ...pasted.edges]);
          setSelectedNodeIds(pasted.nodes.map(n => n.id));
        }
      }

      // Save: Ctrl+S
      if (isMod && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          const selectedSet = new Set(selectedNodeIds);
          setNodes((nds) => nds.filter((n) => !selectedSet.has(n.id)));
          setEdges((eds) => eds.filter((e) => !selectedSet.has(e.source) && !selectedSet.has(e.target)));
          setSelectedNodeIds([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, selectedNodeIds, undo, redo, copy, cut, paste, handleSave, setNodes, setEdges]);

  // File operations
  const handleNewGraph = useCallback(() => {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
    setNodes([]);
    setEdges([]);
    setCurrentGraphName('Untitled');
    setCurrentGraphPath(null);
    setHasUnsavedChanges(false);
    setNodeIdCounter(1);
    setShowFileMenu(false);
  }, [hasUnsavedChanges, setNodes, setEdges]);

  const handleSave = useCallback(async () => {
    if (!projectPath) {
      alert('Please open a project first');
      return;
    }

    if (!currentGraphPath) {
      setShowSaveDialog(true);
      setSaveFileName(currentGraphName.replace(/[^a-zA-Z0-9_-]/g, '_'));
      return;
    }

    try {
      const filename = currentGraphPath.split('/').pop() || 'graph.graph.json';
      await graphStorage.save(nodes, edges, filename, { name: currentGraphName });
      setHasUnsavedChanges(false);
      console.log('[NodeEditor] Graph saved:', currentGraphPath);
    } catch (e) {
      console.error('[NodeEditor] Failed to save graph:', e);
      alert('Failed to save graph: ' + (e instanceof Error ? e.message : String(e)));
    }
    setShowFileMenu(false);
  }, [projectPath, currentGraphPath, currentGraphName, nodes, edges]);

  const handleSaveAs = useCallback(async (filename: string) => {
    if (!projectPath) {
      alert('Please open a project first');
      return;
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fullFilename = safeName.endsWith('.graph.json') ? safeName : `${safeName}.graph.json`;

    try {
      const path = await graphStorage.save(nodes, edges, fullFilename, { name: filename });
      setCurrentGraphPath(path);
      setCurrentGraphName(filename);
      setHasUnsavedChanges(false);
      setShowSaveDialog(false);
      console.log('[NodeEditor] Graph saved as:', path);
    } catch (e) {
      console.error('[NodeEditor] Failed to save graph:', e);
      alert('Failed to save graph: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [projectPath, nodes, edges]);

  const handleOpenLoadDialog = useCallback(async () => {
    if (!projectPath) {
      alert('Please open a project first');
      return;
    }

    try {
      const graphs = await graphStorage.list();
      setSavedGraphs(graphs);
      setShowLoadDialog(true);
    } catch (e) {
      console.error('[NodeEditor] Failed to list graphs:', e);
    }
    setShowFileMenu(false);
  }, [projectPath]);

  const handleLoad = useCallback(async (entry: GraphListEntry) => {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;

    try {
      const { graph, nodes: loadedNodes, edges: loadedEdges } = await graphStorage.load(entry.path);
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setCurrentGraphName(graph.name);
      setCurrentGraphPath(entry.path);
      setHasUnsavedChanges(false);
      setNodeIdCounter(Math.max(...loadedNodes.map((n) => parseInt(n.id) || 0), 0) + 1);
      setShowLoadDialog(false);
      console.log('[NodeEditor] Graph loaded:', entry.path);
    } catch (e) {
      console.error('[NodeEditor] Failed to load graph:', e);
      alert('Failed to load graph: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [hasUnsavedChanges, setNodes, setEdges]);

  const handleDelete = useCallback(async (entry: GraphListEntry) => {
    if (!confirm(`Delete "${entry.name}"?`)) return;

    try {
      await graphStorage.delete(entry.path);
      const graphs = await graphStorage.list();
      setSavedGraphs(graphs);
      if (currentGraphPath === entry.path) {
        handleNewGraph();
      }
    } catch (e) {
      console.error('[NodeEditor] Failed to delete graph:', e);
    }
  }, [currentGraphPath, handleNewGraph]);

  // Handle selection changes
  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selectedNodes }) => {
    setSelectedNodeIds(selectedNodes.map((n) => n.id));
  }, []);

  // Handle node property changes from inspector
  const handleNodeChange = useCallback((nodeId: string, updates: Partial<Node>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            ...updates,
            data: updates.data ? { ...node.data, ...updates.data } : node.data,
          };
        }
        return node;
      })
    );
  }, [setNodes]);

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
          onSelectionChange={onSelectionChange}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes as NodeTypes}
          defaultEdgeOptions={edgeOptions}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          proOptions={{ hideAttribution: true }}
          style={{ backgroundColor: theme.bg }}
        >
          <Controls
            showInteractive={false}
            className="react-flow-controls-dark"
            style={{
              backgroundColor: theme.bgPanel,
              borderRadius: 4,
              border: `1px solid ${theme.border}`,
              boxShadow: 'none',
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
            <div className="flex items-center gap-3">
              {/* File Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowFileMenu(!showFileMenu)}
                  className="px-3 py-1.5 rounded flex items-center gap-2 text-xs"
                  style={{
                    backgroundColor: theme.bgPanel,
                    border: `1px solid ${theme.border}`,
                    color: theme.text,
                  }}
                >
                  <span style={{ color: hasUnsavedChanges ? theme.warning : theme.textMuted }}>
                    {hasUnsavedChanges ? '●' : ''}
                  </span>
                  {currentGraphName}
                  <span style={{ color: theme.textMuted }}>▾</span>
                </button>

                {showFileMenu && (
                  <div
                    className="absolute top-full left-0 mt-1 py-1 rounded shadow-lg z-50 min-w-[150px]"
                    style={{
                      backgroundColor: theme.bgPanel,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <button
                      onClick={handleNewGraph}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-opacity-80"
                      style={{ color: theme.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      New Graph
                    </button>
                    <button
                      onClick={handleOpenLoadDialog}
                      className="w-full px-3 py-1.5 text-left text-xs"
                      style={{ color: theme.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Open...
                    </button>
                    <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
                    <button
                      onClick={handleSave}
                      className="w-full px-3 py-1.5 text-left text-xs"
                      style={{ color: theme.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Save {currentGraphPath ? '' : 'As...'}
                    </button>
                    <button
                      onClick={() => { setShowSaveDialog(true); setSaveFileName(currentGraphName); setShowFileMenu(false); }}
                      className="w-full px-3 py-1.5 text-left text-xs"
                      style={{ color: theme.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Save As...
                    </button>
                  </div>
                )}
              </div>

              {/* Execution Controls */}
              <ExecutionControls nodes={nodes} edges={edges} graphRunner={graphRunner} />

              {/* Stats */}
              <div
                className="px-3 py-1.5 rounded flex items-center gap-4 text-xs"
                style={{
                  backgroundColor: theme.bgPanel,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <span style={{ color: theme.textMuted }}>
                  {nodes.length} nodes · {edges.length} edges
                </span>
              </div>
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

          {/* Inspector toggle button */}
          <Panel position="top-right">
            <button
              onClick={() => setShowInspector(!showInspector)}
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: theme.bgPanel,
                color: theme.textMuted,
                border: `1px solid ${theme.border}`,
              }}
              title={showInspector ? 'Hide Inspector' : 'Show Inspector'}
            >
              {showInspector ? '▶' : '◀'} Inspector
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Inspector Sidebar */}
      {showInspector && (
        <div
          className="w-64 h-full flex flex-col"
          style={{
            backgroundColor: theme.bgPanel,
            borderLeft: `1px solid ${theme.border}`,
          }}
        >
          {/* Tab buttons */}
          <div
            className="flex"
            style={{ borderBottom: `1px solid ${theme.border}` }}
          >
            <button
              onClick={() => setInspectorTab('properties')}
              className="flex-1 px-3 py-2 text-xs transition-colors"
              style={{
                backgroundColor: inspectorTab === 'properties' ? theme.bgHover : 'transparent',
                color: inspectorTab === 'properties' ? theme.text : theme.textMuted,
                borderBottom: inspectorTab === 'properties' ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              Properties
            </button>
            <button
              onClick={() => setInspectorTab('variables')}
              className="flex-1 px-3 py-2 text-xs transition-colors"
              style={{
                backgroundColor: inspectorTab === 'variables' ? theme.bgHover : 'transparent',
                color: inspectorTab === 'variables' ? theme.text : theme.textMuted,
                borderBottom: inspectorTab === 'variables' ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              Variables
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {inspectorTab === 'properties' ? (
              <NodePropertyInspector
                nodes={nodes}
                edges={edges}
                selectedNodeIds={selectedNodeIds}
                onNodeChange={handleNodeChange}
              />
            ) : (
              <VariableInspector graphRunner={graphRunner} />
            )}
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="rounded p-4 w-80"
            style={{ backgroundColor: theme.bgPanel, border: `1px solid ${theme.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm mb-3" style={{ color: theme.text }}>Save Graph As</div>
            <input
              type="text"
              value={saveFileName}
              onChange={(e) => setSaveFileName(e.target.value)}
              placeholder="graph-name"
              autoFocus
              className="w-full px-3 py-2 rounded text-sm mb-3"
              style={{
                backgroundColor: theme.bg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && saveFileName.trim()) {
                  handleSaveAs(saveFileName.trim());
                }
                if (e.key === 'Escape') {
                  setShowSaveDialog(false);
                }
              }}
            />
            <div className="text-xs mb-3" style={{ color: theme.textDim }}>
              Will be saved as: {saveFileName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'graph'}.graph.json
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-1.5 rounded text-xs"
                style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs"
                style={{
                  backgroundColor: saveFileName.trim() ? theme.accent : theme.bgHover,
                  color: saveFileName.trim() ? theme.bg : theme.textDim,
                }}
                disabled={!saveFileName.trim()}
                onClick={() => saveFileName.trim() && handleSaveAs(saveFileName.trim())}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowLoadDialog(false)}
        >
          <div
            className="rounded p-4 w-96 max-h-[80vh] flex flex-col"
            style={{ backgroundColor: theme.bgPanel, border: `1px solid ${theme.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm mb-3 flex items-center justify-between" style={{ color: theme.text }}>
              <span>Open Graph</span>
              <button
                onClick={() => setShowLoadDialog(false)}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
              >
                ✕
              </button>
            </div>

            {savedGraphs.length === 0 ? (
              <div className="py-8 text-center" style={{ color: theme.textDim }}>
                No saved graphs found
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1">
                {savedGraphs.map((entry) => (
                  <div
                    key={entry.path}
                    className="p-2 rounded flex items-center justify-between group"
                    style={{ backgroundColor: theme.bgHover }}
                  >
                    <button
                      onClick={() => handleLoad(entry)}
                      className="flex-1 text-left"
                    >
                      <div className="text-xs" style={{ color: theme.text }}>{entry.name}</div>
                      <div className="text-[10px]" style={{ color: theme.textDim }}>
                        {new Date(entry.modifiedAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: theme.error, color: 'white' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close file menu */}
      {showFileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowFileMenu(false)}
        />
      )}
    </div>
  );
}

export default NodeEditor;
