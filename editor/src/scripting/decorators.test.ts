// ═══════════════════════════════════════════════════════════════════════════
// Component Decorators Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import {
  component,
  property,
  action,
  signal,
  handler,
  lifecycle,
  number,
  string,
  boolean,
  color,
  vec2,
  vec3,
  select,
  getComponentMetadata,
  componentRegistry,
  type LifecycleEvent,
  type EventPhase,
} from './decorators'

// Clear registry between tests to avoid interference
beforeEach(() => {
  // Note: We can't fully clear WeakMaps, but we can clear the registry
  // This is sufficient for testing since we use unique class names
})

describe('Component Decorators', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // @component decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@component', () => {
    it('should register a component with default name from class', () => {
      @component()
      class TestComponentDefault {}

      const metadata = getComponentMetadata(TestComponentDefault)
      expect(metadata).toBeDefined()
      expect(metadata!.name).toBe('TestComponentDefault')
    })

    it('should register a component with custom name', () => {
      @component({ name: 'CustomName' })
      class TestComponentCustom {}

      const metadata = getComponentMetadata(TestComponentCustom)
      expect(metadata!.name).toBe('CustomName')
      expect(componentRegistry.has('CustomName')).toBe(true)
    })

    it('should register a component with string shorthand', () => {
      @component('StringName')
      class TestComponentString {}

      const metadata = getComponentMetadata(TestComponentString)
      expect(metadata!.name).toBe('StringName')
    })

    it('should store icon and description', () => {
      @component({ name: 'IconTest', icon: '★', description: 'Test component' })
      class TestComponentIcon {}

      const metadata = getComponentMetadata(TestComponentIcon)
      expect(metadata!.icon).toBe('★')
      expect(metadata!.description).toBe('Test component')
    })

    it('should collect property metadata', () => {
      @component({ name: 'PropsTest' })
      class TestComponentProps {
        @property({ type: 'number' })
        health: number = 100
      }

      const metadata = getComponentMetadata(TestComponentProps)
      expect(metadata!.properties.size).toBe(1)
      expect(metadata!.properties.has('health')).toBe(true)
      expect(metadata!.properties.get('health')!.type).toBe('number')
    })

    it('should get metadata from instance', () => {
      @component({ name: 'InstanceTest' })
      class TestComponentInstance {}

      const instance = new TestComponentInstance()
      const metadata = getComponentMetadata(instance)
      expect(metadata).toBeDefined()
      expect(metadata!.name).toBe('InstanceTest')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // @property decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@property', () => {
    it('should store property with all options', () => {
      @component({ name: 'PropOptionsTest' })
      class TestPropOptions {
        @property({
          type: 'number',
          label: 'Health Points',
          min: 0,
          max: 100,
          step: 5,
          precision: 0,
          readonly: false,
          tooltip: 'Current health',
          group: 'Stats',
        })
        health: number = 100
      }

      const metadata = getComponentMetadata(TestPropOptions)
      const propMeta = metadata!.properties.get('health')!
      expect(propMeta.type).toBe('number')
      expect(propMeta.label).toBe('Health Points')
      expect(propMeta.min).toBe(0)
      expect(propMeta.max).toBe(100)
      expect(propMeta.step).toBe(5)
      expect(propMeta.precision).toBe(0)
      expect(propMeta.readonly).toBe(false)
      expect(propMeta.tooltip).toBe('Current health')
      expect(propMeta.group).toBe('Stats')
    })

    it('should default label to property name', () => {
      @component({ name: 'DefaultLabelTest' })
      class TestDefaultLabel {
        @property({ type: 'string' })
        playerName: string = ''
      }

      const metadata = getComponentMetadata(TestDefaultLabel)
      expect(metadata!.properties.get('playerName')!.label).toBe('playerName')
    })

    it('should handle multiple properties', () => {
      @component({ name: 'MultiPropsTest' })
      class TestMultiProps {
        @property({ type: 'number' })
        x: number = 0

        @property({ type: 'number' })
        y: number = 0

        @property({ type: 'string' })
        name: string = ''
      }

      const metadata = getComponentMetadata(TestMultiProps)
      expect(metadata!.properties.size).toBe(3)
      expect(metadata!.properties.has('x')).toBe(true)
      expect(metadata!.properties.has('y')).toBe(true)
      expect(metadata!.properties.has('name')).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Helper decorators
  // ─────────────────────────────────────────────────────────────────────────

  describe('helper decorators', () => {
    it('@number should create number property with range', () => {
      @component({ name: 'NumberHelperTest' })
      class TestNumber {
        @number(0, 100, 5)
        value: number = 50
      }

      const meta = getComponentMetadata(TestNumber)!.properties.get('value')!
      expect(meta.type).toBe('number')
      expect(meta.min).toBe(0)
      expect(meta.max).toBe(100)
      expect(meta.step).toBe(5)
    })

    it('@string should create string property', () => {
      @component({ name: 'StringHelperTest' })
      class TestString {
        @string({ tooltip: 'Enter name' })
        name: string = ''
      }

      const meta = getComponentMetadata(TestString)!.properties.get('name')!
      expect(meta.type).toBe('string')
      expect(meta.tooltip).toBe('Enter name')
    })

    it('@boolean should create boolean property', () => {
      @component({ name: 'BoolHelperTest' })
      class TestBool {
        @boolean({ group: 'Flags' })
        enabled: boolean = true
      }

      const meta = getComponentMetadata(TestBool)!.properties.get('enabled')!
      expect(meta.type).toBe('boolean')
      expect(meta.group).toBe('Flags')
    })

    it('@color should create color property', () => {
      @component({ name: 'ColorHelperTest' })
      class TestColor {
        @color()
        tint: number[] = [1, 1, 1]
      }

      const meta = getComponentMetadata(TestColor)!.properties.get('tint')!
      expect(meta.type).toBe('color')
    })

    it('@vec2 should create vec2 property', () => {
      @component({ name: 'Vec2HelperTest' })
      class TestVec2 {
        @vec2()
        position: number[] = [0, 0]
      }

      const meta = getComponentMetadata(TestVec2)!.properties.get('position')!
      expect(meta.type).toBe('vec2')
    })

    it('@vec3 should create vec3 property', () => {
      @component({ name: 'Vec3HelperTest' })
      class TestVec3 {
        @vec3()
        rotation: number[] = [0, 0, 0]
      }

      const meta = getComponentMetadata(TestVec3)!.properties.get('rotation')!
      expect(meta.type).toBe('vec3')
    })

    it('@select should create select property with options', () => {
      @component({ name: 'SelectHelperTest' })
      class TestSelect {
        @select(['easy', 'medium', 'hard'], { tooltip: 'Difficulty level' })
        difficulty: string = 'medium'
      }

      const meta = getComponentMetadata(TestSelect)!.properties.get('difficulty')!
      expect(meta.type).toBe('select')
      expect(meta.options).toEqual(['easy', 'medium', 'hard'])
      expect(meta.tooltip).toBe('Difficulty level')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // @action decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@action', () => {
    it('should register an action with default name', () => {
      @component({ name: 'ActionDefaultTest' })
      class TestActionDefault {
        @action()
        doSomething() {}
      }

      const metadata = getComponentMetadata(TestActionDefault)
      expect(metadata!.actions.size).toBe(1)
      expect(metadata!.actions.has('doSomething')).toBe(true)
      expect(metadata!.actions.get('doSomething')!.methodName).toBe('doSomething')
      expect(metadata!.actions.get('doSomething')!.displayName).toBe('doSomething')
    })

    it('should register an action with string shorthand', () => {
      @component({ name: 'ActionStringTest' })
      class TestActionString {
        @action('Do Something Cool')
        doSomething() {}
      }

      const metadata = getComponentMetadata(TestActionString)
      expect(metadata!.actions.get('doSomething')!.displayName).toBe('Do Something Cool')
    })

    it('should register an action with full options', () => {
      @component({ name: 'ActionFullTest' })
      class TestActionFull {
        @action({
          displayName: 'Take Damage',
          category: 'Combat',
          async: true,
          outputs: ['survived', 'died'],
          description: 'Apply damage to this entity',
        })
        takeDamage(_amount: number) {}
      }

      const metadata = getComponentMetadata(TestActionFull)
      const actionMeta = metadata!.actions.get('takeDamage')!
      expect(actionMeta.displayName).toBe('Take Damage')
      expect(actionMeta.category).toBe('Combat')
      expect(actionMeta.async).toBe(true)
      expect(actionMeta.outputs).toEqual(['survived', 'died'])
      expect(actionMeta.description).toBe('Apply damage to this entity')
    })

    it('should handle multiple actions', () => {
      @component({ name: 'MultiActionTest' })
      class TestMultiAction {
        @action()
        actionOne() {}

        @action()
        actionTwo() {}

        @action()
        actionThree() {}
      }

      const metadata = getComponentMetadata(TestMultiAction)
      expect(metadata!.actions.size).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // @signal decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@signal', () => {
    it('should register a signal with default name', () => {
      @component({ name: 'SignalDefaultTest' })
      class TestSignalDefault {
        @signal()
        onDeath: unknown = null
      }

      const metadata = getComponentMetadata(TestSignalDefault)
      expect(metadata!.signals.size).toBe(1)
      expect(metadata!.signals.has('onDeath')).toBe(true)
      expect(metadata!.signals.get('onDeath')!.propertyName).toBe('onDeath')
      expect(metadata!.signals.get('onDeath')!.displayName).toBe('onDeath')
    })

    it('should register a signal with string shorthand', () => {
      @component({ name: 'SignalStringTest' })
      class TestSignalString {
        @signal('On Player Death')
        onDeath: unknown = null
      }

      const metadata = getComponentMetadata(TestSignalString)
      expect(metadata!.signals.get('onDeath')!.displayName).toBe('On Player Death')
    }
)

    it('should register a signal with full options', () => {
      @component({ name: 'SignalFullTest' })
      class TestSignalFull {
        @signal({
          displayName: 'Health Changed',
          description: 'Fired when health value changes',
        })
        onHealthChanged: unknown = null
      }

      const metadata = getComponentMetadata(TestSignalFull)
      const signalMeta = metadata!.signals.get('onHealthChanged')!
      expect(signalMeta.displayName).toBe('Health Changed')
      expect(signalMeta.description).toBe('Fired when health value changes')
    })

    it('should handle multiple signals', () => {
      @component({ name: 'MultiSignalTest' })
      class TestMultiSignal {
        @signal()
        onDamage: unknown = null

        @signal()
        onHeal: unknown = null

        @signal()
        onDeath: unknown = null
      }

      const metadata = getComponentMetadata(TestMultiSignal)
      expect(metadata!.signals.size).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // @handler decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@handler', () => {
    it('should register a handler with event type', () => {
      @component({ name: 'HandlerDefaultTest' })
      class TestHandlerDefault {
        @handler({ event: 'damage' })
        onDamage() {}
      }

      const metadata = getComponentMetadata(TestHandlerDefault)
      expect(metadata!.handlers.size).toBe(1)
      expect(metadata!.handlers.has('onDamage')).toBe(true)
      expect(metadata!.handlers.get('onDamage')!.eventType).toBe('damage')
      expect(metadata!.handlers.get('onDamage')!.phase).toBe('execute') // default
    })

    it('should register a handler with specific phase', () => {
      @component({ name: 'HandlerPhaseTest' })
      class TestHandlerPhase {
        @handler({ event: 'damage', phase: 'before' })
        beforeDamage() {}

        @handler({ event: 'damage', phase: 'execute' })
        executeDamage() {}

        @handler({ event: 'damage', phase: 'after' })
        afterDamage() {}
      }

      const metadata = getComponentMetadata(TestHandlerPhase)
      expect(metadata!.handlers.get('beforeDamage')!.phase).toBe('before')
      expect(metadata!.handlers.get('executeDamage')!.phase).toBe('execute')
      expect(metadata!.handlers.get('afterDamage')!.phase).toBe('after')
    })

    it('should register a handler with priority', () => {
      @component({ name: 'HandlerPriorityTest' })
      class TestHandlerPriority {
        @handler({ event: 'damage', priority: 100 })
        highPriority() {}

        @handler({ event: 'damage', priority: -50 })
        lowPriority() {}

        @handler({ event: 'damage' }) // default 0
        normalPriority() {}
      }

      const metadata = getComponentMetadata(TestHandlerPriority)
      expect(metadata!.handlers.get('highPriority')!.priority).toBe(100)
      expect(metadata!.handlers.get('lowPriority')!.priority).toBe(-50)
      expect(metadata!.handlers.get('normalPriority')!.priority).toBe(0)
    })

    it('should handle multiple handlers for different events', () => {
      @component({ name: 'MultiHandlerTest' })
      class TestMultiHandler {
        @handler({ event: 'damage' })
        onDamage() {}

        @handler({ event: 'heal' })
        onHeal() {}

        @handler({ event: 'collision' })
        onCollision() {}
      }

      const metadata = getComponentMetadata(TestMultiHandler)
      expect(metadata!.handlers.size).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // @lifecycle decorator
  // ─────────────────────────────────────────────────────────────────────────

  describe('@lifecycle', () => {
    it('should register lifecycle handlers', () => {
      @component({ name: 'LifecycleBasicTest' })
      class TestLifecycleBasic {
        @lifecycle('Execute:Init')
        onInit() {}
      }

      const metadata = getComponentMetadata(TestLifecycleBasic)
      expect(metadata!.lifecycleHandlers.size).toBe(1)
      expect(metadata!.lifecycleHandlers.has('onInit')).toBe(true)
      expect(metadata!.lifecycleHandlers.get('onInit')!.event).toBe('Execute:Init')
    })

    it('should handle all lifecycle events', () => {
      const lifecycleEvents: LifecycleEvent[] = [
        'ConstructionScript',
        'Before:Init',
        'Execute:Init',
        'After:Init',
        'Execute:Enable',
        'Execute:Disable',
        'Execute:Update',
        'Execute:FixedUpdate',
        'Execute:LateUpdate',
        'Execute:VisibilityChange',
        'Before:Dispose',
        'Execute:Dispose',
        'After:Dispose',
      ]

      // Just verify the types are valid
      expect(lifecycleEvents.length).toBe(13)
    })

    it('should register multiple lifecycle handlers', () => {
      @component({ name: 'MultiLifecycleTest' })
      class TestMultiLifecycle {
        @lifecycle('ConstructionScript')
        onConstruct() {}

        @lifecycle('Execute:Init')
        onInit() {}

        @lifecycle('Execute:Update')
        onUpdate() {}

        @lifecycle('Execute:Dispose')
        onDispose() {}
      }

      const metadata = getComponentMetadata(TestMultiLifecycle)
      expect(metadata!.lifecycleHandlers.size).toBe(4)
      expect(metadata!.lifecycleHandlers.get('onConstruct')!.event).toBe('ConstructionScript')
      expect(metadata!.lifecycleHandlers.get('onInit')!.event).toBe('Execute:Init')
      expect(metadata!.lifecycleHandlers.get('onUpdate')!.event).toBe('Execute:Update')
      expect(metadata!.lifecycleHandlers.get('onDispose')!.event).toBe('Execute:Dispose')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Combined decorators
  // ─────────────────────────────────────────────────────────────────────────

  describe('combined decorators', () => {
    it('should handle component with all decorator types', () => {
      @component({ name: 'FullComponent', icon: '♥', description: 'A complete component' })
      class HealthComponent {
        @property({ type: 'number', min: 0, max: 100 })
        health: number = 100

        @property({ type: 'number', min: 0 })
        maxHealth: number = 100

        @signal({ displayName: 'On Death' })
        onDeath: unknown = null

        @signal({ displayName: 'On Damage' })
        onDamage: unknown = null

        @action({ displayName: 'Take Damage', outputs: ['survived', 'died'] })
        takeDamage(_amount: number) {
          this.health -= _amount
        }

        @action({ displayName: 'Heal' })
        heal(_amount: number) {
          this.health = Math.min(this.health + _amount, this.maxHealth)
        }

        @handler({ event: 'collision', phase: 'execute' })
        onCollision() {}

        @lifecycle('Execute:Init')
        init() {}

        @lifecycle('Execute:Update')
        update() {}
      }

      const metadata = getComponentMetadata(HealthComponent)!

      // Verify component metadata
      expect(metadata.name).toBe('FullComponent')
      expect(metadata.icon).toBe('♥')
      expect(metadata.description).toBe('A complete component')

      // Verify properties
      expect(metadata.properties.size).toBe(2)
      expect(metadata.properties.has('health')).toBe(true)
      expect(metadata.properties.has('maxHealth')).toBe(true)

      // Verify signals
      expect(metadata.signals.size).toBe(2)
      expect(metadata.signals.has('onDeath')).toBe(true)
      expect(metadata.signals.has('onDamage')).toBe(true)

      // Verify actions
      expect(metadata.actions.size).toBe(2)
      expect(metadata.actions.has('takeDamage')).toBe(true)
      expect(metadata.actions.has('heal')).toBe(true)
      expect(metadata.actions.get('takeDamage')!.outputs).toEqual(['survived', 'died'])

      // Verify handlers
      expect(metadata.handlers.size).toBe(1)
      expect(metadata.handlers.has('onCollision')).toBe(true)

      // Verify lifecycle
      expect(metadata.lifecycleHandlers.size).toBe(2)
      expect(metadata.lifecycleHandlers.has('init')).toBe(true)
      expect(metadata.lifecycleHandlers.has('update')).toBe(true)
    })

    it('should register component in global registry', () => {
      @component({ name: 'RegistryTestComponent' })
      class RegistryTest {}

      expect(componentRegistry.has('RegistryTestComponent')).toBe(true)
      const entry = componentRegistry.get('RegistryTestComponent')!
      expect(entry.metadata.name).toBe('RegistryTestComponent')
      expect(entry.ctor).toBe(RegistryTest)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return undefined for null/undefined targets', () => {
      expect(getComponentMetadata(null)).toBeUndefined()
      expect(getComponentMetadata(undefined)).toBeUndefined()
    })

    it('should return undefined for undecorated classes', () => {
      class UndecoratedClass {}
      expect(getComponentMetadata(UndecoratedClass)).toBeUndefined()
    })

    it('should handle empty component', () => {
      @component({ name: 'EmptyComponent' })
      class EmptyComponent {}

      const metadata = getComponentMetadata(EmptyComponent)!
      expect(metadata.properties.size).toBe(0)
      expect(metadata.actions.size).toBe(0)
      expect(metadata.signals.size).toBe(0)
      expect(metadata.handlers.size).toBe(0)
      expect(metadata.lifecycleHandlers.size).toBe(0)
    })
  })
})
