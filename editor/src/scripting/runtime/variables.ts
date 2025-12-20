// ═══════════════════════════════════════════════════════════════════════════
// Variables System - Scoped variable management for visual scripting
// Supports global, scene, node, and local scopes with type validation
// ═══════════════════════════════════════════════════════════════════════════

import { ExprValue, Vec2, isExprWrapper, resolveValue } from './expressions'
import { createGameEvent, GameEventBus, TriplePhaseEventBus } from './events'
import { SeededRandom } from './lifecycle'

// ─────────────────────────────────────────────────────────────────────────────
// Variable Types
// ─────────────────────────────────────────────────────────────────────────────

/** Variable scope determines lifecycle and visibility */
export type VariableScope = 'global' | 'scene' | 'node' | 'local'

/** Variable type for validation and UI */
export type VariableType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'vec2'
  | 'vec3'
  | 'color'
  | 'entity'
  | 'array'
  | 'object'
  | 'any'

/** Full variable definition */
export interface VariableDefinition {
  name: string
  type: VariableType
  scope: VariableScope
  default?: ExprValue
  description?: string
  min?: number // For numbers
  max?: number // For numbers
  step?: number // For numbers
  options?: string[] // For enum-like strings
  readonly?: boolean
  hidden?: boolean // Don't show in inspector
  category?: string // For organizing in UI
}

/** Variable change event */
export interface VariableChangeEvent {
  name: string
  scope: VariableScope
  oldValue: ExprValue
  newValue: ExprValue
  source?: string // nodeId or 'system'
  timestamp: number
}

/** Variable watch callback */
export type VariableWatcher = (event: VariableChangeEvent) => void

// ─────────────────────────────────────────────────────────────────────────────
// Variable Store - Low-level storage with type coercion
// ─────────────────────────────────────────────────────────────────────────────

class VariableStore {
  private values: Map<string, ExprValue> = new Map()
  private definitions: Map<string, VariableDefinition> = new Map()
  private watchers: Map<string, Set<VariableWatcher>> = new Map()
  private globalWatchers: Set<VariableWatcher> = new Set()

  /** Define a variable with type and constraints */
  define(def: VariableDefinition): void {
    this.definitions.set(def.name, def)
    if (def.default !== undefined && !this.values.has(def.name)) {
      this.values.set(def.name, this.coerce(def.default, def.type))
    }
  }

  /** Get a variable definition */
  getDefinition(name: string): VariableDefinition | undefined {
    return this.definitions.get(name)
  }

  /** Get all definitions */
  getDefinitions(): VariableDefinition[] {
    return Array.from(this.definitions.values())
  }

  /** Check if variable exists */
  has(name: string): boolean {
    return this.values.has(name)
  }

  /** Get a variable value */
  get(name: string): ExprValue {
    return this.values.get(name) ?? null
  }

  /** Set a variable value with validation */
  set(name: string, value: ExprValue, source?: string): ExprValue {
    const def = this.definitions.get(name)
    const oldValue = this.values.get(name)

    // Coerce value to expected type
    let coercedValue = def ? this.coerce(value, def.type) : value

    // Apply constraints
    if (def && typeof coercedValue === 'number') {
      if (def.min !== undefined) coercedValue = Math.max(def.min, coercedValue)
      if (def.max !== undefined) coercedValue = Math.min(def.max, coercedValue)
    }

    // Check readonly (allow system/runtime sources to bypass)
    const isSystemSource = source === 'runtime' || source === 'system'
    if (def?.readonly && oldValue !== undefined && !isSystemSource) {
      console.warn(`[Variables] Cannot modify readonly variable: ${name}`)
      return oldValue ?? null
    }

    this.values.set(name, coercedValue)

    // Notify watchers if value changed
    if (!this.deepEqual(oldValue, coercedValue)) {
      const event: VariableChangeEvent = {
        name,
        scope: def?.scope || 'local',
        oldValue: oldValue ?? null,
        newValue: coercedValue,
        source,
        timestamp: Date.now(),
      }

      this.notifyWatchers(name, event)
    }

    return coercedValue
  }

  /** Delete a variable */
  delete(name: string): boolean {
    const existed = this.values.delete(name)
    this.definitions.delete(name)
    this.watchers.delete(name)
    return existed
  }

  /** Clear all variables */
  clear(): void {
    this.values.clear()
  }

  /** Get all variable names */
  keys(): string[] {
    return Array.from(this.values.keys())
  }

  /** Get all values as a record */
  toRecord(): Record<string, ExprValue> {
    const record: Record<string, ExprValue> = {}
    for (const [key, value] of this.values) {
      record[key] = value
    }
    return record
  }

  /** Load values from a record */
  fromRecord(record: Record<string, ExprValue>): void {
    for (const [key, value] of Object.entries(record)) {
      this.set(key, value)
    }
  }

  /** Watch a specific variable */
  watch(name: string, callback: VariableWatcher): () => void {
    if (!this.watchers.has(name)) {
      this.watchers.set(name, new Set())
    }
    this.watchers.get(name)!.add(callback)
    return () => this.watchers.get(name)?.delete(callback)
  }

  /** Watch all variables */
  watchAll(callback: VariableWatcher): () => void {
    this.globalWatchers.add(callback)
    return () => this.globalWatchers.delete(callback)
  }

  /** Notify watchers of a change */
  private notifyWatchers(name: string, event: VariableChangeEvent): void {
    // Specific watchers
    const watchers = this.watchers.get(name)
    if (watchers) {
      for (const watcher of watchers) {
        try {
          watcher(event)
        } catch (e) {
          console.error(`[Variables] Watcher error for '${name}':`, e)
        }
      }
    }

    // Global watchers
    for (const watcher of this.globalWatchers) {
      try {
        watcher(event)
      } catch (e) {
        console.error(`[Variables] Global watcher error:`, e)
      }
    }
  }

  /** Type coercion */
  private coerce(value: ExprValue, type: VariableType): ExprValue {
    if (value === null || value === undefined) {
      return this.getDefaultForType(type)
    }

    switch (type) {
      case 'number':
        if (typeof value === 'number') return value
        if (typeof value === 'string') return parseFloat(value) || 0
        if (typeof value === 'boolean') return value ? 1 : 0
        return 0

      case 'string':
        if (typeof value === 'string') return value
        return String(value)

      case 'boolean':
        if (typeof value === 'boolean') return value
        if (typeof value === 'number') return value !== 0
        if (typeof value === 'string') return value.toLowerCase() !== 'false' && value !== '' && value !== '0'
        return Boolean(value)

      case 'vec2':
        if (Array.isArray(value) && value.length >= 2) return [value[0] || 0, value[1] || 0] as Vec2
        if (typeof value === 'object' && value && 'x' in value && 'y' in value) {
          return [(value as { x: number; y: number }).x, (value as { x: number; y: number }).y] as Vec2
        }
        return [0, 0] as Vec2

      case 'vec3':
        if (Array.isArray(value) && value.length >= 3) return [value[0] || 0, value[1] || 0, value[2] || 0]
        return [0, 0, 0]

      case 'color':
        if (Array.isArray(value)) return value.slice(0, 4)
        if (typeof value === 'string') return this.parseColor(value)
        return [1, 1, 1, 1]

      case 'entity':
        if (typeof value === 'string') return value
        return null

      case 'array':
        if (Array.isArray(value)) return value
        return [value]

      case 'object':
        if (typeof value === 'object' && value !== null) return value
        return {}

      case 'any':
      default:
        return value
    }
  }

  /** Get default value for a type */
  private getDefaultForType(type: VariableType): ExprValue {
    switch (type) {
      case 'number': return 0
      case 'string': return ''
      case 'boolean': return false
      case 'vec2': return [0, 0]
      case 'vec3': return [0, 0, 0]
      case 'color': return [1, 1, 1, 1]
      case 'entity': return null
      case 'array': return []
      case 'object': return {}
      case 'any': return null
    }
  }

  /** Parse a color string */
  private parseColor(str: string): number[] {
    // Handle hex colors
    if (str.startsWith('#')) {
      const hex = str.slice(1)
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        return [r, g, b, 1]
      }
      if (hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16) / 255
        const g = parseInt(hex.slice(2, 4), 16) / 255
        const b = parseInt(hex.slice(4, 6), 16) / 255
        const a = parseInt(hex.slice(6, 8), 16) / 255
        return [r, g, b, a]
      }
    }
    return [1, 1, 1, 1]
  }

  /** Deep equality check */
  private deepEqual(a: ExprValue, b: ExprValue): boolean {
    if (a === b) return true
    if (typeof a !== typeof b) return false
    if (a === null || b === null) return a === b
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((v, i) => this.deepEqual(v, b[i] as ExprValue))
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a as object)
      const bKeys = Object.keys(b as object)
      if (aKeys.length !== bKeys.length) return false
      return aKeys.every(k => this.deepEqual((a as Record<string, ExprValue>)[k], (b as Record<string, ExprValue>)[k]))
    }
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Variables Manager - Multi-scope variable management
// ─────────────────────────────────────────────────────────────────────────────

export class VariablesManager {
  private globalStore = new VariableStore()
  private sceneStores = new Map<string, VariableStore>()
  private nodeStores = new Map<string, VariableStore>()
  private eventBus: TriplePhaseEventBus

  private currentSceneId: string = ''
  private definitions: Map<string, VariableDefinition> = new Map()

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
    this.setupBuiltinVariables()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scene Management
  // ─────────────────────────────────────────────────────────────────────────

  /** Set the current scene */
  setCurrentScene(sceneId: string): void {
    this.currentSceneId = sceneId
    if (!this.sceneStores.has(sceneId)) {
      this.sceneStores.set(sceneId, new VariableStore())
    }
  }

  /** Get the current scene ID */
  getCurrentScene(): string {
    return this.currentSceneId
  }

  /** Clear a scene's variables */
  clearScene(sceneId: string): void {
    this.sceneStores.get(sceneId)?.clear()
  }

  /** Clear a node's variables */
  clearNode(nodeId: string): void {
    this.nodeStores.delete(nodeId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variable Definition
  // ─────────────────────────────────────────────────────────────────────────

  /** Define a variable */
  define(def: VariableDefinition): void {
    this.definitions.set(this.getScopedKey(def.name, def.scope), def)
    this.getStore(def.scope).define(def)
  }

  /** Define multiple variables */
  defineMany(defs: VariableDefinition[]): void {
    for (const def of defs) {
      this.define(def)
    }
  }

  /** Get a variable definition */
  getDefinition(name: string, scope: VariableScope): VariableDefinition | undefined {
    return this.getStore(scope).getDefinition(name)
  }

  /** Get all definitions for a scope */
  getDefinitions(scope: VariableScope): VariableDefinition[] {
    return this.getStore(scope).getDefinitions()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variable Access
  // ─────────────────────────────────────────────────────────────────────────

  /** Get a variable value */
  get(name: string, scope: VariableScope, nodeId?: string): ExprValue {
    return this.getStore(scope, nodeId).get(name)
  }

  /** Set a variable value */
  set(name: string, scope: VariableScope, value: ExprValue, nodeId?: string, source?: string): ExprValue {
    const result = this.getStore(scope, nodeId).set(name, value, source)

    // Emit variable change event
    this.eventBus.emit(createGameEvent({
      type: 'variable:change',
      source: { type: 'node', id: source || nodeId || 'system' },
      data: { name, scope, value: result, nodeId },
    }))

    return result
  }

  /** Check if a variable exists */
  has(name: string, scope: VariableScope, nodeId?: string): boolean {
    return this.getStore(scope, nodeId).has(name)
  }

  /** Delete a variable */
  delete(name: string, scope: VariableScope, nodeId?: string): boolean {
    return this.getStore(scope, nodeId).delete(name)
  }

  /** Get a variable, searching through scopes (local -> node -> scene -> global) */
  resolve(name: string, nodeId?: string): ExprValue {
    // Check node scope first
    if (nodeId) {
      const nodeStore = this.nodeStores.get(nodeId)
      if (nodeStore?.has(name)) return nodeStore.get(name)
    }

    // Check scene scope
    if (this.currentSceneId) {
      const sceneStore = this.sceneStores.get(this.currentSceneId)
      if (sceneStore?.has(name)) return sceneStore.get(name)
    }

    // Check global scope
    return this.globalStore.get(name)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variable Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Increment a number variable */
  increment(name: string, scope: VariableScope, amount: number = 1, nodeId?: string): number {
    const current = this.get(name, scope, nodeId)
    const newValue = (typeof current === 'number' ? current : 0) + amount
    this.set(name, scope, newValue, nodeId)
    return newValue
  }

  /** Decrement a number variable */
  decrement(name: string, scope: VariableScope, amount: number = 1, nodeId?: string): number {
    return this.increment(name, scope, -amount, nodeId)
  }

  /** Toggle a boolean variable */
  toggle(name: string, scope: VariableScope, nodeId?: string): boolean {
    const current = this.get(name, scope, nodeId)
    const newValue = !current
    this.set(name, scope, newValue, nodeId)
    return newValue
  }

  /** Append to an array variable */
  push(name: string, scope: VariableScope, value: ExprValue, nodeId?: string): ExprValue[] {
    const current = this.get(name, scope, nodeId)
    const array = Array.isArray(current) ? [...current] : []
    array.push(value)
    this.set(name, scope, array, nodeId)
    return array
  }

  /** Pop from an array variable */
  pop(name: string, scope: VariableScope, nodeId?: string): ExprValue {
    const current = this.get(name, scope, nodeId)
    const array = Array.isArray(current) ? [...current] : []
    const value = array.pop()
    this.set(name, scope, array, nodeId)
    return value ?? null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Watching
  // ─────────────────────────────────────────────────────────────────────────

  /** Watch a specific variable in a scope */
  watch(name: string, scope: VariableScope, callback: VariableWatcher, nodeId?: string): () => void {
    return this.getStore(scope, nodeId).watch(name, callback)
  }

  /** Watch all variables in a scope */
  watchScope(scope: VariableScope, callback: VariableWatcher, nodeId?: string): () => void {
    return this.getStore(scope, nodeId).watchAll(callback)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  /** Serialize all variables */
  serialize(): {
    global: Record<string, ExprValue>
    scenes: Record<string, Record<string, ExprValue>>
    nodes: Record<string, Record<string, ExprValue>>
    definitions: VariableDefinition[]
  } {
    const scenes: Record<string, Record<string, ExprValue>> = {}
    for (const [sceneId, store] of this.sceneStores) {
      scenes[sceneId] = store.toRecord()
    }

    const nodes: Record<string, Record<string, ExprValue>> = {}
    for (const [nodeId, store] of this.nodeStores) {
      nodes[nodeId] = store.toRecord()
    }

    return {
      global: this.globalStore.toRecord(),
      scenes,
      nodes,
      definitions: Array.from(this.definitions.values()),
    }
  }

  /** Deserialize variables */
  deserialize(data: ReturnType<typeof this.serialize>): void {
    // Restore definitions first
    if (data.definitions) {
      for (const def of data.definitions) {
        this.define(def)
      }
    }

    // Restore global
    if (data.global) {
      this.globalStore.fromRecord(data.global)
    }

    // Restore scenes
    if (data.scenes) {
      for (const [sceneId, values] of Object.entries(data.scenes)) {
        if (!this.sceneStores.has(sceneId)) {
          this.sceneStores.set(sceneId, new VariableStore())
        }
        this.sceneStores.get(sceneId)!.fromRecord(values)
      }
    }

    // Restore nodes
    if (data.nodes) {
      for (const [nodeId, values] of Object.entries(data.nodes)) {
        if (!this.nodeStores.has(nodeId)) {
          this.nodeStores.set(nodeId, new VariableStore())
        }
        this.nodeStores.get(nodeId)!.fromRecord(values)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Play Mode Snapshot Support
  // ─────────────────────────────────────────────────────────────────────────

  /** Get a snapshot of all global variables for play mode */
  getSnapshot(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.globalStore.toRecord()))
  }

  /** Restore global variables from a snapshot */
  restoreSnapshot(snapshot: Record<string, unknown>): void {
    // Clear current global state except readonly builtin vars
    const builtinReadonly = ['time', 'deltaTime', 'frameCount', 'mouseX', 'mouseY', 'mouseDown']

    for (const [key, value] of Object.entries(snapshot)) {
      if (!builtinReadonly.includes(key)) {
        this.globalStore.set(key, value as ExprValue)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Context Building
  // ─────────────────────────────────────────────────────────────────────────

  /** Build a merged context for expression evaluation */
  buildContext(nodeId?: string): Record<string, ExprValue> {
    const context: Record<string, ExprValue> = {}

    // Add global variables
    Object.assign(context, this.globalStore.toRecord())

    // Add scene variables (override global)
    if (this.currentSceneId) {
      const sceneStore = this.sceneStores.get(this.currentSceneId)
      if (sceneStore) {
        Object.assign(context, sceneStore.toRecord())
      }
    }

    // Add node variables (override scene)
    if (nodeId) {
      const nodeStore = this.nodeStores.get(nodeId)
      if (nodeStore) {
        Object.assign(context, nodeStore.toRecord())
      }
    }

    return context
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private getStore(scope: VariableScope, nodeId?: string): VariableStore {
    switch (scope) {
      case 'global':
        return this.globalStore

      case 'scene':
        if (!this.sceneStores.has(this.currentSceneId)) {
          this.sceneStores.set(this.currentSceneId, new VariableStore())
        }
        return this.sceneStores.get(this.currentSceneId)!

      case 'node':
        const id = nodeId || 'default'
        if (!this.nodeStores.has(id)) {
          this.nodeStores.set(id, new VariableStore())
        }
        return this.nodeStores.get(id)!

      case 'local':
        // Local variables don't have persistent storage
        // They're managed by the graph executor
        return new VariableStore()
    }
  }

  private getScopedKey(name: string, scope: VariableScope): string {
    return `${scope}:${name}`
  }

  private setupBuiltinVariables(): void {
    // Time variables
    this.define({ name: 'time', type: 'number', scope: 'global', default: 0, readonly: true, description: 'Total game time in seconds' })
    this.define({ name: 'deltaTime', type: 'number', scope: 'global', default: 0, readonly: true, description: 'Time since last frame' })
    this.define({ name: 'frameCount', type: 'number', scope: 'global', default: 0, readonly: true, description: 'Total frame count' })

    // Input variables
    this.define({ name: 'mouseX', type: 'number', scope: 'global', default: 0, readonly: true, description: 'Mouse X position' })
    this.define({ name: 'mouseY', type: 'number', scope: 'global', default: 0, readonly: true, description: 'Mouse Y position' })
    this.define({ name: 'mouseDown', type: 'boolean', scope: 'global', default: false, readonly: true, description: 'Is mouse button pressed' })

    // Game state
    this.define({ name: 'paused', type: 'boolean', scope: 'global', default: false, description: 'Is game paused' })
    this.define({ name: 'debug', type: 'boolean', scope: 'global', default: false, description: 'Debug mode enabled' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Variables Manager Instance
// ─────────────────────────────────────────────────────────────────────────────

export const GlobalVariables = new VariablesManager()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Get a global variable */
export const getGlobal = (name: string) => GlobalVariables.get(name, 'global')

/** Set a global variable */
export const setGlobal = (name: string, value: ExprValue) => GlobalVariables.set(name, 'global', value)

/** Get a scene variable */
export const getScene = (name: string) => GlobalVariables.get(name, 'scene')

/** Set a scene variable */
export const setScene = (name: string, value: ExprValue) => GlobalVariables.set(name, 'scene', value)

/** Get a node variable */
export const getNode = (name: string, nodeId: string) => GlobalVariables.get(name, 'node', nodeId)

/** Set a node variable */
export const setNode = (name: string, nodeId: string, value: ExprValue) => GlobalVariables.set(name, 'node', value, nodeId)

/** Define a variable */
export const defineVar = (def: VariableDefinition) => GlobalVariables.define(def)

/** Watch a variable */
export const watchVar = (name: string, scope: VariableScope, callback: VariableWatcher) =>
  GlobalVariables.watch(name, scope, callback)
