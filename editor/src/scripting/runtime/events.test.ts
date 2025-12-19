// ═══════════════════════════════════════════════════════════════════════════
// Triple-Phase Event System Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createGameEvent,
  TriplePhaseEventBus,
  GameEvent,
  EventPhase,
} from './events'

describe('createGameEvent', () => {
  it('should create an event with correct properties', () => {
    const event = createGameEvent({
      type: 'TestEvent',
      source: { id: 'node1' },
      data: { value: 42 },
    })

    expect(event.type).toBe('TestEvent')
    expect(event.source.id).toBe('node1')
    expect(event.data.value).toBe(42)
    expect(event.phase).toBe('before')
    expect(event.cancelled).toBe(false)
    expect(event.bubbles).toBe(true)
    expect(event.cancelable).toBe(true)
  })

  it('should generate unique event IDs', () => {
    const event1 = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
    const event2 = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
    expect(event1.id).not.toBe(event2.id)
  })

  it('should allow data modification only in before phase', () => {
    const event = createGameEvent({
      type: 'Test',
      source: { id: 'node1' },
      data: { value: 1 },
    })

    // Can modify in before phase
    event.data = { value: 2 }
    expect(event.data.value).toBe(2)
  })

  it('should allow cancellation in before phase', () => {
    const event = createGameEvent({
      type: 'Test',
      source: { id: 'node1' },
      data: {},
      cancelable: true,
    })

    event.cancel()
    expect(event.cancelled).toBe(true)
  })

  it('should not allow cancellation if not cancelable', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = createGameEvent({
      type: 'Test',
      source: { id: 'node1' },
      data: {},
      cancelable: false,
    })

    event.cancel()
    expect(event.cancelled).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should support propagation control', () => {
    const event = createGameEvent({
      type: 'Test',
      source: { id: 'node1' },
      data: {},
    })

    expect(event.propagationStopped).toBe(false)
    event.stopPropagation()
    expect(event.propagationStopped).toBe(true)
  })

  it('should support immediate propagation stop', () => {
    const event = createGameEvent({
      type: 'Test',
      source: { id: 'node1' },
      data: {},
    })

    event.stopImmediatePropagation()
    expect(event.propagationStopped).toBe(true)
    expect(event.immediatePropagationStopped).toBe(true)
  })
})

describe('TriplePhaseEventBus', () => {
  let bus: TriplePhaseEventBus

  beforeEach(() => {
    bus = new TriplePhaseEventBus()
  })

  describe('handler registration', () => {
    it('should register and unregister handlers', () => {
      const handler = vi.fn()
      const unsub = bus.on('TestEvent', 'before', handler)

      expect(bus.getHandlerCount('TestEvent', 'before')).toBe(1)

      unsub()
      expect(bus.getHandlerCount('TestEvent', 'before')).toBe(0)
    })

    it('should register handlers with priority', () => {
      const order: number[] = []
      bus.on('Test', 'execute', () => { order.push(1) }, { priority: 1 })
      bus.on('Test', 'execute', () => { order.push(3) }, { priority: 3 })
      bus.on('Test', 'execute', () => { order.push(2) }, { priority: 2 })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      bus.emitSync(event)

      expect(order).toEqual([3, 2, 1])
    })
  })

  describe('triple-phase execution', () => {
    it('should execute phases in order: before → execute → after', async () => {
      const phases: EventPhase[] = []

      bus.on('Test', 'before', (e) => { phases.push(e.phase) })
      bus.on('Test', 'execute', (e) => { phases.push(e.phase) })
      bus.on('Test', 'after', (e) => { phases.push(e.phase) })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      await bus.emit(event)

      expect(phases).toEqual(['before', 'execute', 'after'])
    })

    it('should skip execute phase when cancelled in before', async () => {
      const phases: EventPhase[] = []

      bus.on('Test', 'before', (e) => {
        phases.push(e.phase)
        e.cancel()
      })
      bus.on('Test', 'execute', (e) => { phases.push(e.phase) })
      bus.on('Test', 'after', (e) => { phases.push(e.phase) })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      await bus.emit(event)

      expect(phases).toEqual(['before', 'after'])
      expect(event.cancelled).toBe(true)
    })

    it('should always run after phase even if execute throws', async () => {
      const phases: EventPhase[] = []

      bus.on('Test', 'before', (e) => { phases.push(e.phase) })
      bus.on('Test', 'execute', () => { throw new Error('test error') })
      bus.on('Test', 'after', (e) => { phases.push(e.phase) })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      await bus.emit(event)

      expect(phases).toEqual(['before', 'after'])
      expect(event.error).toBeDefined()
      expect(event.error?.message).toBe('test error')
    })

    it('should allow data modification only in before phase', async () => {
      interface TestData { value: number }

      bus.on<TestData>('Test', 'before', (e) => {
        e.data.value = 100
      })
      bus.on<TestData>('Test', 'execute', (e) => {
        expect(e.data.value).toBe(100)
      })

      const event = createGameEvent<TestData>({
        type: 'Test',
        source: { id: 'n' },
        data: { value: 1 },
      })
      await bus.emit(event)

      expect(event.data.value).toBe(100)
    })
  })

  describe('propagation', () => {
    it('should stop propagation when stopPropagation called', async () => {
      const handlers = [vi.fn(), vi.fn()]

      bus.on('Test', 'execute', (e) => {
        handlers[0]()
        e.stopPropagation()
      }, { nodeId: 'child' })
      bus.on('Test', 'execute', handlers[1], { nodeId: 'parent' })

      // Set up hierarchy
      bus.setNodeParent('child', 'parent')

      const event = createGameEvent({
        type: 'Test',
        source: { id: 'child' },
        data: {},
        routing: 'bubble',
      })
      await bus.emit(event)

      expect(handlers[0]).toHaveBeenCalled()
      expect(handlers[1]).not.toHaveBeenCalled()
    })

    it('should stop immediate propagation', async () => {
      const handlers = [vi.fn(), vi.fn()]

      bus.on('Test', 'execute', (e) => {
        handlers[0]()
        e.stopImmediatePropagation()
      }, { nodeId: 'node1', priority: 2 })
      bus.on('Test', 'execute', handlers[1], { nodeId: 'node1', priority: 1 })

      const event = createGameEvent({
        type: 'Test',
        source: { id: 'node1' },
        data: {},
      })
      await bus.emit(event)

      expect(handlers[0]).toHaveBeenCalled()
      expect(handlers[1]).not.toHaveBeenCalled()
    })

    it('should bubble events up the hierarchy', async () => {
      const handled: string[] = []

      bus.setNodeParent('grandchild', 'child')
      bus.setNodeParent('child', 'parent')
      bus.setNodeParent('parent', null)

      bus.on('Test', 'execute', () => { handled.push('grandchild') }, { nodeId: 'grandchild' })
      bus.on('Test', 'execute', () => { handled.push('child') }, { nodeId: 'child' })
      bus.on('Test', 'execute', () => { handled.push('parent') }, { nodeId: 'parent' })

      const event = createGameEvent({
        type: 'Test',
        source: { id: 'grandchild' },
        data: {},
        routing: 'bubble',
      })
      await bus.emit(event)

      expect(handled).toEqual(['grandchild', 'child', 'parent'])
    })

    it('should support local routing (no bubbling)', async () => {
      const handled: string[] = []

      bus.setNodeParent('child', 'parent')

      bus.on('Test', 'execute', () => { handled.push('child') }, { nodeId: 'child' })
      bus.on('Test', 'execute', () => { handled.push('parent') }, { nodeId: 'parent' })

      const event = createGameEvent({
        type: 'Test',
        source: { id: 'child' },
        data: {},
        routing: 'local',
      })
      await bus.emit(event)

      expect(handled).toEqual(['child'])
    })

    it('should support bus routing (all handlers)', async () => {
      const handled: string[] = []

      bus.on('Test', 'execute', () => { handled.push('a') }, { nodeId: 'nodeA' })
      bus.on('Test', 'execute', () => { handled.push('b') }, { nodeId: 'nodeB' })
      bus.on('Test', 'execute', () => { handled.push('global') })

      const event = createGameEvent({
        type: 'Test',
        source: { id: 'nodeA' },
        data: {},
        routing: 'bus',
      })
      await bus.emit(event)

      expect(handled).toContain('a')
      expect(handled).toContain('b')
      expect(handled).toContain('global')
    })
  })

  describe('onAll helper', () => {
    it('should register handlers for all phases', async () => {
      const phases: EventPhase[] = []

      bus.onAll('Test', {
        before: (e) => { phases.push(e.phase) },
        execute: (e) => { phases.push(e.phase) },
        after: (e) => { phases.push(e.phase) },
      })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      await bus.emit(event)

      expect(phases).toEqual(['before', 'execute', 'after'])
    })

    it('should unsubscribe all phases', () => {
      const unsub = bus.onAll('Test', {
        before: vi.fn(),
        execute: vi.fn(),
        after: vi.fn(),
      })

      expect(bus.getHandlerCount('Test', 'before')).toBe(1)
      expect(bus.getHandlerCount('Test', 'execute')).toBe(1)
      expect(bus.getHandlerCount('Test', 'after')).toBe(1)

      unsub()

      expect(bus.getHandlerCount('Test', 'before')).toBe(0)
      expect(bus.getHandlerCount('Test', 'execute')).toBe(0)
      expect(bus.getHandlerCount('Test', 'after')).toBe(0)
    })
  })

  describe('sync emit', () => {
    it('should execute all phases synchronously', () => {
      const phases: EventPhase[] = []

      bus.on('Test', 'before', (e) => { phases.push(e.phase) })
      bus.on('Test', 'execute', (e) => { phases.push(e.phase) })
      bus.on('Test', 'after', (e) => { phases.push(e.phase) })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      bus.emitSync(event)

      expect(phases).toEqual(['before', 'execute', 'after'])
    })

    it('should warn when async handler used in sync emit', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      bus.on('Test', 'execute', async () => {
        await Promise.resolve()
      })

      const event = createGameEvent({ type: 'Test', source: { id: 'n' }, data: {} })
      bus.emitSync(event)

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('should clear all handlers', () => {
      bus.on('Test1', 'before', vi.fn())
      bus.on('Test2', 'execute', vi.fn())

      expect(bus.getHandlerCount()).toBe(2)

      bus.clear()

      expect(bus.getHandlerCount()).toBe(0)
    })

    it('should remove node and its handlers', () => {
      bus.on('Test', 'execute', vi.fn(), { nodeId: 'node1' })
      bus.on('Test', 'execute', vi.fn(), { nodeId: 'node2' })
      bus.setNodeParent('node1', 'parent')

      expect(bus.getHandlerCount()).toBe(2)

      bus.removeNode('node1')

      expect(bus.getHandlerCount()).toBe(1)
      expect(bus.getAncestors('node1')).toEqual([])
    })
  })
})

describe('Event Use Cases', () => {
  let bus: TriplePhaseEventBus

  beforeEach(() => {
    bus = new TriplePhaseEventBus()
  })

  it('should handle damage event with validation and side effects', async () => {
    interface DamageData {
      amount: number
      source: string
      damageType: string
    }

    let finalDamage = 0
    let damageBlocked = false
    let sfxPlayed = false

    // Before: Armor reduces damage
    bus.on<DamageData>('Damage', 'before', (e) => {
      const armor = 20
      e.data.amount = Math.max(0, e.data.amount - armor)
    })

    // Before: Shield can block
    bus.on<DamageData>('Damage', 'before', (e) => {
      if (e.data.damageType === 'magic') {
        e.cancel()
        damageBlocked = true
      }
    })

    // Execute: Apply damage
    bus.on<DamageData>('Damage', 'execute', (e) => {
      finalDamage = e.data.amount
    })

    // After: Play SFX
    bus.on<DamageData>('Damage', 'after', () => {
      sfxPlayed = true
    })

    // Test physical damage
    const physicalDamage = createGameEvent<DamageData>({
      type: 'Damage',
      source: { id: 'enemy' },
      data: { amount: 50, source: 'enemy', damageType: 'physical' },
    })
    await bus.emit(physicalDamage)

    expect(finalDamage).toBe(30) // 50 - 20 armor
    expect(damageBlocked).toBe(false)
    expect(sfxPlayed).toBe(true)

    // Reset
    finalDamage = 0
    sfxPlayed = false

    // Test magic damage (blocked)
    const magicDamage = createGameEvent<DamageData>({
      type: 'Damage',
      source: { id: 'mage' },
      data: { amount: 50, source: 'mage', damageType: 'magic' },
    })
    await bus.emit(magicDamage)

    expect(magicDamage.cancelled).toBe(true)
    expect(damageBlocked).toBe(true)
    expect(finalDamage).toBe(0) // Execute was skipped
    expect(sfxPlayed).toBe(true) // After still runs
  })

  it('should handle async loading gate', async () => {
    const loadSteps: string[] = []

    bus.on('Init', 'before', async () => {
      await new Promise(r => setTimeout(r, 10))
      loadSteps.push('loaded assets')
    })

    bus.on('Init', 'execute', () => {
      loadSteps.push('initialized')
    })

    bus.on('Init', 'after', () => {
      loadSteps.push('ready')
    })

    const event = createGameEvent({
      type: 'Init',
      source: { id: 'scene' },
      data: {},
    })
    await bus.emit(event)

    expect(loadSteps).toEqual(['loaded assets', 'initialized', 'ready'])
  })
})
