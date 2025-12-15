// ═══════════════════════════════════════════════════════════════════════════
// Node Graph Lua Bindings - Allow Lua to define and manipulate nodes
// ═══════════════════════════════════════════════════════════════════════════

import { getLuaRuntime } from '../lua/runtime';
import {
  NodeTypeDefinition,
  NodeCategory,
  NodePortDefinition,
  registerNodeType,
  unregisterNodeType,
  getAllNodeTypes,
  getNodesByCategory,
  getNodeType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Node Graph Store
// Stores the current graph state that can be accessed from Lua
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeInstance {
  id: string;
  typeId: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface EdgeInstance {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface NodeGraph {
  id: string;
  name: string;
  nodes: NodeInstance[];
  edges: EdgeInstance[];
  metadata?: Record<string, unknown>;
}

// Graph storage
const graphs = new Map<string, NodeGraph>();
let activeGraphId: string | null = null;

// Event listeners for graph changes
type GraphEventHandler = (graph: NodeGraph) => void;
const graphEventHandlers: GraphEventHandler[] = [];

export function onGraphChange(handler: GraphEventHandler) {
  graphEventHandlers.push(handler);
  return () => {
    const idx = graphEventHandlers.indexOf(handler);
    if (idx !== -1) graphEventHandlers.splice(idx, 1);
  };
}

function notifyGraphChange(graph: NodeGraph) {
  graphEventHandlers.forEach((h) => h(graph));
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialize Lua Bindings
// ─────────────────────────────────────────────────────────────────────────────

let bindingsInitialized = false;

export function initializeNodeBindings() {
  if (bindingsInitialized) return;

  const runtime = getLuaRuntime();

  // ─────────────────────────────────────────────────────────────────────────
  // nodes module - define and register node types
  // ─────────────────────────────────────────────────────────────────────────

  runtime.registerModule('nodes', {
    // Define a new custom node type
    define: (config: unknown) => {
      if (!config || typeof config !== 'object') {
        throw new Error('nodes.define requires a config object');
      }

      const c = config as Record<string, unknown>;

      // Validate required fields
      if (!c.id || typeof c.id !== 'string') throw new Error('Node must have an id');
      if (!c.name || typeof c.name !== 'string') throw new Error('Node must have a name');

      const inputs: NodePortDefinition[] = [];
      const outputs: NodePortDefinition[] = [];

      // Parse inputs
      if (Array.isArray(c.inputs)) {
        for (const inp of c.inputs) {
          if (inp && typeof inp === 'object') {
            const i = inp as Record<string, unknown>;
            inputs.push({
              id: String(i.id || ''),
              label: String(i.label || ''),
              type: (i.type as any) || 'any',
              required: !!i.required,
            });
          }
        }
      }

      // Parse outputs
      if (Array.isArray(c.outputs)) {
        for (const out of c.outputs) {
          if (out && typeof out === 'object') {
            const o = out as Record<string, unknown>;
            outputs.push({
              id: String(o.id || ''),
              label: String(o.label || ''),
              type: (o.type as any) || 'any',
            });
          }
        }
      }

      const nodeDef: NodeTypeDefinition = {
        id: String(c.id),
        name: String(c.name),
        category: (c.category as NodeCategory) || 'custom',
        description: String(c.description || ''),
        icon: String(c.icon || '★'),
        color: String(c.color || '#8b5cf6'),
        inputs,
        outputs,
        luaCode: typeof c.execute === 'string' ? c.execute : undefined,
        isCustom: true,
      };

      registerNodeType(nodeDef);
      return nodeDef.id;
    },

    // Unregister a custom node type
    undefine: (id: unknown) => {
      if (typeof id !== 'string') return false;
      return unregisterNodeType(id);
    },

    // Get all available node types
    list: () => {
      return getAllNodeTypes().map((n) => ({
        id: n.id,
        name: n.name,
        category: n.category,
        description: n.description,
        icon: n.icon,
        isCustom: n.isCustom || false,
      }));
    },

    // Get nodes by category
    byCategory: (category: unknown) => {
      if (typeof category !== 'string') return [];
      return getNodesByCategory(category as NodeCategory).map((n) => ({
        id: n.id,
        name: n.name,
        description: n.description,
        icon: n.icon,
      }));
    },

    // Get a specific node type
    get: (id: unknown) => {
      if (typeof id !== 'string') return null;
      const node = getNodeType(id);
      if (!node) return null;
      return {
        id: node.id,
        name: node.name,
        category: node.category,
        description: node.description,
        icon: node.icon,
        inputs: node.inputs,
        outputs: node.outputs,
        isCustom: node.isCustom || false,
      };
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // graph module - manipulate node graphs
  // ─────────────────────────────────────────────────────────────────────────

  runtime.registerModule('graph', {
    // Create a new graph
    create: (name: unknown) => {
      const id = `graph-${Date.now()}`;
      const graph: NodeGraph = {
        id,
        name: String(name || 'Untitled'),
        nodes: [],
        edges: [],
      };
      graphs.set(id, graph);
      return id;
    },

    // Set the active graph
    setActive: (id: unknown) => {
      if (typeof id !== 'string') return false;
      if (!graphs.has(id)) return false;
      activeGraphId = id;
      return true;
    },

    // Get the active graph
    getActive: () => {
      if (!activeGraphId) return null;
      const graph = graphs.get(activeGraphId);
      if (!graph) return null;
      return {
        id: graph.id,
        name: graph.name,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      };
    },

    // Add a node to the active graph
    addNode: (typeId: unknown, x: unknown, y: unknown, data?: unknown) => {
      if (!activeGraphId) throw new Error('No active graph');
      const graph = graphs.get(activeGraphId);
      if (!graph) throw new Error('Graph not found');

      const nodeType = getNodeType(String(typeId));
      if (!nodeType) throw new Error(`Unknown node type: ${typeId}`);

      const node: NodeInstance = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        typeId: String(typeId),
        position: { x: Number(x) || 0, y: Number(y) || 0 },
        data: (data as Record<string, unknown>) || {},
      };

      graph.nodes.push(node);
      notifyGraphChange(graph);
      return node.id;
    },

    // Remove a node from the active graph
    removeNode: (nodeId: unknown) => {
      if (!activeGraphId) return false;
      const graph = graphs.get(activeGraphId);
      if (!graph) return false;

      const idx = graph.nodes.findIndex((n) => n.id === nodeId);
      if (idx === -1) return false;

      graph.nodes.splice(idx, 1);
      // Also remove connected edges
      graph.edges = graph.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      notifyGraphChange(graph);
      return true;
    },

    // Connect two nodes
    connect: (
      sourceId: unknown,
      sourceHandle: unknown,
      targetId: unknown,
      targetHandle: unknown
    ) => {
      if (!activeGraphId) throw new Error('No active graph');
      const graph = graphs.get(activeGraphId);
      if (!graph) throw new Error('Graph not found');

      const edge: EdgeInstance = {
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: String(sourceId),
        sourceHandle: String(sourceHandle),
        target: String(targetId),
        targetHandle: String(targetHandle),
      };

      graph.edges.push(edge);
      notifyGraphChange(graph);
      return edge.id;
    },

    // Disconnect an edge
    disconnect: (edgeId: unknown) => {
      if (!activeGraphId) return false;
      const graph = graphs.get(activeGraphId);
      if (!graph) return false;

      const idx = graph.edges.findIndex((e) => e.id === edgeId);
      if (idx === -1) return false;

      graph.edges.splice(idx, 1);
      notifyGraphChange(graph);
      return true;
    },

    // Get all nodes in the active graph
    getNodes: () => {
      if (!activeGraphId) return [];
      const graph = graphs.get(activeGraphId);
      if (!graph) return [];
      return graph.nodes.map((n) => ({
        id: n.id,
        typeId: n.typeId,
        x: n.position.x,
        y: n.position.y,
        data: n.data,
      }));
    },

    // Get all edges in the active graph
    getEdges: () => {
      if (!activeGraphId) return [];
      const graph = graphs.get(activeGraphId);
      if (!graph) return [];
      return graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle,
        target: e.target,
        targetHandle: e.targetHandle,
      }));
    },

    // Export graph as JSON
    export: () => {
      if (!activeGraphId) return null;
      const graph = graphs.get(activeGraphId);
      if (!graph) return null;
      return JSON.stringify(graph);
    },

    // Import graph from JSON
    import: (json: unknown) => {
      if (typeof json !== 'string') throw new Error('Expected JSON string');
      const graph = JSON.parse(json) as NodeGraph;
      graphs.set(graph.id, graph);
      activeGraphId = graph.id;
      notifyGraphChange(graph);
      return graph.id;
    },
  });

  bindingsInitialized = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Access Functions (for React components)
// ─────────────────────────────────────────────────────────────────────────────

export function getGraph(id: string): NodeGraph | undefined {
  return graphs.get(id);
}

export function getActiveGraph(): NodeGraph | undefined {
  if (!activeGraphId) return undefined;
  return graphs.get(activeGraphId);
}

export function getAllGraphs(): NodeGraph[] {
  return Array.from(graphs.values());
}

export function setGraph(graph: NodeGraph) {
  graphs.set(graph.id, graph);
  notifyGraphChange(graph);
}
