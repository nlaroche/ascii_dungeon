// ═══════════════════════════════════════════════════════════════════════════
// State Machine Runtime Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  StateMachineInstance,
  StateMachineManager,
  StateMachineBuilder,
  createStateMachine,
  type StateMachineDefinition,
  type StateDefinition,
} from './stateMachine'

describe('StateMachineInstance', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Basic State Machine Definition
  // ─────────────────────────────────────────────────────────────────────────

  const createBasicFSM = (): StateMachineDefinition => ({
    id: 'test-fsm',
    name: 'Test FSM',
    initialState: 'idle',
    states: [
      {
        id: 'idle',
        name: 'Idle',
        transitions: [
          { target: 'walking', event: 'move' },
          { target: 'attacking', event: 'attack' },
        ],
      },
      {
        id: 'walking',
        name: 'Walking',
        transitions: [
          { target: 'idle', event: 'stop' },
          { target: 'running', event: 'run' },
        ],
      },
      {
        id: 'running',
        name: 'Running',
        transitions: [
          { target: 'walking', event: 'walk' },
          { target: 'idle', event: 'stop' },
        ],
      },
      {
        id: 'attacking',
        name: 'Attacking',
        transitions: [
          { target: 'idle', event: 'done' },
        ],
      },
    ],
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('should create with initial state', () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      expect(fsm.currentState.id).toBe('idle')
    })

    it('should throw if initial state not found', () => {
      const badDef: StateMachineDefinition = {
        id: 'bad',
        name: 'Bad',
        initialState: 'nonexistent',
        states: [],
      }
      expect(() => new StateMachineInstance(badDef)).toThrow()
    })

    it('should accept initial data', () => {
      const def = createBasicFSM()
      def.variables = { health: 100 }
      const fsm = new StateMachineInstance(def, undefined, { health: 50 })
      expect(fsm.getContext().variables.health).toBe(50)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // State Transitions
  // ─────────────────────────────────────────────────────────────────────────

  describe('state transitions', () => {
    it('should transition on trigger event', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      const result = await fsm.trigger('move')
      expect(result).toBe(true)
      expect(fsm.currentState.id).toBe('walking')
    })

    it('should not transition on unknown event', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      const result = await fsm.trigger('unknown')
      expect(result).toBe(false)
      expect(fsm.currentState.id).toBe('idle')
    })

    it('should handle chain of transitions', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.trigger('move')
      expect(fsm.currentState.id).toBe('walking')

      await fsm.trigger('run')
      expect(fsm.currentState.id).toBe('running')

      await fsm.trigger('stop')
      expect(fsm.currentState.id).toBe('idle')
    })

    it('should track previous state', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.trigger('move')
      expect(fsm.previousState?.id).toBe('idle')

      await fsm.trigger('run')
      expect(fsm.previousState?.id).toBe('walking')
    })

    it('should allow forced transitions', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.transitionTo('attacking')
      expect(fsm.currentState.id).toBe('attacking')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Conditional Transitions
  // ─────────────────────────────────────────────────────────────────────────

  describe('conditional transitions', () => {
    it('should evaluate condition expression', async () => {
      const def: StateMachineDefinition = {
        id: 'conditional',
        name: 'Conditional',
        initialState: 'idle',
        variables: { energy: 100 },
        states: [
          {
            id: 'idle',
            name: 'Idle',
            transitions: [
              {
                target: 'tired',
                condition: 'energy < 20',
              },
            ],
          },
          {
            id: 'tired',
            name: 'Tired',
            transitions: [],
          },
        ],
      }

      const fsm = new StateMachineInstance(def)
      await fsm.start()

      // Energy is 100, condition not met
      await fsm.update(0.1)
      expect(fsm.currentState.id).toBe('idle')

      // Set energy low
      fsm.getContext().variables.energy = 10
      await fsm.update(0.1)
      expect(fsm.currentState.id).toBe('tired')
    })

    it('should respect transition priority', async () => {
      const def: StateMachineDefinition = {
        id: 'priority',
        name: 'Priority',
        initialState: 'start',
        variables: { value: 50 },
        states: [
          {
            id: 'start',
            name: 'Start',
            transitions: [
              { target: 'low', condition: 'value < 100', priority: 1 },
              { target: 'high', condition: 'value > 0', priority: 2 },
            ],
          },
          { id: 'low', name: 'Low', transitions: [] },
          { id: 'high', name: 'High', transitions: [] },
        ],
      }

      const fsm = new StateMachineInstance(def)
      await fsm.start()
      await fsm.update(0.1)

      // Higher priority transition should win
      expect(fsm.currentState.id).toBe('high')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // State Actions
  // ─────────────────────────────────────────────────────────────────────────

  describe('state actions', () => {
    it('should call onAction callback', async () => {
      const onAction = vi.fn()
      const def: StateMachineDefinition = {
        id: 'actions',
        name: 'Actions',
        initialState: 'start',
        states: [
          {
            id: 'start',
            name: 'Start',
            onEnter: [{ type: 'log', target: 'Entered start' }],
            transitions: [],
          },
        ],
      }

      const fsm = new StateMachineInstance(def)
      fsm.onAction = onAction
      await fsm.start()

      expect(onAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'log', target: 'Entered start' }),
        expect.any(Object)
      )
    })

    it('should run onEnter and onExit actions', async () => {
      const actions: string[] = []
      const def: StateMachineDefinition = {
        id: 'lifecycle',
        name: 'Lifecycle',
        initialState: 'a',
        states: [
          {
            id: 'a',
            name: 'A',
            onEnter: [{ type: 'log', target: 'enter-a' }],
            onExit: [{ type: 'log', target: 'exit-a' }],
            transitions: [{ target: 'b', event: 'go' }],
          },
          {
            id: 'b',
            name: 'B',
            onEnter: [{ type: 'log', target: 'enter-b' }],
            transitions: [],
          },
        ],
      }

      const fsm = new StateMachineInstance(def)
      fsm.onAction = (action) => actions.push(action.target)
      await fsm.start()
      await fsm.trigger('go')

      expect(actions).toEqual(['enter-a', 'exit-a', 'enter-b'])
    })

    it('should run onUpdate actions each frame', async () => {
      const updates: number[] = []
      const def: StateMachineDefinition = {
        id: 'update',
        name: 'Update',
        initialState: 'counting',
        variables: { count: 0 },
        states: [
          {
            id: 'counting',
            name: 'Counting',
            onUpdate: [{ type: 'set', target: 'count', value: { $expr: 'count + 1' } }],
            transitions: [],
          },
        ],
      }

      const fsm = new StateMachineInstance(def)
      fsm.onAction = () => {
        updates.push(fsm.getContext().variables.count as number)
      }
      await fsm.start()

      await fsm.update(0.016)
      await fsm.update(0.016)
      await fsm.update(0.016)

      expect(updates.length).toBe(3)
    })

    it('should set variables with set action', async () => {
      const def: StateMachineDefinition = {
        id: 'setvar',
        name: 'SetVar',
        initialState: 'start',
        variables: { score: 0 },
        states: [
          {
            id: 'start',
            name: 'Start',
            onEnter: [{ type: 'set', target: 'score', value: 100 }],
            transitions: [],
          },
        ],
      }

      const fsm = new StateMachineInstance(def)
      await fsm.start()

      expect(fsm.getContext().variables.score).toBe(100)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // State Time
  // ─────────────────────────────────────────────────────────────────────────

  describe('state time', () => {
    it('should track time in current state', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.update(0.5)
      await fsm.update(0.5)

      expect(fsm.getContext().stateTime).toBeCloseTo(1.0, 2)
    })

    it('should reset state time on transition', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.update(1.0)
      expect(fsm.getContext().stateTime).toBeCloseTo(1.0, 2)

      await fsm.trigger('move')
      expect(fsm.getContext().stateTime).toBe(0)
    })

    it('should track total time', async () => {
      const fsm = new StateMachineInstance(createBasicFSM())
      await fsm.start()

      await fsm.update(0.5)
      await fsm.trigger('move')
      await fsm.update(0.5)

      expect(fsm.getContext().totalTime).toBeCloseTo(1.0, 2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks
  // ─────────────────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onStateChange callback', async () => {
      const onStateChange = vi.fn()
      const fsm = new StateMachineInstance(createBasicFSM())
      fsm.onStateChange = onStateChange
      await fsm.start()

      await fsm.trigger('move')

      expect(onStateChange).toHaveBeenCalledWith('walking', 'idle')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('serialization', () => {
    it('should serialize state', async () => {
      const def = createBasicFSM()
      def.variables = { score: 0 }

      const fsm = new StateMachineInstance(def)
      await fsm.start()
      fsm.getContext().variables.score = 500
      await fsm.trigger('move')
      await fsm.update(1.5)

      const data = fsm.serialize()
      expect(data.currentState).toBe('walking')
      expect(data.variables.score).toBe(500)
      expect(data.stateTime).toBeCloseTo(1.5, 2)
    })

    it('should deserialize state', async () => {
      const def = createBasicFSM()
      def.variables = { score: 0 }

      const fsm = new StateMachineInstance(def)
      await fsm.start()

      fsm.deserialize({
        currentState: 'running',
        variables: { score: 1000 },
        stateTime: 2.5,
      })

      expect(fsm.currentState.id).toBe('running')
      expect(fsm.getContext().variables.score).toBe(1000)
      expect(fsm.getContext().stateTime).toBeCloseTo(2.5, 2)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// State Machine Manager Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StateMachineManager', () => {
  it('should register and create instances', async () => {
    const manager = new StateMachineManager()
    const def: StateMachineDefinition = {
      id: 'test',
      name: 'Test',
      initialState: 'start',
      states: [{ id: 'start', name: 'Start', transitions: [] }],
    }

    manager.registerDefinition(def)
    const instance = await manager.createInstance('test')

    expect(instance).toBeDefined()
    expect(instance.currentState.id).toBe('start')
  })

  it('should update all instances', async () => {
    const manager = new StateMachineManager()
    const def: StateMachineDefinition = {
      id: 'test',
      name: 'Test',
      initialState: 'start',
      states: [{ id: 'start', name: 'Start', transitions: [] }],
    }

    manager.registerDefinition(def)
    const instance1 = await manager.createInstance('test', 'fsm1')
    const instance2 = await manager.createInstance('test', 'fsm2')

    await manager.updateAll(0.5)

    expect(instance1.getContext().stateTime).toBeCloseTo(0.5, 2)
    expect(instance2.getContext().stateTime).toBeCloseTo(0.5, 2)
  })

  it('should destroy instances', async () => {
    const manager = new StateMachineManager()
    const def: StateMachineDefinition = {
      id: 'test',
      name: 'Test',
      initialState: 'start',
      states: [{ id: 'start', name: 'Start', transitions: [] }],
    }

    manager.registerDefinition(def)
    await manager.createInstance('test', 'fsm1')
    await manager.destroyInstance('fsm1')

    expect(manager.getInstance('fsm1')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Builder Pattern Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StateMachineBuilder', () => {
  it('should build a state machine with builder pattern', () => {
    const def = createStateMachine('enemy-ai', 'Enemy AI')
      .setInitialState('idle')
      .addVariable('health', 100)
      .addVariable('target', null)
      .state('idle', 'Idle')
        .animation('idle')
        .transitionOn('player_spotted', 'chase')
        .transitionWhen('health < 20', 'flee')
      .end()
      .state('chase', 'Chase')
        .animation('run')
        .onEnter({ type: 'playSound', target: 'alert' })
        .transitionOn('player_lost', 'idle')
        .transitionWhen('distance(self.position, target.position) < 2', 'attack')
      .end()
      .state('attack', 'Attack')
        .animation('attack')
        .onEnter({ type: 'call', target: 'damage', value: { amount: 10 } })
        .transitionOn('attack_done', 'chase')
      .end()
      .state('flee', 'Flee')
        .animation('run')
        .transitionWhen('health > 50', 'idle')
      .end()
      .build()

    expect(def.id).toBe('enemy-ai')
    expect(def.name).toBe('Enemy AI')
    expect(def.initialState).toBe('idle')
    expect(def.states.length).toBe(4)
    expect(def.variables?.health).toBe(100)

    const idleState = def.states.find(s => s.id === 'idle')!
    expect(idleState.animation).toBe('idle')
    expect(idleState.transitions.length).toBe(2)

    const chaseState = def.states.find(s => s.id === 'chase')!
    expect(chaseState.onEnter?.length).toBe(1)
    expect(chaseState.onEnter?.[0].type).toBe('playSound')
  })

  it('should use first state as initial if not specified', () => {
    const def = createStateMachine('simple')
      .state('a').end()
      .state('b').end()
      .build()

    expect(def.initialState).toBe('a')
  })
})
