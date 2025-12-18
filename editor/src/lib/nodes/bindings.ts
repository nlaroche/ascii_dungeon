// ═══════════════════════════════════════════════════════════════════════════
// Node Graph Store - Manages graph state for node-based visual scripting
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Node Graph Store
// Stores the current graph state
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
