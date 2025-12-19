// ═══════════════════════════════════════════════════════════════════════════
// Logic Graph Runtime Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  GraphRuntime,
  GraphExecutor,
  LogicGraph,
  GraphExecutionContext,
  ComponentInstance,
} from './graph'
import { TriplePhaseEventBus, createGameEvent } from './events'
import { SeededRandom } from './lifecycle'
import { ExprValue } from './expressions'

// Helper to create a minimal context
function createContext(
  overrides: Partial<GraphExecutionContext> = {}
): GraphExecutionContext {
  return {
    nodeId: 'test-node',
    globalVars: {},
    sceneVars: {},
    nodeVars: {},
    localVars: {},
    components: new Map(),
    subGraphs: new Map(),
    random: new SeededRandom(42),
    cancelled: false,
    eventBus: new TriplePhaseEventBus(),
    ...overrides,
  }
}

describe('GraphRuntime', () => {
  describe('variable management', () => {
    it('should initialize variables with defaults', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'health', type: 'number', scope: 'node', default: 100 },
          { name: 'name', type: 'string', scope: 'node', default: 'Player' },
          { name: 'position', type: 'vec2', scope: 'node', default: [0, 0] },
        ],
        nodes: [],
        edges: [],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)

      expect(ctx.nodeVars.health).toBe(100)
      expect(ctx.nodeVars.name).toBe('Player')
      expect(ctx.nodeVars.position).toEqual([0, 0])
    })

    it('should resolve expression defaults', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'baseHealth', type: 'number', scope: 'node', default: 100 },
          { name: 'maxHealth', type: 'number', scope: 'node', default: { $expr: 'baseHealth * 1.5' } },
        ],
        nodes: [],
        edges: [],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      // Need to set baseHealth first for the expression to work
      ctx.nodeVars.baseHealth = 100
      runtime.initializeVariables(ctx)

      expect(ctx.nodeVars.maxHealth).toBe(150)
    })

    it('should set and get variables by scope', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'globalScore', type: 'number', scope: 'global' },
          { name: 'sceneTimer', type: 'number', scope: 'scene' },
          { name: 'nodeHealth', type: 'number', scope: 'node' },
          { name: 'localTemp', type: 'number', scope: 'local' },
        ],
        nodes: [],
        edges: [],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.setVariable('globalScore', 'global', 1000, ctx)
      runtime.setVariable('sceneTimer', 'scene', 60, ctx)
      runtime.setVariable('nodeHealth', 'node', 100, ctx)
      runtime.setVariable('localTemp', 'local', 42, ctx)

      expect(ctx.globalVars.globalScore).toBe(1000)
      expect(ctx.sceneVars.sceneTimer).toBe(60)
      expect(ctx.nodeVars.nodeHealth).toBe(100)
      expect(ctx.localVars.localTemp).toBe(42)
    })

    it('should find variable by name across scopes', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [],
        nodes: [],
        edges: [],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext({
        globalVars: { score: 100 },
        sceneVars: { timer: 60 },
        nodeVars: { health: 50 },
        localVars: { temp: 1 },
      })

      expect(runtime.getVariableByName('temp', ctx)).toBe(1)
      expect(runtime.getVariableByName('health', ctx)).toBe(50)
      expect(runtime.getVariableByName('timer', ctx)).toBe(60)
      expect(runtime.getVariableByName('score', ctx)).toBe(100)
    })
  })

  describe('signal handlers', () => {
    it('should index signal nodes', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [],
        nodes: [
          { id: 'init1', type: 'signal', signal: 'Init', position: [0, 0] },
          { id: 'init2', type: 'signal', signal: 'Init', position: [0, 100] },
          { id: 'update', type: 'signal', signal: 'Update', position: [0, 200] },
        ],
        edges: [],
      }

      const runtime = new GraphRuntime(graph)

      expect(runtime.getSignalHandlers('Init')).toHaveLength(2)
      expect(runtime.getSignalHandlers('Update')).toHaveLength(1)
      expect(runtime.getSignalHandlers('NonExistent')).toHaveLength(0)
    })
  })

  describe('edge indexing', () => {
    it('should index outgoing edges', () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [],
        nodes: [
          { id: 'node1', type: 'signal', signal: 'Init', position: [0, 0] },
          { id: 'node2', type: 'variable', operation: 'set', variable: 'x', value: 1, position: [100, 0] },
          { id: 'node3', type: 'variable', operation: 'set', variable: 'y', value: 2, position: [100, 100] },
        ],
        edges: [
          { from: 'node1', fromPin: 'out', to: 'node2', toPin: 'in' },
          { from: 'node1', fromPin: 'out', to: 'node3', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)

      const edges = runtime.getOutgoingEdges('node1', 'out')
      expect(edges).toHaveLength(2)
    })
  })
})

describe('Graph Node Execution', () => {
  describe('variable nodes', () => {
    it('should execute set variable node', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'counter', type: 'number', scope: 'node', default: 0 },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'setVar', type: 'variable', operation: 'set', variable: 'counter', value: 42, position: [100, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'setVar', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      expect(ctx.nodeVars.counter).toBe(0)

      await runtime.triggerSignal('Test', ctx)
      expect(ctx.nodeVars.counter).toBe(42)
    })

    it('should execute set variable with expression', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'counter', type: 'number', scope: 'node', default: 10 },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'setVar', type: 'variable', operation: 'set', variable: 'counter', value: { $expr: 'counter * 2' }, position: [100, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'setVar', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.counter).toBe(20)
    })
  })

  describe('branch nodes', () => {
    it('should execute if-branch with true condition', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'condition', type: 'boolean', scope: 'node', default: true },
          { name: 'result', type: 'string', scope: 'node', default: '' },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'branch', type: 'branch', kind: 'if', condition: { $expr: 'condition' }, position: [100, 0] },
          { id: 'trueBranch', type: 'variable', operation: 'set', variable: 'result', value: 'true', position: [200, 0] },
          { id: 'falseBranch', type: 'variable', operation: 'set', variable: 'result', value: 'false', position: [200, 100] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'branch', toPin: 'in' },
          { from: 'branch', fromPin: 'true', to: 'trueBranch', toPin: 'in' },
          { from: 'branch', fromPin: 'false', to: 'falseBranch', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.result).toBe('true')
    })

    it('should execute if-branch with false condition', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'condition', type: 'boolean', scope: 'node', default: false },
          { name: 'result', type: 'string', scope: 'node', default: '' },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'branch', type: 'branch', kind: 'if', condition: { $expr: 'condition' }, position: [100, 0] },
          { id: 'trueBranch', type: 'variable', operation: 'set', variable: 'result', value: 'true', position: [200, 0] },
          { id: 'falseBranch', type: 'variable', operation: 'set', variable: 'result', value: 'false', position: [200, 100] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'branch', toPin: 'in' },
          { from: 'branch', fromPin: 'true', to: 'trueBranch', toPin: 'in' },
          { from: 'branch', fromPin: 'false', to: 'falseBranch', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.result).toBe('false')
    })

    it('should execute switch-branch', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'state', type: 'string', scope: 'node', default: 'idle' },
          { name: 'result', type: 'string', scope: 'node', default: '' },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'switch', type: 'branch', kind: 'switch', value: { $expr: 'state' }, cases: ['idle', 'walking', 'running'], position: [100, 0] },
          { id: 'idleCase', type: 'variable', operation: 'set', variable: 'result', value: 'is idle', position: [200, 0] },
          { id: 'walkingCase', type: 'variable', operation: 'set', variable: 'result', value: 'is walking', position: [200, 50] },
          { id: 'runningCase', type: 'variable', operation: 'set', variable: 'result', value: 'is running', position: [200, 100] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'switch', toPin: 'in' },
          { from: 'switch', fromPin: 'idle', to: 'idleCase', toPin: 'in' },
          { from: 'switch', fromPin: 'walking', to: 'walkingCase', toPin: 'in' },
          { from: 'switch', fromPin: 'running', to: 'runningCase', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.result).toBe('is idle')

      // Test walking state
      ctx.nodeVars.state = 'walking'
      await runtime.triggerSignal('Test', ctx)
      expect(ctx.nodeVars.result).toBe('is walking')
    })
  })

  describe('action nodes', () => {
    it('should call component methods', async () => {
      const mockMove = vi.fn().mockResolvedValue(true)

      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'action', type: 'action', component: 'Movement', method: 'moveTo', inputs: { x: 10, y: 20 }, position: [100, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'action', toPin: 'in' },
        ],
      }

      const components = new Map<string, ComponentInstance>()
      components.set('Movement', { moveTo: mockMove })

      const runtime = new GraphRuntime(graph)
      const ctx = createContext({ components })

      await runtime.triggerSignal('Test', ctx)

      expect(mockMove).toHaveBeenCalledWith({ x: 10, y: 20 })
    })

    it('should resolve expression inputs', async () => {
      const mockDamage = vi.fn().mockResolvedValue(true)

      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'baseDamage', type: 'number', scope: 'node', default: 50 },
          { name: 'multiplier', type: 'number', scope: 'node', default: 2 },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'action', type: 'action', component: 'Combat', method: 'dealDamage', inputs: { amount: { $expr: 'baseDamage * multiplier' } }, position: [100, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'action', toPin: 'in' },
        ],
      }

      const components = new Map<string, ComponentInstance>()
      components.set('Combat', { dealDamage: mockDamage })

      const runtime = new GraphRuntime(graph)
      const ctx = createContext({ components })

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(mockDamage).toHaveBeenCalledWith({ amount: 100 })
    })
  })

  describe('flow nodes', () => {
    it('should execute delay node', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'executed', type: 'boolean', scope: 'node', default: false },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'delay', type: 'flow', kind: 'delay', duration: 50, position: [100, 0] },
          { id: 'setVar', type: 'variable', operation: 'set', variable: 'executed', value: true, position: [200, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'delay', toPin: 'in' },
          { from: 'delay', fromPin: 'out', to: 'setVar', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)

      const start = Date.now()
      await runtime.triggerSignal('Test', ctx)
      const elapsed = Date.now() - start

      expect(ctx.nodeVars.executed).toBe(true)
      expect(elapsed).toBeGreaterThanOrEqual(45)
    })

    it('should execute forEach node', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'items', type: 'any', scope: 'node', default: [1, 2, 3] },
          { name: 'sum', type: 'number', scope: 'node', default: 0 },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'forEach', type: 'flow', kind: 'forEach', collection: { $expr: 'items' }, itemVariable: 'item', position: [100, 0] },
          { id: 'addItem', type: 'variable', operation: 'set', variable: 'sum', value: { $expr: 'sum + item' }, position: [200, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'forEach', toPin: 'in' },
          { from: 'forEach', fromPin: 'body', to: 'addItem', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.sum).toBe(6)
    })

    it('should execute cancel node', async () => {
      const graph: LogicGraph = {
        graphId: 'test',
        version: '1.0.0',
        variables: [
          { name: 'step1', type: 'boolean', scope: 'node', default: false },
          { name: 'step2', type: 'boolean', scope: 'node', default: false },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          { id: 'setStep1', type: 'variable', operation: 'set', variable: 'step1', value: true, position: [100, 0] },
          { id: 'cancel', type: 'flow', kind: 'cancel', reason: 'Testing', position: [200, 0] },
          { id: 'setStep2', type: 'variable', operation: 'set', variable: 'step2', value: true, position: [300, 0] },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'setStep1', toPin: 'in' },
          { from: 'setStep1', fromPin: 'out', to: 'cancel', toPin: 'in' },
          { from: 'cancel', fromPin: 'out', to: 'setStep2', toPin: 'in' },
        ],
      }

      const runtime = new GraphRuntime(graph)
      const ctx = createContext()

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.step1).toBe(true)
      expect(ctx.nodeVars.step2).toBe(false) // Should not execute after cancel
      expect(ctx.cancelled).toBe(true)
    })
  })

  describe('subgraph nodes', () => {
    it('should execute subgraph with input/output mappings', async () => {
      // Sub-graph: doubles the input
      const subGraph: LogicGraph = {
        graphId: 'doubler',
        version: '1.0.0',
        variables: [
          { name: 'input', type: 'number', scope: 'node', default: 0 },
          { name: 'output', type: 'number', scope: 'node', default: 0 },
        ],
        nodes: [
          { id: 'init', type: 'signal', signal: 'Init', position: [0, 0] },
          { id: 'double', type: 'variable', operation: 'set', variable: 'output', value: { $expr: 'input * 2' }, position: [100, 0] },
        ],
        edges: [
          { from: 'init', fromPin: 'out', to: 'double', toPin: 'in' },
        ],
      }

      // Main graph: calls the sub-graph
      const mainGraph: LogicGraph = {
        graphId: 'main',
        version: '1.0.0',
        variables: [
          { name: 'value', type: 'number', scope: 'node', default: 5 },
          { name: 'result', type: 'number', scope: 'node', default: 0 },
        ],
        nodes: [
          { id: 'signal', type: 'signal', signal: 'Test', position: [0, 0] },
          {
            id: 'callSubgraph',
            type: 'subgraph',
            graphRef: 'doubler',
            inputMappings: { input: { $expr: 'value' } },
            outputMappings: { output: 'result' },
            position: [100, 0],
          },
        ],
        edges: [
          { from: 'signal', fromPin: 'out', to: 'callSubgraph', toPin: 'in' },
        ],
      }

      const subGraphs = new Map<string, LogicGraph>()
      subGraphs.set('doubler', subGraph)

      const runtime = new GraphRuntime(mainGraph)
      const ctx = createContext({ subGraphs })

      runtime.initializeVariables(ctx)
      await runtime.triggerSignal('Test', ctx)

      expect(ctx.nodeVars.result).toBe(10)
    })
  })
})

describe('GraphExecutor', () => {
  let eventBus: TriplePhaseEventBus

  beforeEach(() => {
    eventBus = new TriplePhaseEventBus()
  })

  it('should load and initialize a graph', async () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      variables: [
        { name: 'health', type: 'number', scope: 'node', default: 100 },
      ],
      nodes: [],
      edges: [],
    }

    const executor = new GraphExecutor(eventBus)
    const runtime = await executor.loadGraph('node1', graph)

    expect(runtime).toBeDefined()
    expect(executor.getRuntime('node1')).toBe(runtime)
    expect(executor.getVariable('node1', 'health')).toBe(100)
  })

  it('should trigger signals through executor', async () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      variables: [
        { name: 'triggered', type: 'boolean', scope: 'node', default: false },
      ],
      nodes: [
        { id: 'signal', type: 'signal', signal: 'CustomSignal', position: [0, 0] },
        { id: 'setVar', type: 'variable', operation: 'set', variable: 'triggered', value: true, position: [100, 0] },
      ],
      edges: [
        { from: 'signal', fromPin: 'out', to: 'setVar', toPin: 'in' },
      ],
    }

    const executor = new GraphExecutor(eventBus)
    await executor.loadGraph('node1', graph)

    expect(executor.getVariable('node1', 'triggered')).toBe(false)

    await executor.triggerSignal('node1', 'CustomSignal')

    expect(executor.getVariable('node1', 'triggered')).toBe(true)
  })

  it('should set variables through executor', async () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      variables: [
        { name: 'score', type: 'number', scope: 'node', default: 0 },
      ],
      nodes: [],
      edges: [],
    }

    const executor = new GraphExecutor(eventBus)
    await executor.loadGraph('node1', graph)

    executor.setVariable('node1', 'score', 100)

    expect(executor.getVariable('node1', 'score')).toBe(100)
  })

  it('should unload graphs', async () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      variables: [],
      nodes: [],
      edges: [],
    }

    const executor = new GraphExecutor(eventBus)
    await executor.loadGraph('node1', graph)

    expect(executor.getRuntime('node1')).toBeDefined()

    executor.unloadGraph('node1')

    expect(executor.getRuntime('node1')).toBeUndefined()
  })

  it('should respond to events via event bus', async () => {
    const graph: LogicGraph = {
      graphId: 'test',
      version: '1.0.0',
      variables: [
        { name: 'damageReceived', type: 'number', scope: 'node', default: 0 },
      ],
      nodes: [
        { id: 'onDamage', type: 'signal', signal: 'Damage', phase: 'execute', position: [0, 0] },
        { id: 'recordDamage', type: 'variable', operation: 'set', variable: 'damageReceived', value: { $expr: 'event.amount' }, position: [100, 0] },
      ],
      edges: [
        { from: 'onDamage', fromPin: 'out', to: 'recordDamage', toPin: 'in' },
      ],
    }

    const executor = new GraphExecutor(eventBus)
    await executor.loadGraph('node1', graph)

    // Emit a damage event
    const event = createGameEvent({
      type: 'Damage',
      source: { id: 'node1' },
      data: { amount: 25 },
    })

    await eventBus.emit(event)

    expect(executor.getVariable('node1', 'damageReceived')).toBe(25)
  })
})

describe('Complex Graph Patterns', () => {
  it('should execute patrol AI pattern', async () => {
    const graph: LogicGraph = {
      graphId: 'patrol_ai',
      version: '1.0.0',
      variables: [
        { name: 'patrolPoints', type: 'vec2[]', scope: 'node', default: [[0, 0], [10, 0], [10, 10], [0, 10]] },
        { name: 'currentIndex', type: 'number', scope: 'node', default: 0 },
        { name: 'currentTarget', type: 'vec2', scope: 'node', default: [0, 0] },
      ],
      nodes: [
        { id: 'init', type: 'signal', signal: 'Init', position: [0, 0] },
        { id: 'setTarget', type: 'variable', operation: 'set', variable: 'currentTarget', value: { $expr: 'patrolPoints[currentIndex]' }, position: [100, 0] },
        { id: 'nextIndex', type: 'variable', operation: 'set', variable: 'currentIndex', value: { $expr: '(currentIndex + 1) % len(patrolPoints)' }, position: [200, 0] },
      ],
      edges: [
        { from: 'init', fromPin: 'out', to: 'setTarget', toPin: 'in' },
        { from: 'setTarget', fromPin: 'out', to: 'nextIndex', toPin: 'in' },
      ],
    }

    const runtime = new GraphRuntime(graph)
    const ctx = createContext()

    runtime.initializeVariables(ctx)

    // First trigger - should get first patrol point and advance
    await runtime.triggerSignal('Init', ctx)
    expect(ctx.nodeVars.currentTarget).toEqual([0, 0])
    expect(ctx.nodeVars.currentIndex).toBe(1)

    // Second trigger
    await runtime.triggerSignal('Init', ctx)
    expect(ctx.nodeVars.currentTarget).toEqual([10, 0])
    expect(ctx.nodeVars.currentIndex).toBe(2)

    // Third trigger
    await runtime.triggerSignal('Init', ctx)
    expect(ctx.nodeVars.currentTarget).toEqual([10, 10])
    expect(ctx.nodeVars.currentIndex).toBe(3)

    // Fourth trigger - should wrap around
    await runtime.triggerSignal('Init', ctx)
    expect(ctx.nodeVars.currentTarget).toEqual([0, 10])
    expect(ctx.nodeVars.currentIndex).toBe(0)
  })
})
