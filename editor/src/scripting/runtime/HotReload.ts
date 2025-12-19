// =============================================================================
// Hot Reload - Live update graphs without stopping execution
// =============================================================================

import type { Node, Edge } from '@xyflow/react'
import { GraphRunner, GraphRunnerState } from './GraphRunner'
import { graphStorage, SavedGraph } from './GraphStorage'
import { entityBindingManager, BoundGraph } from './EntityBinding'
import { ExprValue } from './expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HotReloadResult {
  success: boolean
  graphId: string
  preservedVariables: string[]
  errors: string[]
}

export interface HotReloadOptions {
  preserveVariables?: boolean
  preserveState?: boolean
  onBeforeReload?: () => void
  onAfterReload?: (result: HotReloadResult) => void
}

// -----------------------------------------------------------------------------
// Hot Reload Manager
// -----------------------------------------------------------------------------

class HotReloadManager {
  private watchedFiles: Map<string, string> = new Map()  // path -> last content hash
  private fileWatchers: Map<string, () => void> = new Map()

  /**
   * Hot reload a graph runner with new nodes/edges
   */
  reloadGraph(
    runner: GraphRunner,
    nodes: Node[],
    edges: Edge[],
    options: HotReloadOptions = {}
  ): HotReloadResult {
    const { preserveVariables = true, preserveState = true } = options

    const result: HotReloadResult = {
      success: false,
      graphId: '',
      preservedVariables: [],
      errors: [],
    }

    try {
      // Capture current state
      const wasRunning = runner.getState() === 'running'
      const wasPaused = runner.getState() === 'paused'
      const currentVariables = preserveVariables ? runner.getAllVariables() : {}

      options.onBeforeReload?.()

      // Stop if running
      if (wasRunning || wasPaused) {
        runner.stop()
      }

      // Load new graph
      const loadResult = runner.loadFromReactFlow(nodes, edges, 'hot-reload')
      if (!loadResult.success) {
        result.errors = loadResult.errors
        return result
      }

      // Restore variables
      if (preserveVariables) {
        for (const [name, value] of Object.entries(currentVariables)) {
          try {
            runner.setVariable(name, value)
            result.preservedVariables.push(name)
          } catch (e) {
            console.warn(`[HotReload] Could not restore variable '${name}':`, e)
          }
        }
      }

      // Restore running state
      if (preserveState && (wasRunning || wasPaused)) {
        runner.start()
        if (wasPaused) {
          runner.pause()
        }
      }

      result.success = true
      result.graphId = 'hot-reload'

      options.onAfterReload?.(result)
      console.log('[HotReload] Graph reloaded successfully')

    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e))
      console.error('[HotReload] Failed:', e)
    }

    return result
  }

  /**
   * Hot reload all graphs bound to an entity
   */
  reloadEntityGraphs(
    entityId: string,
    nodes: Node[],
    edges: Edge[],
    options: HotReloadOptions = {}
  ): HotReloadResult[] {
    const bindings = entityBindingManager.getBindingsForEntity(entityId)
    const results: HotReloadResult[] = []

    for (const binding of bindings) {
      const result = this.reloadGraph(binding.runner, nodes, edges, options)
      results.push(result)
    }

    return results
  }

  /**
   * Reload a graph from a saved file
   */
  async reloadFromFile(
    runner: GraphRunner,
    filePath: string,
    options: HotReloadOptions = {}
  ): Promise<HotReloadResult> {
    try {
      const { graph, nodes, edges } = await graphStorage.load(filePath)
      return this.reloadGraph(runner, nodes, edges, {
        ...options,
        onAfterReload: (result) => {
          result.graphId = graph.id
          options.onAfterReload?.(result)
        },
      })
    } catch (e) {
      return {
        success: false,
        graphId: filePath,
        preservedVariables: [],
        errors: [e instanceof Error ? e.message : String(e)],
      }
    }
  }

  /**
   * Watch a graph file for changes and auto-reload
   */
  watchFile(
    filePath: string,
    runner: GraphRunner,
    options: HotReloadOptions = {}
  ): () => void {
    // Store initial content hash
    this.watchedFiles.set(filePath, '')

    // Set up polling (since we don't have native file watching in browser)
    const pollInterval = setInterval(async () => {
      try {
        const { graph, nodes, edges } = await graphStorage.load(filePath)
        const contentHash = JSON.stringify({ nodes, edges })

        const lastHash = this.watchedFiles.get(filePath)
        if (lastHash && lastHash !== contentHash) {
          console.log('[HotReload] File changed, reloading:', filePath)
          this.reloadGraph(runner, nodes, edges, options)
        }

        this.watchedFiles.set(filePath, contentHash)
      } catch (e) {
        // File might not exist yet or be temporarily unavailable
      }
    }, 1000) // Poll every second

    const cleanup = () => {
      clearInterval(pollInterval)
      this.watchedFiles.delete(filePath)
      this.fileWatchers.delete(filePath)
    }

    this.fileWatchers.set(filePath, cleanup)
    return cleanup
  }

  /**
   * Stop watching a file
   */
  unwatchFile(filePath: string): void {
    const cleanup = this.fileWatchers.get(filePath)
    if (cleanup) {
      cleanup()
    }
  }

  /**
   * Stop all file watchers
   */
  unwatchAll(): void {
    for (const cleanup of this.fileWatchers.values()) {
      cleanup()
    }
    this.fileWatchers.clear()
    this.watchedFiles.clear()
  }

  /**
   * Get list of watched files
   */
  getWatchedFiles(): string[] {
    return Array.from(this.watchedFiles.keys())
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const hotReloadManager = new HotReloadManager()

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function hotReloadGraph(
  runner: GraphRunner,
  nodes: Node[],
  edges: Edge[],
  options?: HotReloadOptions
): HotReloadResult {
  return hotReloadManager.reloadGraph(runner, nodes, edges, options)
}

export function hotReloadFromFile(
  runner: GraphRunner,
  filePath: string,
  options?: HotReloadOptions
): Promise<HotReloadResult> {
  return hotReloadManager.reloadFromFile(runner, filePath, options)
}

export function watchGraphFile(
  filePath: string,
  runner: GraphRunner,
  options?: HotReloadOptions
): () => void {
  return hotReloadManager.watchFile(filePath, runner, options)
}

export function unwatchGraphFile(filePath: string): void {
  hotReloadManager.unwatchFile(filePath)
}

export function unwatchAllGraphFiles(): void {
  hotReloadManager.unwatchAll()
}
