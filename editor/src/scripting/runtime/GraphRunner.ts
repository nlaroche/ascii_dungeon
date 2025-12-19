// =============================================================================
// Graph Runner - Executes visual scripting graphs from the editor
// =============================================================================

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react'
import type { CustomNodeData } from '../../components/nodes/CustomNode'
import {
  GraphRuntime,
  GraphExecutor,
  LogicGraph,
  GraphNode,
  GraphEdge,
  SignalNode,
  ActionNode,
  BranchNode,
  FlowNode,
  VariableNode,
  VariableDef,
  GraphExecutionContext,
  ComponentInstance,
} from './graph'
import { TriplePhaseEventBus, GameEventBus, createGameEvent } from './events'
import { SeededRandom } from './lifecycle'
import { executeNode, NodeExecutorContext } from './nodeExecutors'
import { ExprValue } from './expressions'
import { Scene } from './SceneManager'
import { Timers } from './TimerManager'
import { getNodeType, NodeCategory } from '../../lib/nodes/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type GraphRunnerState = 'idle' | 'running' | 'paused' | 'error'

export interface GraphRunnerEvent {
  type: 'stateChange' | 'nodeExecute' | 'variableChange' | 'error' | 'log'
  data: unknown
}

export type GraphRunnerListener = (event: GraphRunnerEvent) => void

export interface ExecutionStats {
  startTime: number
  endTime?: number
  nodesExecuted: number
  errors: string[]
}

// -----------------------------------------------------------------------------
// Node Type to Runtime Type Mapping
// -----------------------------------------------------------------------------

const CATEGORY_TO_RUNTIME_TYPE: Record<NodeCategory, GraphNode['type']> = {
  event: 'signal',
  action: 'action',
  condition: 'branch',
  data: 'action', // Data nodes become action nodes that return values
  flow: 'flow',
  custom: 'action',
}

const SIGNAL_MAPPINGS: Record<string, string> = {
  'on-start': 'Init',
  'on-update': 'Update',
  'on-key-down': 'KeyDown',
  'on-key-up': 'KeyUp',
  'on-mouse-down': 'MouseDown',
  'on-mouse-up': 'MouseUp',
  'on-collision-enter': 'CollisionEnter',
  'on-collision-exit': 'CollisionExit',
  'on-trigger-enter': 'TriggerEnter',
  'on-trigger-exit': 'TriggerExit',
  'on-timer': 'Timer',
  'on-destroy': 'Destroy',
  'on-enable': 'Enable',
  'on-disable': 'Disable',
}

// -----------------------------------------------------------------------------
// Graph Conversion (React Flow → Runtime)
// -----------------------------------------------------------------------------

interface ConversionResult {
  graph: LogicGraph
  errors: string[]
  warnings: string[]
}

function convertReactFlowToRuntime(
  nodes: RFNode[],
  edges: RFEdge[],
  graphId: string = 'visual-graph'
): ConversionResult {
  const errors: string[] = []
  const warnings: string[] = []
  const graphNodes: GraphNode[] = []
  const graphEdges: GraphEdge[] = []
  const variables: VariableDef[] = []
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
      warnings.push(`Unknown node type: ${nodeData.nodeTypeId}, treating as action`)
    }

    const category = nodeTypeDef?.category || 'action'
    const runtimeType = CATEGORY_TO_RUNTIME_TYPE[category]
    const runtimeId = `node_${rfNode.id}`
    const position: [number, number] = [rfNode.position.x, rfNode.position.y]

    nodeIdMap.set(rfNode.id, runtimeId)

    // Create runtime node based on type
    let runtimeNode: GraphNode

    switch (runtimeType) {
      case 'signal':
        runtimeNode = {
          id: runtimeId,
          type: 'signal',
          signal: SIGNAL_MAPPINGS[nodeData.nodeTypeId] || nodeData.nodeTypeId,
          position,
        } as SignalNode
        break

      case 'branch':
        runtimeNode = {
          id: runtimeId,
          type: 'branch',
          kind: 'if',
          condition: nodeData.inputs?.condition ?? { $expr: 'true' },
          position,
        } as BranchNode
        break

      case 'flow':
        runtimeNode = createFlowNode(runtimeId, nodeData, position)
        break

      case 'variable':
        runtimeNode = {
          id: runtimeId,
          type: 'variable',
          operation: nodeData.nodeTypeId === 'set-variable' ? 'set' : 'get',
          variable: (nodeData.inputs?.name as string) || 'unnamed',
          value: nodeData.inputs?.value,
          position,
        } as VariableNode
        break

      default:
        // Action node - most data and action nodes become this
        runtimeNode = {
          id: runtimeId,
          type: 'action',
          component: 'NodeExecutor',
          method: nodeData.nodeTypeId,
          inputs: nodeData.inputs || {},
          position,
        } as ActionNode
    }

    graphNodes.push(runtimeNode)
  }

  // Convert edges
  for (const rfEdge of edges) {
    const fromId = nodeIdMap.get(rfEdge.source)
    const toId = nodeIdMap.get(rfEdge.target)

    if (!fromId || !toId) {
      warnings.push(`Edge ${rfEdge.id} references missing nodes`)
      continue
    }

    graphEdges.push({
      from: fromId,
      fromPin: rfEdge.sourceHandle || 'out',
      to: toId,
      toPin: rfEdge.targetHandle || 'in',
    })
  }

  return {
    graph: {
      graphId,
      version: '1.0',
      variables,
      nodes: graphNodes,
      edges: graphEdges,
    },
    errors,
    warnings,
  }
}

function createFlowNode(
  id: string,
  nodeData: CustomNodeData,
  position: [number, number]
): FlowNode {
  const nodeTypeId = nodeData.nodeTypeId

  if (nodeTypeId === 'delay' || nodeTypeId === 'wait') {
    return {
      id,
      type: 'flow',
      kind: 'delay',
      duration: nodeData.inputs?.seconds ?? 1,
      position,
    }
  }

  if (nodeTypeId === 'for-loop' || nodeTypeId === 'forEach') {
    return {
      id,
      type: 'flow',
      kind: 'forEach',
      collection: nodeData.inputs?.collection,
      itemVariable: (nodeData.inputs?.itemVar as string) || 'item',
      position,
    }
  }

  if (nodeTypeId === 'parallel') {
    return {
      id,
      type: 'flow',
      kind: 'parallel',
      branches: ['branch1', 'branch2'],
      joinMode: 'all',
      position,
    }
  }

  // Default to sequence
  return {
    id,
    type: 'flow',
    kind: 'sequence',
    position,
  }
}

// -----------------------------------------------------------------------------
// Node Executor Component
// -----------------------------------------------------------------------------

/**
 * Component that wraps our node executors for use in the graph runtime
 */
function createNodeExecutorComponent(): ComponentInstance {
  return new Proxy({} as ComponentInstance, {
    get(_, prop: string) {
      // Return a function that calls the appropriate node executor
      return async (inputs: Record<string, unknown>): Promise<unknown> => {
        const ctx: NodeExecutorContext = {
          nodeId: 'graph-runner',
          variables: {},
        }
        return executeNode(prop, inputs as Record<string, ExprValue>, ctx)
      }
    }
  })
}

// -----------------------------------------------------------------------------
// Graph Runner Class
// -----------------------------------------------------------------------------

export class GraphRunner {
  private runtime: GraphRuntime | null = null
  private context: GraphExecutionContext | null = null
  private eventBus: TriplePhaseEventBus
  private state: GraphRunnerState = 'idle'
  private listeners: Set<GraphRunnerListener> = new Set()
  private stats: ExecutionStats | null = null
  private animationFrameId: number | null = null
  private lastUpdateTime: number = 0

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------

  addListener(listener: GraphRunnerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: GraphRunnerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (e) {
        console.error('[GraphRunner] Listener error:', e)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Graph Loading
  // ---------------------------------------------------------------------------

  /**
   * Load a graph from React Flow nodes and edges
   */
  loadFromReactFlow(
    nodes: RFNode[],
    edges: RFEdge[],
    graphId?: string
  ): { success: boolean; errors: string[]; warnings: string[] } {
    const { graph, errors, warnings } = convertReactFlowToRuntime(nodes, edges, graphId)

    if (errors.length > 0) {
      this.emit({ type: 'error', data: { errors } })
      return { success: false, errors, warnings }
    }

    return this.loadGraph(graph)
  }

  /**
   * Load a LogicGraph directly
   */
  loadGraph(graph: LogicGraph): { success: boolean; errors: string[]; warnings: string[] } {
    try {
      this.stop()

      this.runtime = new GraphRuntime(graph)

      // Create execution context
      this.context = {
        nodeId: graph.graphId,
        globalVars: {},
        sceneVars: {},
        nodeVars: {},
        localVars: {},
        components: new Map([
          ['NodeExecutor', createNodeExecutorComponent()],
          ['Scene', Scene as unknown as ComponentInstance],
          ['Timers', Timers as unknown as ComponentInstance],
        ]),
        subGraphs: new Map(),
        random: new SeededRandom(),
        cancelled: false,
        eventBus: this.eventBus,
      }

      // Initialize variables
      this.runtime.initializeVariables(this.context)

      this.setState('idle')
      return { success: true, errors: [], warnings: [] }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      this.emit({ type: 'error', data: { errors: [error] } })
      return { success: false, errors: [error], warnings: [] }
    }
  }

  // ---------------------------------------------------------------------------
  // Execution Control
  // ---------------------------------------------------------------------------

  /**
   * Start executing the graph
   */
  async start(): Promise<void> {
    if (!this.runtime || !this.context) {
      this.emit({ type: 'error', data: { errors: ['No graph loaded'] } })
      return
    }

    if (this.state === 'running') return

    this.stats = {
      startTime: performance.now(),
      nodesExecuted: 0,
      errors: [],
    }

    this.setState('running')
    this.context.cancelled = false

    // Register event listeners
    this.runtime.registerEventListeners(this.context)

    // Trigger Init signal
    try {
      await this.runtime.triggerSignal('Init', this.context)
      this.emit({ type: 'log', data: { message: 'Graph started - Init signal triggered' } })
    } catch (e) {
      this.handleError(e)
    }

    // Start update loop
    this.startUpdateLoop()
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.state !== 'running') return
    this.setState('paused')
    this.stopUpdateLoop()
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.state !== 'paused') return
    this.setState('running')
    this.startUpdateLoop()
  }

  /**
   * Stop execution
   */
  stop(): void {
    if (this.state === 'idle') return

    this.stopUpdateLoop()

    if (this.runtime) {
      this.runtime.unregisterEventListeners()
    }

    if (this.context) {
      this.context.cancelled = true
    }

    if (this.stats) {
      this.stats.endTime = performance.now()
    }

    this.setState('idle')
    this.emit({ type: 'log', data: { message: 'Graph stopped' } })
  }

  /**
   * Trigger a specific signal
   */
  async triggerSignal(signal: string, data?: unknown): Promise<void> {
    if (!this.runtime || !this.context) return

    try {
      await this.runtime.triggerSignal(signal, this.context, data)
    } catch (e) {
      this.handleError(e)
    }
  }

  // ---------------------------------------------------------------------------
  // Update Loop
  // ---------------------------------------------------------------------------

  private startUpdateLoop(): void {
    this.lastUpdateTime = performance.now()
    this.animationFrameId = requestAnimationFrame(this.update.bind(this))
  }

  private stopUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private async update(currentTime: number): Promise<void> {
    if (this.state !== 'running' || !this.runtime || !this.context) return

    const deltaTime = (currentTime - this.lastUpdateTime) / 1000
    this.lastUpdateTime = currentTime

    // Update timers
    Timers.update(deltaTime)

    // Update scene (for delayed destroys)
    Scene.update(deltaTime)

    // Trigger Update signal
    try {
      this.context.localVars['deltaTime'] = deltaTime
      this.context.localVars['time'] = currentTime / 1000
      await this.runtime.triggerSignal('Update', this.context, { deltaTime, time: currentTime / 1000 })
    } catch (e) {
      this.handleError(e)
    }

    // Continue loop
    if (this.state === 'running') {
      this.animationFrameId = requestAnimationFrame(this.update.bind(this))
    }
  }

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  getState(): GraphRunnerState {
    return this.state
  }

  private setState(state: GraphRunnerState): void {
    this.state = state
    this.emit({ type: 'stateChange', data: { state } })
  }

  getStats(): ExecutionStats | null {
    return this.stats
  }

  // ---------------------------------------------------------------------------
  // Variable Access
  // ---------------------------------------------------------------------------

  getVariable(name: string): ExprValue {
    if (!this.runtime || !this.context) return null
    return this.runtime.getVariableByName(name, this.context)
  }

  setVariable(name: string, value: ExprValue): void {
    if (!this.runtime || !this.context) return

    // Find variable scope
    const graph = this.runtime.getGraph()
    const varDef = graph.variables.find(v => v.name === name)
    const scope = varDef?.scope || 'node'

    this.runtime.setVariable(name, scope, value, this.context)
    this.emit({ type: 'variableChange', data: { name, value } })
  }

  getAllVariables(): Record<string, ExprValue> {
    if (!this.context) return {}

    return {
      ...this.context.globalVars,
      ...this.context.sceneVars,
      ...this.context.nodeVars,
      ...this.context.localVars,
    }
  }

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  private handleError(e: unknown): void {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[GraphRunner] Error:', error)

    if (this.stats) {
      this.stats.errors.push(error)
    }

    this.emit({ type: 'error', data: { error } })
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.stop()
    this.listeners.clear()
    this.runtime = null
    this.context = null
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const globalGraphRunner = new GraphRunner()

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function loadGraph(nodes: RFNode[], edges: RFEdge[], graphId?: string) {
  return globalGraphRunner.loadFromReactFlow(nodes, edges, graphId)
}

export function startGraph() {
  return globalGraphRunner.start()
}

export function stopGraph() {
  return globalGraphRunner.stop()
}

export function pauseGraph() {
  return globalGraphRunner.pause()
}

export function resumeGraph() {
  return globalGraphRunner.resume()
}

export function getGraphState() {
  return globalGraphRunner.getState()
}
