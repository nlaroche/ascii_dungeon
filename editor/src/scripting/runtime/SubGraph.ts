// =============================================================================
// SubGraph System - Reusable graph components
// =============================================================================

import type { Node, Edge } from '@xyflow/react'
import { GraphRunner } from './GraphRunner'
import { SavedGraph, graphStorage } from './GraphStorage'
import { ExprValue } from './expressions'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SubGraphDefinition {
  id: string
  name: string
  description?: string
  category?: string
  icon?: string
  color?: string
  inputs: SubGraphPort[]
  outputs: SubGraphPort[]
  graph: SavedGraph
}

export interface SubGraphPort {
  id: string
  name: string
  type: 'flow' | 'number' | 'string' | 'boolean' | 'any' | 'entity'
  defaultValue?: ExprValue
}

export interface SubGraphInstance {
  definitionId: string
  runner: GraphRunner
  inputValues: Map<string, ExprValue>
  outputValues: Map<string, ExprValue>
}

// -----------------------------------------------------------------------------
// SubGraph Registry
// -----------------------------------------------------------------------------

class SubGraphRegistry {
  private definitions: Map<string, SubGraphDefinition> = new Map()
  private instances: Map<string, SubGraphInstance> = new Map()

  /**
   * Register a subgraph definition
   */
  register(definition: SubGraphDefinition): void {
    this.definitions.set(definition.id, definition)
    console.log('[SubGraph] Registered:', definition.id)
  }

  /**
   * Unregister a subgraph definition
   */
  unregister(id: string): void {
    this.definitions.delete(id)
    // Also dispose any running instances
    for (const [instanceId, instance] of this.instances) {
      if (instance.definitionId === id) {
        instance.runner.dispose()
        this.instances.delete(instanceId)
      }
    }
  }

  /**
   * Get a subgraph definition
   */
  get(id: string): SubGraphDefinition | undefined {
    return this.definitions.get(id)
  }

  /**
   * Get all registered subgraphs
   */
  getAll(): SubGraphDefinition[] {
    return Array.from(this.definitions.values())
  }

  /**
   * Create an instance of a subgraph
   */
  createInstance(definitionId: string): SubGraphInstance | null {
    const definition = this.definitions.get(definitionId)
    if (!definition) {
      console.error('[SubGraph] Definition not found:', definitionId)
      return null
    }

    const instanceId = `${definitionId}_${Date.now()}`
    const runner = new GraphRunner()

    // Load the subgraph
    const { nodes, edges } = graphStorage.fromSavedGraph
      ? graphStorage.fromSavedGraph(definition.graph)
      : { nodes: [], edges: [] }

    // We need to use the toSavedGraph's inverse - for now just use the graph directly
    runner.loadGraph(definition.graph.nodes as any)

    const instance: SubGraphInstance = {
      definitionId,
      runner,
      inputValues: new Map(),
      outputValues: new Map(),
    }

    this.instances.set(instanceId, instance)
    return instance
  }

  /**
   * Dispose an instance
   */
  disposeInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.runner.dispose()
      this.instances.delete(instanceId)
    }
  }

  /**
   * Create a subgraph definition from current nodes/edges
   */
  createDefinition(
    id: string,
    name: string,
    nodes: Node[],
    edges: Edge[],
    options: {
      description?: string
      category?: string
      icon?: string
      color?: string
      inputs?: SubGraphPort[]
      outputs?: SubGraphPort[]
    } = {}
  ): SubGraphDefinition {
    const definition: SubGraphDefinition = {
      id,
      name,
      description: options.description,
      category: options.category || 'custom',
      icon: options.icon || '📦',
      color: options.color || '#8b5cf6',
      inputs: options.inputs || [],
      outputs: options.outputs || [],
      graph: graphStorage.toSavedGraph(nodes, edges, {
        id: `subgraph_${id}`,
        name,
      }),
    }

    return definition
  }

  /**
   * Save a subgraph definition to file
   */
  async saveDefinition(definition: SubGraphDefinition): Promise<string> {
    // Save to subgraphs folder
    const filename = `${definition.id}.subgraph.json`
    const content = JSON.stringify(definition, null, 2)

    // TODO: Save to file system when path is available
    console.log('[SubGraph] Would save to:', filename)

    // Register it
    this.register(definition)

    return filename
  }

  /**
   * Load subgraph definitions from files
   */
  async loadDefinitions(basePath: string): Promise<void> {
    // TODO: Load from file system
    console.log('[SubGraph] Would load from:', basePath)
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const subGraphRegistry = new SubGraphRegistry()

// -----------------------------------------------------------------------------
// Node Executor for SubGraphs
// -----------------------------------------------------------------------------

import { registerExecutor, NodeExecutorContext } from './nodeExecutors'

// Register a generic subgraph executor
registerExecutor('subgraph-call', async (inputs, ctx) => {
  const subgraphId = inputs.subgraphId as string
  if (!subgraphId) {
    console.error('[SubGraph] No subgraphId provided')
    return null
  }

  const instance = subGraphRegistry.createInstance(subgraphId)
  if (!instance) return null

  // Set input values
  for (const [key, value] of Object.entries(inputs)) {
    if (key !== 'subgraphId' && key !== 'flow') {
      instance.inputValues.set(key, value)
      instance.runner.setVariable(`input_${key}`, value)
    }
  }

  // Execute the subgraph
  await instance.runner.start()

  // Get output values
  const outputs: Record<string, ExprValue> = {}
  const definition = subGraphRegistry.get(subgraphId)
  if (definition) {
    for (const output of definition.outputs) {
      outputs[output.id] = instance.runner.getVariable(`output_${output.id}`)
    }
  }

  // Cleanup
  subGraphRegistry.disposeInstance(subgraphId)

  return outputs
})

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function registerSubGraph(definition: SubGraphDefinition): void {
  subGraphRegistry.register(definition)
}

export function getSubGraph(id: string): SubGraphDefinition | undefined {
  return subGraphRegistry.get(id)
}

export function getAllSubGraphs(): SubGraphDefinition[] {
  return subGraphRegistry.getAll()
}

export function createSubGraph(
  id: string,
  name: string,
  nodes: Node[],
  edges: Edge[],
  options?: {
    description?: string
    inputs?: SubGraphPort[]
    outputs?: SubGraphPort[]
  }
): SubGraphDefinition {
  return subGraphRegistry.createDefinition(id, name, nodes, edges, options)
}
