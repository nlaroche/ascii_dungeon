// =============================================================================
// PlayMode Integration Tests - Tests actual play mode execution flow
// These tests simulate the real scenario of loading graphs and executing behaviors
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GraphRuntime, LogicGraph, GraphExecutionContext } from './graph'
import { reactFlowToGraph } from './serialization'
import { TriplePhaseEventBus } from './events'
import { SeededRandom } from './lifecycle'
import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react'

// -----------------------------------------------------------------------------
// Mock Engine State (simulates what __engineState provides)
// -----------------------------------------------------------------------------

interface MockComponent {
  id: string
  script: string
  enabled: boolean
  properties: Record<string, unknown>
}

interface MockEntity {
  id: string
  name: string
  position: { x: number; y: number; z: number }
  components: MockComponent[]
  children: MockEntity[]
}

function createMockEngineState() {
  const entities = new Map<string, MockEntity>()

  const findNode = (root: MockEntity, id: string): MockEntity | null => {
    if (root.id === id) return root
    for (const child of root.children) {
      const found = findNode(child, id)
      if (found) return found
    }
    return null
  }

  const findPath = (root: MockEntity, id: string, path: number[] = []): number[] | null => {
    if (root.id === id) return path
    for (let i = 0; i < root.children.length; i++) {
      const result = findPath(root.children[i], id, [...path, i])
      if (result) return result
    }
    return null
  }

  let rootNode: MockEntity = {
    id: 'root',
    name: 'Root',
    position: { x: 0, y: 0, z: 0 },
    components: [],
    children: []
  }

  return {
    getState: () => ({
      scene: { rootNode },
      setPath: (path: (string | number)[], value: unknown) => {
        // Path format: ['scene', 'rootNode', 'children', 0, 'components', 0, 'properties', 'x']
        const childIndices = path.filter((p, i) =>
          path[i-1] === 'children' && typeof p === 'number'
        ) as number[]

        let current = rootNode
        for (const idx of childIndices) {
          current = current.children[idx]
        }

        if (current) {
          // Handle Rect2D property updates (new format)
          const propIndex = path.indexOf('properties')
          if (propIndex !== -1 && path[propIndex + 1]) {
            const compIndex = path[path.indexOf('components') + 1] as number
            const propName = path[propIndex + 1] as string
            if (current.components[compIndex]) {
              current.components[compIndex].properties[propName] = value
              // Also update position for test assertions
              if (propName === 'x') {
                current.position.x = value as number
              } else if (propName === 'y') {
                current.position.y = value as number
              }
            }
          }
          // Handle legacy position format
          else if (path.includes('position')) {
            if (Array.isArray(value)) {
              current.position = { x: value[0], y: value[1], z: value[2] || 0 }
            } else {
              const pos = value as { x: number; y: number; z: number }
              current.position = pos
            }
          }
        }
      }
    }),
    addEntity: (entity: MockEntity) => {
      rootNode.children.push(entity)
      entities.set(entity.id, entity)
    },
    getEntity: (id: string) => findNode(rootNode, id),
    getRootNode: () => rootNode
  }
}

// -----------------------------------------------------------------------------
// Test Helper: Create execution context
// -----------------------------------------------------------------------------

function createTestContext(
  eventBus: TriplePhaseEventBus,
  nodeId: string
): GraphExecutionContext {
  return {
    nodeId,
    globalVars: {},
    sceneVars: {},
    nodeVars: {},
    localVars: {},
    components: new Map(),
    subGraphs: new Map(),
    random: new SeededRandom(),
    cancelled: false,
    eventBus,
  }
}

// -----------------------------------------------------------------------------
// Test: Wander Graph Conversion
// -----------------------------------------------------------------------------

describe('Wander Graph Conversion', () => {
  it('should correctly convert wander graph from ReactFlow format', () => {
    // This is the actual wander.graph.json structure
    const nodes: ReactFlowNode[] = [
      { id: '1', type: 'custom', position: { x: 50, y: 50 }, data: { nodeTypeId: 'on-start', inputs: {} } },
      { id: '2', type: 'custom', position: { x: 250, y: 50 }, data: { nodeTypeId: 'print', inputs: { message: 'Wander started!' } } },
      { id: '3', type: 'custom', position: { x: 50, y: 180 }, data: { nodeTypeId: 'on-update', inputs: {} } },
      { id: '4', type: 'custom', position: { x: 250, y: 180 }, data: { nodeTypeId: 'random', inputs: { min: 0, max: 100 } } },
      { id: '5', type: 'custom', position: { x: 450, y: 180 }, data: { nodeTypeId: 'compare', inputs: { a: 0, b: 5 } } },
      { id: '6', type: 'custom', position: { x: 650, y: 180 }, data: { nodeTypeId: 'branch', inputs: {} } },
      { id: '7', type: 'custom', position: { x: 50, y: 350 }, data: { nodeTypeId: 'get-self', inputs: {} } },
      { id: '8', type: 'custom', position: { x: 250, y: 350 }, data: { nodeTypeId: 'random', inputs: { min: -1, max: 1 } } },
      { id: '9', type: 'custom', position: { x: 450, y: 350 }, data: { nodeTypeId: 'random', inputs: { min: -1, max: 1 } } },
      { id: '10', type: 'custom', position: { x: 650, y: 350 }, data: { nodeTypeId: 'translate', inputs: {} } },
    ]

    const edges: ReactFlowEdge[] = [
      { id: 'e1', source: '1', sourceHandle: 'flow', target: '2', targetHandle: 'flow', type: 'smoothstep' },
      { id: 'e2', source: '3', sourceHandle: 'flow', target: '6', targetHandle: 'flow', type: 'smoothstep' },
      { id: 'e3', source: '4', sourceHandle: 'value', target: '5', targetHandle: 'a', type: 'smoothstep' },
      { id: 'e4', source: '5', sourceHandle: 'less', target: '6', targetHandle: 'condition', type: 'smoothstep' },
      { id: 'e5', source: '6', sourceHandle: 'true', target: '10', targetHandle: 'flow', type: 'smoothstep' },
      { id: 'e6', source: '7', sourceHandle: 'entity', target: '10', targetHandle: 'entity', type: 'smoothstep' },
      { id: 'e7', source: '8', sourceHandle: 'value', target: '10', targetHandle: 'dx', type: 'smoothstep' },
      { id: 'e8', source: '9', sourceHandle: 'value', target: '10', targetHandle: 'dy', type: 'smoothstep' },
    ]

    const graph = reactFlowToGraph(nodes, edges, 'wander-test')

    // Verify the graph has the expected structure
    expect(graph.graphId).toBe('wander-test')
    expect(graph.nodes.length).toBe(10)
    expect(graph.edges.length).toBe(8)

    // Check that signal nodes are properly typed
    const initNode = graph.nodes.find(n => n.id === '1')
    expect(initNode?.type).toBe('signal')
    expect((initNode as any).signal).toBe('Init')

    const updateNode = graph.nodes.find(n => n.id === '3')
    expect(updateNode?.type).toBe('signal')
    expect((updateNode as any).signal).toBe('Update')

    // Check branch node
    const branchNode = graph.nodes.find(n => n.id === '6')
    expect(branchNode?.type).toBe('branch')

    // Check translate node has correct structure
    const translateNode = graph.nodes.find(n => n.id === '10')
    expect(translateNode?.type).toBe('action')
    expect((translateNode as any).component).toBe('Builtin')
    expect((translateNode as any).method).toBe('translate')

    // Check random nodes have correct inputs
    const randomNode4 = graph.nodes.find(n => n.id === '4')
    expect(randomNode4?.type).toBe('action')
    expect((randomNode4 as any).method).toBe('random')
    expect((randomNode4 as any).inputs.min).toBe(0)
    expect((randomNode4 as any).inputs.max).toBe(100)

    // Check compare node
    const compareNode = graph.nodes.find(n => n.id === '5')
    expect(compareNode?.type).toBe('action')
    expect((compareNode as any).method).toBe('compare')
    expect((compareNode as any).inputs.b).toBe(5)
  })
})

// -----------------------------------------------------------------------------
// Test: Graph Runtime with Wander Behavior
// -----------------------------------------------------------------------------

describe('Wander Behavior Runtime', () => {
  let eventBus: TriplePhaseEventBus
  let mockState: ReturnType<typeof createMockEngineState>

  beforeEach(() => {
    eventBus = new TriplePhaseEventBus()
    mockState = createMockEngineState()

    // Setup mock engine state on window
    ;(global as any).window = {
      __engineState: {
        getState: () => ({
          scene: { rootNode: mockState.getRootNode() },
          setPath: mockState.getState().setPath,
        })
      }
    }

    // Add a test entity (the sheep) with Rect2D component for position
    mockState.addEntity({
      id: 'sheep-1',
      name: 'Sheep',
      position: { x: 10, y: 10, z: 0 },
      components: [
        {
          id: 'sheep-1-rect',
          script: 'Rect2D',
          enabled: true,
          properties: { x: 10, y: 10, width: 1, height: 1 }
        }
      ],
      children: []
    })
  })

  afterEach(() => {
    delete (global as any).window
  })

  it('should execute translate and move entity when branch is true', async () => {
    // Simple graph: Update -> Branch(always true) -> Translate
    const graph: LogicGraph = {
      graphId: 'simple-move',
      version: '1.0',
      variables: [],
      nodes: [
        { id: 'update', type: 'signal', signal: 'Update', position: [0, 0] },
        { id: 'branch', type: 'branch', kind: 'if', condition: true, position: [200, 0] },
        {
          id: 'translate',
          type: 'action',
          component: 'Builtin',
          method: 'translate',
          inputs: { dx: 1, dy: 1 },
          position: [400, 0]
        }
      ],
      edges: [
        { from: 'update', fromPin: 'flow', to: 'branch', toPin: 'flow' },
        { from: 'branch', fromPin: 'true', to: 'translate', toPin: 'flow' }
      ]
    }

    const ctx = createTestContext(eventBus, 'sheep-1')
    const runtime = new GraphRuntime(graph)

    // Capture initial position
    const initialPos = { ...mockState.getEntity('sheep-1')!.position }

    // Trigger update
    await runtime.triggerSignal('Update', ctx)

    // Check position changed
    const newPos = mockState.getEntity('sheep-1')!.position
    expect(newPos.x).toBe(initialPos.x + 1)
    expect(newPos.y).toBe(initialPos.y + 1)
  })

  it('should NOT move entity when branch is false', async () => {
    const graph: LogicGraph = {
      graphId: 'no-move',
      version: '1.0',
      variables: [],
      nodes: [
        { id: 'update', type: 'signal', signal: 'Update', position: [0, 0] },
        { id: 'branch', type: 'branch', kind: 'if', condition: false, position: [200, 0] },
        {
          id: 'translate',
          type: 'action',
          component: 'Builtin',
          method: 'translate',
          inputs: { dx: 1, dy: 1 },
          position: [400, 0]
        }
      ],
      edges: [
        { from: 'update', fromPin: 'flow', to: 'branch', toPin: 'flow' },
        { from: 'branch', fromPin: 'true', to: 'translate', toPin: 'flow' }
      ]
    }

    const ctx = createTestContext(eventBus, 'sheep-1')
    const runtime = new GraphRuntime(graph)

    const initialPos = { ...mockState.getEntity('sheep-1')!.position }

    // Trigger multiple updates
    for (let i = 0; i < 10; i++) {
      await runtime.triggerSignal('Update', ctx)
    }

    // Position should NOT change
    const newPos = mockState.getEntity('sheep-1')!.position
    expect(newPos.x).toBe(initialPos.x)
    expect(newPos.y).toBe(initialPos.y)
  })

  it('should resolve random values from data edges', async () => {
    // Graph with random node feeding into translate
    const graph: LogicGraph = {
      graphId: 'random-move',
      version: '1.0',
      variables: [],
      nodes: [
        { id: 'update', type: 'signal', signal: 'Update', position: [0, 0] },
        {
          id: 'random-dx',
          type: 'action',
          component: '',
          method: 'random',
          inputs: { min: 1, max: 2 },  // Always positive for predictable test
          position: [200, 0]
        },
        {
          id: 'translate',
          type: 'action',
          component: 'Builtin',
          method: 'translate',
          inputs: { dy: 0 },  // Only dx from edge
          position: [400, 0]
        }
      ],
      edges: [
        { from: 'update', fromPin: 'flow', to: 'translate', toPin: 'flow' },
        { from: 'random-dx', fromPin: 'value', to: 'translate', toPin: 'dx' }
      ]
    }

    const ctx = createTestContext(eventBus, 'sheep-1')
    const runtime = new GraphRuntime(graph)

    const initialPos = { ...mockState.getEntity('sheep-1')!.position }

    await runtime.triggerSignal('Update', ctx)

    const newPos = mockState.getEntity('sheep-1')!.position
    // dx should be between 1 and 2
    expect(newPos.x).toBeGreaterThanOrEqual(initialPos.x + 1)
    expect(newPos.x).toBeLessThanOrEqual(initialPos.x + 2)
    // dy should not change (set to 0)
    expect(newPos.y).toBe(initialPos.y)
  })

  it('should resolve compare condition from data edge', async () => {
    // Graph: Update -> Compare(always returns less=true) -> Branch -> Translate
    const graph: LogicGraph = {
      graphId: 'compare-branch',
      version: '1.0',
      variables: [],
      nodes: [
        { id: 'update', type: 'signal', signal: 'Update', position: [0, 0] },
        {
          id: 'compare',
          type: 'action',
          component: '',
          method: 'compare',
          inputs: { a: 0, b: 100 },  // 0 < 100, so less=true
          position: [200, 0]
        },
        { id: 'branch', type: 'branch', kind: 'if', position: [400, 0] },
        {
          id: 'translate',
          type: 'action',
          component: 'Builtin',
          method: 'translate',
          inputs: { dx: 5, dy: 5 },
          position: [600, 0]
        }
      ],
      edges: [
        { from: 'update', fromPin: 'flow', to: 'branch', toPin: 'flow' },
        { from: 'compare', fromPin: 'less', to: 'branch', toPin: 'condition' },
        { from: 'branch', fromPin: 'true', to: 'translate', toPin: 'flow' }
      ]
    }

    const ctx = createTestContext(eventBus, 'sheep-1')
    const runtime = new GraphRuntime(graph)

    const initialPos = { ...mockState.getEntity('sheep-1')!.position }

    await runtime.triggerSignal('Update', ctx)

    const newPos = mockState.getEntity('sheep-1')!.position
    // Should have moved because 0 < 100
    expect(newPos.x).toBe(initialPos.x + 5)
    expect(newPos.y).toBe(initialPos.y + 5)
  })

  it('should simulate full wander behavior over multiple frames', async () => {
    // Full wander: Update -> Random -> Compare -> Branch -> Random dx/dy -> Translate
    // Using 5% chance like the real wander graph
    const graph: LogicGraph = {
      graphId: 'wander-sim',
      version: '1.0',
      variables: [],
      nodes: [
        { id: 'update', type: 'signal', signal: 'Update', position: [0, 0] },
        { id: 'random-chance', type: 'action', component: '', method: 'random', inputs: { min: 0, max: 100 }, position: [200, 0] },
        { id: 'compare', type: 'action', component: '', method: 'compare', inputs: { b: 5 }, position: [400, 0] },
        { id: 'branch', type: 'branch', kind: 'if', position: [600, 0] },
        { id: 'random-dx', type: 'action', component: '', method: 'random', inputs: { min: -1, max: 1 }, position: [800, 0] },
        { id: 'random-dy', type: 'action', component: '', method: 'random', inputs: { min: -1, max: 1 }, position: [800, 100] },
        { id: 'translate', type: 'action', component: 'Builtin', method: 'translate', inputs: {}, position: [1000, 0] },
      ],
      edges: [
        { from: 'update', fromPin: 'flow', to: 'branch', toPin: 'flow' },
        { from: 'random-chance', fromPin: 'value', to: 'compare', toPin: 'a' },
        { from: 'compare', fromPin: 'less', to: 'branch', toPin: 'condition' },
        { from: 'branch', fromPin: 'true', to: 'translate', toPin: 'flow' },
        { from: 'random-dx', fromPin: 'value', to: 'translate', toPin: 'dx' },
        { from: 'random-dy', fromPin: 'value', to: 'translate', toPin: 'dy' },
      ]
    }

    const ctx = createTestContext(eventBus, 'sheep-1')
    const runtime = new GraphRuntime(graph)

    const initialPos = { ...mockState.getEntity('sheep-1')!.position }
    let moveCount = 0

    // Simulate 1000 frames
    for (let i = 0; i < 1000; i++) {
      const beforePos = { ...mockState.getEntity('sheep-1')!.position }
      await runtime.triggerSignal('Update', ctx)
      const afterPos = mockState.getEntity('sheep-1')!.position

      if (afterPos.x !== beforePos.x || afterPos.y !== beforePos.y) {
        moveCount++
      }
    }

    // With 5% chance, expect roughly 50 moves (±30 for variance)
    console.log(`[Test] Wander behavior moved ${moveCount} times over 1000 frames`)
    expect(moveCount).toBeGreaterThan(10)
    expect(moveCount).toBeLessThan(150)

    // Final position should be different from initial
    const finalPos = mockState.getEntity('sheep-1')!.position
    const totalMovement = Math.abs(finalPos.x - initialPos.x) + Math.abs(finalPos.y - initialPos.y)
    expect(totalMovement).toBeGreaterThan(0)
  })
})
