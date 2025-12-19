// ═══════════════════════════════════════════════════════════════════════════
// Expression Evaluator Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import {
  evaluateExpression,
  compileExpression,
  evaluateAST,
  evaluateCached,
  clearExpressionCache,
  getExpressionCacheStats,
  isExprWrapper,
  resolveValue,
  ExprContext,
  Vec2,
} from './expressions'
import { SeededRandom } from './lifecycle'

describe('Expression Evaluator', () => {
  const createContext = (variables: Record<string, unknown> = {}): ExprContext => ({
    variables: variables as ExprContext['variables'],
  })

  describe('literals', () => {
    it('should evaluate numbers', () => {
      expect(evaluateExpression('42', createContext())).toBe(42)
      expect(evaluateExpression('3.14', createContext())).toBeCloseTo(3.14)
      expect(evaluateExpression('0.5', createContext())).toBe(0.5)
    })

    it('should evaluate strings', () => {
      expect(evaluateExpression('"hello"', createContext())).toBe('hello')
      expect(evaluateExpression("'world'", createContext())).toBe('world')
      expect(evaluateExpression('"with\\"quote"', createContext())).toBe('with"quote')
    })

    it('should evaluate booleans', () => {
      expect(evaluateExpression('true', createContext())).toBe(true)
      expect(evaluateExpression('false', createContext())).toBe(false)
    })

    it('should evaluate null', () => {
      expect(evaluateExpression('null', createContext())).toBe(null)
    })

    it('should evaluate arrays', () => {
      expect(evaluateExpression('[1, 2, 3]', createContext())).toEqual([1, 2, 3])
      expect(evaluateExpression('["a", "b"]', createContext())).toEqual(['a', 'b'])
      expect(evaluateExpression('[]', createContext())).toEqual([])
    })
  })

  describe('variables', () => {
    it('should resolve simple variables', () => {
      const ctx = createContext({ x: 10, name: 'test' })
      expect(evaluateExpression('x', ctx)).toBe(10)
      expect(evaluateExpression('name', ctx)).toBe('test')
    })

    it('should access object properties', () => {
      const ctx = createContext({
        player: { health: 100, position: { x: 5, y: 10 } },
      })
      expect(evaluateExpression('player.health', ctx)).toBe(100)
      expect(evaluateExpression('player.position.x', ctx)).toBe(5)
    })

    it('should access array elements', () => {
      const ctx = createContext({
        items: ['sword', 'shield', 'potion'],
        index: 1,
      })
      expect(evaluateExpression('items[0]', ctx)).toBe('sword')
      expect(evaluateExpression('items[index]', ctx)).toBe('shield')
    })

    it('should throw on undefined variables', () => {
      expect(() => evaluateExpression('undefinedVar', createContext())).toThrow('Undefined variable')
    })

    it('should access self reference', () => {
      const ctx: ExprContext = {
        variables: {},
        self: { id: 'player1', health: 50 },
      }
      expect(evaluateExpression('self.id', ctx)).toBe('player1')
      expect(evaluateExpression('self.health', ctx)).toBe(50)
    })
  })

  describe('arithmetic', () => {
    it('should evaluate addition', () => {
      expect(evaluateExpression('2 + 3', createContext())).toBe(5)
      expect(evaluateExpression('10 + 20 + 30', createContext())).toBe(60)
    })

    it('should evaluate subtraction', () => {
      expect(evaluateExpression('10 - 3', createContext())).toBe(7)
    })

    it('should evaluate multiplication', () => {
      expect(evaluateExpression('4 * 5', createContext())).toBe(20)
    })

    it('should evaluate division', () => {
      expect(evaluateExpression('20 / 4', createContext())).toBe(5)
    })

    it('should evaluate modulo', () => {
      expect(evaluateExpression('17 % 5', createContext())).toBe(2)
    })

    it('should respect operator precedence', () => {
      expect(evaluateExpression('2 + 3 * 4', createContext())).toBe(14)
      expect(evaluateExpression('(2 + 3) * 4', createContext())).toBe(20)
      expect(evaluateExpression('10 - 6 / 2', createContext())).toBe(7)
    })

    it('should evaluate unary minus', () => {
      expect(evaluateExpression('-5', createContext())).toBe(-5)
      expect(evaluateExpression('10 + -3', createContext())).toBe(7)
    })

    it('should concatenate strings with +', () => {
      expect(evaluateExpression('"hello" + " " + "world"', createContext())).toBe('hello world')
      expect(evaluateExpression('"count: " + 42', createContext())).toBe('count: 42')
    })
  })

  describe('comparison', () => {
    it('should evaluate less than', () => {
      expect(evaluateExpression('3 < 5', createContext())).toBe(true)
      expect(evaluateExpression('5 < 3', createContext())).toBe(false)
    })

    it('should evaluate greater than', () => {
      expect(evaluateExpression('5 > 3', createContext())).toBe(true)
      expect(evaluateExpression('3 > 5', createContext())).toBe(false)
    })

    it('should evaluate less than or equal', () => {
      expect(evaluateExpression('3 <= 5', createContext())).toBe(true)
      expect(evaluateExpression('5 <= 5', createContext())).toBe(true)
      expect(evaluateExpression('6 <= 5', createContext())).toBe(false)
    })

    it('should evaluate greater than or equal', () => {
      expect(evaluateExpression('5 >= 3', createContext())).toBe(true)
      expect(evaluateExpression('5 >= 5', createContext())).toBe(true)
      expect(evaluateExpression('4 >= 5', createContext())).toBe(false)
    })

    it('should evaluate equality', () => {
      expect(evaluateExpression('5 == 5', createContext())).toBe(true)
      expect(evaluateExpression('5 == 6', createContext())).toBe(false)
      expect(evaluateExpression('"a" == "a"', createContext())).toBe(true)
    })

    it('should evaluate inequality', () => {
      expect(evaluateExpression('5 != 6', createContext())).toBe(true)
      expect(evaluateExpression('5 != 5', createContext())).toBe(false)
    })
  })

  describe('logical operators', () => {
    it('should evaluate AND', () => {
      expect(evaluateExpression('true && true', createContext())).toBe(true)
      expect(evaluateExpression('true && false', createContext())).toBe(false)
      expect(evaluateExpression('false && true', createContext())).toBe(false)
    })

    it('should evaluate OR', () => {
      expect(evaluateExpression('true || false', createContext())).toBe(true)
      expect(evaluateExpression('false || true', createContext())).toBe(true)
      expect(evaluateExpression('false || false', createContext())).toBe(false)
    })

    it('should evaluate NOT', () => {
      expect(evaluateExpression('!true', createContext())).toBe(false)
      expect(evaluateExpression('!false', createContext())).toBe(true)
    })

    it('should short-circuit AND', () => {
      // If left is false, right should not be evaluated
      const ctx = createContext({ a: false })
      expect(evaluateExpression('a && undefinedVar', ctx)).toBe(false)
    })

    it('should short-circuit OR', () => {
      // If left is true, right should not be evaluated
      const ctx = createContext({ a: true })
      expect(evaluateExpression('a || undefinedVar', ctx)).toBe(true)
    })
  })

  describe('conditional (ternary)', () => {
    it('should evaluate ternary expression', () => {
      expect(evaluateExpression('true ? 1 : 2', createContext())).toBe(1)
      expect(evaluateExpression('false ? 1 : 2', createContext())).toBe(2)
    })

    it('should work with complex conditions', () => {
      const ctx = createContext({ health: 30, maxHealth: 100 })
      expect(evaluateExpression('health > 50 ? "healthy" : "injured"', ctx)).toBe('injured')
    })
  })

  describe('built-in functions', () => {
    describe('math', () => {
      it('should evaluate abs', () => {
        expect(evaluateExpression('abs(-5)', createContext())).toBe(5)
        expect(evaluateExpression('abs(5)', createContext())).toBe(5)
      })

      it('should evaluate sign', () => {
        expect(evaluateExpression('sign(-5)', createContext())).toBe(-1)
        expect(evaluateExpression('sign(5)', createContext())).toBe(1)
        expect(evaluateExpression('sign(0)', createContext())).toBe(0)
      })

      it('should evaluate floor/ceil/round', () => {
        expect(evaluateExpression('floor(3.7)', createContext())).toBe(3)
        expect(evaluateExpression('ceil(3.2)', createContext())).toBe(4)
        expect(evaluateExpression('round(3.5)', createContext())).toBe(4)
      })

      it('should evaluate min/max', () => {
        expect(evaluateExpression('min(3, 7, 2)', createContext())).toBe(2)
        expect(evaluateExpression('max(3, 7, 2)', createContext())).toBe(7)
      })

      it('should evaluate sqrt/pow', () => {
        expect(evaluateExpression('sqrt(16)', createContext())).toBe(4)
        expect(evaluateExpression('pow(2, 3)', createContext())).toBe(8)
      })
    })

    describe('trigonometry', () => {
      it('should evaluate sin/cos', () => {
        expect(evaluateExpression('sin(0)', createContext())).toBe(0)
        expect(evaluateExpression('cos(0)', createContext())).toBe(1)
      })

      it('should evaluate atan2', () => {
        expect(evaluateExpression('atan2(1, 0)', createContext())).toBeCloseTo(Math.PI / 2)
      })
    })

    describe('interpolation', () => {
      it('should evaluate clamp', () => {
        expect(evaluateExpression('clamp(15, 0, 10)', createContext())).toBe(10)
        expect(evaluateExpression('clamp(-5, 0, 10)', createContext())).toBe(0)
        expect(evaluateExpression('clamp(5, 0, 10)', createContext())).toBe(5)
      })

      it('should evaluate lerp', () => {
        expect(evaluateExpression('lerp(0, 100, 0.5)', createContext())).toBe(50)
        expect(evaluateExpression('lerp(0, 100, 0)', createContext())).toBe(0)
        expect(evaluateExpression('lerp(0, 100, 1)', createContext())).toBe(100)
      })
    })

    describe('vectors', () => {
      it('should evaluate distance', () => {
        const ctx = createContext({ a: [0, 0], b: [3, 4] })
        expect(evaluateExpression('distance(a, b)', ctx)).toBe(5)
      })

      it('should evaluate normalize', () => {
        const ctx = createContext({ v: [3, 4] })
        const result = evaluateExpression('normalize(v)', ctx) as Vec2
        expect(result[0]).toBeCloseTo(0.6)
        expect(result[1]).toBeCloseTo(0.8)
      })

      it('should evaluate dot', () => {
        const ctx = createContext({ a: [1, 0], b: [0, 1] })
        expect(evaluateExpression('dot(a, b)', ctx)).toBe(0)

        const ctx2 = createContext({ a: [1, 2], b: [3, 4] })
        expect(evaluateExpression('dot(a, b)', ctx2)).toBe(11)
      })

      it('should create vec2', () => {
        expect(evaluateExpression('vec2(5, 10)', createContext())).toEqual([5, 10])
      })
    })

    describe('array/string', () => {
      it('should evaluate len', () => {
        const ctx = createContext({ arr: [1, 2, 3], str: 'hello' })
        expect(evaluateExpression('len(arr)', ctx)).toBe(3)
        expect(evaluateExpression('len(str)', ctx)).toBe(5)
      })

      it('should evaluate concat', () => {
        expect(evaluateExpression('concat("a", "b", "c")', createContext())).toBe('abc')
      })

      it('should evaluate contains', () => {
        expect(evaluateExpression('contains("hello world", "world")', createContext())).toBe(true)
        expect(evaluateExpression('contains("hello", "xyz")', createContext())).toBe(false)
      })
    })

    describe('type conversion', () => {
      it('should evaluate int', () => {
        expect(evaluateExpression('int(3.7)', createContext())).toBe(3)
        expect(evaluateExpression('int(-3.7)', createContext())).toBe(-3)
      })

      it('should evaluate float', () => {
        expect(evaluateExpression('float("3.14")', createContext())).toBeCloseTo(3.14)
      })

      it('should evaluate str', () => {
        expect(evaluateExpression('str(42)', createContext())).toBe('42')
      })

      it('should evaluate typeof', () => {
        expect(evaluateExpression('typeof(42)', createContext())).toBe('number')
        expect(evaluateExpression('typeof("hi")', createContext())).toBe('string')
        expect(evaluateExpression('typeof(true)', createContext())).toBe('boolean')
        expect(evaluateExpression('typeof(null)', createContext())).toBe('null')
        expect(evaluateExpression('typeof([1,2])', createContext())).toBe('array')
      })
    })

    describe('random', () => {
      it('should use seeded random when provided', () => {
        const ctx1: ExprContext = {
          variables: {},
          random: new SeededRandom(12345),
        }
        const ctx2: ExprContext = {
          variables: {},
          random: new SeededRandom(12345),
        }

        const val1 = evaluateExpression('random(0, 100)', ctx1)
        const val2 = evaluateExpression('random(0, 100)', ctx2)
        expect(val1).toBe(val2)
      })

      it('should respect range', () => {
        for (let i = 0; i < 20; i++) {
          const val = evaluateExpression('random(10, 20)', createContext()) as number
          expect(val).toBeGreaterThanOrEqual(10)
          expect(val).toBeLessThan(20)
        }
      })

      it('should evaluate randomInt', () => {
        const ctx: ExprContext = {
          variables: {},
          random: new SeededRandom(42),
        }
        const val = evaluateExpression('randomInt(0, 10)', ctx) as number
        expect(Number.isInteger(val)).toBe(true)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(10)
      })
    })
  })

  describe('complex expressions', () => {
    it('should evaluate damage calculation', () => {
      const ctx = createContext({
        baseDamage: 50,
        armor: 20,
        critMultiplier: 1.5,
        isCrit: 1,
      })
      const expr = 'baseDamage * (1 + critMultiplier * isCrit) * (1 - armor / 100)'
      expect(evaluateExpression(expr, ctx)).toBe(100)
    })

    it('should evaluate patrol index cycling', () => {
      const ctx = createContext({
        currentIndex: 2,
        patrolPoints: [[0, 0], [10, 0], [10, 10], [0, 10]],
      })
      const expr = '(currentIndex + 1) % len(patrolPoints)'
      expect(evaluateExpression(expr, ctx)).toBe(3)

      ctx.variables.currentIndex = 3
      expect(evaluateExpression(expr, ctx)).toBe(0)
    })

    it('should evaluate health bar percentage', () => {
      const ctx = createContext({ health: 75, maxHealth: 100 })
      expect(evaluateExpression('health / maxHealth * 100', ctx)).toBe(75)
    })

    it('should evaluate distance check', () => {
      const ctx = createContext({
        self: { position: [0, 0] },
        target: { position: [3, 4] },
        attackRange: 6,
      })
      ctx.self = ctx.variables.self as Record<string, unknown>

      const expr = 'distance(self.position, target.position) < attackRange'
      expect(evaluateExpression(expr, ctx)).toBe(true)
    })
  })

  describe('compilation and caching', () => {
    beforeEach(() => {
      clearExpressionCache()
    })

    it('should compile and evaluate separately', () => {
      const ast = compileExpression('x + y')
      const ctx = createContext({ x: 10, y: 20 })
      expect(evaluateAST(ast, ctx)).toBe(30)

      ctx.variables.x = 5
      expect(evaluateAST(ast, ctx)).toBe(25)
    })

    it('should cache compiled expressions', () => {
      const ctx = createContext({ x: 10 })

      evaluateCached('x * 2', ctx)
      evaluateCached('x * 2', ctx)

      const stats = getExpressionCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.expressions).toContain('x * 2')
    })

    it('should clear cache', () => {
      evaluateCached('1 + 1', createContext())
      expect(getExpressionCacheStats().size).toBe(1)

      clearExpressionCache()
      expect(getExpressionCacheStats().size).toBe(0)
    })
  })

  describe('expression wrappers', () => {
    it('should detect expression wrappers', () => {
      expect(isExprWrapper({ $expr: 'x + 1' })).toBe(true)
      expect(isExprWrapper({ x: 1 })).toBe(false)
      expect(isExprWrapper('x + 1')).toBe(false)
      expect(isExprWrapper(null)).toBe(false)
    })

    it('should resolve expression wrappers', () => {
      const ctx = createContext({ x: 10 })

      expect(resolveValue({ $expr: 'x * 2' }, ctx)).toBe(20)
      expect(resolveValue(42, ctx)).toBe(42)
      expect(resolveValue('plain string', ctx)).toBe('plain string')
    })
  })

  describe('error handling', () => {
    it('should throw on syntax errors', () => {
      expect(() => evaluateExpression('1 +', createContext())).toThrow()
      expect(() => evaluateExpression('(1 + 2', createContext())).toThrow()
    })

    it('should throw on unknown functions', () => {
      expect(() => evaluateExpression('unknownFn()', createContext())).toThrow('Unknown function')
    })

    it('should throw on property access of null', () => {
      const ctx = createContext({ x: null })
      expect(() => evaluateExpression('x.foo', ctx)).toThrow('Cannot access property of null')
    })
  })
})
