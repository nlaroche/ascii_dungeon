// ═══════════════════════════════════════════════════════════════════════════
// Variables System Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  VariablesManager,
  VariableDefinition,
  VariableChangeEvent,
  getGlobal,
  setGlobal,
  GlobalVariables,
} from './variables'
import { TriplePhaseEventBus } from './events'

describe('VariablesManager', () => {
  let manager: VariablesManager
  let eventBus: TriplePhaseEventBus

  beforeEach(() => {
    eventBus = new TriplePhaseEventBus()
    manager = new VariablesManager(eventBus)
  })

  describe('basic operations', () => {
    it('should set and get variables', () => {
      manager.set('health', 'global', 100)
      expect(manager.get('health', 'global')).toBe(100)
    })

    it('should return null for undefined variables', () => {
      expect(manager.get('nonexistent', 'global')).toBe(null)
    })

    it('should check if variable exists', () => {
      expect(manager.has('test', 'global')).toBe(false)
      manager.set('test', 'global', 'value')
      expect(manager.has('test', 'global')).toBe(true)
    })

    it('should delete variables', () => {
      manager.set('toDelete', 'global', 123)
      expect(manager.has('toDelete', 'global')).toBe(true)
      manager.delete('toDelete', 'global')
      expect(manager.has('toDelete', 'global')).toBe(false)
    })
  })

  describe('variable definitions', () => {
    it('should define variables with defaults', () => {
      manager.define({
        name: 'score',
        type: 'number',
        scope: 'global',
        default: 0,
      })

      expect(manager.get('score', 'global')).toBe(0)
    })

    it('should apply min/max constraints', () => {
      manager.define({
        name: 'health',
        type: 'number',
        scope: 'global',
        min: 0,
        max: 100,
        default: 50,
      })

      manager.set('health', 'global', 150)
      expect(manager.get('health', 'global')).toBe(100)

      manager.set('health', 'global', -50)
      expect(manager.get('health', 'global')).toBe(0)
    })

    it('should prevent modifying readonly variables', () => {
      manager.define({
        name: 'constant',
        type: 'number',
        scope: 'global',
        default: 42,
        readonly: true,
      })

      manager.set('constant', 'global', 100)
      expect(manager.get('constant', 'global')).toBe(42)
    })

    it('should get definitions', () => {
      manager.define({
        name: 'test',
        type: 'string',
        scope: 'global',
        description: 'Test variable',
      })

      const def = manager.getDefinition('test', 'global')
      expect(def?.name).toBe('test')
      expect(def?.type).toBe('string')
      expect(def?.description).toBe('Test variable')
    })
  })

  describe('type coercion', () => {
    it('should coerce to number', () => {
      manager.define({ name: 'num', type: 'number', scope: 'global' })

      manager.set('num', 'global', '42')
      expect(manager.get('num', 'global')).toBe(42)

      manager.set('num', 'global', true)
      expect(manager.get('num', 'global')).toBe(1)

      manager.set('num', 'global', false)
      expect(manager.get('num', 'global')).toBe(0)
    })

    it('should coerce to string', () => {
      manager.define({ name: 'str', type: 'string', scope: 'global' })

      manager.set('str', 'global', 42)
      expect(manager.get('str', 'global')).toBe('42')

      manager.set('str', 'global', true)
      expect(manager.get('str', 'global')).toBe('true')
    })

    it('should coerce to boolean', () => {
      manager.define({ name: 'bool', type: 'boolean', scope: 'global' })

      manager.set('bool', 'global', 1)
      expect(manager.get('bool', 'global')).toBe(true)

      manager.set('bool', 'global', 0)
      expect(manager.get('bool', 'global')).toBe(false)

      manager.set('bool', 'global', 'false')
      expect(manager.get('bool', 'global')).toBe(false)

      manager.set('bool', 'global', 'true')
      expect(manager.get('bool', 'global')).toBe(true)
    })

    it('should coerce to vec2', () => {
      manager.define({ name: 'pos', type: 'vec2', scope: 'global' })

      manager.set('pos', 'global', [10, 20])
      expect(manager.get('pos', 'global')).toEqual([10, 20])

      manager.set('pos', 'global', { x: 5, y: 15 })
      expect(manager.get('pos', 'global')).toEqual([5, 15])
    })

    it('should coerce to color from hex', () => {
      manager.define({ name: 'color', type: 'color', scope: 'global' })

      manager.set('color', 'global', '#ff0000')
      const color = manager.get('color', 'global') as number[]
      expect(color[0]).toBeCloseTo(1, 2)
      expect(color[1]).toBeCloseTo(0, 2)
      expect(color[2]).toBeCloseTo(0, 2)
    })
  })

  describe('scopes', () => {
    it('should maintain separate global scope', () => {
      manager.set('var', 'global', 'global_value')
      manager.setCurrentScene('scene1')
      manager.set('var', 'scene', 'scene_value')

      expect(manager.get('var', 'global')).toBe('global_value')
      expect(manager.get('var', 'scene')).toBe('scene_value')
    })

    it('should maintain separate scene scopes', () => {
      manager.setCurrentScene('scene1')
      manager.set('var', 'scene', 'scene1_value')

      manager.setCurrentScene('scene2')
      manager.set('var', 'scene', 'scene2_value')

      expect(manager.get('var', 'scene')).toBe('scene2_value')

      manager.setCurrentScene('scene1')
      expect(manager.get('var', 'scene')).toBe('scene1_value')
    })

    it('should maintain separate node scopes', () => {
      manager.set('var', 'node', 'node1_value', 'node1')
      manager.set('var', 'node', 'node2_value', 'node2')

      expect(manager.get('var', 'node', 'node1')).toBe('node1_value')
      expect(manager.get('var', 'node', 'node2')).toBe('node2_value')
    })

    it('should resolve variables through scope chain', () => {
      manager.set('global_only', 'global', 'global')
      manager.setCurrentScene('scene1')
      manager.set('scene_only', 'scene', 'scene')
      manager.set('node_only', 'node', 'node', 'node1')
      manager.set('override', 'global', 'global')
      manager.set('override', 'scene', 'scene')
      manager.set('override', 'node', 'node', 'node1')

      expect(manager.resolve('global_only', 'node1')).toBe('global')
      expect(manager.resolve('scene_only', 'node1')).toBe('scene')
      expect(manager.resolve('node_only', 'node1')).toBe('node')
      expect(manager.resolve('override', 'node1')).toBe('node')
    })

    it('should clear scene variables', () => {
      manager.setCurrentScene('scene1')
      manager.set('var', 'scene', 'value')

      expect(manager.get('var', 'scene')).toBe('value')
      manager.clearScene('scene1')
      expect(manager.get('var', 'scene')).toBe(null)
    })

    it('should clear node variables', () => {
      manager.set('var', 'node', 'value', 'node1')

      expect(manager.get('var', 'node', 'node1')).toBe('value')
      manager.clearNode('node1')
      expect(manager.get('var', 'node', 'node1')).toBe(null)
    })
  })

  describe('variable operations', () => {
    it('should increment number variables', () => {
      manager.set('count', 'global', 5)

      expect(manager.increment('count', 'global')).toBe(6)
      expect(manager.increment('count', 'global', 10)).toBe(16)
    })

    it('should decrement number variables', () => {
      manager.set('count', 'global', 10)

      expect(manager.decrement('count', 'global')).toBe(9)
      expect(manager.decrement('count', 'global', 5)).toBe(4)
    })

    it('should toggle boolean variables', () => {
      manager.set('flag', 'global', false)

      expect(manager.toggle('flag', 'global')).toBe(true)
      expect(manager.toggle('flag', 'global')).toBe(false)
    })

    it('should push to array variables', () => {
      manager.set('items', 'global', ['a', 'b'])

      const result = manager.push('items', 'global', 'c')
      expect(result).toEqual(['a', 'b', 'c'])
      expect(manager.get('items', 'global')).toEqual(['a', 'b', 'c'])
    })

    it('should pop from array variables', () => {
      manager.set('items', 'global', ['a', 'b', 'c'])

      expect(manager.pop('items', 'global')).toBe('c')
      expect(manager.get('items', 'global')).toEqual(['a', 'b'])
    })
  })

  describe('watching', () => {
    it('should notify watchers on value change', () => {
      const callback = vi.fn()
      manager.watch('test', 'global', callback)

      manager.set('test', 'global', 'value1')
      manager.set('test', 'global', 'value2')

      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: 'test',
          oldValue: 'value1',
          newValue: 'value2',
        })
      )
    })

    it('should not notify if value unchanged', () => {
      const callback = vi.fn()
      manager.set('test', 'global', 'same')
      manager.watch('test', 'global', callback)

      manager.set('test', 'global', 'same')

      expect(callback).not.toHaveBeenCalled()
    })

    it('should unsubscribe watchers', () => {
      const callback = vi.fn()
      const unsub = manager.watch('test', 'global', callback)

      manager.set('test', 'global', 'value1')
      unsub()
      manager.set('test', 'global', 'value2')

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should watch all variables in a scope', () => {
      const callback = vi.fn()
      manager.watchScope('global', callback)

      manager.set('var1', 'global', 'value1')
      manager.set('var2', 'global', 'value2')

      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  describe('serialization', () => {
    it('should serialize all variables', () => {
      manager.set('globalVar', 'global', 'global_value')
      manager.setCurrentScene('scene1')
      manager.set('sceneVar', 'scene', 'scene_value')
      manager.set('nodeVar', 'node', 'node_value', 'node1')

      const serialized = manager.serialize()

      expect(serialized.global.globalVar).toBe('global_value')
      expect(serialized.scenes.scene1.sceneVar).toBe('scene_value')
      expect(serialized.nodes.node1.nodeVar).toBe('node_value')
    })

    it('should deserialize variables', () => {
      const data = {
        global: { restoredGlobal: 'restored' },
        scenes: { scene1: { restoredScene: 'restored' } },
        nodes: { node1: { restoredNode: 'restored' } },
        definitions: [
          { name: 'defined', type: 'string' as const, scope: 'global' as const, default: 'default' }
        ],
      }

      manager.deserialize(data)
      manager.setCurrentScene('scene1')

      expect(manager.get('restoredGlobal', 'global')).toBe('restored')
      expect(manager.get('restoredScene', 'scene')).toBe('restored')
      expect(manager.get('restoredNode', 'node', 'node1')).toBe('restored')
      expect(manager.getDefinition('defined', 'global')?.default).toBe('default')
    })
  })

  describe('context building', () => {
    it('should build merged context', () => {
      manager.set('globalVar', 'global', 'global')
      manager.setCurrentScene('scene1')
      manager.set('sceneVar', 'scene', 'scene')
      manager.set('nodeVar', 'node', 'node', 'node1')
      manager.set('override', 'global', 'global')
      manager.set('override', 'scene', 'scene')
      manager.set('override', 'node', 'node', 'node1')

      const context = manager.buildContext('node1')

      expect(context.globalVar).toBe('global')
      expect(context.sceneVar).toBe('scene')
      expect(context.nodeVar).toBe('node')
      expect(context.override).toBe('node') // Node overrides scene and global
    })
  })

  describe('builtin variables', () => {
    it('should have time-related builtins', () => {
      const defs = manager.getDefinitions('global')

      expect(defs.find(d => d.name === 'time')).toBeDefined()
      expect(defs.find(d => d.name === 'deltaTime')).toBeDefined()
      expect(defs.find(d => d.name === 'frameCount')).toBeDefined()
    })

    it('should have input-related builtins', () => {
      const defs = manager.getDefinitions('global')

      expect(defs.find(d => d.name === 'mouseX')).toBeDefined()
      expect(defs.find(d => d.name === 'mouseY')).toBeDefined()
      expect(defs.find(d => d.name === 'mouseDown')).toBeDefined()
    })

    it('should have game state builtins', () => {
      const defs = manager.getDefinitions('global')

      expect(defs.find(d => d.name === 'paused')).toBeDefined()
      expect(defs.find(d => d.name === 'debug')).toBeDefined()
    })
  })
})

describe('convenience functions', () => {
  it('should work with global variables', () => {
    setGlobal('testVar', 'testValue')
    expect(getGlobal('testVar')).toBe('testValue')
  })
})
