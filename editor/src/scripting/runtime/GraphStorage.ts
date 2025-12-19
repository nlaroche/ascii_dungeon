// =============================================================================
// Graph Storage - Save and load visual scripting graphs to/from files
// =============================================================================

import type { Node, Edge } from '@xyflow/react'
import type { CustomNodeData } from '../../components/nodes/CustomNode'
import { getFileSystem } from '../../lib/filesystem'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SavedGraph {
  version: '1.0'
  id: string
  name: string
  description?: string
  createdAt: number
  modifiedAt: number
  nodes: SavedNode[]
  edges: SavedEdge[]
  variables: SavedVariable[]
  metadata?: Record<string, unknown>
}

export interface SavedNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: CustomNodeData
}

export interface SavedEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}

export interface SavedVariable {
  name: string
  type: 'number' | 'string' | 'boolean' | 'vec2' | 'vec3' | 'any'
  defaultValue: unknown
  scope: 'global' | 'scene' | 'node' | 'local'
}

export interface GraphListEntry {
  path: string
  name: string
  description?: string
  modifiedAt: number
}

// -----------------------------------------------------------------------------
// Graph Storage Class
// -----------------------------------------------------------------------------

export class GraphStorage {
  private basePath: string = ''

  /**
   * Set the base path for graph storage (project path + /graphs)
   */
  setBasePath(projectPath: string): void {
    this.basePath = `${projectPath}/graphs`
  }

  /**
   * Get the base path for graph storage
   */
  getBasePath(): string {
    return this.basePath
  }

  /**
   * Ensure the graphs directory exists
   */
  async ensureDirectory(): Promise<void> {
    if (!this.basePath) {
      throw new Error('Base path not set. Call setBasePath first.')
    }

    const fs = await getFileSystem()
    try {
      await fs.createDirectory(this.basePath)
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Convert React Flow nodes/edges to saveable format
   */
  toSavedGraph(
    nodes: Node[],
    edges: Edge[],
    options: {
      id?: string
      name?: string
      description?: string
      variables?: SavedVariable[]
      metadata?: Record<string, unknown>
    } = {}
  ): SavedGraph {
    const now = Date.now()

    return {
      version: '1.0',
      id: options.id || `graph_${now}`,
      name: options.name || 'Untitled Graph',
      description: options.description,
      createdAt: now,
      modifiedAt: now,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type || 'custom',
        position: { x: node.position.x, y: node.position.y },
        data: node.data as CustomNodeData,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle || undefined,
        target: edge.target,
        targetHandle: edge.targetHandle || undefined,
      })),
      variables: options.variables || [],
      metadata: options.metadata,
    }
  }

  /**
   * Convert saved graph back to React Flow format
   */
  fromSavedGraph(saved: SavedGraph): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = saved.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }))

    const edges: Edge[] = saved.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      type: 'smoothstep',
    }))

    return { nodes, edges }
  }

  /**
   * Save a graph to a file
   */
  async save(
    nodes: Node[],
    edges: Edge[],
    filename: string,
    options: {
      name?: string
      description?: string
      variables?: SavedVariable[]
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<string> {
    await this.ensureDirectory()

    const fs = await getFileSystem()
    const savedGraph = this.toSavedGraph(nodes, edges, {
      id: filename.replace('.graph.json', ''),
      name: options.name || filename.replace('.graph.json', ''),
      ...options,
    })

    const path = `${this.basePath}/${filename}`
    if (!path.endsWith('.graph.json')) {
      throw new Error('Graph files must have .graph.json extension')
    }

    await fs.writeFile(path, JSON.stringify(savedGraph, null, 2))
    return path
  }

  /**
   * Load a graph from a file
   */
  async load(filename: string): Promise<{
    graph: SavedGraph
    nodes: Node[]
    edges: Edge[]
  }> {
    const fs = await getFileSystem()
    const path = filename.includes('/') ? filename : `${this.basePath}/${filename}`

    const content = await fs.readFile(path)
    const graph = JSON.parse(content) as SavedGraph

    // Validate version
    if (graph.version !== '1.0') {
      console.warn(`[GraphStorage] Unknown graph version: ${graph.version}`)
    }

    const { nodes, edges } = this.fromSavedGraph(graph)
    return { graph, nodes, edges }
  }

  /**
   * List all saved graphs
   */
  async list(): Promise<GraphListEntry[]> {
    await this.ensureDirectory()

    const fs = await getFileSystem()
    const entries = await fs.readDirectory(this.basePath)

    const graphs: GraphListEntry[] = []

    for (const entry of entries) {
      if (entry.name.endsWith('.graph.json')) {
        try {
          const content = await fs.readFile(entry.path)
          const graph = JSON.parse(content) as SavedGraph
          graphs.push({
            path: entry.path,
            name: graph.name,
            description: graph.description,
            modifiedAt: graph.modifiedAt,
          })
        } catch (e) {
          console.warn(`[GraphStorage] Failed to read graph: ${entry.path}`, e)
        }
      }
    }

    // Sort by modification time, newest first
    return graphs.sort((a, b) => b.modifiedAt - a.modifiedAt)
  }

  /**
   * Delete a graph file
   */
  async delete(filename: string): Promise<void> {
    const fs = await getFileSystem()
    const path = filename.includes('/') ? filename : `${this.basePath}/${filename}`
    await fs.deleteFile(path)
  }

  /**
   * Check if a graph file exists
   */
  async exists(filename: string): Promise<boolean> {
    const fs = await getFileSystem()
    const path = filename.includes('/') ? filename : `${this.basePath}/${filename}`
    return fs.exists(path)
  }
}

// -----------------------------------------------------------------------------
// Global Instance
// -----------------------------------------------------------------------------

export const graphStorage = new GraphStorage()

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export function saveGraph(
  nodes: Node[],
  edges: Edge[],
  filename: string,
  options?: {
    name?: string
    description?: string
    variables?: SavedVariable[]
  }
): Promise<string> {
  return graphStorage.save(nodes, edges, filename, options)
}

export function loadGraph(filename: string): Promise<{
  graph: SavedGraph
  nodes: Node[]
  edges: Edge[]
}> {
  return graphStorage.load(filename)
}

export function listGraphs(): Promise<GraphListEntry[]> {
  return graphStorage.list()
}

export function deleteGraph(filename: string): Promise<void> {
  return graphStorage.delete(filename)
}
