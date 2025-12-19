// =============================================================================
// Graph Debugger - Breakpoints and step-through execution
// =============================================================================

import { GraphRunner, GraphRunnerEvent, GraphRunnerState } from './GraphRunner'
import { ExprValue } from './expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Breakpoint {
  nodeId: string
  condition?: string  // Optional expression that must be true to break
  hitCount?: number   // Break after N hits (0 = always)
  enabled: boolean
}

export interface DebugState {
  isDebugging: boolean
  isPaused: boolean
  currentNodeId: string | null
  callStack: string[]
  watchedVariables: Map<string, ExprValue>
  breakpointHits: Map<string, number>
}

export type DebugEvent =
  | { type: 'breakpoint-hit'; nodeId: string; variables: Record<string, ExprValue> }
  | { type: 'step-complete'; nodeId: string }
  | { type: 'debug-start' }
  | { type: 'debug-stop' }
  | { type: 'debug-pause' }
  | { type: 'debug-resume' }

export type DebugEventListener = (event: DebugEvent) => void

// -----------------------------------------------------------------------------
// Graph Debugger
// -----------------------------------------------------------------------------

export class GraphDebugger {
  private runner: GraphRunner | null = null
  private breakpoints: Map<string, Breakpoint> = new Map()
  private state: DebugState = {
    isDebugging: false,
    isPaused: false,
    currentNodeId: null,
    callStack: [],
    watchedVariables: new Map(),
    breakpointHits: new Map(),
  }
  private listeners: Set<DebugEventListener> = new Set()
  private stepMode: 'none' | 'over' | 'into' | 'out' = 'none'
  private stepResolve: (() => void) | null = null

  /**
   * Attach debugger to a graph runner
   */
  attach(runner: GraphRunner): void {
    this.runner = runner

    // Listen for runner events
    runner.addListener((event: GraphRunnerEvent) => {
      if (event.type === 'nodeExecute') {
        const { nodeId } = event.data as { nodeId: string }
        this.onNodeExecute(nodeId)
      }
    })
  }

  /**
   * Detach from runner
   */
  detach(): void {
    this.runner = null
    this.state.isDebugging = false
    this.state.isPaused = false
  }

  // ---------------------------------------------------------------------------
  // Breakpoints
  // ---------------------------------------------------------------------------

  /**
   * Set a breakpoint on a node
   */
  setBreakpoint(nodeId: string, options: Partial<Breakpoint> = {}): void {
    this.breakpoints.set(nodeId, {
      nodeId,
      enabled: true,
      ...options,
    })
    console.log('[Debugger] Breakpoint set:', nodeId)
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(nodeId: string): void {
    this.breakpoints.delete(nodeId)
    this.state.breakpointHits.delete(nodeId)
  }

  /**
   * Toggle a breakpoint
   */
  toggleBreakpoint(nodeId: string): boolean {
    const bp = this.breakpoints.get(nodeId)
    if (bp) {
      bp.enabled = !bp.enabled
      return bp.enabled
    } else {
      this.setBreakpoint(nodeId)
      return true
    }
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values())
  }

  /**
   * Check if a node has a breakpoint
   */
  hasBreakpoint(nodeId: string): boolean {
    return this.breakpoints.has(nodeId)
  }

  /**
   * Check if a breakpoint is enabled
   */
  isBreakpointEnabled(nodeId: string): boolean {
    return this.breakpoints.get(nodeId)?.enabled ?? false
  }

  // ---------------------------------------------------------------------------
  // Debug Control
  // ---------------------------------------------------------------------------

  /**
   * Start debugging
   */
  async startDebugging(): Promise<void> {
    if (!this.runner) {
      console.error('[Debugger] No runner attached')
      return
    }

    this.state.isDebugging = true
    this.state.isPaused = false
    this.state.callStack = []
    this.state.breakpointHits.clear()

    this.emit({ type: 'debug-start' })
    await this.runner.start()
  }

  /**
   * Stop debugging
   */
  stopDebugging(): void {
    if (!this.runner) return

    this.state.isDebugging = false
    this.state.isPaused = false
    this.stepMode = 'none'

    if (this.stepResolve) {
      this.stepResolve()
      this.stepResolve = null
    }

    this.runner.stop()
    this.emit({ type: 'debug-stop' })
  }

  /**
   * Continue execution
   */
  continue(): void {
    if (!this.state.isPaused) return

    this.state.isPaused = false
    this.stepMode = 'none'

    if (this.stepResolve) {
      this.stepResolve()
      this.stepResolve = null
    }

    this.emit({ type: 'debug-resume' })
  }

  /**
   * Step over - execute current node and pause at next
   */
  stepOver(): void {
    if (!this.state.isPaused) return

    this.stepMode = 'over'
    this.state.isPaused = false

    if (this.stepResolve) {
      this.stepResolve()
      this.stepResolve = null
    }
  }

  /**
   * Step into - step into subgraph if available
   */
  stepInto(): void {
    if (!this.state.isPaused) return

    this.stepMode = 'into'
    this.state.isPaused = false

    if (this.stepResolve) {
      this.stepResolve()
      this.stepResolve = null
    }
  }

  /**
   * Step out - continue until exiting current subgraph
   */
  stepOut(): void {
    if (!this.state.isPaused) return

    this.stepMode = 'out'
    this.state.isPaused = false

    if (this.stepResolve) {
      this.stepResolve()
      this.stepResolve = null
    }
  }

  // ---------------------------------------------------------------------------
  // Variable Watching
  // ---------------------------------------------------------------------------

  /**
   * Add a variable to watch
   */
  watchVariable(name: string): void {
    this.state.watchedVariables.set(name, null)
    this.updateWatchedVariable(name)
  }

  /**
   * Remove a watched variable
   */
  unwatchVariable(name: string): void {
    this.state.watchedVariables.delete(name)
  }

  /**
   * Get all watched variables
   */
  getWatchedVariables(): Map<string, ExprValue> {
    // Update all watched variables
    for (const name of this.state.watchedVariables.keys()) {
      this.updateWatchedVariable(name)
    }
    return new Map(this.state.watchedVariables)
  }

  private updateWatchedVariable(name: string): void {
    if (!this.runner) return
    const value = this.runner.getVariable(name)
    this.state.watchedVariables.set(name, value)
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  getState(): DebugState {
    return { ...this.state }
  }

  isDebugging(): boolean {
    return this.state.isDebugging
  }

  isPaused(): boolean {
    return this.state.isPaused
  }

  getCurrentNodeId(): string | null {
    return this.state.currentNodeId
  }

  getCallStack(): string[] {
    return [...this.state.callStack]
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to debug events
   */
  addListener(listener: DebugEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: DebugEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (e) {
        console.error('[Debugger] Listener error:', e)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async onNodeExecute(nodeId: string): Promise<void> {
    if (!this.state.isDebugging) return

    this.state.currentNodeId = nodeId

    // Update call stack
    if (!this.state.callStack.includes(nodeId)) {
      this.state.callStack.push(nodeId)
    }

    // Check for breakpoint
    const bp = this.breakpoints.get(nodeId)
    let shouldBreak = false

    if (bp?.enabled) {
      // Check hit count
      const hits = (this.state.breakpointHits.get(nodeId) || 0) + 1
      this.state.breakpointHits.set(nodeId, hits)

      if (!bp.hitCount || hits >= bp.hitCount) {
        // Check condition
        if (bp.condition) {
          // TODO: Evaluate condition expression
          shouldBreak = true
        } else {
          shouldBreak = true
        }
      }
    }

    // Check step mode
    if (this.stepMode === 'over' || this.stepMode === 'into') {
      shouldBreak = true
      this.stepMode = 'none'
    }

    if (shouldBreak) {
      await this.pauseExecution(nodeId)
    }
  }

  private async pauseExecution(nodeId: string): Promise<void> {
    this.state.isPaused = true
    this.runner?.pause()

    // Get current variables
    const variables = this.runner?.getAllVariables() || {}

    this.emit({
      type: 'breakpoint-hit',
      nodeId,
      variables,
    })

    // Wait for continue/step
    await new Promise<void>((resolve) => {
      this.stepResolve = resolve
    })

    if (this.state.isDebugging && !this.state.isPaused) {
      this.runner?.resume()
    }
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const graphDebugger = new GraphDebugger()

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function attachDebugger(runner: GraphRunner): void {
  graphDebugger.attach(runner)
}

export function setBreakpoint(nodeId: string): void {
  graphDebugger.setBreakpoint(nodeId)
}

export function removeBreakpoint(nodeId: string): void {
  graphDebugger.removeBreakpoint(nodeId)
}

export function toggleBreakpoint(nodeId: string): boolean {
  return graphDebugger.toggleBreakpoint(nodeId)
}

export function startDebugging(): Promise<void> {
  return graphDebugger.startDebugging()
}

export function stopDebugging(): void {
  graphDebugger.stopDebugging()
}

export function continueExecution(): void {
  graphDebugger.continue()
}

export function stepOver(): void {
  graphDebugger.stepOver()
}

export function stepInto(): void {
  graphDebugger.stepInto()
}

export function stepOut(): void {
  graphDebugger.stepOut()
}
