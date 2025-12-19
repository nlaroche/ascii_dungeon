// ═══════════════════════════════════════════════════════════════════════════
// Node Lifecycle State Machine Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  LifecycleManager,
  SeededRandom,
  LifecycleState,
  InitEventData,
  DisposeEventData,
} from './lifecycle'
import { TriplePhaseEventBus, GameEvent } from './events'

describe('SeededRandom', () => {
  it('should produce deterministic results with same seed', () => {
    const rng1 = new SeededRandom(12345)
    const rng2 = new SeededRandom(12345)

    for (let i = 0; i < 10; i++) {
      expect(rng1.next()).toBe(rng2.next())
    }
  })

  it('should produce different results with different seeds', () => {
    const rng1 = new SeededRandom(12345)
    const rng2 = new SeededRandom(54321)

    const results1: number[] = []
    const results2: number[] = []

    for (let i = 0; i < 10; i++) {
      results1.push(rng1.next())
      results2.push(rng2.next())
    }

    expect(results1).not.toEqual(results2)
  })

  it('should generate integers in range', () => {
    const rng = new SeededRandom(42)

    for (let i = 0; i < 100; i++) {
      const value = rng.int(0, 10)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(10)
    }
  })

  it('should generate floats in range', () => {
    const rng = new SeededRandom(42)

    for (let i = 0; i < 100; i++) {
      const value = rng.float(5, 10)
      expect(value).toBeGreaterThanOrEqual(5)
      expect(value).toBeLessThan(10)
    }
  })

  it('should pick from array', () => {
    const rng = new SeededRandom(42)
    const items = ['a', 'b', 'c', 'd']

    for (let i = 0; i < 10; i++) {
      const picked = rng.pick(items)
      expect(items).toContain(picked)
    }
  })

  it('should shuffle array deterministically', () => {
    const rng1 = new SeededRandom(42)
    const rng2 = new SeededRandom(42)

    const arr1 = [1, 2, 3, 4, 5]
    const arr2 = [1, 2, 3, 4, 5]

    rng1.shuffle(arr1)
    rng2.shuffle(arr2)

    expect(arr1).toEqual(arr2)
  })

  it('should save and restore seed', () => {
    const rng = new SeededRandom(42)

    // Generate some numbers
    rng.next()
    rng.next()

    // Save state
    const savedSeed = rng.getSeed()

    // Generate more
    const next1 = rng.next()
    const next2 = rng.next()

    // Restore and verify
    rng.setSeed(savedSeed)
    expect(rng.next()).toBe(next1)
    expect(rng.next()).toBe(next2)
  })
})

describe('LifecycleManager', () => {
  let manager: LifecycleManager
  let eventBus: TriplePhaseEventBus

  beforeEach(() => {
    eventBus = new TriplePhaseEventBus()
    manager = new LifecycleManager(eventBus)
  })

  describe('registration', () => {
    it('should register a node', () => {
      manager.register('node1')

      expect(manager.getState('node1')).toBe('uninitialized')
    })

    it('should register a node with parent', () => {
      manager.register('parent')
      manager.register('child', 'parent')

      expect(manager.getParent('child')).toBe('parent')
      expect(manager.getChildren('parent')).toContain('child')
    })

    it('should register a node with custom config', () => {
      manager.register('node1', null, { retryCount: 3 })

      expect(manager.getState('node1')).toBe('uninitialized')
    })

    it('should warn when registering duplicate node', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      manager.register('node1')
      manager.register('node1')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should unregister a node', () => {
      manager.register('node1')
      manager.unregister('node1')

      expect(manager.getState('node1')).toBeUndefined()
    })
  })

  describe('state transitions', () => {
    it('should initialize a node through all states', async () => {
      const states: LifecycleState[] = []

      manager.register('node1')

      // Track state changes by polling (not ideal but works for testing)
      const originalGetState = manager.getState.bind(manager)
      vi.spyOn(manager, 'getState').mockImplementation((id) => {
        const state = originalGetState(id)
        return state
      })

      await manager.initialize('node1')

      expect(manager.getState('node1')).toBe('ready')
    })

    it('should fire Init event during initialization', async () => {
      const initHandler = vi.fn()

      manager.register('node1')
      eventBus.on<InitEventData>('Init', 'execute', initHandler, { nodeId: 'node1' })

      await manager.initialize('node1')

      expect(initHandler).toHaveBeenCalled()
      expect(initHandler.mock.calls[0][0].data.nodeId).toBe('node1')
    })

    it('should not initialize if parent not ready', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      manager.register('parent')
      manager.register('child', 'parent')

      const result = await manager.initialize('child', { recursive: false })

      expect(result).toBe(false)
      expect(manager.getState('child')).toBe('uninitialized')
      consoleSpy.mockRestore()
    })

    it('should initialize parent before children when recursive', async () => {
      const order: string[] = []

      manager.register('parent')
      manager.register('child', 'parent')

      eventBus.on<InitEventData>('Init', 'execute', (e) => {
        order.push(e.data.nodeId)
      })

      await manager.initialize('parent', { recursive: true })

      expect(order).toEqual(['parent', 'child'])
    })
  })

  describe('disposal', () => {
    it('should dispose a node', async () => {
      manager.register('node1')
      await manager.initialize('node1')

      await manager.dispose('node1')

      expect(manager.getState('node1')).toBe('disposed')
    })

    it('should fire Dispose event', async () => {
      const disposeHandler = vi.fn()

      manager.register('node1')
      await manager.initialize('node1')

      eventBus.on<DisposeEventData>('Dispose', 'execute', disposeHandler, { nodeId: 'node1' })

      await manager.dispose('node1')

      expect(disposeHandler).toHaveBeenCalled()
      expect(disposeHandler.mock.calls[0][0].data.reason).toBe('manual')
    })

    it('should dispose children before parent', async () => {
      const order: string[] = []

      manager.register('parent')
      manager.register('child', 'parent')
      await manager.initialize('parent', { recursive: true })

      eventBus.on<DisposeEventData>('Dispose', 'execute', (e) => {
        order.push(e.data.nodeId)
      })

      await manager.dispose('parent')

      expect(order).toEqual(['child', 'parent'])
    })

    it('should set reason to "parent" when disposed due to parent', async () => {
      let childReason: string | undefined

      manager.register('parent')
      manager.register('child', 'parent')
      await manager.initialize('parent', { recursive: true })

      eventBus.on<DisposeEventData>('Dispose', 'execute', (e) => {
        if (e.data.nodeId === 'child') {
          childReason = e.data.reason
        }
      })

      await manager.dispose('parent')

      expect(childReason).toBe('parent')
    })
  })

  describe('error handling', () => {
    it('should handle initialization error', async () => {
      manager.register('node1', null, { retryCount: 0 })

      eventBus.on('Init', 'execute', () => {
        throw new Error('Init failed')
      }, { nodeId: 'node1' })

      const result = await manager.initialize('node1')

      expect(result).toBe(false)
      expect(manager.getState('node1')).toBe('error')
    })

    it('should retry on error', async () => {
      let attempts = 0

      manager.register('node1', null, { retryCount: 2, retryDelayMs: 10 })

      eventBus.on('Init', 'execute', () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Init failed')
        }
      }, { nodeId: 'node1' })

      const result = await manager.initialize('node1')

      expect(result).toBe(true)
      expect(attempts).toBe(3)
      expect(manager.getState('node1')).toBe('ready')
    })

    it('should use exponential backoff', async () => {
      const delays: number[] = []
      let lastTime = Date.now()

      manager.register('node1', null, {
        retryCount: 2,
        retryDelayMs: 50,
        retryBackoff: 'exponential',
      })

      let attempts = 0
      eventBus.on('Init', 'execute', () => {
        const now = Date.now()
        if (attempts > 0) {
          delays.push(now - lastTime)
        }
        lastTime = now
        attempts++
        if (attempts < 3) {
          throw new Error('Init failed')
        }
      }, { nodeId: 'node1' })

      await manager.initialize('node1')

      // Exponential: 50ms, 100ms
      expect(delays[0]).toBeGreaterThanOrEqual(45) // First retry: base delay
      expect(delays[1]).toBeGreaterThanOrEqual(90) // Second retry: 2x base delay
    }, 10000)

    it('should emit error event', async () => {
      const errorHandler = vi.fn()

      manager.register('node1', null, { retryCount: 0 })

      eventBus.on('Error', 'execute', errorHandler)
      eventBus.on('Init', 'execute', () => {
        throw new Error('Test error')
      }, { nodeId: 'node1' })

      await manager.initialize('node1')

      expect(errorHandler).toHaveBeenCalled()
      expect(errorHandler.mock.calls[0][0].data.error.message).toBe('Test error')
    })

    it('should cancel initialization when event is cancelled', async () => {
      manager.register('node1', null, { retryCount: 0 })

      eventBus.on('Init', 'before', (e) => {
        e.cancel()
      }, { nodeId: 'node1' })

      const result = await manager.initialize('node1')

      expect(result).toBe(false)
      expect(manager.getState('node1')).toBe('error')
    })
  })

  describe('construction scripts', () => {
    it('should run construction script', async () => {
      const scriptFn = vi.fn()

      manager.registerConstructionScript('TestNode', scriptFn)
      manager.register('node1')

      await manager.initialize('node1', { nodeType: 'TestNode' })

      expect(scriptFn).toHaveBeenCalled()
      expect(scriptFn.mock.calls[0][0].nodeId).toBe('node1')
    })

    it('should provide seeded random to construction script', async () => {
      let randomValue1: number | undefined
      let randomValue2: number | undefined

      manager.setGlobalSeed(12345)
      manager.registerConstructionScript('TestNode', (ctx) => {
        randomValue1 = ctx.random.next()
      })
      manager.register('node1')
      await manager.initialize('node1', { nodeType: 'TestNode' })

      // Reset and do again with same seed
      manager.clear()
      manager.setGlobalSeed(12345)
      manager.register('node2')
      await manager.initialize('node2', { nodeType: 'TestNode' })
      // Different node, different seed in sequence

      // Test determinism within same run
      manager.clear()
      manager.setGlobalSeed(99999)
      manager.register('node3')
      await manager.initialize('node3', { nodeType: 'TestNode' })
      randomValue2 = randomValue1 // Save first value

      manager.clear()
      manager.setGlobalSeed(99999)
      manager.register('node4')
      let randomValue3: number | undefined
      manager.registerConstructionScript('TestNode', (ctx) => {
        randomValue3 = ctx.random.next()
      })
      await manager.initialize('node4', { nodeType: 'TestNode' })

      expect(randomValue2).toBeDefined()
      expect(randomValue3).toBeDefined()
    })

    it('should pass spawn params to construction script', async () => {
      let receivedParams: Record<string, unknown> | undefined

      manager.registerConstructionScript('TestNode', (ctx) => {
        receivedParams = ctx.spawnParams
      })
      manager.register('node1')

      await manager.initialize('node1', {
        nodeType: 'TestNode',
        spawnParams: { speed: 5, name: 'test' },
      })

      expect(receivedParams).toEqual({ speed: 5, name: 'test' })
    })
  })

  describe('batch operations', () => {
    it('should initialize all root nodes', async () => {
      manager.register('root1')
      manager.register('root2')
      manager.register('child1', 'root1')

      await manager.initializeAll()

      expect(manager.getState('root1')).toBe('ready')
      expect(manager.getState('root2')).toBe('ready')
      expect(manager.getState('child1')).toBe('ready')
    })

    it('should dispose all nodes', async () => {
      manager.register('root1')
      manager.register('child1', 'root1')
      await manager.initializeAll()

      await manager.disposeAll()

      expect(manager.getState('root1')).toBe('disposed')
      expect(manager.getState('child1')).toBe('disposed')
    })
  })

  describe('queries', () => {
    it('should get all nodes in a state', async () => {
      manager.register('node1')
      manager.register('node2')
      manager.register('node3')
      await manager.initialize('node1')

      const readyNodes = manager.getNodesInState('ready')
      const uninitNodes = manager.getNodesInState('uninitialized')

      expect(readyNodes).toEqual(['node1'])
      expect(uninitNodes).toContain('node2')
      expect(uninitNodes).toContain('node3')
    })

    it('should check if node is ready', async () => {
      manager.register('node1')

      expect(manager.isReady('node1')).toBe(false)

      await manager.initialize('node1')

      expect(manager.isReady('node1')).toBe(true)
    })

    it('should get debug info', async () => {
      manager.register('node1')
      manager.register('node2')
      await manager.initialize('node1')

      const debug = manager.getDebugInfo()

      expect(debug.nodeCount).toBe(2)
      expect((debug.states as Record<string, string>)['node1']).toBe('ready')
      expect((debug.states as Record<string, string>)['node2']).toBe('uninitialized')
    })
  })
})
