// ═══════════════════════════════════════════════════════════════════════════
// PlayModeManager - Orchestrates scene-level play mode execution
// Handles state snapshots, lifecycle management, and runtime bridging
// ═══════════════════════════════════════════════════════════════════════════

import { RuntimeManager, Runtime } from './RuntimeManager'
import { GameEventBus, createGameEvent } from './events'
import { GlobalVariables } from './variables'
import { BehaviorComponent, ComponentInstanceRegistry } from '../components/BehaviorComponent'
import type { Node, EntityMaps, NormalizedNode, NormalizedComponent } from '../../stores/engineState'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PlayModeStatus = 'stopped' | 'playing' | 'paused'

export interface SceneSnapshot {
  timestamp: number
  rootNode: Node
  entities: EntityMaps
  globalVariables: Record<string, unknown>
}

export interface PlayModeState {
  status: PlayModeStatus
  snapshot: SceneSnapshot | null
  startTime: number
  frameCount: number
  elapsedTime: number
}

export interface PlayModeStats {
  fps: number
  frameTime: number
  entityCount: number
  componentCount: number
  behaviorCount: number
}

export interface EntityRuntimeState {
  id: string
  name: string
  position: [number, number, number]
  components: Array<{
    id: string
    script: string
    enabled: boolean
    properties: Record<string, unknown>
  }>
}

type PlayModeListener = (state: PlayModeState) => void

// ─────────────────────────────────────────────────────────────────────────────
// PlayModeManager
// ─────────────────────────────────────────────────────────────────────────────

export class PlayModeManager {
  private static instance: PlayModeManager

  // State
  private state: PlayModeState = {
    status: 'stopped',
    snapshot: null,
    startTime: 0,
    frameCount: 0,
    elapsedTime: 0,
  }

  // Runtime reference
  private runtime: RuntimeManager

  // Active behavior instances
  private activeBehaviors: Map<string, BehaviorComponent> = new Map()

  // Listeners for state changes
  private listeners: Set<PlayModeListener> = new Set()

  // Step mode
  private stepRequested: boolean = false
  private stepsRemaining: number = 0

  // Store reference for state access (injected)
  private getStoreState: (() => { scene: { rootNode: Node }; entities: EntityMaps }) | null = null
  private setStoreState: ((updates: Partial<{ scene: { rootNode: Node } }>) => void) | null = null

  static getInstance(): PlayModeManager {
    if (!PlayModeManager.instance) {
      PlayModeManager.instance = new PlayModeManager()
    }
    return PlayModeManager.instance
  }

  constructor() {
    this.runtime = Runtime
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Store Integration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inject store accessors for state management
   */
  setStoreAccessors(
    getState: () => { scene: { rootNode: Node }; entities: EntityMaps },
    setState: (updates: Partial<{ scene: { rootNode: Node } }>) => void
  ): void {
    this.getStoreState = getState
    this.setStoreState = setState
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core Controls
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start play mode - snapshot state and begin execution
   */
  async start(): Promise<void> {
    if (this.state.status !== 'stopped') {
      console.warn('[PlayMode] Already running')
      return
    }

    if (!this.getStoreState) {
      console.error('[PlayMode] Store not connected')
      return
    }

    console.log('[PlayMode] Starting...')

    // Take snapshot of current state
    const storeState = this.getStoreState()
    const rootNode = storeState.scene?.rootNode

    // Guard against undefined rootNode
    if (!rootNode) {
      console.error('[PlayMode] No root node in scene - cannot start play mode')
      return
    }

    this.state.snapshot = this.createSnapshot(rootNode, storeState.entities)

    // Update state
    this.state.status = 'playing'
    this.state.startTime = Date.now()
    this.state.frameCount = 0
    this.state.elapsedTime = 0

    // Initialize all behavior components in the scene
    await this.initializeSceneBehaviors(rootNode)

    // Start the runtime
    this.runtime.start()

    // Subscribe to frame updates for tracking
    this.runtime.onUpdate(this.onRuntimeUpdate)

    // Emit play mode started event
    GameEventBus.emit(createGameEvent({
      type: 'playmode:start',
      source: { type: 'system', id: 'playmode' },
      data: { timestamp: this.state.startTime },
    }))

    this.notifyListeners()
    console.log('[PlayMode] Started')
  }

  /**
   * Stop play mode - optionally apply or discard changes
   */
  stop(applyChanges: boolean = false): void {
    if (this.state.status === 'stopped') {
      console.warn('[PlayMode] Already stopped')
      return
    }

    console.log(`[PlayMode] Stopping (apply=${applyChanges})...`)

    // Stop the runtime
    this.runtime.stop()

    // Dispose all behavior instances
    this.disposeSceneBehaviors()

    // Restore snapshot or apply changes
    if (!applyChanges && this.state.snapshot && this.setStoreState) {
      console.log('[PlayMode] Restoring snapshot')
      this.setStoreState({ scene: { rootNode: this.state.snapshot.rootNode } })
      GlobalVariables.restoreSnapshot(this.state.snapshot.globalVariables)
    } else {
      console.log('[PlayMode] Applying runtime changes')
    }

    // Emit play mode stopped event
    GameEventBus.emit(createGameEvent({
      type: 'playmode:stop',
      source: { type: 'system', id: 'playmode' },
      data: {
        applied: applyChanges,
        duration: Date.now() - this.state.startTime,
        frames: this.state.frameCount,
      },
    }))

    // Reset state
    this.state.status = 'stopped'
    this.state.snapshot = null

    this.notifyListeners()
    console.log('[PlayMode] Stopped')
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.state.status !== 'playing') {
      console.warn('[PlayMode] Not playing')
      return
    }

    this.runtime.pause()
    this.state.status = 'paused'

    GameEventBus.emit(createGameEvent({
      type: 'playmode:pause',
      source: { type: 'system', id: 'playmode' },
      data: {},
    }))

    this.notifyListeners()
    console.log('[PlayMode] Paused')
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.state.status !== 'paused') {
      console.warn('[PlayMode] Not paused')
      return
    }

    this.runtime.resume()
    this.state.status = 'playing'

    GameEventBus.emit(createGameEvent({
      type: 'playmode:resume',
      source: { type: 'system', id: 'playmode' },
      data: {},
    }))

    this.notifyListeners()
    console.log('[PlayMode] Resumed')
  }

  /**
   * Step forward by N frames (while paused)
   */
  stepFrame(count: number = 1): void {
    if (this.state.status !== 'paused') {
      console.warn('[PlayMode] Must be paused to step')
      return
    }

    this.stepsRemaining = count
    this.stepRequested = true

    // Temporarily resume for stepping
    this.runtime.resume()

    console.log(`[PlayMode] Stepping ${count} frame(s)`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────────────────

  getState(): Readonly<PlayModeState> {
    return this.state
  }

  getStatus(): PlayModeStatus {
    return this.state.status
  }

  isPlaying(): boolean {
    return this.state.status === 'playing'
  }

  isPaused(): boolean {
    return this.state.status === 'paused'
  }

  isStopped(): boolean {
    return this.state.status === 'stopped'
  }

  isRunning(): boolean {
    return this.state.status !== 'stopped'
  }

  getSnapshot(): SceneSnapshot | null {
    return this.state.snapshot
  }

  getStats(): PlayModeStats {
    const runtimeStats = this.runtime.getStats()
    return {
      fps: runtimeStats.fps,
      frameTime: runtimeStats.frameTime,
      entityCount: this.getStoreState?.().entities.nodeOrder.length ?? 0,
      componentCount: Object.keys(this.getStoreState?.().entities.components ?? {}).length,
      behaviorCount: this.activeBehaviors.size,
    }
  }

  getElapsedTime(): number {
    return this.state.elapsedTime
  }

  getFrameCount(): number {
    return this.state.frameCount
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entity State Query (for MCP/debugging)
  // ─────────────────────────────────────────────────────────────────────────

  getEntityState(entityId: string): EntityRuntimeState | null {
    if (!this.getStoreState) return null

    const entities = this.getStoreState().entities
    const node = entities.nodes[entityId]
    if (!node) return null

    const components = node.componentIds.map(compId => {
      const comp = entities.components[compId]
      return {
        id: comp.id,
        script: comp.script,
        enabled: comp.enabled,
        properties: { ...comp.properties },
      }
    })

    return {
      id: node.id,
      name: node.name,
      position: node.transform?.position ?? [0, 0, 0],
      components,
    }
  }

  getAllEntities(): EntityRuntimeState[] {
    if (!this.getStoreState) return []

    const entities = this.getStoreState().entities
    return entities.nodeOrder.map(id => this.getEntityState(id)).filter((e): e is EntityRuntimeState => e !== null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Listener Management
  // ─────────────────────────────────────────────────────────────────────────

  subscribe(listener: PlayModeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────

  private createSnapshot(rootNode: Node, entities: EntityMaps): SceneSnapshot {
    return {
      timestamp: Date.now(),
      rootNode: JSON.parse(JSON.stringify(rootNode)),
      entities: JSON.parse(JSON.stringify(entities)),
      globalVariables: GlobalVariables.getSnapshot(),
    }
  }

  private async initializeSceneBehaviors(rootNode: Node): Promise<void> {
    // Walk the tree and find all nodes with Behavior components
    const behaviorNodes = this.findBehaviorNodes(rootNode)

    console.log(`[PlayMode] Found ${behaviorNodes.length} nodes with Behavior components`)

    for (const node of behaviorNodes) {
      const behaviorComp = node.components.find(c => c.script === 'Behavior')
      if (!behaviorComp) continue

      // Create behavior instance
      try {
        const behavior = new BehaviorComponent()
        behavior.setEntityId(node.id)
        behavior.setGraphData(behaviorComp.properties.graph as Record<string, unknown>)

        // Register with runtime
        this.runtime.registerBehavior(behavior)
        this.activeBehaviors.set(node.id, behavior)

        // Call lifecycle: Attach
        behavior.onAttach?.()
      } catch (error) {
        console.error(`[PlayMode] Failed to initialize behavior for ${node.id}:`, error)
      }
    }

    // Call Init lifecycle on all behaviors
    for (const behavior of this.activeBehaviors.values()) {
      try {
        behavior.onInit?.()
      } catch (error) {
        console.error('[PlayMode] Behavior init failed:', error)
      }
    }
  }

  private disposeSceneBehaviors(): void {
    for (const [entityId, behavior] of this.activeBehaviors) {
      try {
        behavior.onDispose?.()
        behavior.onDetach?.()
        this.runtime.unregisterBehavior(behavior)
      } catch (error) {
        console.error(`[PlayMode] Failed to dispose behavior for ${entityId}:`, error)
      }
    }
    this.activeBehaviors.clear()
  }

  private findBehaviorNodes(node: Node): Node[] {
    const results: Node[] = []

    const hasBehavior = node.components.some(c => c.script === 'Behavior')
    if (hasBehavior) {
      results.push(node)
    }

    for (const child of node.children) {
      results.push(...this.findBehaviorNodes(child))
    }

    return results
  }

  private onRuntimeUpdate = (deltaTime: number): void => {
    this.state.frameCount++
    this.state.elapsedTime += deltaTime

    // Handle step mode
    if (this.stepRequested) {
      this.stepsRemaining--
      if (this.stepsRemaining <= 0) {
        this.stepRequested = false
        this.runtime.pause()
        this.state.status = 'paused'
        this.notifyListeners()
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const PlayMode = PlayModeManager.getInstance()

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

export const startPlayMode = () => PlayMode.start()
export const stopPlayMode = (apply?: boolean) => PlayMode.stop(apply)
export const pausePlayMode = () => PlayMode.pause()
export const resumePlayMode = () => PlayMode.resume()
export const stepPlayMode = (count?: number) => PlayMode.stepFrame(count)
export const getPlayModeStatus = () => PlayMode.getStatus()
export const isPlayModeRunning = () => PlayMode.isRunning()
