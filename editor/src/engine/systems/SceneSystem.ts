// ═══════════════════════════════════════════════════════════════════════════
// Scene System - Manages scene graph and node operations
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, SystemPriority, type SystemUpdateContext } from '../System'
import { EventBus } from '../events'
import type { Node, Transform } from '../../stores/engineState'

/**
 * Scene System - Manages the scene graph and provides node operations
 *
 * Hooks:
 * - onNodeAdded: Called when a node is added
 * - onNodeRemoved: Called when a node is removed
 * - onNodeUpdated: Called when a node is modified
 * - onTransformChange: Called when a node's transform changes
 * - onSceneLoad: Called when a new scene is loaded
 * - onSceneSave: Called when scene is saved
 * - onTraverse: Called for each node during traversal
 */
export class SceneSystem extends EngineSystem {
  static readonly NAME = 'Scene'

  // Node lookup cache
  private nodeCache: Map<string, { node: Node; path: number[] }> = new Map()
  private cacheDirty: boolean = true

  constructor() {
    super(SceneSystem.NAME, SystemPriority.Scene)

    // Define hooks
    this.defineHook('onNodeAdded')
    this.defineHook('onNodeRemoved')
    this.defineHook('onNodeUpdated')
    this.defineHook('onTransformChange')
    this.defineHook('onSceneLoad')
    this.defineHook('onSceneSave')
    this.defineHook('onTraverse')
  }

  update(ctx: SystemUpdateContext): void {
    // Rebuild cache if needed
    if (this.cacheDirty) {
      this.rebuildCache(ctx.state.scene.rootNode)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Node Operations
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get a node by ID */
  getNode(nodeId: string, ctx: SystemUpdateContext): Node | null {
    const cached = this.nodeCache.get(nodeId)
    if (cached) return cached.node

    // Search if not in cache
    const found = this.findNodeById(ctx.state.scene.rootNode, nodeId)
    return found?.node ?? null
  }

  /** Get the path to a node (array of child indices) */
  getNodePath(nodeId: string): number[] | null {
    const cached = this.nodeCache.get(nodeId)
    return cached?.path ?? null
  }

  /** Get a node's parent */
  getParent(nodeId: string, ctx: SystemUpdateContext): Node | null {
    const path = this.getNodePath(nodeId)
    if (!path || path.length === 0) return null

    // Get parent path
    const parentPath = path.slice(0, -1)
    if (parentPath.length === 0) return ctx.state.scene.rootNode

    // Navigate to parent
    let current = ctx.state.scene.rootNode
    for (const index of parentPath) {
      current = current.children[index]
      if (!current) return null
    }
    return current
  }

  /** Get all children of a node */
  getChildren(nodeId: string, ctx: SystemUpdateContext): Node[] {
    const node = this.getNode(nodeId, ctx)
    return node?.children ?? []
  }

  /** Get all descendants of a node */
  getDescendants(nodeId: string, ctx: SystemUpdateContext): Node[] {
    const node = this.getNode(nodeId, ctx)
    if (!node) return []

    const descendants: Node[] = []
    const traverse = (n: Node) => {
      descendants.push(n)
      for (const child of n.children) {
        traverse(child)
      }
    }

    for (const child of node.children) {
      traverse(child)
    }

    return descendants
  }

  /** Find nodes matching a predicate */
  findNodes(predicate: (node: Node) => boolean, ctx: SystemUpdateContext): Node[] {
    const results: Node[] = []

    this.traverse(ctx.state.scene.rootNode, (node) => {
      if (predicate(node)) {
        results.push(node)
      }
    })

    return results
  }

  /** Find nodes by type */
  findByType(type: string, ctx: SystemUpdateContext): Node[] {
    return this.findNodes((node) => node.type === type, ctx)
  }

  /** Find nodes by name (partial match) */
  findByName(name: string, ctx: SystemUpdateContext): Node[] {
    const lowerName = name.toLowerCase()
    return this.findNodes((node) => node.name.toLowerCase().includes(lowerName), ctx)
  }

  /** Create a new node */
  createNode(
    name: string,
    type: string = 'Node3D',
    parentId: string,
    ctx: SystemUpdateContext
  ): Node | null {
    const node: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      children: [],
      components: [],
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      meta: {},
    }

    // Add to parent
    const parentPath = this.getNodePath(parentId)
    if (parentPath === null) return null

    const basePath = ['scene', 'rootNode', ...parentPath.flatMap((i) => ['children', i])]
    const parent = this.getNode(parentId, ctx)
    if (!parent) return null

    const newChildren = [...parent.children, node]
    ctx.setState([...basePath, 'children'], newChildren, `Add node: ${name}`)

    this.cacheDirty = true
    this.callHook('onNodeAdded', node, parentId)
    EventBus.emit('scene:nodeAdded', { node, parentId })

    return node
  }

  /** Remove a node */
  removeNode(nodeId: string, ctx: SystemUpdateContext): boolean {
    const path = this.getNodePath(nodeId)
    if (!path || path.length === 0) return false // Can't remove root

    const parentPath = path.slice(0, -1)
    const childIndex = path[path.length - 1]

    // Get parent
    let basePath: (string | number)[] = ['scene', 'rootNode']
    for (const index of parentPath) {
      basePath = [...basePath, 'children', index]
    }

    // Navigate to parent and remove child
    let parent = ctx.state.scene.rootNode
    for (const index of parentPath) {
      parent = parent.children[index]
    }

    const newChildren = parent.children.filter((_, i) => i !== childIndex)
    ctx.setState([...basePath, 'children'], newChildren, `Remove node: ${nodeId}`)

    const parentId = parentPath.length === 0 ? 'root' : parent.id
    this.cacheDirty = true
    this.callHook('onNodeRemoved', nodeId, parentId)
    EventBus.emit('scene:nodeRemoved', { nodeId, parentId })

    return true
  }

  /** Update a node's transform */
  setTransform(nodeId: string, transform: Partial<Transform>, ctx: SystemUpdateContext): void {
    const path = this.getNodePath(nodeId)
    if (!path) return

    const basePath = ['scene', 'rootNode', ...path.flatMap((i) => ['children', i]), 'transform']

    const node = this.getNode(nodeId, ctx)
    const oldTransform = node?.transform

    for (const [key, value] of Object.entries(transform)) {
      ctx.setState([...basePath, key], value, `Update ${key}`)
    }

    if (oldTransform) {
      this.callHook('onTransformChange', nodeId, transform, oldTransform)
      EventBus.emit('transform:updated', {
        nodeId,
        transform: { ...oldTransform, ...transform } as Transform,
        delta: transform,
      })
    }
  }

  /** Reparent a node */
  reparent(nodeId: string, newParentId: string, ctx: SystemUpdateContext): boolean {
    const node = this.getNode(nodeId, ctx)
    if (!node) return false

    // Remove from old parent
    if (!this.removeNode(nodeId, ctx)) return false

    // Add to new parent
    const newParentPath = this.getNodePath(newParentId)
    if (newParentPath === null) return false

    const basePath = ['scene', 'rootNode', ...newParentPath.flatMap((i) => ['children', i])]
    const newParent = this.getNode(newParentId, ctx)
    if (!newParent) return false

    const newChildren = [...newParent.children, node]
    ctx.setState([...basePath, 'children'], newChildren, `Reparent: ${node.name}`)

    this.cacheDirty = true
    return true
  }

  /** Duplicate a node */
  duplicate(nodeId: string, ctx: SystemUpdateContext): Node | null {
    const node = this.getNode(nodeId, ctx)
    if (!node) return null

    const parent = this.getParent(nodeId, ctx)
    if (!parent) return null

    // Deep clone and generate new IDs
    const clone = this.deepCloneNode(node)

    // Add to same parent
    const parentPath = this.getNodePath(parent.id)
    if (parentPath === null) return null

    const basePath = ['scene', 'rootNode', ...parentPath.flatMap((i) => ['children', i])]
    const newChildren = [...parent.children, clone]
    ctx.setState([...basePath, 'children'], newChildren, `Duplicate: ${node.name}`)

    this.cacheDirty = true
    this.callHook('onNodeAdded', clone, parent.id)

    return clone
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Traversal
  // ─────────────────────────────────────────────────────────────────────────────

  /** Traverse all nodes in the scene */
  traverse(root: Node, callback: (node: Node, depth: number) => void | boolean, depth: number = 0): void {
    const result = callback(root, depth)
    this.callHook('onTraverse', root, depth)

    // Return false to stop traversal of children
    if (result === false) return

    for (const child of root.children) {
      this.traverse(child, callback, depth + 1)
    }
  }

  /** Get flattened list of all nodes */
  getAllNodes(ctx: SystemUpdateContext): Node[] {
    const nodes: Node[] = []
    this.traverse(ctx.state.scene.rootNode, (node) => {
      nodes.push(node)
    })
    return nodes
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private rebuildCache(root: Node): void {
    this.nodeCache.clear()

    const buildCache = (node: Node, path: number[]) => {
      this.nodeCache.set(node.id, { node, path })
      node.children.forEach((child, index) => {
        buildCache(child, [...path, index])
      })
    }

    buildCache(root, [])
    this.cacheDirty = false
  }

  private findNodeById(root: Node, id: string, path: number[] = []): { node: Node; path: number[] } | null {
    if (root.id === id) {
      return { node: root, path }
    }

    for (let i = 0; i < root.children.length; i++) {
      const found = this.findNodeById(root.children[i], id, [...path, i])
      if (found) return found
    }

    return null
  }

  private deepCloneNode(node: Node): Node {
    return {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${node.name} (copy)`,
      children: node.children.map((child) => this.deepCloneNode(child)),
      components: node.components.map((comp) => ({
        ...comp,
        id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      })),
      transform: node.transform ? { ...node.transform } : undefined,
      visual: node.visual ? { ...node.visual } : undefined,
      meta: { ...node.meta },
    }
  }

  /** Mark cache as needing rebuild */
  invalidateCache(): void {
    this.cacheDirty = true
  }
}
