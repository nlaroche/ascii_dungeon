// ═══════════════════════════════════════════════════════════════════════════
// State Machine Runtime - Finite State Machines for game behavior
// ═══════════════════════════════════════════════════════════════════════════

import { TriplePhaseEventBus, createGameEvent, type GameEvent } from './events'
import { evaluateExpression, type ExprContext } from './expressions'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StateDefinition {
  /** Unique state ID */
  id: string
  /** Display name */
  name: string
  /** Actions to run when entering this state */
  onEnter?: StateAction[]
  /** Actions to run when exiting this state */
  onExit?: StateAction[]
  /** Actions to run while in this state (each update) */
  onUpdate?: StateAction[]
  /** Transitions from this state */
  transitions: StateTransition[]
  /** Animation to play while in this state */
  animation?: string
  /** Sound to play when entering */
  enterSound?: string
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

export interface StateTransition {
  /** Target state ID */
  target: string
  /** Condition expression (if omitted, transition is triggered manually) */
  condition?: string | { $expr: string }
  /** Event that triggers this transition */
  event?: string
  /** Priority (higher = checked first) */
  priority?: number
  /** Actions to run during transition */
  actions?: StateAction[]
  /** Transition duration in seconds (for blending) */
  duration?: number
}

export interface StateAction {
  /** Action type */
  type: 'emit' | 'set' | 'call' | 'log' | 'playSound' | 'playAnimation'
  /** Target (variable name, event name, etc.) */
  target: string
  /** Value or parameters */
  value?: unknown
  /** Delay before executing (seconds) */
  delay?: number
}

export interface StateMachineDefinition {
  /** Unique ID */
  id: string
  /** Display name */
  name: string
  /** Initial state ID */
  initialState: string
  /** All states */
  states: StateDefinition[]
  /** Variables local to this state machine */
  variables?: Record<string, unknown>
  /** Whether to persist state across scene changes */
  persistent?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// State Machine Instance
// ─────────────────────────────────────────────────────────────────────────────

export interface StateMachineContext extends ExprContext {
  /** Current state ID */
  currentState: string
  /** Previous state ID */
  previousState: string | null
  /** Time spent in current state (seconds) */
  stateTime: number
  /** Total time machine has been running */
  totalTime: number
  /** State machine variables */
  variables: Record<string, unknown>
  /** Custom data passed to the machine */
  data: Record<string, unknown>
}

export type StateMachineEventType =
  | 'stateEnter'
  | 'stateExit'
  | 'stateUpdate'
  | 'transition'
  | 'error'

export interface StateMachineEvent {
  type: StateMachineEventType
  machineId: string
  stateId: string
  previousStateId?: string
  transitionId?: string
  error?: Error
}

export class StateMachineInstance {
  readonly id: string
  readonly definition: StateMachineDefinition
  private currentStateId: string
  private previousStateId: string | null = null
  private stateTime: number = 0
  private totalTime: number = 0
  private variables: Record<string, unknown>
  private eventBus: TriplePhaseEventBus
  private isTransitioning: boolean = false
  private pendingTransition: { target: string; actions?: StateAction[] } | null = null

  // Callbacks
  onStateChange?: (current: string, previous: string | null) => void
  onAction?: (action: StateAction, context: StateMachineContext) => void

  constructor(
    definition: StateMachineDefinition,
    eventBus?: TriplePhaseEventBus,
    initialData?: Record<string, unknown>
  ) {
    this.id = `fsm_${definition.id}_${Date.now()}`
    this.definition = definition
    this.currentStateId = definition.initialState
    this.variables = { ...definition.variables }
    this.eventBus = eventBus || new TriplePhaseEventBus()

    // Apply initial data
    if (initialData) {
      Object.assign(this.variables, initialData)
    }

    // Verify initial state exists
    if (!this.getState(definition.initialState)) {
      throw new Error(`Initial state '${definition.initialState}' not found in state machine '${definition.name}'`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  get currentState(): StateDefinition {
    return this.getState(this.currentStateId)!
  }

  get previousState(): StateDefinition | null {
    return this.previousStateId ? this.getState(this.previousStateId) : null
  }

  getState(id: string): StateDefinition | undefined {
    return this.definition.states.find(s => s.id === id)
  }

  getContext(): StateMachineContext {
    return {
      currentState: this.currentStateId,
      previousState: this.previousStateId,
      stateTime: this.stateTime,
      totalTime: this.totalTime,
      variables: this.variables,
      data: {},
      // ExprContext properties
      node: null,
      self: this.variables,
      global: {},
      scene: {},
      local: this.variables,
      event: null,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the state machine (enter initial state)
   */
  async start(): Promise<void> {
    await this.enterState(this.currentStateId)
  }

  /**
   * Update the state machine (called each frame)
   */
  async update(dt: number): Promise<void> {
    this.stateTime += dt
    this.totalTime += dt

    // Process pending transition
    if (this.pendingTransition && !this.isTransitioning) {
      const { target, actions } = this.pendingTransition
      this.pendingTransition = null
      await this.transitionTo(target, actions)
      return
    }

    if (this.isTransitioning) return

    const state = this.currentState
    if (!state) return

    // Run onUpdate actions
    if (state.onUpdate) {
      for (const action of state.onUpdate) {
        await this.executeAction(action)
      }
    }

    // Check automatic transitions (those with conditions)
    await this.checkTransitions()

    // Emit update event
    await this.emitEvent('stateUpdate', {
      stateId: this.currentStateId,
    })
  }

  /**
   * Stop the state machine
   */
  async stop(): Promise<void> {
    await this.exitState(this.currentStateId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Trigger a transition by event name
   */
  async trigger(eventName: string): Promise<boolean> {
    if (this.isTransitioning) return false

    const state = this.currentState
    if (!state) return false

    // Find matching transition
    const transition = state.transitions
      .filter(t => t.event === eventName)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .find(t => this.evaluateCondition(t.condition))

    if (transition) {
      await this.transitionTo(transition.target, transition.actions)
      return true
    }

    return false
  }

  /**
   * Force transition to a specific state
   */
  async transitionTo(targetStateId: string, actions?: StateAction[]): Promise<void> {
    const targetState = this.getState(targetStateId)
    if (!targetState) {
      console.error(`[FSM] State '${targetStateId}' not found`)
      return
    }

    if (this.isTransitioning) {
      // Queue the transition
      this.pendingTransition = { target: targetStateId, actions }
      return
    }

    this.isTransitioning = true

    try {
      // Exit current state
      await this.exitState(this.currentStateId)

      // Run transition actions
      if (actions) {
        for (const action of actions) {
          await this.executeAction(action)
        }
      }

      // Update state references
      this.previousStateId = this.currentStateId
      this.currentStateId = targetStateId
      this.stateTime = 0

      // Enter new state
      await this.enterState(targetStateId)

      // Notify
      this.onStateChange?.(this.currentStateId, this.previousStateId)

      // Emit transition event
      await this.emitEvent('transition', {
        stateId: targetStateId,
        previousStateId: this.previousStateId,
      })
    } finally {
      this.isTransitioning = false
    }
  }

  /**
   * Check all automatic transitions
   */
  private async checkTransitions(): Promise<void> {
    const state = this.currentState
    if (!state) return

    // Sort by priority and find first matching
    const transitions = [...state.transitions]
      .filter(t => !t.event) // Only automatic transitions (no event trigger)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))

    for (const transition of transitions) {
      if (this.evaluateCondition(transition.condition)) {
        await this.transitionTo(transition.target, transition.actions)
        break
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Enter/Exit
  // ─────────────────────────────────────────────────────────────────────────

  private async enterState(stateId: string): Promise<void> {
    const state = this.getState(stateId)
    if (!state) return

    // Emit enter event
    await this.emitEvent('stateEnter', { stateId })

    // Play enter sound
    if (state.enterSound) {
      await this.executeAction({
        type: 'playSound',
        target: state.enterSound,
      })
    }

    // Play animation
    if (state.animation) {
      await this.executeAction({
        type: 'playAnimation',
        target: state.animation,
      })
    }

    // Run onEnter actions
    if (state.onEnter) {
      for (const action of state.onEnter) {
        await this.executeAction(action)
      }
    }
  }

  private async exitState(stateId: string): Promise<void> {
    const state = this.getState(stateId)
    if (!state) return

    // Run onExit actions
    if (state.onExit) {
      for (const action of state.onExit) {
        await this.executeAction(action)
      }
    }

    // Emit exit event
    await this.emitEvent('stateExit', { stateId })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  private async executeAction(action: StateAction): Promise<void> {
    // Handle delay
    if (action.delay && action.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay * 1000))
    }

    // Notify callback
    this.onAction?.(action, this.getContext())

    switch (action.type) {
      case 'emit':
        await this.eventBus.emit(createGameEvent(action.target, action.value, {
          source: { type: 'fsm', id: this.id },
        }))
        break

      case 'set':
        this.variables[action.target] = action.value
        break

      case 'call':
        // External call - handled by onAction callback
        break

      case 'log':
        console.log(`[FSM:${this.definition.name}] ${action.target}`, action.value || '')
        break

      case 'playSound':
        // Sound playback - handled by onAction callback
        console.log(`[FSM] Play sound: ${action.target}`)
        break

      case 'playAnimation':
        // Animation playback - handled by onAction callback
        console.log(`[FSM] Play animation: ${action.target}`)
        break
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private evaluateCondition(condition?: string | { $expr: string }): boolean {
    if (!condition) return true

    const expr = typeof condition === 'string' ? condition : condition.$expr
    try {
      const result = evaluateExpression(expr, this.getContext())
      return Boolean(result)
    } catch (e) {
      console.error(`[FSM] Condition evaluation error: ${e}`)
      return false
    }
  }

  private async emitEvent(
    type: StateMachineEventType,
    data: Partial<StateMachineEvent>
  ): Promise<void> {
    const eventData: StateMachineEvent = {
      type,
      machineId: this.id,
      stateId: this.currentStateId,
      ...data,
    }

    await this.eventBus.emit(createGameEvent({
      type: `fsm:${type}`,
      source: { type: 'node', id: this.id },
      data: eventData,
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  serialize(): { currentState: string; variables: Record<string, unknown>; stateTime: number } {
    return {
      currentState: this.currentStateId,
      variables: { ...this.variables },
      stateTime: this.stateTime,
    }
  }

  deserialize(data: { currentState: string; variables: Record<string, unknown>; stateTime: number }): void {
    this.currentStateId = data.currentState
    this.variables = { ...data.variables }
    this.stateTime = data.stateTime
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global State Machine Manager
// ─────────────────────────────────────────────────────────────────────────────

export class StateMachineManager {
  private machines: Map<string, StateMachineInstance> = new Map()
  private definitions: Map<string, StateMachineDefinition> = new Map()
  private eventBus: TriplePhaseEventBus

  constructor(eventBus?: TriplePhaseEventBus) {
    this.eventBus = eventBus || new TriplePhaseEventBus()
  }

  /**
   * Register a state machine definition
   */
  registerDefinition(definition: StateMachineDefinition): void {
    this.definitions.set(definition.id, definition)
  }

  /**
   * Create and start a new state machine instance
   */
  async createInstance(
    definitionId: string,
    instanceId?: string,
    initialData?: Record<string, unknown>
  ): Promise<StateMachineInstance> {
    const definition = this.definitions.get(definitionId)
    if (!definition) {
      throw new Error(`State machine definition '${definitionId}' not found`)
    }

    const instance = new StateMachineInstance(definition, this.eventBus, initialData)
    const id = instanceId || instance.id
    this.machines.set(id, instance)

    await instance.start()
    return instance
  }

  /**
   * Get a state machine instance by ID
   */
  getInstance(id: string): StateMachineInstance | undefined {
    return this.machines.get(id)
  }

  /**
   * Update all state machines
   */
  async updateAll(dt: number): Promise<void> {
    for (const machine of this.machines.values()) {
      await machine.update(dt)
    }
  }

  /**
   * Destroy a state machine instance
   */
  async destroyInstance(id: string): Promise<void> {
    const instance = this.machines.get(id)
    if (instance) {
      await instance.stop()
      this.machines.delete(id)
    }
  }

  /**
   * Destroy all instances
   */
  async destroyAll(): Promise<void> {
    for (const id of this.machines.keys()) {
      await this.destroyInstance(id)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder Pattern for State Machines
// ─────────────────────────────────────────────────────────────────────────────

export class StateMachineBuilder {
  private definition: StateMachineDefinition

  constructor(id: string, name?: string) {
    this.definition = {
      id,
      name: name || id,
      initialState: '',
      states: [],
      variables: {},
    }
  }

  setInitialState(stateId: string): this {
    this.definition.initialState = stateId
    return this
  }

  addVariable(name: string, defaultValue: unknown): this {
    this.definition.variables![name] = defaultValue
    return this
  }

  addState(state: StateDefinition): this {
    this.definition.states.push(state)
    return this
  }

  state(id: string, name?: string): StateBuilder {
    return new StateBuilder(this, id, name)
  }

  build(): StateMachineDefinition {
    if (!this.definition.initialState && this.definition.states.length > 0) {
      this.definition.initialState = this.definition.states[0].id
    }
    return this.definition
  }

  _addState(state: StateDefinition): void {
    this.definition.states.push(state)
  }
}

export class StateBuilder {
  private parent: StateMachineBuilder
  private state: StateDefinition

  constructor(parent: StateMachineBuilder, id: string, name?: string) {
    this.parent = parent
    this.state = {
      id,
      name: name || id,
      transitions: [],
    }
  }

  onEnter(...actions: StateAction[]): this {
    this.state.onEnter = actions
    return this
  }

  onExit(...actions: StateAction[]): this {
    this.state.onExit = actions
    return this
  }

  onUpdate(...actions: StateAction[]): this {
    this.state.onUpdate = actions
    return this
  }

  animation(name: string): this {
    this.state.animation = name
    return this
  }

  enterSound(name: string): this {
    this.state.enterSound = name
    return this
  }

  transitionTo(target: string, options?: Partial<StateTransition>): this {
    this.state.transitions.push({
      target,
      ...options,
    })
    return this
  }

  transitionOn(event: string, target: string, options?: Partial<StateTransition>): this {
    this.state.transitions.push({
      target,
      event,
      ...options,
    })
    return this
  }

  transitionWhen(condition: string, target: string, options?: Partial<StateTransition>): this {
    this.state.transitions.push({
      target,
      condition,
      ...options,
    })
    return this
  }

  end(): StateMachineBuilder {
    this.parent._addState(this.state)
    return this.parent
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience function
// ─────────────────────────────────────────────────────────────────────────────

export function createStateMachine(id: string, name?: string): StateMachineBuilder {
  return new StateMachineBuilder(id, name)
}
