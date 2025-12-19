// =============================================================================
// Node Executors Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  mathExecutors,
  vectorExecutors,
  stringExecutors,
  comparisonExecutors,
  arrayExecutors,
  executeNode,
  hasExecutor,
  registerExecutor,
  NodeExecutorContext,
} from './nodeExecutors'

const createContext = (overrides: Partial<NodeExecutorContext> = {}): NodeExecutorContext => ({
  nodeId: 'test-node',
  variables: {},
  ...overrides,
})

describe('Math Executors', () => {
  const ctx = createContext()

  it('should clamp values', () => {
    expect(mathExecutors['clamp']({ value: 5, min: 0, max: 10 }, ctx)).toBe(5)
    expect(mathExecutors['clamp']({ value: -5, min: 0, max: 10 }, ctx)).toBe(0)
    expect(mathExecutors['clamp']({ value: 15, min: 0, max: 10 }, ctx)).toBe(10)
  })

  it('should lerp between values', () => {
    expect(mathExecutors['lerp']({ a: 0, b: 10, t: 0 }, ctx)).toBe(0)
    expect(mathExecutors['lerp']({ a: 0, b: 10, t: 0.5 }, ctx)).toBe(5)
    expect(mathExecutors['lerp']({ a: 0, b: 10, t: 1 }, ctx)).toBe(10)
  })

  it('should inverse lerp', () => {
    expect(mathExecutors['inverse-lerp']({ a: 0, b: 10, value: 5 }, ctx)).toBe(0.5)
    expect(mathExecutors['inverse-lerp']({ a: 0, b: 10, value: 0 }, ctx)).toBe(0)
    expect(mathExecutors['inverse-lerp']({ a: 0, b: 10, value: 10 }, ctx)).toBe(1)
  })

  it('should remap values', () => {
    expect(mathExecutors['remap']({
      value: 5, inMin: 0, inMax: 10, outMin: 0, outMax: 100
    }, ctx)).toBe(50)
  })

  it('should compute absolute value', () => {
    expect(mathExecutors['abs']({ value: -5 }, ctx)).toBe(5)
    expect(mathExecutors['abs']({ value: 5 }, ctx)).toBe(5)
  })

  it('should compute sign', () => {
    expect(mathExecutors['sign']({ value: 10 }, ctx)).toBe(1)
    expect(mathExecutors['sign']({ value: -10 }, ctx)).toBe(-1)
    expect(mathExecutors['sign']({ value: 0 }, ctx)).toBe(0)
  })

  it('should floor and ceil', () => {
    expect(mathExecutors['floor']({ value: 5.7 }, ctx)).toBe(5)
    expect(mathExecutors['ceil']({ value: 5.3 }, ctx)).toBe(6)
  })

  it('should round', () => {
    expect(mathExecutors['round']({ value: 5.4 }, ctx)).toBe(5)
    expect(mathExecutors['round']({ value: 5.5 }, ctx)).toBe(6)
  })

  it('should compute trigonometry', () => {
    expect(mathExecutors['sin']({ angle: 0 }, ctx)).toBe(0)
    expect(mathExecutors['cos']({ angle: 0 }, ctx)).toBe(1)
    expect(mathExecutors['tan']({ angle: 0 }, ctx)).toBe(0)
  })

  it('should compute atan2', () => {
    expect(mathExecutors['atan2']({ y: 1, x: 0 }, ctx)).toBeCloseTo(Math.PI / 2)
  })

  it('should compute sqrt and pow', () => {
    expect(mathExecutors['sqrt']({ value: 16 }, ctx)).toBe(4)
    expect(mathExecutors['pow']({ base: 2, exponent: 3 }, ctx)).toBe(8)
  })

  it('should compute min and max', () => {
    expect(mathExecutors['min']({ a: 5, b: 10 }, ctx)).toBe(5)
    expect(mathExecutors['max']({ a: 5, b: 10 }, ctx)).toBe(10)
  })

  it('should compute modulo', () => {
    expect(mathExecutors['mod']({ a: 10, b: 3 }, ctx)).toBe(1)
  })

  it('should generate random range', () => {
    const result = mathExecutors['random-range']({ min: 0, max: 10 }, ctx) as number
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(10)
  })

  it('should generate random int', () => {
    const result = mathExecutors['random-int']({ min: 0, max: 5 }, ctx) as number
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(5)
  })
})

describe('Vector Executors', () => {
  const ctx = createContext()

  it('should create vectors', () => {
    expect(vectorExecutors['vec2-create']({ x: 3, y: 4 }, ctx)).toEqual({ x: 3, y: 4 })
  })

  it('should split vectors', () => {
    expect(vectorExecutors['vec2-split']({ vec: { x: 3, y: 4 } }, ctx)).toEqual({ x: 3, y: 4 })
  })

  it('should add vectors', () => {
    expect(vectorExecutors['vec2-add']({
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 }
    }, ctx)).toEqual({ x: 4, y: 6 })
  })

  it('should subtract vectors', () => {
    expect(vectorExecutors['vec2-sub']({
      a: { x: 5, y: 7 },
      b: { x: 2, y: 3 }
    }, ctx)).toEqual({ x: 3, y: 4 })
  })

  it('should multiply vectors', () => {
    expect(vectorExecutors['vec2-mul']({
      a: { x: 2, y: 3 },
      b: { x: 4, y: 5 }
    }, ctx)).toEqual({ x: 8, y: 15 })
  })

  it('should scale vectors', () => {
    expect(vectorExecutors['vec2-scale']({
      vec: { x: 2, y: 3 },
      scalar: 2
    }, ctx)).toEqual({ x: 4, y: 6 })
  })

  it('should normalize vectors', () => {
    const result = vectorExecutors['vec2-normalize']({ vec: { x: 3, y: 4 } }, ctx) as { x: number; y: number }
    expect(result.x).toBeCloseTo(0.6)
    expect(result.y).toBeCloseTo(0.8)
  })

  it('should handle zero vector normalization', () => {
    expect(vectorExecutors['vec2-normalize']({ vec: { x: 0, y: 0 } }, ctx)).toEqual({ x: 0, y: 0 })
  })

  it('should compute vector length', () => {
    expect(vectorExecutors['vec2-length']({ vec: { x: 3, y: 4 } }, ctx)).toBe(5)
  })

  it('should compute distance', () => {
    expect(vectorExecutors['vec2-distance']({
      a: { x: 0, y: 0 },
      b: { x: 3, y: 4 }
    }, ctx)).toBe(5)
  })

  it('should compute dot product', () => {
    expect(vectorExecutors['vec2-dot']({
      a: { x: 1, y: 0 },
      b: { x: 0, y: 1 }
    }, ctx)).toBe(0)
    expect(vectorExecutors['vec2-dot']({
      a: { x: 2, y: 3 },
      b: { x: 4, y: 5 }
    }, ctx)).toBe(23)
  })

  it('should compute angle', () => {
    expect(vectorExecutors['vec2-angle']({ vec: { x: 1, y: 0 } }, ctx)).toBe(0)
    expect(vectorExecutors['vec2-angle']({ vec: { x: 0, y: 1 } }, ctx)).toBeCloseTo(Math.PI / 2)
  })

  it('should rotate vectors', () => {
    const result = vectorExecutors['vec2-rotate']({
      vec: { x: 1, y: 0 },
      angle: Math.PI / 2
    }, ctx) as { x: number; y: number }
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
  })

  it('should lerp vectors', () => {
    expect(vectorExecutors['vec2-lerp']({
      a: { x: 0, y: 0 },
      b: { x: 10, y: 20 },
      t: 0.5
    }, ctx)).toEqual({ x: 5, y: 10 })
  })

  it('should reflect vectors', () => {
    const result = vectorExecutors['vec2-reflect']({
      vec: { x: 1, y: -1 },
      normal: { x: 0, y: 1 }
    }, ctx) as { x: number; y: number }
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(1)
  })
})

describe('String Executors', () => {
  const ctx = createContext()

  it('should concat strings', () => {
    expect(stringExecutors['concat']({ a: 'Hello', b: ' World' }, ctx)).toBe('Hello World')
  })

  it('should format with object values', () => {
    expect(stringExecutors['format']({
      template: 'Hello {name}!',
      values: { name: 'World' }
    }, ctx)).toBe('Hello World!')
  })

  it('should format with array values', () => {
    expect(stringExecutors['format']({
      template: '{0} + {1} = {2}',
      values: [1, 2, 3]
    }, ctx)).toBe('1 + 2 = 3')
  })

  it('should convert to string', () => {
    expect(stringExecutors['to-string']({ value: 123 }, ctx)).toBe('123')
    expect(stringExecutors['to-string']({ value: true }, ctx)).toBe('true')
  })

  it('should parse numbers', () => {
    expect(stringExecutors['parse-number']({ value: '123.45' }, ctx)).toBe(123.45)
    expect(stringExecutors['parse-number']({ value: 'abc' }, ctx)).toBe(0)
  })

  it('should parse integers', () => {
    expect(stringExecutors['parse-int']({ value: '123.45' }, ctx)).toBe(123)
    expect(stringExecutors['parse-int']({ value: 'abc' }, ctx)).toBe(0)
  })

  it('should get string length', () => {
    expect(stringExecutors['string-length']({ value: 'Hello' }, ctx)).toBe(5)
  })

  it('should get substring', () => {
    expect(stringExecutors['substring']({ value: 'Hello World', start: 0, end: 5 }, ctx)).toBe('Hello')
  })

  it('should replace in string', () => {
    expect(stringExecutors['string-replace']({
      value: 'Hello World',
      find: 'World',
      replace: 'Universe'
    }, ctx)).toBe('Hello Universe')
  })

  it('should split string', () => {
    expect(stringExecutors['string-split']({ value: 'a,b,c', delimiter: ',' }, ctx)).toEqual(['a', 'b', 'c'])
  })

  it('should join array', () => {
    expect(stringExecutors['string-join']({ values: ['a', 'b', 'c'], delimiter: ',' }, ctx)).toBe('a,b,c')
  })

  it('should change case', () => {
    expect(stringExecutors['to-uppercase']({ value: 'hello' }, ctx)).toBe('HELLO')
    expect(stringExecutors['to-lowercase']({ value: 'HELLO' }, ctx)).toBe('hello')
  })

  it('should trim whitespace', () => {
    expect(stringExecutors['string-trim']({ value: '  hello  ' }, ctx)).toBe('hello')
  })
})

describe('Comparison Executors', () => {
  const ctx = createContext()

  it('should compare equality', () => {
    expect(comparisonExecutors['equals']({ a: 5, b: 5 }, ctx)).toBe(true)
    expect(comparisonExecutors['equals']({ a: 5, b: 6 }, ctx)).toBe(false)
    expect(comparisonExecutors['not-equals']({ a: 5, b: 6 }, ctx)).toBe(true)
  })

  it('should compare greater/less', () => {
    expect(comparisonExecutors['greater-than']({ a: 5, b: 3 }, ctx)).toBe(true)
    expect(comparisonExecutors['less-than']({ a: 3, b: 5 }, ctx)).toBe(true)
    expect(comparisonExecutors['greater-equal']({ a: 5, b: 5 }, ctx)).toBe(true)
    expect(comparisonExecutors['less-equal']({ a: 5, b: 5 }, ctx)).toBe(true)
  })

  it('should check in-range', () => {
    expect(comparisonExecutors['in-range']({ value: 5, min: 0, max: 10 }, ctx)).toBe(true)
    expect(comparisonExecutors['in-range']({ value: 15, min: 0, max: 10 }, ctx)).toBe(false)
  })

  it('should check null', () => {
    expect(comparisonExecutors['is-null']({ value: null }, ctx)).toBe(true)
    expect(comparisonExecutors['is-null']({ value: undefined }, ctx)).toBe(true)
    expect(comparisonExecutors['is-null']({ value: 0 }, ctx)).toBe(false)
    expect(comparisonExecutors['is-not-null']({ value: 5 }, ctx)).toBe(true)
  })

  it('should perform logical operations', () => {
    expect(comparisonExecutors['and']({ a: true, b: true }, ctx)).toBe(true)
    expect(comparisonExecutors['and']({ a: true, b: false }, ctx)).toBe(false)
    expect(comparisonExecutors['or']({ a: false, b: true }, ctx)).toBe(true)
    expect(comparisonExecutors['or']({ a: false, b: false }, ctx)).toBe(false)
    expect(comparisonExecutors['not']({ value: true }, ctx)).toBe(false)
    expect(comparisonExecutors['xor']({ a: true, b: false }, ctx)).toBe(true)
    expect(comparisonExecutors['xor']({ a: true, b: true }, ctx)).toBe(false)
  })
})

describe('Array Executors', () => {
  const ctx = createContext()

  it('should get array length', () => {
    expect(arrayExecutors['array-length']({ array: [1, 2, 3] }, ctx)).toBe(3)
    expect(arrayExecutors['array-length']({ array: null }, ctx)).toBe(0)
  })

  it('should get/set array elements', () => {
    expect(arrayExecutors['array-get']({ array: [1, 2, 3], index: 1 }, ctx)).toBe(2)
    expect(arrayExecutors['array-set']({ array: [1, 2, 3], index: 1, value: 5 }, ctx)).toEqual([1, 5, 3])
  })

  it('should push and pop', () => {
    expect(arrayExecutors['array-push']({ array: [1, 2], value: 3 }, ctx)).toEqual([1, 2, 3])
    expect(arrayExecutors['array-pop']({ array: [1, 2, 3] }, ctx)).toBe(3)
    expect(arrayExecutors['array-pop']({ array: [] }, ctx)).toBe(null)
  })

  it('should slice arrays', () => {
    expect(arrayExecutors['array-slice']({ array: [1, 2, 3, 4], start: 1, end: 3 }, ctx)).toEqual([2, 3])
  })

  it('should concat arrays', () => {
    expect(arrayExecutors['array-concat']({ a: [1, 2], b: [3, 4] }, ctx)).toEqual([1, 2, 3, 4])
  })

  it('should check includes and find index', () => {
    expect(arrayExecutors['array-includes']({ array: [1, 2, 3], value: 2 }, ctx)).toBe(true)
    expect(arrayExecutors['array-includes']({ array: [1, 2, 3], value: 5 }, ctx)).toBe(false)
    expect(arrayExecutors['array-find-index']({ array: [1, 2, 3], value: 2 }, ctx)).toBe(1)
  })

  it('should reverse arrays', () => {
    expect(arrayExecutors['array-reverse']({ array: [1, 2, 3] }, ctx)).toEqual([3, 2, 1])
  })

  it('should sort arrays', () => {
    expect(arrayExecutors['array-sort']({ array: [3, 1, 2] }, ctx)).toEqual([1, 2, 3])
  })

  it('should filter nulls', () => {
    expect(arrayExecutors['array-filter-nulls']({
      array: [1, null, 2, undefined, 3]
    }, ctx)).toEqual([1, 2, 3])
  })

  it('should get random element', () => {
    const result = arrayExecutors['array-random']({ array: [1, 2, 3] }, ctx)
    expect([1, 2, 3]).toContain(result)
    expect(arrayExecutors['array-random']({ array: [] }, ctx)).toBe(null)
  })

  it('should shuffle arrays', () => {
    const input = [1, 2, 3, 4, 5]
    const result = arrayExecutors['array-shuffle']({ array: input }, ctx) as number[]
    expect(result).toHaveLength(5)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('executeNode', () => {
  const ctx = createContext()

  it('should execute known node types', () => {
    expect(executeNode('abs', { value: -5 }, ctx)).toBe(5)
    expect(executeNode('concat', { a: 'Hello', b: ' World' }, ctx)).toBe('Hello World')
  })

  it('should return null for unknown types', () => {
    expect(executeNode('unknown-node', {}, ctx)).toBe(null)
  })
})

describe('hasExecutor', () => {
  it('should return true for known executors', () => {
    expect(hasExecutor('clamp')).toBe(true)
    expect(hasExecutor('vec2-add')).toBe(true)
  })

  it('should return false for unknown executors', () => {
    expect(hasExecutor('unknown-node')).toBe(false)
  })
})

describe('registerExecutor', () => {
  it('should register custom executors', () => {
    const customExecutor = () => 'custom result'
    registerExecutor('custom-node', customExecutor)

    expect(hasExecutor('custom-node')).toBe(true)
    expect(executeNode('custom-node', {}, createContext())).toBe('custom result')
  })
})
