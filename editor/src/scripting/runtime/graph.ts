// ═══════════════════════════════════════════════════════════════════════════
// Logic Graph Runtime
// Visual scripting execution engine for ASCII Dungeon
// ═══════════════════════════════════════════════════════════════════════════

import {
  evaluateExpression,
  resolveValue,
  ExprContext,
  ExprValue,
  ExprWrapper,
} from './expressions'
import {
  TriplePhaseEventBus,
  GameEventBus,
  createGameEvent,
  GameEvent,
  EventPhase,
} from './events'
import { SeededRandom } from './lifecycle'
import { executeScriptNode, NodeExecutorContext } from './nodeExecutors'

// ─────────────────────────────────────────────────────────────────────────────
// Graph Data Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LogicGraph {
  graphId: string
  version: string
  description?: string
  variables: VariableDef[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface VariableDef {
  name: string
  type: 'number' | 'string' | 'boolean' | 'vec2' | 'vec2[]' | 'any'
  scope: 'global' | 'scene' | 'node' | 'local'
  default?: unknown | ExprWrapper
  description?: string
}

export interface GraphEdge {
  from: string
  fromPin: string
  to: string
  toPin: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Node Types
// ─────────────────────────────────────────────────────────────────────────────

export type GraphNode =
  | SignalNode
  | ActionNode
  | BranchNode
  | FlowNode
  | VariableNode
  | SubGraphNode

interface BaseNode {
  id: string
  position: [number, number]
}

// Signal: Entry point triggered by events
export interface SignalNode extends BaseNode {
  type: 'signal'
  signal: string // e.g., 'Init', 'Update', 'Damage', 'Component:Signal'
  phase?: EventPhase // Which phase to listen to
}

// Action: Call a method on a component
export interface ActionNode extends BaseNode {
  type: 'action'
  component: string
  method: string
  inputs: Record<string, unknown | ExprWrapper>
}

// Branch: Conditional flow
export interface BranchNode extends BaseNode {
  type: 'branch'
  kind: 'if' | 'switch'
  condition?: unknown | ExprWrapper // For 'if'
  value?: unknown | ExprWrapper // For 'switch'
  cases?: string[] // For 'switch'
}

// Flow: Control flow nodes
export interface FlowNode extends BaseNode {
  type: 'flow'
  kind: 'delay' | 'parallel' | 'merge' | 'sequence' | 'forEach' | 'cancel'
  duration?: unknown | ExprWrapper // For 'delay'
  branches?: string[] // For 'parallel'
  inputs?: string[] // For 'merge'
  collection?: unknown | ExprWrapper // For 'forEach'
  itemVariable?: string // For 'forEach'
  joinMode?: 'all' | 'any' // For 'parallel'
  reason?: string // For 'cancel'
}

// Variable: Get/Set/Watch
export interface VariableNode extends BaseNode {
  type: 'variable'
  operation: 'get' | 'set' | 'watch'
  variable: string
  value?: unknown | ExprWrapper // For 'set'
}

// SubGraph: Reference another graph
export interface SubGraphNode extends BaseNode {
  type: 'subgraph'
  graphRef: string
  inputMappings?: Record<string, unknown | ExprWrapper>
  outputMappings?: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Context
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphExecutionContext {
  /** Node ID that owns this graph */
  nodeId: string
  /** Variables by scope */
  globalVars: Record<string, ExprValue>
  sceneVars: Record<string, ExprValue>
  nodeVars: Record<string, ExprValue>
  localVars: Record<string, ExprValue>
  /** Event that triggered this execution (if any) */
  triggerEvent?: GameEvent
  /** Component registry for action calls */
  components: Map<string, ComponentInstance>
  /** SubGraph registry */
  subGraphs: Map<string, LogicGraph>
  /** Random generator */
  random: SeededRandom
  /** Cancellation flag */
  cancelled: boolean
  /** Event bus */
  eventBus: TriplePhaseEventBus
}

export interface ComponentInstance {
  [methodName: string]: (...args: unknown[]) => unknown | Promise<unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Runtime
// ─────────────────────────────────────────────────────────────────────────────

export class GraphRuntime {
  private graph: LogicGraph
  private nodeMap: Map<string, GraphNode> = new Map()
  private outgoingEdges: Map<string, Map<string, GraphEdge[]>> = new Map() // nodeId -> pinName -> edges
  private incomingEdges: Map<string, Map<string, GraphEdge>> = new Map() // nodeId -> pinName -> edge
  private signalHandlers: Map<string, SignalNode[]> = new Map() // signal -> nodes
  private watchHandlers: Map<string, VariableNode[]> = new Map() // variable -> watch nodes
  private eventUnsubscribers: (() => void)[] = []
  private _signalLogCount: Record<string, number> = {} // Debug counter

  constructor(graph: LogicGraph) {
    this.graph = graph
    this.buildIndex()
  }

  private buildIndex(): void {
    // Index nodes
    for (const node of this.graph.nodes) {
      this.nodeMap.set(node.id, node)

      // Index signal nodes
      if (node.type === 'signal') {
        const handlers = this.signalHandlers.get(node.signal) || []
        handlers.push(node)
        this.signalHandlers.set(node.signal, handlers)
      }

      // Index watch nodes
      if (node.type === 'variable' && node.operation === 'watch') {
        const handlers = this.watchHandlers.get(node.variable) || []
        handlers.push(node)
        this.watchHandlers.set(node.variable, handlers)
      }
    }

    // Index edges
    for (const edge of this.graph.edges) {
      // Outgoing edges
      if (!this.outgoingEdges.has(edge.from)) {
        this.outgoingEdges.set(edge.from, new Map())
      }
      const pinMap = this.outgoingEdges.get(edge.from)!
      if (!pinMap.has(edge.fromPin)) {
        pinMap.set(edge.fromPin, [])
      }
      pinMap.get(edge.fromPin)!.push(edge)

      // Incoming edges (for data input resolution)
      if (!this.incomingEdges.has(edge.to)) {
        this.incomingEdges.set(edge.to, new Map())
      }
      this.incomingEdges.get(edge.to)!.set(edge.toPin, edge)
    }
  }

  /**
   * Get incoming edge to a node's input pin
   */
  getIncomingEdge(nodeId: string, pinName: string): GraphEdge | undefined {
    return this.incomingEdges.get(nodeId)?.get(pinName)
  }

  /**
   * Resolve an input value from an incoming edge
   */
  async resolveInputFromEdge(
    nodeId: string,
    pinName: string,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    const edge = this.getIncomingEdge(nodeId, pinName)
    if (!edge) return null

    const sourceNode = this.nodeMap.get(edge.from)
    if (!sourceNode) return null

    return await this.executeDataNode(sourceNode, edge.fromPin, ctx)
  }

  /**
   * Execute a data node (produces values, not flow control)
   */
  private async executeDataNode(
    node: GraphNode,
    outputPin: string,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    const exprCtx = this.buildExprContext(ctx)

    if (node.type === 'action') {
      const actionNode = node as ActionNode
      // Resolve inputs from static values first
      const inputs: Record<string, ExprValue> = {}
      for (const [key, value] of Object.entries(actionNode.inputs || {})) {
        if (value !== undefined) {
          inputs[key] = resolveValue(value, exprCtx)
        }
      }

      // Then resolve any inputs from incoming data edges
      // Edge connections OVERRIDE static defaults - this is important!
      const flowPins = ['flow', 'in', 'out']
      for (const [pinName, edge] of this.incomingEdges.get(node.id) || []) {
        if (!flowPins.includes(pinName)) {
          const value = await this.resolveInputFromEdge(node.id, pinName, ctx)
          if (value !== undefined) {
            inputs[pinName] = value
          }
        }
      }

      return this.executeBuiltInDataNode(actionNode.method, inputs, outputPin, ctx)
    }

    if (node.type === 'variable') {
      const varNode = node as VariableNode
      if (varNode.operation === 'get') {
        return this.getVariableByName(varNode.variable, ctx)
      }
    }

    return null
  }

  /**
   * Execute built-in data nodes (random, compare, get-self, etc.)
   */
  private executeBuiltInDataNode(
    nodeType: string,
    inputs: Record<string, ExprValue>,
    outputPin: string,
    _ctx: GraphExecutionContext
  ): ExprValue {
    switch (nodeType) {
      case 'random': {
        const min = Number(inputs.min ?? 0)
        const max = Number(inputs.max ?? 1)
        return min + Math.random() * (max - min)
      }
      case 'compare': {
        const a = Number(inputs.a ?? 0)
        const b = Number(inputs.b ?? 0)
        switch (outputPin) {
          case 'less': return a < b
          case 'equal': return a === b
          case 'greater': return a > b
          case 'lessEqual': return a <= b
          case 'greaterEqual': return a >= b
          default: return a < b
        }
      }
      case 'get-self': {
        return _ctx.nodeId
      }
      default:
        return null
    }
  }

  /**
   * Get the graph definition
   */
  getGraph(): LogicGraph {
    return this.graph
  }

  /**
   * Get edges from a node's output pin
   */
  getOutgoingEdges(nodeId: string, pinName: string): GraphEdge[] {
    return this.outgoingEdges.get(nodeId)?.get(pinName) || []
  }

  /**
   * Get signal handlers for a signal type
   */
  getSignalHandlers(signal: string): SignalNode[] {
    return this.signalHandlers.get(signal) || []
  }

  /**
   * Initialize the graph variables with defaults
   */
  initializeVariables(ctx: GraphExecutionContext): void {
    for (const varDef of this.graph.variables) {
      const defaultValue = this.resolveDefault(varDef.default, ctx)
      this.setVariable(varDef.name, varDef.scope, defaultValue, ctx)
    }
  }

  /**
   * Resolve default value (may be an expression)
   */
  private resolveDefault(value: unknown, ctx: GraphExecutionContext): ExprValue {
    if (value === undefined) return null
    return resolveValue(value, this.buildExprContext(ctx))
  }

  /**
   * Set a variable value
   */
  setVariable(
    name: string,
    scope: VariableDef['scope'],
    value: ExprValue,
    ctx: GraphExecutionContext
  ): void {
    const oldValue = this.getVariable(name, scope, ctx)

    switch (scope) {
      case 'global':
        ctx.globalVars[name] = value
        break
      case 'scene':
        ctx.sceneVars[name] = value
        break
      case 'node':
        ctx.nodeVars[name] = value
        break
      case 'local':
        ctx.localVars[name] = value
        break
    }

    // Trigger watch handlers if value changed
    if (oldValue !== value) {
      const watchNodes = this.watchHandlers.get(name)
      if (watchNodes && watchNodes.length > 0) {
        // Schedule watch handlers asynchronously to avoid infinite loops
        setTimeout(() => {
          for (const watchNode of watchNodes) {
            this.executeFromNode(watchNode.id, ctx, { oldValue, newValue: value })
          }
        }, 0)
      }
    }
  }

  /**
   * Get a variable value
   */
  getVariable(
    name: string,
    scope: VariableDef['scope'],
    ctx: GraphExecutionContext
  ): ExprValue {
    switch (scope) {
      case 'global':
        return ctx.globalVars[name] ?? null
      case 'scene':
        return ctx.sceneVars[name] ?? null
      case 'node':
        return ctx.nodeVars[name] ?? null
      case 'local':
        return ctx.localVars[name] ?? null
    }
  }

  /**
   * Get variable by name (searches all scopes)
   */
  getVariableByName(name: string, ctx: GraphExecutionContext): ExprValue {
    // Search in order: local -> node -> scene -> global
    if (name in ctx.localVars) return ctx.localVars[name]
    if (name in ctx.nodeVars) return ctx.nodeVars[name]
    if (name in ctx.sceneVars) return ctx.sceneVars[name]
    if (name in ctx.globalVars) return ctx.globalVars[name]
    return null
  }

  /**
   * Get variable scope by name
   */
  private getVariableScope(name: string): VariableDef['scope'] {
    const def = this.graph.variables.find(v => v.name === name)
    return def?.scope || 'local'
  }

  /**
   * Build expression context from execution context
   */
  buildExprContext(ctx: GraphExecutionContext): ExprContext {
    // Merge all variables, with local taking precedence
    const variables: Record<string, ExprValue> = {
      ...ctx.globalVars,
      ...ctx.sceneVars,
      ...ctx.nodeVars,
      ...ctx.localVars,
    }

    // Add special variables
    if (ctx.triggerEvent) {
      variables['event'] = ctx.triggerEvent.data as ExprValue
      variables['eventType'] = ctx.triggerEvent.type
    }

    return {
      variables,
      random: ctx.random,
    }
  }

  /**
   * Register event listeners with the event bus
   */
  registerEventListeners(ctx: GraphExecutionContext): void {
    for (const [signal, handlers] of this.signalHandlers) {
      // Parse signal (might be 'Component:Signal' format)
      const eventType = signal.includes(':') ? signal : signal
      const phase: EventPhase = handlers[0]?.phase || 'execute'

      const unsub = ctx.eventBus.on(eventType, phase, (event) => {
        for (const handler of handlers) {
          // Only trigger if phase matches (or handler has no phase specified)
          if (!handler.phase || handler.phase === event.phase) {
            this.executeFromNode(handler.id, { ...ctx, triggerEvent: event })
          }
        }
      }, { nodeId: ctx.nodeId })

      this.eventUnsubscribers.push(unsub)
    }
  }

  /**
   * Unregister all event listeners
   */
  unregisterEventListeners(): void {
    for (const unsub of this.eventUnsubscribers) {
      unsub()
    }
    this.eventUnsubscribers = []
  }

  /**
   * Execute from a specific node
   */
  async executeFromNode(
    nodeId: string,
    ctx: GraphExecutionContext,
    inputData?: Record<string, unknown>
  ): Promise<ExprValue> {
    if (ctx.cancelled) return null

    const node = this.nodeMap.get(nodeId)
    if (!node) {
      console.warn(`[Graph] Node not found: ${nodeId}`)
      return null
    }

    const result = await this.executeNode(node, ctx, inputData)

    // Follow outgoing flow edges (check both 'flow' and 'out' for compatibility)
    let outEdges = this.getOutgoingEdges(nodeId, 'flow')
    if (outEdges.length === 0) {
      outEdges = this.getOutgoingEdges(nodeId, 'out')
    }
    for (const edge of outEdges) {
      await this.executeFromNode(edge.to, ctx)
    }

    return result
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: GraphNode,
    ctx: GraphExecutionContext,
    inputData?: Record<string, unknown>
  ): Promise<ExprValue> {
    // Debug: log node execution
    console.log(`[Graph] Executing node: ${node.id} (${node.type})`, node)

    switch (node.type) {
      case 'signal':
        // Signal nodes don't execute - they're entry points
        return null

      case 'action':
        return this.executeActionNode(node, ctx)

      case 'branch':
        return this.executeBranchNode(node, ctx)

      case 'flow':
        return this.executeFlowNode(node, ctx)

      case 'variable':
        return this.executeVariableNode(node, ctx, inputData)

      case 'subgraph':
        return this.executeSubGraphNode(node, ctx)

      default:
        console.warn(`[Graph] Unknown node type: ${(node as GraphNode).type}`)
        return null
    }
  }

  /**
   * Execute an action node
   */
  private async executeActionNode(
    node: ActionNode,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    // Resolve inputs first
    const exprCtx = this.buildExprContext(ctx)
    const resolvedInputs: Record<string, ExprValue> = {}
    for (const [key, value] of Object.entries(node.inputs)) {
      // Skip flow/nodeTypeId - these aren't actual inputs
      if (key === 'flow' || key === 'nodeTypeId') continue
      resolvedInputs[key] = resolveValue(value, exprCtx)
    }

    // Also resolve inputs from incoming data edges
    // Edge connections OVERRIDE static defaults - this is important!
    // Skip flow control pins (flow, in, out)
    const flowPins = ['flow', 'in', 'out']
    for (const [pinName, edge] of this.incomingEdges.get(node.id) || []) {
      if (!flowPins.includes(pinName)) {
        const value = await this.resolveInputFromEdge(node.id, pinName, ctx)
        if (value !== undefined) {
          resolvedInputs[pinName] = value
        }
      }
    }

    // Handle built-in actions
    if (node.component === 'Builtin') {
      return this.executeBuiltinAction(node.method, resolvedInputs, ctx)
    }

    // Handle Script nodes
    if (node.component === 'Script' && node.method === 'execute') {
      const code = resolvedInputs.code as string || ''
      if (!code) {
        console.warn('[Graph] Script node has no code')
        return null
      }

      // Build executor context
      const execCtx: NodeExecutorContext = {
        nodeId: node.id,
        selfEntityId: ctx.nodeId,
        variables: {
          ...ctx.globalVars,
          ...ctx.sceneVars,
          ...ctx.nodeVars,
          ...ctx.localVars,
        },
      }

      // Create emit function for the script
      const emitSignal = (signal: string, data?: ExprValue) => {
        if (ctx.eventBus) {
          ctx.eventBus.emit(signal, data)
        }
      }

      // Execute the script code
      const result = await executeScriptNode(code, resolvedInputs, execCtx, emitSignal)
      return result
    }

    const component = ctx.components.get(node.component)
    if (!component) {
      console.warn(`[Graph] Component not found: ${node.component}`)
      return null
    }

    const method = component[node.method]
    if (typeof method !== 'function') {
      console.warn(`[Graph] Method not found: ${node.component}.${node.method}`)
      return null
    }

    try {
      const result = await method.call(component, resolvedInputs)

      // Handle different outputs based on result
      if (result === true) {
        // Success - follow 'success' or 'complete' edge
        const successEdges = this.getOutgoingEdges(node.id, 'success')
          .concat(this.getOutgoingEdges(node.id, 'complete'))
        for (const edge of successEdges) {
          await this.executeFromNode(edge.to, ctx)
        }
      } else if (result === false) {
        // Failure - follow 'error' or 'failed' edge
        const errorEdges = this.getOutgoingEdges(node.id, 'error')
          .concat(this.getOutgoingEdges(node.id, 'failed'))
        for (const edge of errorEdges) {
          await this.executeFromNode(edge.to, ctx)
        }
      }

      return result as ExprValue
    } catch (error) {
      console.error(`[Graph] Error in action ${node.component}.${node.method}:`, error)
      const errorEdges = this.getOutgoingEdges(node.id, 'error')
      for (const edge of errorEdges) {
        await this.executeFromNode(edge.to, ctx)
      }
      return null
    }
  }

  /**
   * Execute a built-in action (translate, print, etc.)
   */
  private executeBuiltinAction(
    method: string,
    inputs: Record<string, ExprValue>,
    ctx: GraphExecutionContext
  ): ExprValue {
    switch (method) {
      case 'translate': {
        const dx = Number(inputs.dx) || 0
        const dy = Number(inputs.dy) || 0
        const entityId = inputs.entity as string || ctx.nodeId

        console.log(`[Graph] translate entity=${entityId} dx=${dx} dy=${dy}`)

        // Update via global state if available
        if (typeof window !== 'undefined' && (window as any).__engineState) {
          const store = (window as any).__engineState
          const storeState = store.getState?.()
          const rootNode = storeState?.scene?.rootNode
          const setPath = storeState?.setPath

          if (rootNode && setPath) {
            // Find node in tree
            const findNode = (node: any): any => {
              if (node.id === entityId) return node
              for (const child of node.children || []) {
                const found = findNode(child)
                if (found) return found
              }
              return null
            }

            // Find path to node
            const findPath = (node: any, id: string, path: number[] = []): number[] | null => {
              if (node.id === id) return path
              for (let i = 0; i < (node.children?.length || 0); i++) {
                const result = findPath(node.children[i], id, [...path, i])
                if (result) return result
              }
              return null
            }

            const targetNode = findNode(rootNode)
            const nodePath = findPath(rootNode, entityId)

            if (targetNode && nodePath) {
              // Find the Rect2D component to get current position
              const rect2DIndex = targetNode.components?.findIndex(
                (c: any) => c.script === 'Rect2D'
              ) ?? -1

              if (rect2DIndex >= 0) {
                const rect2D = targetNode.components[rect2DIndex]
                const currentX = (rect2D.properties?.x as number) ?? 0
                const currentY = (rect2D.properties?.y as number) ?? 0

                const newX = currentX + dx
                const newY = currentY + dy

                // Build state path to Rect2D component properties
                const statePath: (string | number)[] = ['scene', 'rootNode']
                for (const idx of nodePath) {
                  statePath.push('children', idx)
                }
                statePath.push('components', rect2DIndex, 'properties')

                // Update Rect2D x and y properties (what the renderer uses)
                setPath([...statePath, 'x'], newX, `Translate ${entityId} X`, 'script')
                setPath([...statePath, 'y'], newY, `Translate ${entityId} Y`, 'script')

                console.log(`[Graph] Moved ${entityId} from (${currentX},${currentY}) to (${newX},${newY}) via Rect2D`)
              } else {
                console.warn(`[Graph] Entity ${entityId} has no Rect2D component`)
              }
            } else {
              console.warn(`[Graph] Entity not found for translate: ${entityId}`)
            }
          }
        }

        return true
      }

      case 'move-entity': {
        const x = Number(inputs.x) || 0
        const y = Number(inputs.y) || 0
        const entityId = inputs.entity as string || ctx.nodeId

        console.log(`[Graph] move-entity entity=${entityId} to x=${x} y=${y}`)

        if (typeof window !== 'undefined' && (window as any).__engineState) {
          const store = (window as any).__engineState
          const storeState = store.getState?.()
          const rootNode = storeState?.scene?.rootNode
          const setPath = storeState?.setPath

          if (rootNode && setPath) {
            // Find node in tree
            const findNode = (node: any): any => {
              if (node.id === entityId) return node
              for (const child of node.children || []) {
                const found = findNode(child)
                if (found) return found
              }
              return null
            }

            const findPath = (node: any, id: string, path: number[] = []): number[] | null => {
              if (node.id === id) return path
              for (let i = 0; i < (node.children?.length || 0); i++) {
                const result = findPath(node.children[i], id, [...path, i])
                if (result) return result
              }
              return null
            }

            const targetNode = findNode(rootNode)
            const nodePath = findPath(rootNode, entityId)

            if (targetNode && nodePath) {
              // Find the Rect2D component
              const rect2DIndex = targetNode.components?.findIndex(
                (c: any) => c.script === 'Rect2D'
              ) ?? -1

              if (rect2DIndex >= 0) {
                // Build state path to Rect2D component properties
                const statePath: (string | number)[] = ['scene', 'rootNode']
                for (const idx of nodePath) {
                  statePath.push('children', idx)
                }
                statePath.push('components', rect2DIndex, 'properties')

                // Update Rect2D x and y properties (what the renderer uses)
                setPath([...statePath, 'x'], x, `Move ${entityId} X`, 'script')
                setPath([...statePath, 'y'], y, `Move ${entityId} Y`, 'script')

                console.log(`[Graph] Moved ${entityId} to (${x},${y}) via Rect2D`)
              } else {
                console.warn(`[Graph] Entity ${entityId} has no Rect2D component`)
              }
            }
          }
        }

        return true
      }

      case 'print':
      case 'log': {
        const message = String(inputs.message || inputs.text || '')
        console.log(`[Graph:${ctx.nodeId}]`, message)
        return true
      }

      case 'emit-signal': {
        const signalName = String(inputs.signal || inputs.name || '')
        const data = inputs.data
        if (ctx.eventBus && signalName) {
          ctx.eventBus.emit(signalName, data)
        }
        return true
      }

      default:
        console.warn(`[Graph] Unknown built-in action: ${method}`)
        return null
    }
  }

  /**
   * Execute a branch node
   */
  private async executeBranchNode(
    node: BranchNode,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    const exprCtx = this.buildExprContext(ctx)

    if (node.kind === 'if') {
      // Resolve condition - either from node property or incoming edge
      let condition: ExprValue
      if (node.condition !== undefined) {
        condition = resolveValue(node.condition, exprCtx)
      } else {
        // Try to get condition from incoming edge
        condition = await this.resolveInputFromEdge(node.id, 'condition', ctx)
      }

      const branch = condition ? 'true' : 'false'
      console.log(`[Graph] Branch condition=${condition}, taking ${branch} path`)

      const edges = this.getOutgoingEdges(node.id, branch)
      for (const edge of edges) {
        await this.executeFromNode(edge.to, ctx)
      }

      return condition
    }

    if (node.kind === 'switch') {
      let value: ExprValue
      if (node.value !== undefined) {
        value = resolveValue(node.value, exprCtx)
      } else {
        value = await this.resolveInputFromEdge(node.id, 'value', ctx)
      }
      const valueStr = String(value)

      // Check if value matches a case
      const matchedCase = node.cases?.find(c => c === valueStr)
      const branch = matchedCase || 'default'

      const edges = this.getOutgoingEdges(node.id, branch)
      for (const edge of edges) {
        await this.executeFromNode(edge.to, ctx)
      }

      return value
    }

    return null
  }

  /**
   * Execute a flow control node
   */
  private async executeFlowNode(
    node: FlowNode,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    const exprCtx = this.buildExprContext(ctx)

    switch (node.kind) {
      case 'delay': {
        const duration = resolveValue(node.duration, exprCtx) as number
        await new Promise(resolve => setTimeout(resolve, duration))
        return duration
      }

      case 'parallel': {
        if (!node.branches) return null

        const promises = node.branches.map(branchPin => {
          const edges = this.getOutgoingEdges(node.id, branchPin)
          return Promise.all(edges.map(edge => this.executeFromNode(edge.to, ctx)))
        })

        if (node.joinMode === 'any') {
          await Promise.race(promises)
        } else {
          await Promise.all(promises)
        }
        return null
      }

      case 'merge': {
        // Merge just continues - it's a join point
        return null
      }

      case 'sequence': {
        // Sequence just continues to 'out'
        return null
      }

      case 'forEach': {
        const collection = resolveValue(node.collection, exprCtx) as ExprValue[]
        if (!Array.isArray(collection)) return null

        const itemVar = node.itemVariable || 'item'
        const indexVar = `${itemVar}Index`

        for (let i = 0; i < collection.length; i++) {
          if (ctx.cancelled) break

          ctx.localVars[itemVar] = collection[i]
          ctx.localVars[indexVar] = i

          const bodyEdges = this.getOutgoingEdges(node.id, 'body')
          for (const edge of bodyEdges) {
            await this.executeFromNode(edge.to, ctx)
          }
        }

        // Clean up loop variables
        delete ctx.localVars[itemVar]
        delete ctx.localVars[indexVar]

        // Continue to 'complete'
        const completeEdges = this.getOutgoingEdges(node.id, 'complete')
        for (const edge of completeEdges) {
          await this.executeFromNode(edge.to, ctx)
        }

        return collection.length
      }

      case 'cancel': {
        ctx.cancelled = true
        console.log(`[Graph] Cancelled: ${node.reason || 'Unknown reason'}`)
        return null
      }

      default:
        return null
    }
  }

  /**
   * Execute a variable node
   */
  private async executeVariableNode(
    node: VariableNode,
    ctx: GraphExecutionContext,
    inputData?: Record<string, unknown>
  ): Promise<ExprValue> {
    const scope = this.getVariableScope(node.variable)
    const exprCtx = this.buildExprContext(ctx)

    switch (node.operation) {
      case 'get':
        return this.getVariable(node.variable, scope, ctx)

      case 'set': {
        const value = resolveValue(node.value, exprCtx)
        this.setVariable(node.variable, scope, value, ctx)
        return value
      }

      case 'watch':
        // Watch nodes are triggered by setVariable, not executed directly
        // When triggered via setVariable, inputData contains oldValue/newValue
        if (inputData) {
          ctx.localVars['oldValue'] = inputData.oldValue as ExprValue
          ctx.localVars['newValue'] = inputData.newValue as ExprValue
        }
        return null

      default:
        return null
    }
  }

  /**
   * Execute a subgraph node
   */
  private async executeSubGraphNode(
    node: SubGraphNode,
    ctx: GraphExecutionContext
  ): Promise<ExprValue> {
    const subGraph = ctx.subGraphs.get(node.graphRef)
    if (!subGraph) {
      console.warn(`[Graph] SubGraph not found: ${node.graphRef}`)
      return null
    }

    // Create sub-runtime
    const subRuntime = new GraphRuntime(subGraph)

    // Create sub-context with FRESH nodeVars for isolation
    const subCtx: GraphExecutionContext = {
      ...ctx,
      nodeVars: {}, // Fresh scope for subgraph
      localVars: {},
    }

    // Initialize subgraph variables with defaults FIRST
    subRuntime.initializeVariables(subCtx)

    // THEN apply input mappings (overrides defaults)
    const exprCtx = this.buildExprContext(ctx)
    if (node.inputMappings) {
      for (const [varName, value] of Object.entries(node.inputMappings)) {
        const resolved = resolveValue(value, exprCtx)
        subCtx.nodeVars[varName] = resolved
      }
    }

    // Find 'start' signal and execute
    const startHandlers = subRuntime.getSignalHandlers('Start')
      .concat(subRuntime.getSignalHandlers('Init'))

    for (const handler of startHandlers) {
      await subRuntime.executeFromNode(handler.id, subCtx)
    }

    // Map outputs back
    if (node.outputMappings) {
      for (const [subVar, parentVar] of Object.entries(node.outputMappings)) {
        const value = subRuntime.getVariableByName(subVar, subCtx)
        const scope = this.getVariableScope(parentVar)
        this.setVariable(parentVar, scope, value, ctx)
      }
    }

    return null
  }

  /**
   * Manually trigger a signal
   */
  async triggerSignal(signal: string, ctx: GraphExecutionContext, data?: unknown): Promise<void> {
    const handlers = this.getSignalHandlers(signal)

    // Debug: log first few signal triggers
    if (!this._signalLogCount[signal]) this._signalLogCount[signal] = 0
    if (this._signalLogCount[signal] < 3) {
      console.log(`[GraphRuntime] triggerSignal "${signal}" -> ${handlers.length} handlers, node=${ctx.nodeId}`)
      if (handlers.length === 0) {
        console.log(`[GraphRuntime] Available signals:`, Array.from(this.signalHandlers.keys()))
      }
      this._signalLogCount[signal]++
    }

    // Create a synthetic event
    const event = createGameEvent({
      type: signal,
      source: { id: ctx.nodeId },
      data: data || {},
    })

    // Set trigger event on context directly (don't spread to preserve cancelled state)
    const prevEvent = ctx.triggerEvent
    ctx.triggerEvent = event

    for (const handler of handlers) {
      await this.executeFromNode(handler.id, ctx)
    }

    // Restore previous event
    ctx.triggerEvent = prevEvent
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Executor - High-level API for running graphs
// ─────────────────────────────────────────────────────────────────────────────

export class GraphExecutor {
  private runtimes: Map<string, GraphRuntime> = new Map()
  private contexts: Map<string, GraphExecutionContext> = new Map()
  private eventBus: TriplePhaseEventBus

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
  }

  /**
   * Load and initialize a graph for a node
   */
  async loadGraph(
    nodeId: string,
    graph: LogicGraph,
    options: {
      globalVars?: Record<string, ExprValue>
      sceneVars?: Record<string, ExprValue>
      nodeVars?: Record<string, ExprValue>
      components?: Map<string, ComponentInstance>
      subGraphs?: Map<string, LogicGraph>
    } = {}
  ): Promise<GraphRuntime> {
    const runtime = new GraphRuntime(graph)

    const ctx: GraphExecutionContext = {
      nodeId,
      globalVars: options.globalVars || {},
      sceneVars: options.sceneVars || {},
      nodeVars: options.nodeVars || {},
      localVars: {},
      components: options.components || new Map(),
      subGraphs: options.subGraphs || new Map(),
      random: new SeededRandom(),
      cancelled: false,
      eventBus: this.eventBus,
    }

    // Initialize variables
    runtime.initializeVariables(ctx)

    // Register event listeners
    runtime.registerEventListeners(ctx)

    this.runtimes.set(nodeId, runtime)
    this.contexts.set(nodeId, ctx)

    return runtime
  }

  /**
   * Get runtime for a node
   */
  getRuntime(nodeId: string): GraphRuntime | undefined {
    return this.runtimes.get(nodeId)
  }

  /**
   * Get context for a node
   */
  getContext(nodeId: string): GraphExecutionContext | undefined {
    return this.contexts.get(nodeId)
  }

  /**
   * Unload a graph
   */
  unloadGraph(nodeId: string): void {
    const runtime = this.runtimes.get(nodeId)
    if (runtime) {
      runtime.unregisterEventListeners()
    }
    this.runtimes.delete(nodeId)
    this.contexts.delete(nodeId)
  }

  /**
   * Unload all graphs
   */
  unloadAll(): void {
    for (const [nodeId] of this.runtimes) {
      this.unloadGraph(nodeId)
    }
  }

  /**
   * Trigger a signal on a specific node's graph
   */
  async triggerSignal(nodeId: string, signal: string, data?: unknown): Promise<void> {
    const runtime = this.runtimes.get(nodeId)
    const ctx = this.contexts.get(nodeId)

    if (!runtime || !ctx) {
      console.warn(`[GraphExecutor] No graph loaded for node: ${nodeId}`)
      return
    }

    await runtime.triggerSignal(signal, ctx, data)
  }

  /**
   * Set a variable on a node's graph
   */
  setVariable(nodeId: string, name: string, value: ExprValue): void {
    const runtime = this.runtimes.get(nodeId)
    const ctx = this.contexts.get(nodeId)

    if (!runtime || !ctx) return

    // Find variable scope
    const graph = runtime.getGraph()
    const varDef = graph.variables.find(v => v.name === name)
    const scope = varDef?.scope || 'node'

    runtime.setVariable(name, scope, value, ctx)
  }

  /**
   * Get a variable from a node's graph
   */
  getVariable(nodeId: string, name: string): ExprValue {
    const runtime = this.runtimes.get(nodeId)
    const ctx = this.contexts.get(nodeId)

    if (!runtime || !ctx) return null

    return runtime.getVariableByName(name, ctx)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Executor Instance
// ─────────────────────────────────────────────────────────────────────────────

export const GlobalGraphExecutor = new GraphExecutor()
