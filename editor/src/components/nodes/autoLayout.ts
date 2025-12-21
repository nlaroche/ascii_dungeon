// ═══════════════════════════════════════════════════════════════════════════
// Auto Layout - Layered + Force hybrid algorithm for node graphs
// ═══════════════════════════════════════════════════════════════════════════

import type { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  iterations: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 180,
  nodeHeight: 80,
  horizontalSpacing: 250,
  verticalSpacing: 120,
  iterations: 50,
};

interface NodeWithLayer extends Node {
  layer?: number;
  order?: number;
}

/**
 * Layered + Force hybrid auto-layout algorithm
 *
 * Phase 1: Assign layers based on node dependencies (signal nodes on left, actions in middle, etc.)
 * Phase 2: Order nodes within layers to minimize edge crossings
 * Phase 3: Apply force-directed spacing within layers for cleaner visuals
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions> = {}
): Node[] {
  if (nodes.length === 0) return nodes;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const workingNodes = nodes.map(n => ({ ...n })) as NodeWithLayer[];

  // Build adjacency maps
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const node of workingNodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    // Only consider flow edges for layering
    if (edge.sourceHandle === 'flow' || !edge.sourceHandle) {
      outgoing.get(edge.source)?.push(edge.target);
      incoming.get(edge.target)?.push(edge.source);
    }
  }

  // Phase 1: Assign layers using longest path algorithm
  assignLayers(workingNodes, incoming, outgoing);

  // Phase 2: Order nodes within layers to reduce crossings
  orderNodesInLayers(workingNodes, edges);

  // Phase 3: Calculate positions
  const layerNodes = new Map<number, NodeWithLayer[]>();
  for (const node of workingNodes) {
    const layer = node.layer ?? 0;
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(node);
  }

  // Sort layers by order within each layer
  for (const [, nodesInLayer] of layerNodes) {
    nodesInLayer.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // Phase 4: Apply force-directed adjustment within layers
  applyForceLayout(workingNodes, edges, opts);

  // Calculate final positions
  const sortedLayers = Array.from(layerNodes.keys()).sort((a, b) => a - b);

  for (const layer of sortedLayers) {
    const nodesInLayer = layerNodes.get(layer)!;
    const x = layer * opts.horizontalSpacing + 50;

    // Center nodes vertically
    const totalHeight = nodesInLayer.length * opts.verticalSpacing;
    const startY = -totalHeight / 2 + opts.verticalSpacing / 2;

    for (let i = 0; i < nodesInLayer.length; i++) {
      const node = nodesInLayer[i];
      node.position = {
        x: x + (node.position.x ?? 0) * 0.2, // Keep some of force adjustment
        y: startY + i * opts.verticalSpacing + (node.position.y ?? 0) * 0.2,
      };
    }
  }

  return workingNodes.map(({ layer, order, ...node }) => node);
}

/**
 * Assign layers using modified longest path algorithm
 * Signal/Event nodes get layer 0, then we propagate forward
 */
function assignLayers(
  nodes: NodeWithLayer[],
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>
): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find root nodes (no incoming flow edges) - these are typically event/signal nodes
  const roots = nodes.filter(n => (incoming.get(n.id)?.length ?? 0) === 0);

  // Also prioritize event nodes even if they have connections
  const eventNodes = nodes.filter(n => {
    const data = n.data as { nodeTypeId?: string };
    return data.nodeTypeId?.startsWith('on-') ||
           data.nodeTypeId === 'on-start' ||
           data.nodeTypeId === 'on-update';
  });

  // Initialize all nodes as unvisited
  for (const node of nodes) {
    node.layer = undefined;
  }

  // BFS to assign layers
  const queue: { id: string; layer: number }[] = [];

  // Start with roots and event nodes at layer 0
  const startNodes = new Set([...roots, ...eventNodes]);
  for (const node of startNodes) {
    node.layer = 0;
    queue.push({ id: node.id, layer: 0 });
  }

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    const successors = outgoing.get(id) ?? [];

    for (const successorId of successors) {
      const successor = nodeMap.get(successorId);
      if (successor) {
        const newLayer = layer + 1;
        if (successor.layer === undefined || successor.layer < newLayer) {
          successor.layer = newLayer;
          queue.push({ id: successorId, layer: newLayer });
        }
      }
    }
  }

  // Assign remaining unvisited nodes
  for (const node of nodes) {
    if (node.layer === undefined) {
      // Put unconnected nodes in their own layer based on type
      const data = node.data as { nodeTypeId?: string };
      if (data.nodeTypeId?.includes('random') || data.nodeTypeId?.includes('get-')) {
        node.layer = 0; // Data nodes often feed into early layers
      } else {
        node.layer = 1;
      }
    }
  }
}

/**
 * Order nodes within each layer to minimize edge crossings
 * Uses barycenter heuristic
 */
function orderNodesInLayers(nodes: NodeWithLayer[], edges: Edge[]): void {
  // Build edge map
  const edgeMap = new Map<string, { sources: string[]; targets: string[] }>();
  for (const node of nodes) {
    edgeMap.set(node.id, { sources: [], targets: [] });
  }
  for (const edge of edges) {
    edgeMap.get(edge.source)?.targets.push(edge.target);
    edgeMap.get(edge.target)?.sources.push(edge.source);
  }

  // Group nodes by layer
  const layers = new Map<number, NodeWithLayer[]>();
  for (const node of nodes) {
    const layer = node.layer ?? 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(node);
  }

  // Initialize order within each layer
  for (const [, nodesInLayer] of layers) {
    nodesInLayer.forEach((n, i) => { n.order = i; });
  }

  // Barycenter iterations
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

  for (let iter = 0; iter < 4; iter++) {
    // Forward pass
    for (let i = 1; i < sortedLayers.length; i++) {
      const layer = sortedLayers[i];
      const prevLayer = layers.get(sortedLayers[i - 1])!;
      const currLayer = layers.get(layer)!;

      for (const node of currLayer) {
        const sources = edgeMap.get(node.id)?.sources ?? [];
        if (sources.length > 0) {
          const sourceOrders = sources
            .map(s => prevLayer.find(n => n.id === s)?.order ?? 0);
          node.order = sourceOrders.reduce((a, b) => a + b, 0) / sourceOrders.length;
        }
      }
      currLayer.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      currLayer.forEach((n, i) => { n.order = i; });
    }

    // Backward pass
    for (let i = sortedLayers.length - 2; i >= 0; i--) {
      const layer = sortedLayers[i];
      const nextLayer = layers.get(sortedLayers[i + 1])!;
      const currLayer = layers.get(layer)!;

      for (const node of currLayer) {
        const targets = edgeMap.get(node.id)?.targets ?? [];
        if (targets.length > 0) {
          const targetOrders = targets
            .map(t => nextLayer.find(n => n.id === t)?.order ?? 0);
          node.order = targetOrders.reduce((a, b) => a + b, 0) / targetOrders.length;
        }
      }
      currLayer.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      currLayer.forEach((n, i) => { n.order = i; });
    }
  }
}

/**
 * Apply force-directed layout for fine-tuning positions
 * Nodes repel each other, edges act as springs
 */
function applyForceLayout(
  nodes: NodeWithLayer[],
  edges: Edge[],
  opts: LayoutOptions
): void {
  // Initialize positions based on layer/order
  for (const node of nodes) {
    if (!node.position) {
      node.position = { x: 0, y: 0 };
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Force simulation
  for (let iter = 0; iter < opts.iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      forces.set(node.id, { x: 0, y: 0 });
    }

    // Repulsion between nodes in same layer
    const layers = new Map<number, NodeWithLayer[]>();
    for (const node of nodes) {
      const layer = node.layer ?? 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(node);
    }

    for (const [, nodesInLayer] of layers) {
      for (let i = 0; i < nodesInLayer.length; i++) {
        for (let j = i + 1; j < nodesInLayer.length; j++) {
          const a = nodesInLayer[i];
          const b = nodesInLayer[j];

          const dy = (b.position?.y ?? 0) - (a.position?.y ?? 0);
          const distance = Math.abs(dy) + 0.1;
          const minDist = opts.verticalSpacing * 0.8;

          if (distance < minDist) {
            const force = (minDist - distance) * 0.1;
            const forceA = forces.get(a.id)!;
            const forceB = forces.get(b.id)!;

            if (dy > 0) {
              forceA.y -= force;
              forceB.y += force;
            } else {
              forceA.y += force;
              forceB.y -= force;
            }
          }
        }
      }
    }

    // Edge attraction (gentle spring force)
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      // Only apply vertical alignment force for data edges
      if (edge.sourceHandle !== 'flow' && edge.sourceHandle) {
        const dy = (target.position?.y ?? 0) - (source.position?.y ?? 0);
        const force = dy * 0.02;

        forces.get(source.id)!.y += force;
        forces.get(target.id)!.y -= force;
      }
    }

    // Apply forces
    const damping = 1 - (iter / opts.iterations) * 0.5;
    for (const node of nodes) {
      const force = forces.get(node.id)!;
      node.position = {
        x: (node.position?.x ?? 0) + force.x * damping,
        y: (node.position?.y ?? 0) + force.y * damping,
      };
    }
  }
}
