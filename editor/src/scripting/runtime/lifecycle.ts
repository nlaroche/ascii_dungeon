// ═══════════════════════════════════════════════════════════════════════════
// Node Lifecycle State Machine
// Manages deterministic initialization and cleanup of scene nodes
// ═══════════════════════════════════════════════════════════════════════════

import {
  createGameEvent,
  GameEvent,
  TriplePhaseEventBus,
  GameEventBus,
} from './events'

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle States
// ─────────────────────────────────────────────────────────────────────────────

export type LifecycleState =
  | 'uninitialized'  // Node exists in data but lifecycle hasn't started
  | 'constructing'   // ConstructionScript executing
  | 'pending'        // Async operations in progress
  | 'ready'          // Fully initialized, receiving updates
  | 'error'          // Initialization or runtime failure
  | 'disposed'       // Cleaned up

export interface LifecycleConfig {
  /** Number of retry attempts on error (default: 0) */
  retryCount: number
  /** Delay between retries in ms (default: 1000) */
  retryDelayMs: number
  /** Retry backoff strategy */
  retryBackoff: 'none' | 'linear' | 'exponential'
  /** What to do on unrecoverable error */
  fallbackState: 'error' | 'dispose' | 'retry'
  /** If true, error doesn't propagate to parent */
  errorBoundary: boolean
  /** Maximum time for initialization (default: 30000) */
  initTimeoutMs: number
}

export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  retryCount: 0,
  retryDelayMs: 1000,
  retryBackoff: 'none',
  fallbackState: 'error',
  errorBoundary: false,
  initTimeoutMs: 30000,
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Data Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InitEventData {
  nodeId: string
  parentId: string | null
  retryAttempt: number
}

export interface DisposeEventData {
  nodeId: string
  reason: 'manual' | 'parent' | 'error' | 'scene'
}

export interface EnableEventData {
  nodeId: string
  reason: 'self' | 'parent' | 'scene'
  previousState: boolean
}

export interface ErrorEventData {
  nodeId: string
  error: Error
  phase: string
  recoverable: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Construction Context
// ─────────────────────────────────────────────────────────────────────────────

export interface ConstructionContext {
  nodeId: string
  parentId: string | null
  spawnParams: Record<string, unknown>
  random: SeededRandom
}

/** Simple seeded random for deterministic procedural generation */
export class SeededRandom {
  private seed: number

  constructor(seed: number = Date.now()) {
    this.seed = seed
  }

  /** Get next random number between 0 and 1 */
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }

  /** Get random integer between min (inclusive) and max (exclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min
  }

  /** Get random float between min and max */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  /** Pick random element from array */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length)]
  }

  /** Shuffle array in place */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1)
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /** Get current seed (for saving/restoring state) */
  getSeed(): number {
    return this.seed
  }

  /** Set seed (for restoring state) */
  setSeed(seed: number): void {
    this.seed = seed
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Lifecycle Tracker
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeLifecycleInfo {
  state: LifecycleState
  config: LifecycleConfig
  error?: Error
  retryCount: number
  initStartTime?: number
}

export class LifecycleManager {
  private nodes: Map<string, NodeLifecycleInfo> = new Map()
  private hierarchy: Map<string, string | null> = new Map() // nodeId -> parentId
  private children: Map<string, Set<string>> = new Map() // parentId -> childIds
  private eventBus: TriplePhaseEventBus

  // Callbacks for external integration
  private constructionScripts: Map<string, (ctx: ConstructionContext) => void | Promise<void>> = new Map()
  private globalSeed: number = Date.now()

  constructor(eventBus: TriplePhaseEventBus = GameEventBus) {
    this.eventBus = eventBus
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Node Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a node in the lifecycle system
   */
  register(
    nodeId: string,
    parentId: string | null = null,
    config: Partial<LifecycleConfig> = {}
  ): void {
    if (this.nodes.has(nodeId)) {
      console.warn(`[Lifecycle] Node '${nodeId}' already registered`)
      return
    }

    this.nodes.set(nodeId, {
      state: 'uninitialized',
      config: { ...DEFAULT_LIFECYCLE_CONFIG, ...config },
      retryCount: 0,
    })

    this.hierarchy.set(nodeId, parentId)
    this.eventBus.setNodeParent(nodeId, parentId)

    if (parentId) {
      if (!this.children.has(parentId)) {
        this.children.set(parentId, new Set())
      }
      this.children.get(parentId)!.add(nodeId)
    }
  }

  /**
   * Unregister a node
   */
  unregister(nodeId: string): void {
    const info = this.nodes.get(nodeId)
    if (!info) return

    // Clean up children references
    const parentId = this.hierarchy.get(nodeId)
    if (parentId) {
      this.children.get(parentId)?.delete(nodeId)
    }

    // Remove from tracking
    this.nodes.delete(nodeId)
    this.hierarchy.delete(nodeId)
    this.children.delete(nodeId)
    this.eventBus.removeNode(nodeId)
  }

  /**
   * Register a construction script for a node type
   */
  registerConstructionScript(
    nodeType: string,
    script: (ctx: ConstructionContext) => void | Promise<void>
  ): void {
    this.constructionScripts.set(nodeType, script)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current state of a node
   */
  getState(nodeId: string): LifecycleState | undefined {
    return this.nodes.get(nodeId)?.state
  }

  /**
   * Check if node is in a specific state
   */
  isInState(nodeId: string, state: LifecycleState): boolean {
    return this.getState(nodeId) === state
  }

  /**
   * Check if node is ready (fully initialized)
   */
  isReady(nodeId: string): boolean {
    return this.isInState(nodeId, 'ready')
  }

  /**
   * Get all nodes in a specific state
   */
  getNodesInState(state: LifecycleState): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, info]) => info.state === state)
      .map(([id]) => id)
  }

  /**
   * Get children of a node
   */
  getChildren(nodeId: string): string[] {
    return Array.from(this.children.get(nodeId) || [])
  }

  /**
   * Get parent of a node
   */
  getParent(nodeId: string): string | null {
    return this.hierarchy.get(nodeId) ?? null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize a node (and optionally its children)
   */
  async initialize(
    nodeId: string,
    options: {
      recursive?: boolean
      spawnParams?: Record<string, unknown>
      nodeType?: string
    } = {}
  ): Promise<boolean> {
    const { recursive = true, spawnParams = {}, nodeType } = options
    const info = this.nodes.get(nodeId)

    if (!info) {
      console.error(`[Lifecycle] Node '${nodeId}' not registered`)
      return false
    }

    // Check if already initialized or in progress
    if (info.state !== 'uninitialized' && info.state !== 'error') {
      return info.state === 'ready'
    }

    // Check parent is ready (if has parent)
    const parentId = this.hierarchy.get(nodeId)
    if (parentId && !this.isReady(parentId)) {
      console.warn(`[Lifecycle] Cannot initialize '${nodeId}' - parent '${parentId}' not ready`)
      return false
    }

    try {
      // Phase 1: Constructing
      await this.transitionTo(nodeId, 'constructing')

      // Run construction script if registered
      if (nodeType && this.constructionScripts.has(nodeType)) {
        const script = this.constructionScripts.get(nodeType)!
        const ctx: ConstructionContext = {
          nodeId,
          parentId,
          spawnParams,
          random: new SeededRandom(this.globalSeed++),
        }
        await script(ctx)
      }

      // Phase 2: Pending (Before:Init)
      await this.transitionTo(nodeId, 'pending')
      info.initStartTime = Date.now()

      // Create and emit Init event
      const initEvent = createGameEvent<InitEventData>({
        type: 'Init',
        source: { id: nodeId },
        data: {
          nodeId,
          parentId,
          retryAttempt: info.retryCount,
        },
        bubbles: false,
        routing: 'local',
      })

      await this.eventBus.emit(initEvent)

      // Check for timeout
      const elapsed = Date.now() - info.initStartTime
      if (elapsed > info.config.initTimeoutMs) {
        throw new Error(`Initialization timeout after ${elapsed}ms`)
      }

      // Check if cancelled
      if (initEvent.cancelled) {
        throw new Error('Initialization cancelled')
      }

      // Check for error
      if (initEvent.error) {
        throw initEvent.error
      }

      // Phase 3: Ready
      await this.transitionTo(nodeId, 'ready')

      // Initialize children if recursive
      if (recursive) {
        const childIds = this.getChildren(nodeId)
        for (const childId of childIds) {
          await this.initialize(childId, { recursive: true })
        }
      }

      return true
    } catch (error) {
      return this.handleError(nodeId, error as Error, 'Init')
    }
  }

  /**
   * Dispose a node (and its children)
   */
  async dispose(
    nodeId: string,
    reason: DisposeEventData['reason'] = 'manual'
  ): Promise<void> {
    const info = this.nodes.get(nodeId)
    if (!info) return

    // Already disposed
    if (info.state === 'disposed') return

    // Dispose children first (depth-first)
    const childIds = this.getChildren(nodeId)
    for (const childId of childIds) {
      await this.dispose(childId, 'parent')
    }

    // Create and emit Dispose event
    const disposeEvent = createGameEvent<DisposeEventData>({
      type: 'Dispose',
      source: { id: nodeId },
      data: { nodeId, reason },
      bubbles: false,
      cancelable: false,
      routing: 'local',
    })

    await this.eventBus.emit(disposeEvent)

    // Transition to disposed
    await this.transitionTo(nodeId, 'disposed')
  }

  /**
   * Initialize all root nodes (nodes without parents)
   */
  async initializeAll(): Promise<void> {
    const rootNodes = Array.from(this.hierarchy.entries())
      .filter(([_, parentId]) => parentId === null)
      .map(([nodeId]) => nodeId)

    for (const nodeId of rootNodes) {
      await this.initialize(nodeId, { recursive: true })
    }
  }

  /**
   * Dispose all nodes
   */
  async disposeAll(): Promise<void> {
    const rootNodes = Array.from(this.hierarchy.entries())
      .filter(([_, parentId]) => parentId === null)
      .map(([nodeId]) => nodeId)

    for (const nodeId of rootNodes) {
      await this.dispose(nodeId, 'scene')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Transitions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transition a node to a new state
   */
  private async transitionTo(nodeId: string, newState: LifecycleState): Promise<void> {
    const info = this.nodes.get(nodeId)
    if (!info) return

    const oldState = info.state

    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[Lifecycle] Invalid transition: ${oldState} → ${newState} for '${nodeId}'`)
      return
    }

    info.state = newState

    // Clear error on successful transition away from error
    if (oldState === 'error' && newState !== 'error') {
      info.error = undefined
      info.retryCount = 0
    }
  }

  /**
   * Check if a state transition is valid
   */
  private isValidTransition(from: LifecycleState, to: LifecycleState): boolean {
    const validTransitions: Record<LifecycleState, LifecycleState[]> = {
      uninitialized: ['constructing'],
      constructing: ['pending', 'error'],
      pending: ['ready', 'error'],
      ready: ['disposed', 'error'],
      error: ['pending', 'disposed'], // Can retry or dispose
      disposed: [], // Terminal state
    }

    return validTransitions[from]?.includes(to) ?? false
  }

  /**
   * Handle initialization error with retry logic
   */
  private async handleError(nodeId: string, error: Error, phase: string): Promise<boolean> {
    const info = this.nodes.get(nodeId)
    if (!info) return false

    info.error = error
    info.retryCount++

    // Emit error event
    const errorEvent = createGameEvent<ErrorEventData>({
      type: 'Error',
      source: { id: nodeId },
      data: {
        nodeId,
        error,
        phase,
        recoverable: info.retryCount <= info.config.retryCount,
      },
      bubbles: !info.config.errorBoundary,
      routing: info.config.errorBoundary ? 'local' : 'bubble',
    })

    await this.eventBus.emit(errorEvent)

    // Check if we should retry
    if (info.retryCount <= info.config.retryCount) {
      const delay = this.calculateRetryDelay(info)
      console.log(`[Lifecycle] Retrying '${nodeId}' in ${delay}ms (attempt ${info.retryCount})`)

      await new Promise(resolve => setTimeout(resolve, delay))

      // Transition back to pending for retry
      info.state = 'uninitialized' // Reset state for retry
      return this.initialize(nodeId, { recursive: false })
    }

    // No more retries - handle based on fallback config
    switch (info.config.fallbackState) {
      case 'error':
        await this.transitionTo(nodeId, 'error')
        console.error(`[Lifecycle] Node '${nodeId}' failed: ${error.message}`)
        return false

      case 'dispose':
        await this.dispose(nodeId, 'error')
        return false

      case 'retry':
        // Keep trying forever (dangerous!)
        info.retryCount = 0
        return this.initialize(nodeId, { recursive: false })

      default:
        await this.transitionTo(nodeId, 'error')
        return false
    }
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(info: NodeLifecycleInfo): number {
    const base = info.config.retryDelayMs

    switch (info.config.retryBackoff) {
      case 'none':
        return base
      case 'linear':
        return base * info.retryCount
      case 'exponential':
        return base * Math.pow(2, info.retryCount - 1)
      default:
        return base
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set global seed for deterministic construction scripts
   */
  setGlobalSeed(seed: number): void {
    this.globalSeed = seed
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    this.nodes.clear()
    this.hierarchy.clear()
    this.children.clear()
  }

  /**
   * Get debug info
   */
  getDebugInfo(): Record<string, unknown> {
    const nodeStates: Record<string, string> = {}
    for (const [id, info] of this.nodes) {
      nodeStates[id] = info.state
    }
    return {
      nodeCount: this.nodes.size,
      states: nodeStates,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const GlobalLifecycleManager = new LifecycleManager()
