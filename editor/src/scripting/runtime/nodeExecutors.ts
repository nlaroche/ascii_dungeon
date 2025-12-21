// =============================================================================
// Node Executors - Built-in implementations for visual scripting nodes
// =============================================================================

import { ExprValue, Vec2 } from './expressions'
import { Scene, EntityData } from './SceneManager'
import { Timers } from './TimerManager'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NodeExecutorContext {
  nodeId: string
  selfEntityId?: string
  variables: Record<string, ExprValue>
}

export type NodeExecutor = (
  inputs: Record<string, ExprValue>,
  ctx: NodeExecutorContext
) => ExprValue | Promise<ExprValue>

// -----------------------------------------------------------------------------
// Math Executors
// -----------------------------------------------------------------------------

export const mathExecutors: Record<string, NodeExecutor> = {
  'clamp': ({ value, min, max }) => {
    const v = value as number
    const lo = min as number
    const hi = max as number
    return Math.max(lo, Math.min(hi, v))
  },

  'lerp': ({ a, b, t }) => {
    const va = a as number
    const vb = b as number
    const vt = t as number
    return va + (vb - va) * vt
  },

  'inverse-lerp': ({ a, b, value }) => {
    const va = a as number
    const vb = b as number
    const v = value as number
    if (vb - va === 0) return 0
    return (v - va) / (vb - va)
  },

  'remap': ({ value, inMin, inMax, outMin, outMax }) => {
    const v = value as number
    const iMin = inMin as number
    const iMax = inMax as number
    const oMin = outMin as number
    const oMax = outMax as number
    const t = iMax - iMin === 0 ? 0 : (v - iMin) / (iMax - iMin)
    return oMin + (oMax - oMin) * t
  },

  'abs': ({ value }) => Math.abs(value as number),
  'sign': ({ value }) => Math.sign(value as number),
  'floor': ({ value }) => Math.floor(value as number),
  'ceil': ({ value }) => Math.ceil(value as number),
  'round': ({ value }) => Math.round(value as number),
  'sin': ({ angle }) => Math.sin(angle as number),
  'cos': ({ angle }) => Math.cos(angle as number),
  'tan': ({ angle }) => Math.tan(angle as number),
  'atan2': ({ y, x }) => Math.atan2(y as number, x as number),
  'sqrt': ({ value }) => Math.sqrt(value as number),
  'pow': ({ base, exponent }) => Math.pow(base as number, exponent as number),
  'min': ({ a, b }) => Math.min(a as number, b as number),
  'max': ({ a, b }) => Math.max(a as number, b as number),
  'mod': ({ a, b }) => (a as number) % (b as number),

  'random-range': ({ min, max }, ctx) => {
    const lo = min as number
    const hi = max as number
    return lo + Math.random() * (hi - lo)
  },

  'random-int': ({ min, max }) => {
    const lo = min as number
    const hi = max as number
    return Math.floor(lo + Math.random() * (hi - lo + 1))
  },
}

// -----------------------------------------------------------------------------
// Vector Executors
// -----------------------------------------------------------------------------

export const vectorExecutors: Record<string, NodeExecutor> = {
  'vec2-create': ({ x, y }) => ({ x: x as number, y: y as number }),

  'vec2-split': ({ vec }) => {
    const v = vec as Vec2
    return { x: v?.x ?? 0, y: v?.y ?? 0 }
  },

  'vec2-add': ({ a, b }) => {
    const va = a as Vec2
    const vb = b as Vec2
    return { x: (va?.x ?? 0) + (vb?.x ?? 0), y: (va?.y ?? 0) + (vb?.y ?? 0) }
  },

  'vec2-sub': ({ a, b }) => {
    const va = a as Vec2
    const vb = b as Vec2
    return { x: (va?.x ?? 0) - (vb?.x ?? 0), y: (va?.y ?? 0) - (vb?.y ?? 0) }
  },

  'vec2-mul': ({ a, b }) => {
    const va = a as Vec2
    const vb = b as Vec2
    return { x: (va?.x ?? 0) * (vb?.x ?? 0), y: (va?.y ?? 0) * (vb?.y ?? 0) }
  },

  'vec2-scale': ({ vec, scalar }) => {
    const v = vec as Vec2
    const s = scalar as number
    return { x: (v?.x ?? 0) * s, y: (v?.y ?? 0) * s }
  },

  'vec2-normalize': ({ vec }) => {
    const v = vec as Vec2
    const len = Math.sqrt((v?.x ?? 0) ** 2 + (v?.y ?? 0) ** 2)
    if (len === 0) return { x: 0, y: 0 }
    return { x: (v?.x ?? 0) / len, y: (v?.y ?? 0) / len }
  },

  'vec2-length': ({ vec }) => {
    const v = vec as Vec2
    return Math.sqrt((v?.x ?? 0) ** 2 + (v?.y ?? 0) ** 2)
  },

  'vec2-distance': ({ a, b }) => {
    const va = a as Vec2
    const vb = b as Vec2
    const dx = (vb?.x ?? 0) - (va?.x ?? 0)
    const dy = (vb?.y ?? 0) - (va?.y ?? 0)
    return Math.sqrt(dx * dx + dy * dy)
  },

  'vec2-dot': ({ a, b }) => {
    const va = a as Vec2
    const vb = b as Vec2
    return (va?.x ?? 0) * (vb?.x ?? 0) + (va?.y ?? 0) * (vb?.y ?? 0)
  },

  'vec2-angle': ({ vec }) => {
    const v = vec as Vec2
    return Math.atan2(v?.y ?? 0, v?.x ?? 0)
  },

  'vec2-rotate': ({ vec, angle }) => {
    const v = vec as Vec2
    const a = angle as number
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const x = v?.x ?? 0
    const y = v?.y ?? 0
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  },

  'vec2-lerp': ({ a, b, t }) => {
    const va = a as Vec2
    const vb = b as Vec2
    const vt = t as number
    return {
      x: (va?.x ?? 0) + ((vb?.x ?? 0) - (va?.x ?? 0)) * vt,
      y: (va?.y ?? 0) + ((vb?.y ?? 0) - (va?.y ?? 0)) * vt,
    }
  },

  'vec2-reflect': ({ vec, normal }) => {
    const v = vec as Vec2
    const n = normal as Vec2
    const dot = (v?.x ?? 0) * (n?.x ?? 0) + (v?.y ?? 0) * (n?.y ?? 0)
    return {
      x: (v?.x ?? 0) - 2 * dot * (n?.x ?? 0),
      y: (v?.y ?? 0) - 2 * dot * (n?.y ?? 0),
    }
  },
}

// -----------------------------------------------------------------------------
// String Executors
// -----------------------------------------------------------------------------

export const stringExecutors: Record<string, NodeExecutor> = {
  'concat': ({ a, b }) => String(a ?? '') + String(b ?? ''),

  'format': ({ template, values }) => {
    let result = String(template ?? '')
    const vals = values as Record<string, unknown>
    if (vals && typeof vals === 'object') {
      for (const [key, value] of Object.entries(vals)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''))
      }
    }
    // Also handle positional {0}, {1}, etc. if values is an array
    if (Array.isArray(vals)) {
      for (let i = 0; i < vals.length; i++) {
        result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), String(vals[i] ?? ''))
      }
    }
    return result
  },

  'to-string': ({ value }) => String(value ?? ''),

  'parse-number': ({ value }) => {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  },

  'parse-int': ({ value }) => {
    const num = parseInt(String(value), 10)
    return isNaN(num) ? 0 : num
  },

  'string-length': ({ value }) => String(value ?? '').length,

  'substring': ({ value, start, end }) => {
    const str = String(value ?? '')
    const s = start as number
    const e = end as number | undefined
    return str.substring(s, e)
  },

  'string-replace': ({ value, find, replace }) => {
    return String(value ?? '').replace(String(find ?? ''), String(replace ?? ''))
  },

  'string-split': ({ value, delimiter }) => {
    return String(value ?? '').split(String(delimiter ?? ''))
  },

  'string-join': ({ values, delimiter }) => {
    const arr = values as unknown[]
    if (!Array.isArray(arr)) return ''
    return arr.map(v => String(v ?? '')).join(String(delimiter ?? ''))
  },

  'to-uppercase': ({ value }) => String(value ?? '').toUpperCase(),
  'to-lowercase': ({ value }) => String(value ?? '').toLowerCase(),
  'string-trim': ({ value }) => String(value ?? '').trim(),
}

// -----------------------------------------------------------------------------
// Comparison Executors
// -----------------------------------------------------------------------------

export const comparisonExecutors: Record<string, NodeExecutor> = {
  'equals': ({ a, b }) => a === b,
  'not-equals': ({ a, b }) => a !== b,
  'greater-than': ({ a, b }) => (a as number) > (b as number),
  'less-than': ({ a, b }) => (a as number) < (b as number),
  'greater-equal': ({ a, b }) => (a as number) >= (b as number),
  'less-equal': ({ a, b }) => (a as number) <= (b as number),

  'in-range': ({ value, min, max }) => {
    const v = value as number
    return v >= (min as number) && v <= (max as number)
  },

  'is-null': ({ value }) => value === null || value === undefined,
  'is-not-null': ({ value }) => value !== null && value !== undefined,

  'and': ({ a, b }) => Boolean(a) && Boolean(b),
  'or': ({ a, b }) => Boolean(a) || Boolean(b),
  'not': ({ value }) => !value,
  'xor': ({ a, b }) => Boolean(a) !== Boolean(b),
}

// -----------------------------------------------------------------------------
// Entity Executors
// -----------------------------------------------------------------------------

export const entityExecutors: Record<string, NodeExecutor> = {
  'get-self': (_, ctx) => ctx.selfEntityId ?? null,

  'get-parent': ({ entityId }) => {
    const parent = Scene.getParent(entityId as string)
    return parent?.id ?? null
  },

  'get-children': ({ entityId }) => {
    const children = Scene.getChildren(entityId as string)
    return children.map(c => c.id)
  },

  'find-entity': ({ name }) => {
    const entity = Scene.findByName(name as string)
    return entity?.id ?? null
  },

  'find-entities-by-tag': ({ tag }) => {
    const entities = Scene.findByTag(tag as string)
    return entities.map(e => e.id)
  },

  'find-entities-by-layer': ({ layer }) => {
    const entities = Scene.findByLayer(layer as string)
    return entities.map(e => e.id)
  },

  'find-in-radius': ({ x, y, radius }) => {
    const entities = Scene.findInRadius(x as number, y as number, radius as number)
    return entities.map(e => e.id)
  },

  'get-position': ({ entityId }) => {
    return Scene.getPosition(entityId as string) ?? { x: 0, y: 0 }
  },

  'set-position': ({ entityId, x, y }) => {
    Scene.setPosition(entityId as string, x as number, y as number)
    return true
  },

  'translate': ({ entity, dx, dy }) => {
    Scene.translate(entity as string, dx as number, dy as number)
    return true
  },

  'distance-to': ({ entityA, entityB }) => {
    return Scene.distance(entityA as string, entityB as string)
  },

  'direction-to': ({ from, to }) => {
    return Scene.direction(from as string, to as string)
  },

  'is-enabled': ({ entityId }) => {
    return Scene.isEnabled(entityId as string)
  },

  'set-enabled': ({ entityId, enabled }) => {
    Scene.setEnabled(entityId as string, enabled as boolean)
    return true
  },

  'get-entity-data': ({ entityId }) => {
    const entity = Scene.getEntity(entityId as string)
    if (!entity) return null
    return {
      id: entity.id,
      name: entity.name,
      tags: entity.tags,
      layer: entity.layer,
      position: entity.position,
      enabled: entity.enabled,
    }
  },

  'has-tag': ({ entityId, tag }) => {
    const entity = Scene.getEntity(entityId as string)
    return entity?.tags?.includes(tag as string) ?? false
  },
}

// -----------------------------------------------------------------------------
// Scene Executors
// -----------------------------------------------------------------------------

export const sceneExecutors: Record<string, NodeExecutor> = {
  'load-scene': async ({ name }) => {
    return await Scene.loadScene(name as string)
  },

  'reload-scene': async () => {
    return await Scene.reloadScene()
  },

  'get-scene-name': () => {
    return Scene.getSceneName()
  },

  'instantiate': ({ prefabId, x, y, parentId }) => {
    const entity = Scene.instantiate(
      prefabId as string,
      x !== undefined && y !== undefined ? { x: x as number, y: y as number } : undefined,
      parentId as string | undefined
    )
    return entity?.id ?? null
  },

  'destroy': ({ entityId, delay }) => {
    Scene.destroy(entityId as string, (delay as number) ?? 0)
    return true
  },

  'get-entity-count': () => {
    return Scene.getEntityCount()
  },

  'get-all-entity-ids': () => {
    return Scene.getAllEntityIds()
  },
}

// -----------------------------------------------------------------------------
// Timer Executors
// -----------------------------------------------------------------------------

export const timerExecutors: Record<string, NodeExecutor> = {
  'start-timer': ({ name, duration, loop }, ctx) => {
    Timers.start({
      name: name as string,
      duration: duration as number,
      loop: loop as boolean,
      nodeId: ctx.nodeId,
    })
    return true
  },

  'stop-timer': ({ name }) => {
    return Timers.stop(name as string)
  },

  'pause-timer': ({ name }) => {
    return Timers.pause(name as string)
  },

  'resume-timer': ({ name }) => {
    return Timers.resume(name as string)
  },

  'is-timer-running': ({ name }) => {
    return Timers.isRunning(name as string)
  },

  'get-timer-remaining': ({ name }) => {
    return Timers.getRemaining(name as string)
  },

  'get-timer-elapsed': ({ name }) => {
    return Timers.getElapsed(name as string)
  },

  'delay': ({ seconds, callback }) => {
    // Note: callback execution would need graph integration
    Timers.start({
      name: `__delay_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      duration: seconds as number,
      loop: false,
    })
    return true
  },
}

// -----------------------------------------------------------------------------
// Array Executors
// -----------------------------------------------------------------------------

export const arrayExecutors: Record<string, NodeExecutor> = {
  'array-length': ({ array }) => {
    return Array.isArray(array) ? array.length : 0
  },

  'array-get': ({ array, index }) => {
    if (!Array.isArray(array)) return null
    return array[index as number] ?? null
  },

  'array-set': ({ array, index, value }) => {
    if (!Array.isArray(array)) return []
    const result = [...array]
    result[index as number] = value
    return result
  },

  'array-push': ({ array, value }) => {
    if (!Array.isArray(array)) return [value]
    return [...array, value]
  },

  'array-pop': ({ array }) => {
    if (!Array.isArray(array) || array.length === 0) return null
    return array[array.length - 1]
  },

  'array-slice': ({ array, start, end }) => {
    if (!Array.isArray(array)) return []
    return array.slice(start as number, end as number | undefined)
  },

  'array-concat': ({ a, b }) => {
    const arrA = Array.isArray(a) ? a : []
    const arrB = Array.isArray(b) ? b : []
    return [...arrA, ...arrB]
  },

  'array-includes': ({ array, value }) => {
    return Array.isArray(array) && array.includes(value)
  },

  'array-find-index': ({ array, value }) => {
    if (!Array.isArray(array)) return -1
    return array.indexOf(value)
  },

  'array-reverse': ({ array }) => {
    if (!Array.isArray(array)) return []
    return [...array].reverse()
  },

  'array-sort': ({ array }) => {
    if (!Array.isArray(array)) return []
    return [...array].sort()
  },

  'array-filter-nulls': ({ array }) => {
    if (!Array.isArray(array)) return []
    return array.filter(v => v !== null && v !== undefined)
  },

  'array-random': ({ array }) => {
    if (!Array.isArray(array) || array.length === 0) return null
    return array[Math.floor(Math.random() * array.length)]
  },

  'array-shuffle': ({ array }) => {
    if (!Array.isArray(array)) return []
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  },
}

// -----------------------------------------------------------------------------
// Script Node Executor - Execute custom TypeScript/JavaScript code
// -----------------------------------------------------------------------------

export interface ScriptNodeInputs {
  code: string
  customInputs: Record<string, ExprValue>
  listenSignals: string[]
  emitSignals: string[]
}

/**
 * Execute a script node with custom code.
 * The code has access to:
 * - inputs: The resolved input values
 * - ctx: The execution context
 * - self: The entity ID this behavior is attached to
 * - emit(signal, data): Function to emit a custom signal
 * - Scene, Timers: Built-in APIs
 */
export function executeScriptNode(
  code: string,
  inputs: Record<string, ExprValue>,
  ctx: NodeExecutorContext,
  emitSignal: (signal: string, data?: ExprValue) => void
): ExprValue | Promise<ExprValue> {
  try {
    // Create a function from the code with access to various utilities
    const fn = new Function(
      'inputs',
      'ctx',
      'self',
      'emit',
      'Scene',
      'Timers',
      'console',
      `
      try {
        ${code}
      } catch (e) {
        console.error('[Script] Runtime error:', e);
        return null;
      }
      `
    )

    // Execute with bound context
    const result = fn(
      inputs,
      ctx,
      ctx.selfEntityId,
      emitSignal,
      Scene,
      Timers,
      console
    )

    return result ?? inputs
  } catch (e) {
    console.error('[Script] Compilation error:', e)
    return null
  }
}

// -----------------------------------------------------------------------------
// Debug Executors
// -----------------------------------------------------------------------------

export const debugExecutors: Record<string, NodeExecutor> = {
  'log': ({ message, level }) => {
    const lvl = (level as string) ?? 'info'
    switch (lvl) {
      case 'warn':
        console.warn('[Script]', message)
        break
      case 'error':
        console.error('[Script]', message)
        break
      default:
        console.log('[Script]', message)
    }
    return true
  },

  'breakpoint': ({ label }) => {
    // In dev mode, this could trigger a debugger pause
    console.log('[Script] Breakpoint:', label)
    // debugger; // Uncomment for actual debugging
    return true
  },

  'assert': ({ condition, message }) => {
    if (!condition) {
      console.error('[Script] Assertion failed:', message)
    }
    return Boolean(condition)
  },
}

// -----------------------------------------------------------------------------
// Combined Executor Registry
// -----------------------------------------------------------------------------

export const nodeExecutors: Record<string, NodeExecutor> = {
  ...mathExecutors,
  ...vectorExecutors,
  ...stringExecutors,
  ...comparisonExecutors,
  ...entityExecutors,
  ...sceneExecutors,
  ...timerExecutors,
  ...arrayExecutors,
  ...debugExecutors,
}

/**
 * Execute a built-in node by type.
 */
export function executeNode(
  nodeType: string,
  inputs: Record<string, ExprValue>,
  ctx: NodeExecutorContext
): ExprValue | Promise<ExprValue> {
  const executor = nodeExecutors[nodeType]
  if (!executor) {
    console.warn(`[NodeExecutor] Unknown node type: ${nodeType}`)
    return null
  }
  return executor(inputs, ctx)
}

/**
 * Check if a node type has a built-in executor.
 */
export function hasExecutor(nodeType: string): boolean {
  return nodeType in nodeExecutors
}

/**
 * Register a custom node executor.
 */
export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  nodeExecutors[nodeType] = executor
}
