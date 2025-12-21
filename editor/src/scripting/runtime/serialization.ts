// ═══════════════════════════════════════════════════════════════════════════
// Graph Serialization - Save/load logic graphs
// ═══════════════════════════════════════════════════════════════════════════

import type {
  LogicGraph,
  GraphNode,
  GraphEdge,
  VariableDef,
  SignalNode,
  ActionNode,
  BranchNode,
  FlowNode,
  VariableNode,
  SubGraphNode,
} from './graph'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Serialized graph format (JSON-safe) */
export interface SerializedGraph {
  formatVersion: number
  graphId: string
  version: string
  description?: string
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  variables: SerializedVariable[]
  metadata?: GraphMetadata
}

/** Serialized node (common format for all node types) */
export interface SerializedNode {
  id: string
  type: GraphNode['type']
  position: [number, number]
  data: Record<string, unknown>
}

/** Serialized edge */
export interface SerializedEdge {
  from: string
  fromPin: string
  to: string
  toPin: string
}

/** Serialized variable definition */
export interface SerializedVariable {
  name: string
  type: VariableDef['type']
  scope: VariableDef['scope']
  default?: unknown
  description?: string
}

/** Graph metadata */
export interface GraphMetadata {
  author?: string
  createdAt?: string
  modifiedAt?: string
  tags?: string[]
  thumbnail?: string
}

// Current serialization format version
const CURRENT_FORMAT_VERSION = 1

// ─────────────────────────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a logic graph to JSON-safe format.
 */
export function serializeGraph(graph: LogicGraph): SerializedGraph {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    graphId: graph.graphId,
    version: graph.version,
    description: graph.description,
    nodes: graph.nodes.map(serializeNode),
    edges: graph.edges.map(serializeEdge),
    variables: graph.variables.map(serializeVariable),
    metadata: {
      modifiedAt: new Date().toISOString(),
    },
  }
}

/**
 * Serialize a single node.
 */
function serializeNode(node: GraphNode): SerializedNode {
  const base = {
    id: node.id,
    type: node.type,
    position: node.position,
  }

  switch (node.type) {
    case 'signal':
      return {
        ...base,
        data: {
          signal: node.signal,
          phase: node.phase,
        },
      }

    case 'action':
      return {
        ...base,
        data: {
          component: node.component,
          method: node.method,
          inputs: node.inputs,
        },
      }

    case 'branch':
      return {
        ...base,
        data: {
          kind: node.kind,
          condition: node.condition,
          value: node.value,
          cases: node.cases,
        },
      }

    case 'flow':
      return {
        ...base,
        data: {
          kind: node.kind,
          duration: node.duration,
          branches: node.branches,
          inputs: node.inputs,
          collection: node.collection,
          itemVariable: node.itemVariable,
          joinMode: node.joinMode,
          reason: node.reason,
        },
      }

    case 'variable':
      return {
        ...base,
        data: {
          operation: node.operation,
          variable: node.variable,
          value: node.value,
        },
      }

    case 'subgraph':
      return {
        ...base,
        data: {
          graphRef: node.graphRef,
          inputMappings: node.inputMappings,
          outputMappings: node.outputMappings,
        },
      }

    default:
      return { ...base, data: {} }
  }
}

/**
 * Serialize a single edge.
 */
function serializeEdge(edge: GraphEdge): SerializedEdge {
  return {
    from: edge.from,
    fromPin: edge.fromPin,
    to: edge.to,
    toPin: edge.toPin,
  }
}

/**
 * Serialize a variable definition.
 */
function serializeVariable(variable: VariableDef): SerializedVariable {
  return {
    name: variable.name,
    type: variable.type,
    scope: variable.scope,
    default: variable.default,
    description: variable.description,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deserialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deserialize a logic graph from JSON format.
 */
export function deserializeGraph(data: SerializedGraph): LogicGraph {
  // Version migration if needed
  const migrated = migrateGraph(data)

  return {
    graphId: migrated.graphId,
    version: migrated.version,
    description: migrated.description,
    nodes: migrated.nodes.map(deserializeNode),
    edges: migrated.edges.map(deserializeEdge),
    variables: migrated.variables.map(deserializeVariable),
  }
}

/**
 * Deserialize a single node.
 */
function deserializeNode(node: SerializedNode): GraphNode {
  const base = {
    id: node.id,
    position: node.position,
  }

  switch (node.type) {
    case 'signal':
      return {
        ...base,
        type: 'signal',
        signal: node.data.signal as string,
        phase: node.data.phase as SignalNode['phase'],
      }

    case 'action':
      return {
        ...base,
        type: 'action',
        component: node.data.component as string,
        method: node.data.method as string,
        inputs: node.data.inputs as Record<string, unknown>,
      }

    case 'branch':
      return {
        ...base,
        type: 'branch',
        kind: node.data.kind as BranchNode['kind'],
        condition: node.data.condition,
        value: node.data.value,
        cases: node.data.cases as string[] | undefined,
      }

    case 'flow':
      return {
        ...base,
        type: 'flow',
        kind: node.data.kind as FlowNode['kind'],
        duration: node.data.duration,
        branches: node.data.branches as string[] | undefined,
        inputs: node.data.inputs as string[] | undefined,
        collection: node.data.collection,
        itemVariable: node.data.itemVariable as string | undefined,
        joinMode: node.data.joinMode as FlowNode['joinMode'],
        reason: node.data.reason as string | undefined,
      }

    case 'variable':
      return {
        ...base,
        type: 'variable',
        operation: node.data.operation as VariableNode['operation'],
        variable: node.data.variable as string,
        value: node.data.value,
      }

    case 'subgraph':
      return {
        ...base,
        type: 'subgraph',
        graphRef: node.data.graphRef as string,
        inputMappings: node.data.inputMappings as Record<string, unknown> | undefined,
        outputMappings: node.data.outputMappings as Record<string, string> | undefined,
      }

    default:
      throw new Error(`Unknown node type: ${node.type}`)
  }
}

/**
 * Deserialize a single edge.
 */
function deserializeEdge(edge: SerializedEdge): GraphEdge {
  return {
    from: edge.from,
    fromPin: edge.fromPin,
    to: edge.to,
    toPin: edge.toPin,
  }
}

/**
 * Deserialize a variable definition.
 */
function deserializeVariable(variable: SerializedVariable): VariableDef {
  return {
    name: variable.name,
    type: variable.type,
    scope: variable.scope,
    default: variable.default,
    description: variable.description,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migrate older graph formats to current version.
 */
function migrateGraph(data: SerializedGraph): SerializedGraph {
  let current = { ...data }

  // Apply migrations in order
  if (!current.formatVersion || current.formatVersion < 1) {
    current = migrateToV1(current)
  }

  // Future migrations would go here:
  // if (current.formatVersion < 2) {
  //   current = migrateToV2(current)
  // }

  return current
}

/**
 * Migration to v1 (initial format).
 */
function migrateToV1(data: SerializedGraph): SerializedGraph {
  // Initial version, no migration needed
  return { ...data, formatVersion: 1 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Validation error */
export interface ValidationError {
  type: 'error' | 'warning'
  message: string
  nodeId?: string
}

/**
 * Validate a serialized graph for integrity.
 */
export function validateGraph(data: SerializedGraph): ValidationError[] {
  const errors: ValidationError[] = []
  const nodeIds = new Set(data.nodes.map(n => n.id))

  // Check for duplicate node IDs
  const seenNodeIds = new Set<string>()
  for (const node of data.nodes) {
    if (seenNodeIds.has(node.id)) {
      errors.push({
        type: 'error',
        message: `Duplicate node ID: ${node.id}`,
        nodeId: node.id,
      })
    }
    seenNodeIds.add(node.id)
  }

  // Validate edges reference existing nodes
  for (const edge of data.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent source node: ${edge.from}`,
      })
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent target node: ${edge.to}`,
      })
    }
  }

  // Check for orphaned nodes (no connections)
  const connectedNodes = new Set<string>()
  for (const edge of data.edges) {
    connectedNodes.add(edge.from)
    connectedNodes.add(edge.to)
  }

  for (const node of data.nodes) {
    // Signal nodes can be entry points (no incoming connections expected)
    if (node.type !== 'signal' && !connectedNodes.has(node.id)) {
      errors.push({
        type: 'warning',
        message: `Orphaned node with no connections: ${node.id}`,
        nodeId: node.id,
      })
    }
  }

  return errors
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a graph to a JSON string.
 */
export function graphToJSON(graph: LogicGraph, pretty = false): string {
  const serialized = serializeGraph(graph)
  return pretty
    ? JSON.stringify(serialized, null, 2)
    : JSON.stringify(serialized)
}

/**
 * Deserialize a graph from a JSON string.
 */
export function graphFromJSON(json: string): LogicGraph {
  const parsed = JSON.parse(json) as SerializedGraph
  const errors = validateGraph(parsed)

  // Only throw on errors, not warnings
  const criticalErrors = errors.filter(e => e.type === 'error')
  if (criticalErrors.length > 0) {
    throw new Error(
      `Graph validation failed:\n${criticalErrors.map(e => `  - ${e.message}`).join('\n')}`
    )
  }

  return deserializeGraph(parsed)
}

/**
 * Clone a graph by serializing and deserializing.
 */
export function cloneGraph(graph: LogicGraph, newId?: string): LogicGraph {
  const cloned = deserializeGraph(serializeGraph(graph))
  if (newId) {
    cloned.graphId = newId
  }
  return cloned
}

// ─────────────────────────────────────────────────────────────────────────────
// React Flow Conversion
// ─────────────────────────────────────────────────────────────────────────────

/** React Flow node format */
export interface ReactFlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

/** React Flow edge format */
export interface ReactFlowEdge {
  id: string
  source: string
  sourceHandle: string | null
  target: string
  targetHandle: string | null
  type?: string
}

/**
 * Convert a LogicGraph to React Flow nodes/edges format.
 */
export function graphToReactFlow(graph: LogicGraph): {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
} {
  const nodes: ReactFlowNode[] = graph.nodes.map(node => ({
    id: node.id,
    type: mapNodeTypeToReactFlow(node),
    position: { x: node.position[0], y: node.position[1] },
    data: extractNodeData(node),
  }))

  const edges: ReactFlowEdge[] = graph.edges.map((edge, idx) => ({
    id: `edge-${idx}`,
    source: edge.from,
    sourceHandle: edge.fromPin,
    target: edge.to,
    targetHandle: edge.toPin,
    type: 'smoothstep',
  }))

  return { nodes, edges }
}

/**
 * Convert React Flow nodes/edges back to a LogicGraph.
 */
export function reactFlowToGraph(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  graphId: string,
  version = '1.0.0'
): LogicGraph {
  // Convert React Flow edges to GraphEdges
  const graphEdges: GraphEdge[] = edges.map(edge => ({
    from: edge.source,
    fromPin: edge.sourceHandle || 'flow',
    to: edge.target,
    toPin: edge.targetHandle || 'flow',
  }))

  // Convert React Flow nodes to GraphNodes
  const graphNodes: GraphNode[] = nodes.map(node => {
    return reactFlowNodeToGraphNode(node)
  })

  return {
    graphId,
    version,
    nodes: graphNodes,
    edges: graphEdges,
    variables: [],
  }
}

/**
 * Map a GraphNode type to a React Flow node type.
 */
function mapNodeTypeToReactFlow(node: GraphNode): string {
  switch (node.type) {
    case 'signal':
      return node.signal
    case 'action':
      return `${node.component}.${node.method}`
    case 'branch':
      return node.kind === 'if' ? 'branch' : 'switch'
    case 'flow':
      return node.kind
    case 'variable':
      return `variable-${node.operation}`
    case 'subgraph':
      return 'subgraph'
    default:
      return 'unknown'
  }
}

/**
 * Extract node data for React Flow.
 */
function extractNodeData(node: GraphNode): Record<string, unknown> {
  switch (node.type) {
    case 'signal':
      return { signal: node.signal, phase: node.phase }
    case 'action':
      return { component: node.component, method: node.method, ...node.inputs }
    case 'branch':
      return { kind: node.kind, condition: node.condition, value: node.value, cases: node.cases }
    case 'flow':
      return {
        kind: node.kind,
        duration: node.duration,
        collection: node.collection,
        itemVariable: node.itemVariable,
      }
    case 'variable':
      return { operation: node.operation, variable: node.variable, value: node.value }
    case 'subgraph':
      return { graphRef: node.graphRef, ...node.inputMappings }
    default:
      return {}
  }
}

/**
 * Convert a React Flow node back to a GraphNode.
 */
function reactFlowNodeToGraphNode(node: ReactFlowNode): GraphNode {
  const base = {
    id: node.id,
    position: [node.position.x, node.position.y] as [number, number],
  }

  // Use nodeTypeId from data if type is "custom", otherwise use type directly
  const rfType = (node.type === 'custom' && node.data?.nodeTypeId)
    ? (node.data.nodeTypeId as string)
    : (node.type || '')

  // Signal nodes (event nodes)
  // Map common node type IDs to their signal names
  const signalMap: Record<string, string> = {
    'on-start': 'Init',
    'on-update': 'Update',
    'on-dispose': 'Dispose',
    'Init': 'Init',
    'Update': 'Update',
    'Dispose': 'Dispose',
  }

  if (rfType.startsWith('on-') || signalMap[rfType]) {
    const signalName = signalMap[rfType] || rfType
    return {
      ...base,
      type: 'signal',
      signal: signalName,
    }
  }

  // Branch node
  if (rfType === 'branch') {
    return {
      ...base,
      type: 'branch',
      kind: 'if',
      condition: node.data.condition,
    }
  }

  // Switch node
  if (rfType === 'switch') {
    return {
      ...base,
      type: 'branch',
      kind: 'switch',
      value: node.data.value,
      cases: node.data.cases as string[] | undefined,
    }
  }

  // Variable nodes
  if (rfType.startsWith('variable-')) {
    const operation = rfType.replace('variable-', '') as VariableNode['operation']
    return {
      ...base,
      type: 'variable',
      operation,
      variable: node.data.variable as string || '',
      value: node.data.value,
    }
  }

  // Flow control nodes
  const flowTypes = ['delay', 'parallel', 'merge', 'sequence', 'forEach', 'cancel']
  if (flowTypes.includes(rfType)) {
    return {
      ...base,
      type: 'flow',
      kind: rfType as FlowNode['kind'],
      duration: node.data.duration,
      collection: node.data.collection,
      itemVariable: node.data.itemVariable as string | undefined,
    }
  }

  // Subgraph node
  if (rfType === 'subgraph') {
    return {
      ...base,
      type: 'subgraph',
      graphRef: node.data.graphRef as string || '',
    }
  }

  // Script node - custom TypeScript code
  if (rfType === 'script') {
    return {
      ...base,
      type: 'action',
      component: 'Script',
      method: 'execute',
      inputs: {
        code: node.data.code as string || '',
        customInputs: node.data.customInputs || [],
        customOutputs: node.data.customOutputs || [],
        listenSignals: node.data.listenSignals || [],
        emitSignals: node.data.emitSignals || [],
        ...(node.data.inputs as Record<string, unknown> || {}),
      },
    }
  }

  // Built-in action nodes (translate, print, move-entity, etc.)
  const builtinActions = [
    'translate', 'move-entity', 'print', 'log', 'spawn-entity', 'destroy-entity',
    'play-sound', 'play-animation', 'set-property', 'get-property',
    'emit-signal', 'add-component', 'remove-component',
  ]

  // Built-in data nodes (random, compare, get-self, etc.)
  const builtinDataNodes = [
    'random', 'compare', 'get-self', 'get-position', 'get-property',
    'math-add', 'math-subtract', 'math-multiply', 'math-divide',
    'distance', 'direction', 'normalize',
  ]

  // Extract inputs correctly - they may be nested in data.inputs
  const extractInputs = (data: Record<string, unknown>): Record<string, unknown> => {
    // If data has an 'inputs' property that's an object, use that
    if (data.inputs && typeof data.inputs === 'object' && !Array.isArray(data.inputs)) {
      return data.inputs as Record<string, unknown>
    }
    // Otherwise filter out nodeTypeId and use the rest
    const { nodeTypeId, ...rest } = data
    return rest
  }

  if (builtinActions.includes(rfType)) {
    return {
      ...base,
      type: 'action',
      component: 'Builtin',
      method: rfType,
      inputs: extractInputs(node.data),
    }
  }

  if (builtinDataNodes.includes(rfType)) {
    return {
      ...base,
      type: 'action',
      component: '',
      method: rfType,
      inputs: extractInputs(node.data),
    }
  }

  // Default: Action node with component.method format
  const [component, method] = rfType.includes('.') ? rfType.split('.') : ['', rfType]
  return {
    ...base,
    type: 'action',
    component: component || node.data.component as string || '',
    method: method || '',
    inputs: extractInputs(node.data),
  }
}
