// ═══════════════════════════════════════════════════════════════════════════
// Behavior Component - Attaches a logic graph to an entity
// Executes visual scripts and bridges component actions/signals
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, action, signal, lifecycle } from '../decorators'
import { GraphRuntime, GraphExecutor } from '../runtime/graph'
import type { LogicGraph, GraphExecutionContext, ComponentInstance } from '../runtime/graph'
import { TriplePhaseEventBus, GameEventBus, createGameEvent } from '../runtime/events'
import { GlobalVariables } from '../runtime/variables'
import { SeededRandom } from '../runtime/lifecycle'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Serialized graph reference (for saving/loading) */
export interface GraphReference {
  /** Inline graph definition */
  inline?: LogicGraph
  /** Reference to external graph file */
  file?: string
  /** Graph ID in the asset database */
  assetId?: string
}

/** Execution mode for the behavior */
export type ExecutionMode = 'always' | 'when-enabled' | 'manual'

// ─────────────────────────────────────────────────────────────────────────────
// Behavior Component
// ─────────────────────────────────────────────────────────────────────────────

@component({
  name: 'Behavior',
  icon: '⚡',
  description: 'Executes a visual script (logic graph)'
})
export class BehaviorComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'string',
    label: 'Graph ID',
    group: 'Graph',
    tooltip: 'ID of the logic graph to execute'
  })
  graphId: string = ''

  @property({
    type: 'boolean',
    label: 'Auto Start',
    group: 'Execution',
    tooltip: 'Start executing on init'
  })
  autoStart: boolean = true

  @property({
    type: 'boolean',
    label: 'Receive Updates',
    group: 'Execution',
    tooltip: 'Receive update events each frame'
  })
  receiveUpdates: boolean = true

  @property({
    type: 'number',
    label: 'Update Rate',
    group: 'Execution',
    min: 0,
    max: 60,
    step: 1,
    tooltip: 'Updates per second (0 = every frame)'
  })
  updateRate: number = 0

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Graph Started', description: 'Fired when graph execution starts' })
  onGraphStarted: (() => void) | null = null

  @signal({ displayName: 'On Graph Stopped', description: 'Fired when graph execution stops' })
  onGraphStopped: (() => void) | null = null

  @signal({ displayName: 'On Graph Error', description: 'Fired when graph execution fails' })
  onGraphError: ((error: string) => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private runtime: GraphRuntime | null = null
  private context: GraphExecutionContext | null = null
  private graph: LogicGraph | null = null
  private eventBus: TriplePhaseEventBus
  private isRunning: boolean = false
  private updateTimer: number = 0
  private updateInterval: number = 0

  // Component bridge - maps component instances for action calls
  private componentBridge: Map<string, ComponentInstance> = new Map()

  constructor() {
    super()
    this.eventBus = GameEventBus
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load and start a graph
   */
  @action({
    displayName: 'Load Graph',
    category: 'Graph',
    description: 'Load a logic graph by ID'
  })
  loadGraph(graphId: string): boolean {
    // Get graph from registry (would come from asset system)
    const graph = BehaviorGraphRegistry.get(graphId)
    if (!graph) {
      console.warn(`[Behavior] Graph not found: ${graphId}`)
      this.onGraphError?.(`Graph not found: ${graphId}`)
      return false
    }

    this.graph = graph
    this.graphId = graphId
    return this.initializeRuntime()
  }

  /**
   * Load a graph from inline definition
   */
  @action({
    displayName: 'Load Inline Graph',
    category: 'Graph',
    description: 'Load a logic graph from definition'
  })
  loadInlineGraph(graph: LogicGraph): boolean {
    this.graph = graph
    this.graphId = graph.graphId
    return this.initializeRuntime()
  }

  /**
   * Start graph execution
   */
  @action({
    displayName: 'Start',
    category: 'Execution',
    description: 'Start executing the graph'
  })
  start(): void {
    if (!this.runtime || !this.context) {
      if (this.graphId) {
        this.loadGraph(this.graphId)
      }
      if (!this.runtime) return
    }

    if (this.isRunning) return

    this.isRunning = true
    this.updateInterval = this.updateRate > 0 ? 1000 / this.updateRate : 0

    // Trigger Init signal
    this.runtime!.triggerSignal('Init', this.context!)
    this.onGraphStarted?.()
  }

  /**
   * Stop graph execution
   */
  @action({
    displayName: 'Stop',
    category: 'Execution',
    description: 'Stop executing the graph'
  })
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    // Trigger Dispose signal
    if (this.runtime && this.context) {
      this.runtime.triggerSignal('Dispose', this.context)
    }

    this.onGraphStopped?.()
  }

  /**
   * Restart graph execution
   */
  @action({
    displayName: 'Restart',
    category: 'Execution',
    description: 'Restart graph execution'
  })
  restart(): void {
    this.stop()
    this.start()
  }

  /**
   * Trigger a custom signal on the graph
   */
  @action({
    displayName: 'Trigger Signal',
    category: 'Signals',
    description: 'Trigger a custom signal on the graph'
  })
  triggerSignal(signalName: string, data?: unknown): void {
    if (!this.runtime || !this.context || !this.isRunning) return
    this.runtime.triggerSignal(signalName, this.context, data)
  }

  /**
   * Set a variable on the graph
   */
  @action({
    displayName: 'Set Variable',
    category: 'Variables',
    description: 'Set a variable value on the graph'
  })
  setVariable(name: string, value: unknown): void {
    if (!this.context) return

    // Find variable scope from graph definition
    const varDef = this.graph?.variables.find(v => v.name === name)
    const scope = varDef?.scope || 'node'

    switch (scope) {
      case 'global':
        this.context.globalVars[name] = value as never
        break
      case 'scene':
        this.context.sceneVars[name] = value as never
        break
      case 'node':
        this.context.nodeVars[name] = value as never
        break
      case 'local':
        this.context.localVars[name] = value as never
        break
    }
  }

  /**
   * Get a variable from the graph
   */
  @action({
    displayName: 'Get Variable',
    category: 'Variables',
    description: 'Get a variable value from the graph'
  })
  getVariable(name: string): unknown {
    if (!this.runtime || !this.context) return null
    return this.runtime.getVariableByName(name, this.context)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    // Build component bridge from sibling components
    this.buildComponentBridge()

    // Auto-load and start if configured
    if (this.graphId && this.autoStart) {
      this.loadGraph(this.graphId)
      this.start()
    }
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    this.stop()
    this.runtime = null
    this.context = null
    this.graph = null
    this.componentBridge.clear()
  }

  /**
   * Called each frame - triggers Update signal
   */
  onUpdate(deltaTime: number): void {
    if (!this.isRunning || !this.runtime || !this.context) return
    if (!this.receiveUpdates) return

    // Rate limiting
    if (this.updateInterval > 0) {
      this.updateTimer += deltaTime * 1000
      if (this.updateTimer < this.updateInterval) return
      this.updateTimer -= this.updateInterval
    }

    // Update context with delta time
    this.context.localVars['deltaTime'] = deltaTime
    this.context.localVars['time'] = (this.context.localVars['time'] as number || 0) + deltaTime

    // Trigger Update signal
    this.runtime.triggerSignal('Update', this.context, { deltaTime })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────

  private initializeRuntime(): boolean {
    if (!this.graph) return false

    try {
      this.runtime = new GraphRuntime(this.graph)

      // Build execution context
      this.context = {
        nodeId: this.node?.id || 'unknown',
        globalVars: GlobalVariables.buildContext(),
        sceneVars: {},
        nodeVars: {},
        localVars: {},
        components: this.componentBridge,
        subGraphs: new Map(),
        random: new SeededRandom(),
        cancelled: false,
        eventBus: this.eventBus,
      }

      // Initialize graph variables with defaults
      this.runtime.initializeVariables(this.context)

      // Register event listeners
      this.runtime.registerEventListeners(this.context)

      return true
    } catch (error) {
      console.error('[Behavior] Failed to initialize runtime:', error)
      this.onGraphError?.(String(error))
      return false
    }
  }

  private buildComponentBridge(): void {
    this.componentBridge.clear()

    if (!this.node) return

    // Get all sibling components and expose their actions
    const components = this.node.components || []
    for (const comp of components) {
      if (comp.id === this.id) continue // Skip self

      // Create a proxy that calls component methods
      const proxy: ComponentInstance = {}

      // Get the actual component instance (this would come from ComponentManager)
      const instance = ComponentInstanceRegistry.get(comp.id)
      if (instance) {
        // Copy all methods that are decorated as @action
        const actionMethods = getActionMethods(instance)
        for (const methodName of actionMethods) {
          proxy[methodName] = (...args: unknown[]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (instance as any)[methodName]?.(...args)
          }
        }
      }

      this.componentBridge.set(comp.script, proxy)
    }

    // Also add built-in pseudo-components
    this.componentBridge.set('Behavior', {
      triggerSignal: (...args: unknown[]) => this.triggerSignal(args[0] as string, args[1]),
      setVariable: (...args: unknown[]) => this.setVariable(args[0] as string, args[1]),
      getVariable: (...args: unknown[]) => this.getVariable(args[0] as string),
      stop: () => this.stop(),
      restart: () => this.restart(),
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      graphId: this.graphId,
      inlineGraph: this.graph,
      isRunning: this.isRunning,
      variables: this.context ? {
        node: this.context.nodeVars,
        local: this.context.localVars,
      } : null,
    }
  }

  override deserialize(data: Record<string, unknown>): void {
    super.deserialize(data)

    if (data.graphId) {
      this.graphId = data.graphId as string
    }

    if (data.inlineGraph) {
      this.graph = data.inlineGraph as LogicGraph
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Getters
  // ─────────────────────────────────────────────────────────────────────────

  /** Check if graph is currently running */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /** Get the current graph */
  getGraph(): LogicGraph | null {
    return this.graph
  }

  /** Get the runtime instance */
  getRuntime(): GraphRuntime | null {
    return this.runtime
  }

  /** Get the execution context */
  getContext(): GraphExecutionContext | null {
    return this.context
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Registry - Stores logic graphs by ID
// ─────────────────────────────────────────────────────────────────────────────

class GraphRegistry {
  private graphs: Map<string, LogicGraph> = new Map()

  register(graph: LogicGraph): void {
    this.graphs.set(graph.graphId, graph)
  }

  get(id: string): LogicGraph | undefined {
    return this.graphs.get(id)
  }

  has(id: string): boolean {
    return this.graphs.has(id)
  }

  remove(id: string): boolean {
    return this.graphs.delete(id)
  }

  getAll(): LogicGraph[] {
    return Array.from(this.graphs.values())
  }

  clear(): void {
    this.graphs.clear()
  }
}

export const BehaviorGraphRegistry = new GraphRegistry()

// ─────────────────────────────────────────────────────────────────────────────
// Component Instance Registry - Maps component IDs to instances
// ─────────────────────────────────────────────────────────────────────────────

class InstanceRegistry {
  private instances: Map<string, Component> = new Map()

  register(id: string, instance: Component): void {
    this.instances.set(id, instance)
  }

  get(id: string): Component | undefined {
    return this.instances.get(id)
  }

  remove(id: string): boolean {
    return this.instances.delete(id)
  }

  clear(): void {
    this.instances.clear()
  }
}

export const ComponentInstanceRegistry = new InstanceRegistry()

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get action methods from a component instance
// ─────────────────────────────────────────────────────────────────────────────

function getActionMethods(instance: Component): string[] {
  const methods: string[] = []
  const proto = Object.getPrototypeOf(instance)

  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue
    if (typeof (proto as Record<string, unknown>)[key] === 'function') {
      // Check if method has @action decorator metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reflectAPI = Reflect as any
      const metadata = reflectAPI.getMetadata?.('action', proto, key)
      if (metadata) {
        methods.push(key)
      } else {
        // Fallback: include public methods that don't start with underscore
        if (!key.startsWith('_') && !key.startsWith('on')) {
          methods.push(key)
        }
      }
    }
  }

  return methods
}
