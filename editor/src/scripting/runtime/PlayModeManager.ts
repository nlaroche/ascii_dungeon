// ═══════════════════════════════════════════════════════════════════════════
// PlayModeManager - Orchestrates scene-level play mode execution
// Handles state snapshots, lifecycle management, and runtime bridging
// ═══════════════════════════════════════════════════════════════════════════

import { RuntimeManager, Runtime } from './RuntimeManager'
import { GameEventBus, createGameEvent } from './events'
import { GlobalVariables } from './variables'
import { BehaviorComponent, ComponentInstanceRegistry, BehaviorGraphRegistry } from '../components/BehaviorComponent'
import type { LogicGraph, VariableDef } from './graph'
import { PlayerControllerComponent } from '../components/PlayerControllerComponent'
import { graphStorage } from './GraphStorage'
import { reactFlowToGraph } from './serialization'
import { Scene } from './SceneManager'
import type { Node, EntityMaps, NormalizedNode, NormalizedComponent } from '../../stores/engineState'

// Runtime component interface for script components
interface RuntimeComponent {
  setStoreAccessor: (accessor: () => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }) => void
  onInit?: () => void
  onUpdate?: (deltaTime: number) => void
  onDispose?: () => void
  node?: Node
}

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

  // Active runtime script components (PlayerController, WanderAI, etc.)
  private activeRuntimeComponents: Map<string, RuntimeComponent> = new Map()

  // Listeners for state changes
  private listeners: Set<PlayModeListener> = new Set()

  // Step mode
  private stepRequested: boolean = false
  private stepsRemaining: number = 0

  // Store reference for state access (injected)
  private getStoreState: (() => { scene: { rootNode: Node }; entities: EntityMaps; project: { root: string } }) | null = null
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
    getState: () => { scene: { rootNode: Node }; entities: EntityMaps; project: { root: string } },
    setState: (updates: Partial<{ scene: { rootNode: Node } }>) => void,
    setPath?: (path: (string | number)[], value: unknown) => void
  ): void {
    this.getStoreState = getState
    this.setStoreState = setState

    // Also set up the Scene manager with store access for entity transforms
    if (setPath) {
      Scene.setStoreAccessor({
        getState: () => getState() as { entities: { nodes: Record<string, { components: string[] }>; components: Record<string, { script: string; properties?: Record<string, unknown> }> } },
        setPath
      })
    }
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

    // Load graph files from project into registry
    await this.loadProjectGraphs()

    // Initialize all behavior components in the scene
    await this.initializeSceneBehaviors(rootNode)

    // Initialize runtime script components (PlayerController, WanderAI, etc.)
    this.initializeRuntimeComponents(rootNode)

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

    // Dispose runtime script components
    this.disposeRuntimeComponents()

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

  /**
   * Load all graph files from the project's graphs/ folder into BehaviorGraphRegistry
   */
  private async loadProjectGraphs(): Promise<void> {
    try {
      // Get project root and set basePath for graphStorage
      const projectRoot = this.getStoreState?.().project?.root
      if (!projectRoot) {
        console.warn('[PlayMode] No project root set, cannot load graphs')
        return
      }
      graphStorage.setBasePath(projectRoot)

      // List all graph files
      const graphList = await graphStorage.list()
      console.log(`[PlayMode] Loading ${graphList.length} graph files from ${projectRoot}...`)

      for (const entry of graphList) {
        try {
          const { graph, nodes, edges } = await graphStorage.load(entry.path)

          // Convert saved graph format to LogicGraph
          const logicGraph = reactFlowToGraph(nodes, edges, graph.id)

          // Add variables from the saved graph
          if (graph.variables && Array.isArray(graph.variables)) {
            logicGraph.variables = graph.variables.map(v => ({
              name: v.name,
              type: v.type as VariableDef['type'],
              scope: v.scope,
              default: v.defaultValue,
            }))
          }

          // Register in the behavior graph registry
          BehaviorGraphRegistry.register(logicGraph)
          console.log(`[PlayMode] Loaded graph: ${graph.name} (${graph.id})`)
        } catch (e) {
          console.warn(`[PlayMode] Failed to load graph ${entry.path}:`, e)
        }
      }
    } catch (e) {
      console.warn('[PlayMode] Failed to list project graphs:', e)
    }
  }

  private async initializeSceneBehaviors(rootNode: Node): Promise<void> {
    // Walk the tree and find all nodes with Behavior components
    const behaviorNodes = this.findBehaviorNodes(rootNode)

    console.log(`[PlayMode] Found ${behaviorNodes.length} nodes with Behavior components`)

    for (const node of behaviorNodes) {
      const behaviorComp = node.components.find(c => c.script === 'Behavior')
      if (!behaviorComp) continue

      console.log(`[PlayMode] Initializing behavior for node: ${node.name} (${node.id})`)
      console.log(`[PlayMode] Behavior component properties:`, behaviorComp.properties)

      // Create behavior instance
      try {
        const behavior = new BehaviorComponent()

        // Set node reference - this also calls onAttach internally
        behavior._setNode(node)
        console.log(`[PlayMode] Node reference set, node.id=${behavior.getNode()?.id}`)

        // Check if this is a graphId reference or inline graph
        if (behaviorComp.properties?.graphId) {
          // Graph file reference - set properties and let onInit load it
          behavior.graphId = behaviorComp.properties.graphId as string
          behavior.autoStart = (behaviorComp.properties.autoStart as boolean) ?? true
          behavior.receiveUpdates = (behaviorComp.properties.receiveUpdates as boolean) ?? true
          console.log(`[PlayMode] Set graphId=${behavior.graphId}, autoStart=${behavior.autoStart}`)
        } else if (behaviorComp.properties?.graph) {
          // Inline graph definition - convert and load
          const inlineGraph = behaviorComp.properties.graph as LogicGraph
          behavior.loadInlineGraph(inlineGraph)
          console.log(`[PlayMode] Loaded inline graph`)
        } else {
          console.log(`[PlayMode] No graphId or graph property found`)
        }

        // Register with runtime
        this.runtime.registerBehavior(behavior)
        this.activeBehaviors.set(node.id, behavior)
        console.log(`[PlayMode] Behavior registered`)
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

    // Find nodes with Behavior components
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

    // Update runtime script components
    for (const [id, component] of this.activeRuntimeComponents) {
      try {
        component.onUpdate?.(deltaTime)
      } catch (error) {
        console.error(`[PlayMode] Runtime component update error (${id}):`, error)
      }
    }

    // Handle step mode
    if (this.stepRequested) {
      this.stepsRemaining--
      if (this.stepsRemaining <= 0) {
        this.stepRequested = false
        this.runtime.pause()
        this.state.status = 'paused'
      }
    }

    // Notify listeners of time/frame updates
    this.notifyListeners()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Runtime Components (PlayerController, WanderAI, etc.)
  // ─────────────────────────────────────────────────────────────────────────

  private initializeRuntimeComponents(rootNode: Node): void {
    const runtimeNodes = this.findRuntimeComponentNodes(rootNode)
    console.log(`[PlayMode] Found ${runtimeNodes.length} nodes with runtime components`)

    for (const { node, scriptName, compData } of runtimeNodes) {
      try {
        let component: RuntimeComponent | null = null

        // Create the appropriate component instance
        switch (scriptName) {
          case 'PlayerController': {
            const pc = new PlayerControllerComponent()
            // Copy properties from scene data
            if (compData.properties) {
              pc.moveSpeed = (compData.properties.moveSpeed as number) ?? 5
              pc.gridSnap = (compData.properties.gridSnap as boolean) ?? true
              pc.moveCooldown = (compData.properties.moveCooldown as number) ?? 0.15
            }
            component = pc
            break
          }
          // Note: Behavior components are handled by initializeSceneBehaviors
          // which uses the graph registry for visual scripting graphs
        }

        if (component) {
          // Set node reference and store accessor
          (component as { node?: Node }).node = node
          component.setStoreAccessor(() => this.getStoreState!())

          // Call init lifecycle
          component.onInit?.()

          // Store the active component
          const key = `${node.id}:${scriptName}`
          this.activeRuntimeComponents.set(key, component)
          console.log(`[PlayMode] Initialized ${scriptName} on ${node.name}`)
        }
      } catch (error) {
        console.error(`[PlayMode] Failed to initialize ${scriptName} on ${node.name}:`, error)
      }
    }
  }

  private disposeRuntimeComponents(): void {
    for (const [key, component] of this.activeRuntimeComponents) {
      try {
        component.onDispose?.()
      } catch (error) {
        console.error(`[PlayMode] Runtime component dispose error (${key}):`, error)
      }
    }
    this.activeRuntimeComponents.clear()
  }

  private findRuntimeComponentNodes(node: Node): Array<{ node: Node; scriptName: string; compData: { properties?: Record<string, unknown> } }> {
    const results: Array<{ node: Node; scriptName: string; compData: { properties?: Record<string, unknown> } }> = []

    // Check for runtime script components (game-specific scripts)
    // Note: Behavior components use visual scripting and are handled separately
    const runtimeScripts = ['PlayerController']
    for (const comp of node.components) {
      if (runtimeScripts.includes(comp.script)) {
        results.push({ node, scriptName: comp.script, compData: comp })
      }
    }

    // Recurse into children
    for (const child of node.children) {
      results.push(...this.findRuntimeComponentNodes(child))
    }

    return results
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
