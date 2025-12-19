// ═══════════════════════════════════════════════════════════════════════════
// Serialization Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  serializeGraph,
  deserializeGraph,
  validateGraph,
  graphToJSON,
  graphFromJSON,
  cloneGraph,
  graphToReactFlow,
  reactFlowToGraph,
} from './serialization'
import type { LogicGraph } from './graph'

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestGraph(): LogicGraph {
  return {
    graphId: 'test-graph',
    version: '1.0.0',
    description: 'A test graph',
    variables: [
      { name: 'health', type: 'number', scope: 'node', default: 100 },
      { name: 'playerName', type: 'string', scope: 'global', default: 'Hero' },
    ],
    nodes: [
      {
        id: 'node-1',
        type: 'signal',
        position: [100, 100],
        signal: 'Init',
      },
      {
        id: 'node-2',
        type: 'action',
        position: [300, 100],
        component: 'Debug',
        method: 'log',
        inputs: { message: 'Hello World' },
      },
      {
        id: 'node-3',
        type: 'branch',
        position: [300, 200],
        kind: 'if',
        condition: { $expr: 'health > 50' },
      },
      {
        id: 'node-4',
        type: 'variable',
        position: [100, 300],
        operation: 'get',
        variable: 'health',
      },
    ],
    edges: [
      { from: 'node-1', fromPin: 'flow', to: 'node-2', toPin: 'flow' },
      { from: 'node-2', fromPin: 'flow', to: 'node-3', toPin: 'flow' },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeGraph', () => {
  it('should serialize a graph to JSON-safe format', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)

    expect(serialized.formatVersion).toBe(1)
    expect(serialized.graphId).toBe('test-graph')
    expect(serialized.version).toBe('1.0.0')
    expect(serialized.nodes).toHaveLength(4)
    expect(serialized.edges).toHaveLength(2)
    expect(serialized.variables).toHaveLength(2)
  })

  it('should serialize signal nodes correctly', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    const signalNode = serialized.nodes.find(n => n.id === 'node-1')

    expect(signalNode?.type).toBe('signal')
    expect(signalNode?.data.signal).toBe('Init')
  })

  it('should serialize action nodes correctly', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    const actionNode = serialized.nodes.find(n => n.id === 'node-2')

    expect(actionNode?.type).toBe('action')
    expect(actionNode?.data.component).toBe('Debug')
    expect(actionNode?.data.method).toBe('log')
    expect(actionNode?.data.inputs).toEqual({ message: 'Hello World' })
  })

  it('should serialize branch nodes correctly', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    const branchNode = serialized.nodes.find(n => n.id === 'node-3')

    expect(branchNode?.type).toBe('branch')
    expect(branchNode?.data.kind).toBe('if')
    expect(branchNode?.data.condition).toEqual({ $expr: 'health > 50' })
  })

  it('should serialize variable nodes correctly', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    const variableNode = serialized.nodes.find(n => n.id === 'node-4')

    expect(variableNode?.type).toBe('variable')
    expect(variableNode?.data.operation).toBe('get')
    expect(variableNode?.data.variable).toBe('health')
  })

  it('should include metadata', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)

    expect(serialized.metadata).toBeDefined()
    expect(serialized.metadata?.modifiedAt).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Deserialization Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('deserializeGraph', () => {
  it('should deserialize a serialized graph', () => {
    const original = createTestGraph()
    const serialized = serializeGraph(original)
    const deserialized = deserializeGraph(serialized)

    expect(deserialized.graphId).toBe(original.graphId)
    expect(deserialized.version).toBe(original.version)
    expect(deserialized.nodes).toHaveLength(original.nodes.length)
    expect(deserialized.edges).toHaveLength(original.edges.length)
  })

  it('should preserve node types after round-trip', () => {
    const original = createTestGraph()
    const serialized = serializeGraph(original)
    const deserialized = deserializeGraph(serialized)

    const signalNode = deserialized.nodes.find(n => n.id === 'node-1')
    expect(signalNode?.type).toBe('signal')
    if (signalNode?.type === 'signal') {
      expect(signalNode.signal).toBe('Init')
    }

    const actionNode = deserialized.nodes.find(n => n.id === 'node-2')
    expect(actionNode?.type).toBe('action')
    if (actionNode?.type === 'action') {
      expect(actionNode.component).toBe('Debug')
      expect(actionNode.method).toBe('log')
    }
  })

  it('should preserve edges after round-trip', () => {
    const original = createTestGraph()
    const serialized = serializeGraph(original)
    const deserialized = deserializeGraph(serialized)

    expect(deserialized.edges[0]).toEqual(original.edges[0])
    expect(deserialized.edges[1]).toEqual(original.edges[1])
  })

  it('should preserve variables after round-trip', () => {
    const original = createTestGraph()
    const serialized = serializeGraph(original)
    const deserialized = deserializeGraph(serialized)

    expect(deserialized.variables).toHaveLength(2)
    expect(deserialized.variables[0].name).toBe('health')
    expect(deserialized.variables[0].default).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateGraph', () => {
  it('should return no errors for a valid graph', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    const errors = validateGraph(serialized)

    const criticalErrors = errors.filter(e => e.type === 'error')
    expect(criticalErrors).toHaveLength(0)
  })

  it('should detect duplicate node IDs', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    // Add duplicate node
    serialized.nodes.push({ ...serialized.nodes[0] })

    const errors = validateGraph(serialized)
    const duplicateError = errors.find(e => e.message.includes('Duplicate node ID'))
    expect(duplicateError).toBeDefined()
  })

  it('should detect edges referencing non-existent nodes', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)
    // Add invalid edge
    serialized.edges.push({
      from: 'non-existent',
      fromPin: 'flow',
      to: 'node-1',
      toPin: 'flow',
    })

    const errors = validateGraph(serialized)
    const invalidEdge = errors.find(e => e.message.includes('non-existent'))
    expect(invalidEdge).toBeDefined()
  })

  it('should warn about orphaned nodes', () => {
    const graph = createTestGraph()
    const serialized = serializeGraph(graph)

    const errors = validateGraph(serialized)
    const warnings = errors.filter(e => e.type === 'warning')
    // node-4 is not connected to anything
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('should not warn about orphaned signal nodes', () => {
    const serialized = serializeGraph({
      graphId: 'test',
      version: '1.0.0',
      nodes: [
        { id: 'signal-1', type: 'signal', position: [0, 0], signal: 'Init' },
      ],
      edges: [],
      variables: [],
    })

    const errors = validateGraph(serialized)
    const orphanWarning = errors.find(e => e.message.includes('Orphaned') && e.nodeId === 'signal-1')
    expect(orphanWarning).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// JSON Helpers Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('graphToJSON / graphFromJSON', () => {
  it('should convert graph to JSON string', () => {
    const graph = createTestGraph()
    const json = graphToJSON(graph)

    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('should convert graph to pretty JSON', () => {
    const graph = createTestGraph()
    const json = graphToJSON(graph, true)

    expect(json).toContain('\n')
    expect(json).toContain('  ')
  })

  it('should parse JSON back to graph', () => {
    const graph = createTestGraph()
    const json = graphToJSON(graph)
    const parsed = graphFromJSON(json)

    expect(parsed.graphId).toBe(graph.graphId)
    expect(parsed.nodes).toHaveLength(graph.nodes.length)
  })

  it('should throw on invalid graph JSON', () => {
    const invalidJson = JSON.stringify({
      formatVersion: 1,
      graphId: 'test',
      version: '1.0.0',
      nodes: [{ id: 'node-1', type: 'signal', position: [0, 0], data: {} }],
      edges: [{ from: 'non-existent', fromPin: 'flow', to: 'node-1', toPin: 'flow' }],
      variables: [],
    })

    expect(() => graphFromJSON(invalidJson)).toThrow()
  })
})

describe('cloneGraph', () => {
  it('should create a deep copy of the graph', () => {
    const original = createTestGraph()
    const cloned = cloneGraph(original)

    expect(cloned).not.toBe(original)
    expect(cloned.graphId).toBe(original.graphId)
    expect(cloned.nodes).not.toBe(original.nodes)
    expect(cloned.nodes[0]).not.toBe(original.nodes[0])
  })

  it('should allow changing the graph ID', () => {
    const original = createTestGraph()
    const cloned = cloneGraph(original, 'new-graph-id')

    expect(cloned.graphId).toBe('new-graph-id')
    expect(original.graphId).toBe('test-graph')
  })

  it('should not affect original when modifying clone', () => {
    const original = createTestGraph()
    const cloned = cloneGraph(original)

    cloned.nodes.push({
      id: 'new-node',
      type: 'signal',
      position: [0, 0],
      signal: 'Test',
    })

    expect(original.nodes).toHaveLength(4)
    expect(cloned.nodes).toHaveLength(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// React Flow Conversion Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('graphToReactFlow', () => {
  it('should convert nodes to React Flow format', () => {
    const graph = createTestGraph()
    const { nodes } = graphToReactFlow(graph)

    expect(nodes).toHaveLength(4)
    expect(nodes[0].id).toBe('node-1')
    expect(nodes[0].position).toEqual({ x: 100, y: 100 })
  })

  it('should map signal nodes to their signal type', () => {
    const graph = createTestGraph()
    const { nodes } = graphToReactFlow(graph)

    const signalNode = nodes.find(n => n.id === 'node-1')
    expect(signalNode?.type).toBe('Init')
  })

  it('should map action nodes to component.method format', () => {
    const graph = createTestGraph()
    const { nodes } = graphToReactFlow(graph)

    const actionNode = nodes.find(n => n.id === 'node-2')
    expect(actionNode?.type).toBe('Debug.log')
  })

  it('should convert edges to React Flow format', () => {
    const graph = createTestGraph()
    const { edges } = graphToReactFlow(graph)

    expect(edges).toHaveLength(2)
    expect(edges[0].source).toBe('node-1')
    expect(edges[0].sourceHandle).toBe('flow')
    expect(edges[0].target).toBe('node-2')
    expect(edges[0].targetHandle).toBe('flow')
  })
})

describe('reactFlowToGraph', () => {
  it('should convert React Flow nodes back to graph format', () => {
    const rfNodes = [
      { id: 'n1', type: 'Init', position: { x: 0, y: 0 }, data: {} },
      { id: 'n2', type: 'Debug.log', position: { x: 100, y: 0 }, data: { message: 'test' } },
    ]
    const rfEdges = [
      { id: 'e1', source: 'n1', sourceHandle: 'flow', target: 'n2', targetHandle: 'flow' },
    ]

    const graph = reactFlowToGraph(rfNodes, rfEdges, 'my-graph')

    expect(graph.graphId).toBe('my-graph')
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
  })

  it('should convert signal-type nodes correctly', () => {
    const rfNodes = [
      { id: 'n1', type: 'on-key-down', position: { x: 0, y: 0 }, data: { key: 'Space' } },
    ]

    const graph = reactFlowToGraph(rfNodes, [], 'test')
    const node = graph.nodes[0]

    expect(node.type).toBe('signal')
    if (node.type === 'signal') {
      expect(node.signal).toBe('on-key-down')
    }
  })

  it('should convert variable nodes correctly', () => {
    const rfNodes = [
      { id: 'n1', type: 'variable-get', position: { x: 0, y: 0 }, data: { variable: 'health' } },
      { id: 'n2', type: 'variable-set', position: { x: 0, y: 0 }, data: { variable: 'health', value: 50 } },
    ]

    const graph = reactFlowToGraph(rfNodes, [], 'test')

    expect(graph.nodes[0].type).toBe('variable')
    if (graph.nodes[0].type === 'variable') {
      expect(graph.nodes[0].operation).toBe('get')
    }

    expect(graph.nodes[1].type).toBe('variable')
    if (graph.nodes[1].type === 'variable') {
      expect(graph.nodes[1].operation).toBe('set')
    }
  })

  it('should convert flow control nodes correctly', () => {
    const rfNodes = [
      { id: 'n1', type: 'delay', position: { x: 0, y: 0 }, data: { duration: 1.5 } },
      { id: 'n2', type: 'sequence', position: { x: 0, y: 0 }, data: {} },
    ]

    const graph = reactFlowToGraph(rfNodes, [], 'test')

    expect(graph.nodes[0].type).toBe('flow')
    if (graph.nodes[0].type === 'flow') {
      expect(graph.nodes[0].kind).toBe('delay')
    }

    expect(graph.nodes[1].type).toBe('flow')
    if (graph.nodes[1].type === 'flow') {
      expect(graph.nodes[1].kind).toBe('sequence')
    }
  })

  it('should handle round-trip conversion', () => {
    const original = createTestGraph()
    const { nodes, edges } = graphToReactFlow(original)
    const restored = reactFlowToGraph(nodes, edges, original.graphId, original.version)

    expect(restored.graphId).toBe(original.graphId)
    expect(restored.nodes).toHaveLength(original.nodes.length)
    expect(restored.edges).toHaveLength(original.edges.length)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Flow Node Types Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('flow node serialization', () => {
  it('should serialize delay nodes', () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      nodes: [
        {
          id: 'delay-1',
          type: 'flow',
          position: [0, 0],
          kind: 'delay',
          duration: 2.5,
        },
      ],
      edges: [],
      variables: [],
    }

    const serialized = serializeGraph(graph)
    const node = serialized.nodes[0]

    expect(node.data.kind).toBe('delay')
    expect(node.data.duration).toBe(2.5)
  })

  it('should serialize forEach nodes', () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      nodes: [
        {
          id: 'foreach-1',
          type: 'flow',
          position: [0, 0],
          kind: 'forEach',
          collection: { $expr: 'enemies' },
          itemVariable: 'enemy',
        },
      ],
      edges: [],
      variables: [],
    }

    const serialized = serializeGraph(graph)
    const deserialized = deserializeGraph(serialized)
    const node = deserialized.nodes[0]

    expect(node.type).toBe('flow')
    if (node.type === 'flow') {
      expect(node.kind).toBe('forEach')
      expect(node.itemVariable).toBe('enemy')
    }
  })
})

describe('subgraph node serialization', () => {
  it('should serialize subgraph nodes', () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      nodes: [
        {
          id: 'sub-1',
          type: 'subgraph',
          position: [0, 0],
          graphRef: 'damage-calculation',
          inputMappings: { damage: 10, target: { $expr: 'self' } },
          outputMappings: { result: 'finalDamage' },
        },
      ],
      edges: [],
      variables: [],
    }

    const serialized = serializeGraph(graph)
    const deserialized = deserializeGraph(serialized)
    const node = deserialized.nodes[0]

    expect(node.type).toBe('subgraph')
    if (node.type === 'subgraph') {
      expect(node.graphRef).toBe('damage-calculation')
      expect(node.inputMappings?.damage).toBe(10)
      expect(node.outputMappings?.result).toBe('finalDamage')
    }
  })
})
