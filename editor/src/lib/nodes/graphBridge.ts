// ═══════════════════════════════════════════════════════════════════════════
// Graph Bridge - Convert between React Flow and Runtime Graph formats
// ═══════════════════════════════════════════════════════════════════════════

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react'
import type { CustomNodeData } from '../../components/nodes/CustomNode'
import type {
  LogicGraph,
  GraphNode,
  GraphEdge,
  SignalNode,
  ActionNode,
  BranchNode,
  FlowNode,
  VariableNode,
  VariableDef,
} from '../../scripting/runtime/graph'
import { getNodeType, NodeTypeDefinition, NodeCategory } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// React Flow Node to Runtime Node Mapping
// ─────────────────────────────────────────────────────────────────────────────

/** Maps React Flow category to runtime node type */
const CATEGORY_TO_NODE_TYPE: Record<NodeCategory, GraphNode['type']> = {
  event: 'signal',
  action: 'action',
  condition: 'branch',
  data: 'variable',
  flow: 'flow',
  custom: 'action',
}

/** Maps specific node IDs to runtime behavior */
const NODE_ID_MAPPINGS: Record<string, { type: GraphNode['type']; operation?: string }> = {
  // Events → Signals
  'on-start': { type: 'signal' },
  'on-update': { type: 'signal' },
  'on-key': { type: 'signal' },
  'on-collision': { type: 'signal' },
  'on-trigger': { type: 'signal' },

  // Actions
  'print': { type: 'action', operation: 'log' },
  'set-variable': { type: 'variable', operation: 'set' },
  'spawn-entity': { type: 'action', operation: 'spawn' },
  'destroy-entity': { type: 'action', operation: 'destroy' },
  'move-entity': { type: 'action', operation: 'move' },
  'play-sound': { type: 'action', operation: 'playSound' },
  'emit-event': { type: 'action', operation: 'emit' },
  'delay': { type: 'flow', operation: 'delay' },

  // Conditions → Branches
  'branch': { type: 'branch' },
  'compare': { type: 'branch', operation: 'compare' },
  'and': { type: 'branch', operation: 'and' },
  'or': { type: 'branch', operation: 'or' },
  'not': { type: 'branch', operation: 'not' },

  // Data → Variables
  'get-variable': { type: 'variable', operation: 'get' },
  'number': { type: 'variable', operation: 'constant' },
  'string': { type: 'variable', operation: 'constant' },
  'math': { type: 'action', operation: 'math' },
  'random': { type: 'action', operation: 'random' },
  'position': { type: 'action', operation: 'makePosition' },
  'get-entity-property': { type: 'action', operation: 'getProperty' },

  // Flow control
  'sequence': { type: 'flow', operation: 'sequence' },
  'for-loop': { type: 'flow', operation: 'forLoop' },
  'while-loop': { type: 'flow', operation: 'whileLoop' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert React Flow Graph to Runtime Graph
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversionResult {
  graph: LogicGraph
  errors: string[]
  warnings: string[]
}

/**
 * Convert a React Flow graph to our runtime LogicGraph format
 */
export function reactFlowToRuntime(
  nodes: RFNode[],
  edges: RFEdge[],
  graphId: string = 'converted-graph'
): ConversionResult {
  const errors: string[] = []
  const warnings: string[] = []
  const graphNodes: GraphNode[] = []
  const graphEdges: GraphEdge[] = []
  const variables: VariableDef[] = []

  // Track node ID mapping (React Flow ID → Runtime ID)
  const nodeIdMap = new Map<string, string>()

  // Convert nodes
  for (const rfNode of nodes) {
    const nodeData = rfNode.data as CustomNodeData
    if (!nodeData?.nodeTypeId) {
      warnings.push(`Node ${rfNode.id} has no nodeTypeId, skipping`)
      continue
    }

    const nodeTypeDef = getNodeType(nodeData.nodeTypeId)
    if (!nodeTypeDef) {
      errors.push(`Unknown node type: ${nodeData.nodeTypeId}`)
      continue
    }

    const runtimeNode = convertNode(rfNode, nodeTypeDef, nodeData)
    if (runtimeNode) {
      graphNodes.push(runtimeNode)
      nodeIdMap.set(rfNode.id, runtimeNode.id)

      // Extract variable definitions from constant nodes
      if (runtimeNode.type === 'variable' && (runtimeNode as VariableNode).operation === 'constant') {
        const varNode = runtimeNode as VariableNode
        variables.push({
          name: varNode.variable,
          type: inferValueType(nodeData.inputs?.value),
          default: nodeData.inputs?.value,
          scope: 'local',
        })
      }
    }
  }

  // Convert edges
  for (const rfEdge of edges) {
    const sourceId = nodeIdMap.get(rfEdge.source)
    const targetId = nodeIdMap.get(rfEdge.target)

    if (!sourceId || !targetId) {
      warnings.push(`Edge ${rfEdge.id} references missing nodes`)
      continue
    }

    graphEdges.push({
      id: rfEdge.id,
      source: sourceId,
      sourcePin: rfEdge.sourceHandle || 'flow',
      target: targetId,
      targetPin: rfEdge.targetHandle || 'flow',
    })
  }

  return {
    graph: {
      id: graphId,
      name: graphId,
      nodes: graphNodes,
      edges: graphEdges,
      variables,
      inputs: [],
      outputs: [],
    },
    errors,
    warnings,
  }
}

/**
 * Convert a single React Flow node to a runtime node
 */
function convertNode(
  rfNode: RFNode,
  nodeTypeDef: NodeTypeDefinition,
  nodeData: CustomNodeData
): GraphNode | null {
  const mapping = NODE_ID_MAPPINGS[nodeData.nodeTypeId]
  const nodeType = mapping?.type || CATEGORY_TO_NODE_TYPE[nodeTypeDef.category]

  const baseNode = {
    id: `node_${rfNode.id}`,
    position: { x: rfNode.position.x, y: rfNode.position.y },
  }

  switch (nodeType) {
    case 'signal':
      return createSignalNode(baseNode, nodeData, nodeTypeDef)
    case 'action':
      return createActionNode(baseNode, nodeData, mapping?.operation || nodeData.nodeTypeId)
    case 'branch':
      return createBranchNode(baseNode, nodeData, mapping?.operation)
    case 'flow':
      return createFlowNode(baseNode, nodeData, mapping?.operation || 'sequence')
    case 'variable':
      return createVariableNode(baseNode, nodeData, mapping?.operation || 'get')
    default:
      return null
  }
}

function createSignalNode(
  base: { id: string; position: { x: number; y: number } },
  nodeData: CustomNodeData,
  nodeTypeDef: NodeTypeDefinition
): SignalNode {
  // Map event node types to signal names
  const signalMap: Record<string, string> = {
    'on-start': 'Init',
    'on-update': 'Update',
    'on-key': `Key:${nodeData.inputs?.key || 'any'}`,
    'on-collision': 'Collision',
    'on-trigger': nodeData.inputs?.name as string || 'custom',
  }

  return {
    ...base,
    type: 'signal',
    signal: signalMap[nodeData.nodeTypeId] || nodeTypeDef.name,
    outputs: nodeTypeDef.outputs
      .filter(o => o.type !== 'flow')
      .map(o => o.id),
  }
}

function createActionNode(
  base: { id: string; position: { x: number; y: number } },
  nodeData: CustomNodeData,
  operation: string
): ActionNode {
  // Build params from node inputs
  const params: Record<string, unknown> = {}
  if (nodeData.inputs) {
    for (const [key, value] of Object.entries(nodeData.inputs)) {
      params[key] = value
    }
  }

  return {
    ...base,
    type: 'action',
    component: 'System',
    action: operation,
    params,
  }
}

function createBranchNode(
  base: { id: string; position: { x: number; y: number } },
  nodeData: CustomNodeData,
  operation?: string
): BranchNode {
  // Build condition expression from inputs
  let condition = 'true'

  if (operation === 'compare') {
    condition = `$expr: a == b`
  } else if (operation === 'and') {
    condition = `$expr: a && b`
  } else if (operation === 'or') {
    condition = `$expr: a || b`
  } else if (operation === 'not') {
    condition = `$expr: !value`
  } else if (nodeData.inputs?.condition !== undefined) {
    condition = nodeData.inputs.condition as string
  }

  return {
    ...base,
    type: 'branch',
    condition: { $expr: condition },
    trueOutput: 'true',
    falseOutput: 'false',
  }
}

function createFlowNode(
  base: { id: string; position: { x: number; y: number } },
  nodeData: CustomNodeData,
  operation: string
): FlowNode {
  const flowOperation = operation as FlowNode['operation']

  const flowNode: FlowNode = {
    ...base,
    type: 'flow',
    operation: flowOperation,
  }

  // Add operation-specific properties
  if (flowOperation === 'delay') {
    flowNode.duration = (nodeData.inputs?.seconds as number) || 1
  } else if (flowOperation === 'sequence') {
    flowNode.outputs = ['out-1', 'out-2', 'out-3']
  }

  return flowNode
}

function createVariableNode(
  base: { id: string; position: { x: number; y: number } },
  nodeData: CustomNodeData,
  operation: string
): VariableNode {
  const varName = (nodeData.inputs?.name as string) || `var_${base.id}`

  return {
    ...base,
    type: 'variable',
    operation: operation as VariableNode['operation'],
    variable: varName,
    scope: 'local',
    value: nodeData.inputs?.value,
  }
}

function inferValueType(value: unknown): VariableDef['type'] {
  if (value === null || value === undefined) return 'any'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'vec2' // Assume vec2 for arrays
  return 'any'
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert Runtime Graph to React Flow Format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a runtime LogicGraph back to React Flow format
 */
export function runtimeToReactFlow(
  graph: LogicGraph
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = []
  const edges: RFEdge[] = []

  // Convert nodes
  for (const graphNode of graph.nodes) {
    const rfNode = convertToRFNode(graphNode)
    if (rfNode) {
      nodes.push(rfNode)
    }
  }

  // Convert edges
  for (const graphEdge of graph.edges) {
    edges.push({
      id: graphEdge.id,
      source: graphEdge.source.replace('node_', ''),
      sourceHandle: graphEdge.sourcePin,
      target: graphEdge.target.replace('node_', ''),
      targetHandle: graphEdge.targetPin,
      type: 'smoothstep',
    })
  }

  return { nodes, edges }
}

function convertToRFNode(graphNode: GraphNode): RFNode | null {
  const rfId = graphNode.id.replace('node_', '')

  const baseNode: RFNode = {
    id: rfId,
    type: 'custom',
    position: graphNode.position || { x: 0, y: 0 },
    data: {} as CustomNodeData,
  }

  switch (graphNode.type) {
    case 'signal': {
      const signalNode = graphNode as SignalNode
      // Map signal back to event node type
      const signalToNode: Record<string, string> = {
        'Init': 'on-start',
        'Update': 'on-update',
        'Collision': 'on-collision',
      }
      const nodeTypeId = signalToNode[signalNode.signal] || 'on-trigger'
      baseNode.data = {
        nodeTypeId,
        inputs: nodeTypeId === 'on-trigger' ? { name: signalNode.signal } : {},
      } as CustomNodeData
      break
    }

    case 'action': {
      const actionNode = graphNode as ActionNode
      // Map action back to node type
      const actionToNode: Record<string, string> = {
        'log': 'print',
        'spawn': 'spawn-entity',
        'destroy': 'destroy-entity',
        'move': 'move-entity',
        'playSound': 'play-sound',
        'emit': 'emit-event',
      }
      baseNode.data = {
        nodeTypeId: actionToNode[actionNode.action] || actionNode.action,
        inputs: actionNode.params as Record<string, unknown>,
      } as CustomNodeData
      break
    }

    case 'branch': {
      baseNode.data = {
        nodeTypeId: 'branch',
        inputs: {},
      } as CustomNodeData
      break
    }

    case 'flow': {
      const flowNode = graphNode as FlowNode
      const operationToNode: Record<string, string> = {
        'sequence': 'sequence',
        'delay': 'delay',
      }
      baseNode.data = {
        nodeTypeId: operationToNode[flowNode.operation] || 'sequence',
        inputs: flowNode.operation === 'delay' ? { seconds: flowNode.duration } : {},
      } as CustomNodeData
      break
    }

    case 'variable': {
      const varNode = graphNode as VariableNode
      const opToNode: Record<string, string> = {
        'get': 'get-variable',
        'set': 'set-variable',
        'constant': typeof varNode.value === 'number' ? 'number' : 'string',
      }
      baseNode.data = {
        nodeTypeId: opToNode[varNode.operation] || 'get-variable',
        inputs: { name: varNode.variable, value: varNode.value },
      } as CustomNodeData
      break
    }

    default:
      return null
  }

  return baseNode
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate a logic graph for common issues
 */
export function validateGraph(graph: LogicGraph): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for orphan nodes (no connections)
  const connectedNodes = new Set<string>()
  for (const edge of graph.edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  for (const node of graph.nodes) {
    if (!connectedNodes.has(node.id)) {
      warnings.push(`Node '${node.id}' has no connections`)
    }
  }

  // Check for signal nodes (need at least one entry point)
  const hasSignal = graph.nodes.some(n => n.type === 'signal')
  if (!hasSignal) {
    errors.push('Graph has no signal/event nodes - it cannot be triggered')
  }

  // Check for edge validity
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge '${edge.id}' references non-existent source node: ${edge.source}`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge '${edge.id}' references non-existent target node: ${edge.target}`)
    }
  }

  // Check for circular dependencies (basic cycle detection)
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const outgoingEdges = graph.edges.filter(e => e.source === nodeId)
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true
      } else if (recursionStack.has(edge.target)) {
        return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        warnings.push('Graph contains cycles - ensure loops are intentional')
        break
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize a graph to JSON for saving
 */
export function serializeGraph(graph: LogicGraph): string {
  return JSON.stringify(graph, null, 2)
}

/**
 * Deserialize a graph from JSON
 */
export function deserializeGraph(json: string): LogicGraph {
  return JSON.parse(json) as LogicGraph
}
