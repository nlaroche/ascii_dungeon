// ═══════════════════════════════════════════════════════════════════════════
// useEngineState - Zustand store with data-driven state management
// Features: setPath for any state update, diff-based history, undo/redo
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  EngineState,
  INITIAL_ENGINE_STATE,
  Diff,
  HistoryEntry,
  LogEntry,
  ChatMessage,
  Conversation,
  PostEffect,
  SceneLight,
  DebugViewMode,
  SkyboxType,
  FogType,
  // Normalized entity types
  NormalizedNode,
  NormalizedComponent,
  EntityMaps,
  TransientState,
  Transform,
  Node,
  NodeComponent,
} from './engineState';
import type { TemplateDefinition } from '../lib/templates';
import { entitySubscriptions, detectEntityChanges } from './subscriptions';

// ─────────────────────────────────────────────────────────────────────────────
// Path Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatePath = (string | number)[];

// ─────────────────────────────────────────────────────────────────────────────
// Store Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineStateStore extends EngineState {
  // Core state update - THE key function
  setPath: <T>(
    path: StatePath,
    value: T,
    description?: string,
    source?: 'user' | 'ai' | 'script'
  ) => void;

  // Batch updates (multiple changes as single history entry)
  batchUpdate: (
    updates: Array<{ path: StatePath; value: unknown }>,
    description: string,
    source?: 'user' | 'ai' | 'script'
  ) => void;

  // Get value at path
  getPath: <T>(path: StatePath) => T | undefined;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Console
  log: (type: LogEntry['type'], msg: string) => void;
  clearLogs: () => void;

  // Runtime updates (no history)
  updateRuntime: (updates: Partial<EngineState['runtime']>) => void;

  // Transient updates (no history - for drag, hover, etc.)
  setTransient: <K extends keyof TransientState>(key: K, value: Partial<TransientState[K]>) => void;

  // Entity operations (normalized, O(1))
  getNodeById: (id: string) => NormalizedNode | undefined;
  getComponentById: (id: string) => NormalizedComponent | undefined;
  getNodeParentById: (id: string) => NormalizedNode | undefined;
  getNodeChildrenById: (id: string) => NormalizedNode[];

  // Sync entities from tree (internal)
  syncEntitiesFromTree: () => void;

  // Drag operations (transient - commits only on endDrag)
  startDrag: (nodeId: string, axis: TransientState['drag']['axis']) => void;
  updateDrag: (transform: Transform) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  // Hover operations (transient)
  setHover: (nodeId: string | null, gizmoAxis?: string | null, componentId?: string | null) => void;
  clearHover: () => void;

  // Camera orbit (transient)
  startCameraOrbit: (yaw: number, pitch: number) => void;
  endCameraOrbit: () => void;

  // Reset
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a value from state at the given path
 */
function getValueAtPath(obj: unknown, path: StatePath): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/**
 * Set a value in state at the given path, returning new state
 * Uses immutable updates - creates new objects along the path
 */
function setValueAtPath<T>(obj: T, path: StatePath, value: unknown): T {
  if (path.length === 0) return value as T;

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  const [key, ...rest] = path;

  if (rest.length === 0) {
    (result as Record<string | number, unknown>)[key] = value;
  } else {
    (result as Record<string | number, unknown>)[key] = setValueAtPath(
      (result as Record<string | number, unknown>)[key],
      rest,
      value
    );
  }

  return result as T;
}

/**
 * Deep clone for storing old/new values in diffs
 */
function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Create a diff entry for a single path change
 */
function createDiff(
  path: StatePath,
  oldValue: unknown,
  newValue: unknown
): Diff {
  return {
    type: 'set',
    path: [...path],
    oldValue: deepClone(oldValue),
    newValue: deepClone(newValue),
  };
}

/**
 * Apply a diff entry to state (forward or reverse)
 */
function applyDiff(state: EngineState, diff: Diff, reverse: boolean): EngineState {
  const value = reverse ? diff.oldValue : diff.newValue;
  return setValueAtPath(state, diff.path, value);
}

/**
 * Apply multiple diffs to state
 */
function applyDiffs(state: EngineState, diffs: Diff[], reverse: boolean): EngineState {
  const orderedDiffs = reverse ? [...diffs].reverse() : diffs;
  let result = state;
  for (const diff of orderedDiffs) {
    result = applyDiff(result, diff, reverse);
  }
  return result;
}

/**
 * Get current time as HH:MM:SS string
 */
function getTimeString(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized Entity Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate unique ID for new nodes/components
 */
export function generateId(prefix = 'node'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Convert tree node to normalized node
 */
function treeNodeToNormalized(
  node: Node,
  parentId: string | null,
  nodesMap: Record<string, NormalizedNode>,
  componentsMap: Record<string, NormalizedComponent>,
  nodeOrder: string[]
): void {
  // Create normalized node
  const normalizedNode: NormalizedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId,
    childIds: node.children.map((c) => c.id),
    componentIds: node.components.map((c) => c.id),
    transform: node.transform,
    visual: node.visual,
    meta: node.meta,
  };

  nodesMap[node.id] = normalizedNode;
  nodeOrder.push(node.id);

  // Create normalized components
  for (const comp of node.components) {
    componentsMap[comp.id] = {
      id: comp.id,
      nodeId: node.id,
      script: comp.script,
      enabled: comp.enabled,
      properties: comp.properties,
    };
  }

  // Recursively process children
  for (const child of node.children) {
    treeNodeToNormalized(child, node.id, nodesMap, componentsMap, nodeOrder);
  }
}

/**
 * Sync tree to entities - call this after tree changes to keep entities in sync
 */
export function syncTreeToEntities(rootNode: Node): EntityMaps {
  const nodes: Record<string, NormalizedNode> = {};
  const components: Record<string, NormalizedComponent> = {};
  const nodeOrder: string[] = [];

  treeNodeToNormalized(rootNode, null, nodes, components, nodeOrder);

  return { nodes, components, nodeOrder };
}

/**
 * Build tree node from normalized entities (for backwards compatibility)
 */
export function buildTreeFromEntities(entities: EntityMaps, nodeId: string): Node | null {
  const normalizedNode = entities.nodes[nodeId];
  if (!normalizedNode) return null;

  const children: Node[] = normalizedNode.childIds
    .map((childId) => buildTreeFromEntities(entities, childId))
    .filter((n): n is Node => n !== null);

  const components: NodeComponent[] = normalizedNode.componentIds
    .map((compId) => entities.components[compId])
    .filter((c): c is NormalizedComponent => c !== undefined)
    .map((c) => ({
      id: c.id,
      script: c.script,
      enabled: c.enabled,
      properties: c.properties,
    }));

  return {
    id: normalizedNode.id,
    name: normalizedNode.name,
    type: normalizedNode.type,
    children,
    components,
    transform: normalizedNode.transform,
    visual: normalizedNode.visual,
    meta: normalizedNode.meta,
  };
}

/**
 * Recompute nodeOrder from hierarchy (depth-first traversal)
 */
export function computeNodeOrder(
  nodes: Record<string, NormalizedNode>,
  rootId: string
): string[] {
  const order: string[] = [];

  function traverse(nodeId: string) {
    const node = nodes[nodeId];
    if (!node) return;
    order.push(nodeId);
    for (const childId of node.childIds) {
      traverse(childId);
    }
  }

  traverse(rootId);
  return order;
}

/**
 * Get all ancestor IDs (path to root)
 */
export function getAncestorIds(
  nodes: Record<string, NormalizedNode>,
  nodeId: string
): string[] {
  const ancestors: string[] = [];
  let current = nodes[nodeId];

  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = nodes[current.parentId];
  }

  return ancestors;
}

/**
 * Get all descendant IDs (all children recursively)
 */
export function getDescendantIds(
  nodes: Record<string, NormalizedNode>,
  nodeId: string
): string[] {
  const descendants: string[] = [];

  function traverse(id: string) {
    const node = nodes[id];
    if (!node) return;
    for (const childId of node.childIds) {
      descendants.push(childId);
      traverse(childId);
    }
  }

  traverse(nodeId);
  return descendants;
}

/**
 * Check if nodeId is descendant of ancestorId
 */
export function isDescendantOfNormalized(
  nodes: Record<string, NormalizedNode>,
  ancestorId: string,
  nodeId: string
): boolean {
  let current = nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = nodes[current.parentId];
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand Store
// ─────────────────────────────────────────────────────────────────────────────

export const useEngineState = create<EngineStateStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...INITIAL_ENGINE_STATE,

    // ═══════════════════════════════════════════════════════════════════════
    // setPath - THE key function for updating any part of state
    // ═══════════════════════════════════════════════════════════════════════
    setPath: <T>(
      path: StatePath,
      value: T,
      description?: string,
      source: 'user' | 'ai' | 'script' = 'user'
    ) => {
      set((state) => {
        const oldValue = getValueAtPath(state, path);

        // No change? Skip
        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
          return state;
        }

        // Create diff
        const diff = createDiff(path, oldValue, value);
        const historyEntry: HistoryEntry = {
          timestamp: Date.now(),
          description: description || `Set ${path.join('.')}`,
          source,
          diff: [diff],
        };

        // Apply change
        let newState = setValueAtPath(state, path, value);

        // Update metadata
        newState = setValueAtPath(newState, ['_lastModified'], Date.now());

        // Update history
        newState = setValueAtPath(
          newState,
          ['session', 'history'],
          [...state.session.history, historyEntry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, historyEntry]
        );
        // Clear redo stack on new change
        newState = setValueAtPath(newState, ['session', 'redoStack'], []);
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // batchUpdate - Multiple changes as single history entry
    // ═══════════════════════════════════════════════════════════════════════
    batchUpdate: (
      updates: Array<{ path: StatePath; value: unknown }>,
      description: string,
      source: 'user' | 'ai' | 'script' = 'user'
    ) => {
      set((state) => {
        const diffs: Diff[] = [];
        let newState = state;

        for (const { path, value } of updates) {
          const oldValue = getValueAtPath(newState, path);
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            diffs.push(createDiff(path, oldValue, value));
            newState = setValueAtPath(newState, path, value);
          }
        }

        // No changes? Skip
        if (diffs.length === 0) return state;

        const historyEntry: HistoryEntry = {
          timestamp: Date.now(),
          description,
          source,
          diff: diffs,
        };

        // Update metadata
        newState = setValueAtPath(newState, ['_lastModified'], Date.now());

        // Update history
        newState = setValueAtPath(
          newState,
          ['session', 'history'],
          [...state.session.history, historyEntry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, historyEntry]
        );
        newState = setValueAtPath(newState, ['session', 'redoStack'], []);
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // getPath - Read value at any path
    // ═══════════════════════════════════════════════════════════════════════
    getPath: <T>(path: StatePath): T | undefined => {
      return getValueAtPath(get(), path) as T | undefined;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Undo
    // ═══════════════════════════════════════════════════════════════════════
    undo: () => {
      set((state) => {
        if (state.session.undoStack.length === 0) return state;

        const entry = state.session.undoStack[state.session.undoStack.length - 1];
        let newState = applyDiffs(state, entry.diff, true);

        // Update stacks
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          state.session.undoStack.slice(0, -1)
        );
        newState = setValueAtPath(
          newState,
          ['session', 'redoStack'],
          [...state.session.redoStack, entry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex - 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Redo
    // ═══════════════════════════════════════════════════════════════════════
    redo: () => {
      set((state) => {
        if (state.session.redoStack.length === 0) return state;

        const entry = state.session.redoStack[state.session.redoStack.length - 1];
        let newState = applyDiffs(state, entry.diff, false);

        // Update stacks
        newState = setValueAtPath(
          newState,
          ['session', 'redoStack'],
          state.session.redoStack.slice(0, -1)
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, entry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    canUndo: () => get().session.undoStack.length > 0,
    canRedo: () => get().session.redoStack.length > 0,

    // ═══════════════════════════════════════════════════════════════════════
    // Console logging
    // ═══════════════════════════════════════════════════════════════════════
    log: (type: LogEntry['type'], msg: string) => {
      set((state) => ({
        ...state,
        console: {
          ...state.console,
          logs: [
            ...state.console.logs,
            { type, msg, time: getTimeString() },
          ],
        },
      }));
    },

    clearLogs: () => {
      set((state) => ({
        ...state,
        console: { ...state.console, logs: [] },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Runtime updates (no history tracking)
    // ═══════════════════════════════════════════════════════════════════════
    updateRuntime: (updates: Partial<EngineState['runtime']>) => {
      set((state) => ({
        ...state,
        runtime: { ...state.runtime, ...updates },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Transient updates (no history tracking - for drag, hover, etc.)
    // ═══════════════════════════════════════════════════════════════════════
    setTransient: <K extends keyof TransientState>(key: K, value: Partial<TransientState[K]>) => {
      set((state) => ({
        ...state,
        transient: {
          ...state.transient,
          [key]: { ...state.transient[key], ...value },
        },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Entity operations (O(1) normalized lookups)
    // ═══════════════════════════════════════════════════════════════════════
    getNodeById: (id: string) => {
      return get().entities.nodes[id];
    },

    getComponentById: (id: string) => {
      return get().entities.components[id];
    },

    getNodeParentById: (id: string) => {
      const node = get().entities.nodes[id];
      if (!node?.parentId) return undefined;
      return get().entities.nodes[node.parentId];
    },

    getNodeChildrenById: (id: string) => {
      const node = get().entities.nodes[id];
      if (!node) return [];
      return node.childIds
        .map((childId) => get().entities.nodes[childId])
        .filter((n): n is NormalizedNode => n !== undefined);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Reset to initial state
    // ═══════════════════════════════════════════════════════════════════════
    reset: () => {
      set({ ...INITIAL_ENGINE_STATE, session: { ...INITIAL_ENGINE_STATE.session, startTime: Date.now() } });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Sync entities from tree (called after tree modifications)
    // ═══════════════════════════════════════════════════════════════════════
    syncEntitiesFromTree: () => {
      const state = get();
      const newEntities = syncTreeToEntities(state.scene.rootNode);
      const prevEntities = state.entities;

      // Detect changes for notifications
      const { changedNodeIds, changedComponentIds } = detectEntityChanges(
        prevEntities,
        newEntities
      );

      // Update entities (no history - this is a derived sync)
      set((s) => ({ ...s, entities: newEntities }));

      // Notify subscribers
      if (changedNodeIds.length > 0 || changedComponentIds.length > 0) {
        entitySubscriptions.notifyEntitiesChange(
          newEntities,
          changedNodeIds,
          changedComponentIds
        );

        // Notify individual node subscribers
        for (const nodeId of changedNodeIds) {
          const node = newEntities.nodes[nodeId];
          const changeType = !prevEntities.nodes[nodeId]
            ? 'create'
            : !node
              ? 'delete'
              : 'update';
          entitySubscriptions.notifyNodeChange(nodeId, node || null, changeType);
        }

        // Notify individual component subscribers
        for (const compId of changedComponentIds) {
          const comp = newEntities.components[compId];
          const changeType = !prevEntities.components[compId]
            ? 'create'
            : !comp
              ? 'delete'
              : 'update';
          entitySubscriptions.notifyComponentChange(compId, comp || null, changeType);
        }
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Drag operations - transient state, commits only on endDrag
    // ═══════════════════════════════════════════════════════════════════════
    startDrag: (nodeId: string, axis: TransientState['drag']['axis']) => {
      const state = get();
      const node = findNode(state.scene.rootNode, nodeId);
      if (!node?.transform) return;

      // Store start transform and set drag active (no history)
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          drag: {
            active: true,
            nodeId,
            startTransform: { ...node.transform! },
            axis,
          },
        },
      }));
    },

    updateDrag: (transform: Transform) => {
      const state = get();
      const { drag } = state.transient;
      if (!drag.active || !drag.nodeId) return;

      // Find the node path and update transform directly (no history)
      const path = findNodePath(state.scene.rootNode, drag.nodeId);
      if (!path) return;

      // Build state path to transform
      const statePath: (string | number)[] = ['scene', 'rootNode'];
      for (const idx of path) {
        statePath.push('children', idx);
      }
      statePath.push('transform');

      // Direct update without history
      set((s) => setValueAtPath(s, statePath, transform));
    },

    endDrag: () => {
      const state = get();
      const { drag } = state.transient;
      if (!drag.active || !drag.nodeId || !drag.startTransform) {
        // Clear drag state anyway
        set((s) => ({
          ...s,
          transient: {
            ...s.transient,
            drag: { active: false, nodeId: null, startTransform: null, axis: null },
          },
        }));
        return;
      }

      // Get current transform
      const node = findNode(state.scene.rootNode, drag.nodeId);
      if (!node?.transform) return;

      // Only commit if transform actually changed
      const startT = drag.startTransform;
      const endT = node.transform;
      const changed =
        startT.position[0] !== endT.position[0] ||
        startT.position[1] !== endT.position[1] ||
        startT.position[2] !== endT.position[2] ||
        startT.rotation[0] !== endT.rotation[0] ||
        startT.rotation[1] !== endT.rotation[1] ||
        startT.rotation[2] !== endT.rotation[2] ||
        startT.scale[0] !== endT.scale[0] ||
        startT.scale[1] !== endT.scale[1] ||
        startT.scale[2] !== endT.scale[2];

      if (changed) {
        // Find path and create history entry
        const path = findNodePath(state.scene.rootNode, drag.nodeId);
        if (path) {
          const statePath: (string | number)[] = ['scene', 'rootNode'];
          for (const idx of path) {
            statePath.push('children', idx);
          }
          statePath.push('transform');

          // Create single diff for the entire drag operation
          const diff = createDiff(statePath, startT, endT);
          const historyEntry: HistoryEntry = {
            timestamp: Date.now(),
            description: `Move ${node.name || drag.nodeId}`,
            source: 'user',
            diff: [diff],
          };

          // Add to history
          set((s) => ({
            ...s,
            _lastModified: Date.now(),
            session: {
              ...s.session,
              history: [...s.session.history, historyEntry],
              undoStack: [...s.session.undoStack, historyEntry],
              redoStack: [],
              historyIndex: s.session.historyIndex + 1,
            },
            transient: {
              ...s.transient,
              drag: { active: false, nodeId: null, startTransform: null, axis: null },
            },
          }));
          return;
        }
      }

      // Clear drag state
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          drag: { active: false, nodeId: null, startTransform: null, axis: null },
        },
      }));
    },

    cancelDrag: () => {
      const state = get();
      const { drag } = state.transient;

      // Restore original transform if we were dragging
      if (drag.active && drag.nodeId && drag.startTransform) {
        const path = findNodePath(state.scene.rootNode, drag.nodeId);
        if (path) {
          const statePath: (string | number)[] = ['scene', 'rootNode'];
          for (const idx of path) {
            statePath.push('children', idx);
          }
          statePath.push('transform');

          // Restore without history
          set((s) => {
            let newState = setValueAtPath(s, statePath, drag.startTransform);
            newState = {
              ...newState,
              transient: {
                ...newState.transient,
                drag: { active: false, nodeId: null, startTransform: null, axis: null },
              },
            };
            return newState;
          });
          return;
        }
      }

      // Clear drag state
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          drag: { active: false, nodeId: null, startTransform: null, axis: null },
        },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Hover operations - purely transient
    // ═══════════════════════════════════════════════════════════════════════
    setHover: (nodeId: string | null, gizmoAxis?: string | null, componentId?: string | null) => {
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          hover: {
            nodeId,
            gizmoAxis: gizmoAxis ?? null,
            componentId: componentId ?? null,
          },
        },
      }));
    },

    clearHover: () => {
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          hover: { nodeId: null, gizmoAxis: null, componentId: null },
        },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Camera orbit - transient
    // ═══════════════════════════════════════════════════════════════════════
    startCameraOrbit: (yaw: number, pitch: number) => {
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          cameraOrbit: { active: true, startYaw: yaw, startPitch: pitch },
        },
      }));
    },

    endCameraOrbit: () => {
      set((s) => ({
        ...s,
        transient: {
          ...s.transient,
          cameraOrbit: { active: false, startYaw: 0, startPitch: 0 },
        },
      }));
    },
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
// Entity Sync Subscription
// Automatically sync entities when tree changes
// ─────────────────────────────────────────────────────────────────────────────

// Subscribe to rootNode changes and sync entities
useEngineState.subscribe(
  (state) => state.scene.rootNode,
  (rootNode, prevRootNode) => {
    if (rootNode !== prevRootNode) {
      // Defer sync to avoid recursive updates during setPath
      queueMicrotask(() => {
        useEngineState.getState().syncEntitiesFromTree();
      });
    }
  }
);

// Subscribe to selection changes and notify subscribers
useEngineState.subscribe(
  (state) => state.selection.nodes,
  (nodeIds, prevNodeIds) => {
    if (nodeIds !== prevNodeIds) {
      const primaryId = nodeIds.length > 0 ? nodeIds[0] : null;
      entitySubscriptions.notifySelectionChange(nodeIds, primaryId);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Convenience hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get theme colors
 */
export function useTheme() {
  return useEngineState((state) => state.ui.theme);
}

/**
 * Hook for UI scale
 */
export function useUIScale() {
  const scale = useEngineState((state) => state.ui.scale);
  const setPath = useEngineState((state) => state.setPath);

  const setScale = (newScale: number) => {
    setPath(['ui', 'scale'], newScale, `Set UI scale to ${Math.round(newScale * 100)}%`);
  };

  return { scale, setScale };
}

/**
 * Hook for editor mode (engine vs template)
 */
export function useEditorMode() {
  const mode = useEngineState((state) => state.ui.editorMode);
  const setPath = useEngineState((state) => state.setPath);

  const setMode = (newMode: 'engine' | 'template') => {
    setPath(['ui', 'editorMode'], newMode, `Switch to ${newMode} mode`);
  };

  const toggleMode = () => {
    setMode(mode === 'engine' ? 'template' : 'engine');
  };

  return { mode, setMode, toggleMode, isTemplateMode: mode === 'template' };
}

/**
 * Hook for active tool
 */
export function useActiveTool() {
  const active = useEngineState((state) => state.tools.active);
  const available = useEngineState((state) => state.tools.available);
  const setPath = useEngineState((state) => state.setPath);

  return {
    tool: available[active],
    setTool: (id: string) => setPath(['tools', 'active'], id, `Select ${id} tool`),
  };
}

/**
 * Hook for panel configuration
 */
export function usePanel(panelId: string) {
  const panel = useEngineState((state) => state.ui.panels[panelId]);
  const setPath = useEngineState((state) => state.setPath);

  const setActiveTab = (tabId: string) => {
    if (panel?.type === 'tabs') {
      setPath(['ui', 'panels', panelId, 'active'], tabId, `Switch to ${tabId} tab`);
    }
  };

  const toggleSection = (sectionId: string) => {
    if (panel?.type === 'stack') {
      const idx = panel.sections.findIndex((s) => s.id === sectionId);
      if (idx !== -1) {
        const collapsed = panel.sections[idx].collapsed;
        setPath(
          ['ui', 'panels', panelId, 'sections', idx, 'collapsed'],
          !collapsed,
          `${collapsed ? 'Expand' : 'Collapse'} ${sectionId}`
        );
      }
    }
  };

  return { panel, setActiveTab, toggleSection };
}

/**
 * Hook for selection
 */
export function useSelection() {
  const selection = useEngineState((state) => state.selection);
  const setPath = useEngineState((state) => state.setPath);

  return {
    selection,
    selectNode: (id: string) =>
      setPath(['selection', 'nodes'], [id], `Select node`),
    selectNodes: (ids: string[]) =>
      setPath(['selection', 'nodes'], ids, `Select ${ids.length} nodes`),
    clearSelection: () =>
      setPath(['selection', 'nodes'], [], 'Clear selection'),
    isSelected: (id: string) => selection.nodes.includes(id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Tree Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { Node } from './engineState';

/**
 * Find a node by ID in the tree (recursive)
 */
export function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the path to a node (array of indices)
 */
export function findNodePath(root: Node, id: string, path: number[] = []): number[] | null {
  if (root.id === id) return path;
  for (let i = 0; i < root.children.length; i++) {
    const result = findNodePath(root.children[i], id, [...path, i]);
    if (result) return result;
  }
  return null;
}

/**
 * Get all nodes flattened (for iteration)
 */
export function flattenNodes(root: Node): Node[] {
  const nodes: Node[] = [root];
  for (const child of root.children) {
    nodes.push(...flattenNodes(child));
  }
  return nodes;
}

/**
 * Find parent node of a given node
 */
export function findParentNode(root: Node, childId: string): Node | null {
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParentNode(child, childId);
    if (found) return found;
  }
  return null;
}

/**
 * Deep clone a node with new IDs
 */
export function cloneNode(node: Node, idPrefix: string = ''): Node {
  const newId = idPrefix + `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  return {
    ...node,
    id: newId,
    name: node.name,
    children: node.children.map((child, i) => cloneNode(child, `${newId}_${i}_`)),
    components: node.components.map((comp) => ({
      ...comp,
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    })),
  };
}

/**
 * Check if a node is descendant of another
 */
export function isDescendantOf(root: Node, ancestorId: string, descendantId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  return findNode(ancestor, descendantId) !== null && ancestorId !== descendantId;
}

// Clipboard for copy/paste
let nodeClipboard: Node[] = [];

/**
 * Hook for scene nodes - full Unity-like operations
 * Uses normalized entities for O(1) lookups where possible
 */
export function useNodes() {
  const rootNode = useEngineState((state) => state.scene.rootNode);
  const entities = useEngineState((state) => state.entities);
  const setPath = useEngineState((state) => state.setPath);
  const batchUpdate = useEngineState((state) => state.batchUpdate);

  // O(1) lookup using normalized entities, returns tree node for compatibility
  const getNode = (id: string): Node | null => {
    // Quick existence check via entities (O(1))
    if (!entities.nodes[id]) return null;
    // Return tree node for backwards compatibility
    return findNode(rootNode, id);
  };

  // O(1) using nodeOrder from entities
  const getAllNodes = (): Node[] => {
    return flattenNodes(rootNode);
  };

  // Keep tree-based for mutation paths
  const getNodePath = (id: string): number[] | null => {
    // Quick existence check (O(1))
    if (!entities.nodes[id]) return null;
    return findNodePath(rootNode, id);
  };

  // O(1) lookup using normalized parentId
  const getParent = (id: string): Node | null => {
    const normalizedNode = entities.nodes[id];
    if (!normalizedNode?.parentId) return null;
    // Return tree node for backwards compatibility
    return findNode(rootNode, normalizedNode.parentId);
  };

  // O(1) normalized lookups for when you just need the data (no tree structure)
  const getNormalizedNode = (id: string): NormalizedNode | undefined => {
    return entities.nodes[id];
  };

  const getNormalizedParent = (id: string): NormalizedNode | undefined => {
    const node = entities.nodes[id];
    if (!node?.parentId) return undefined;
    return entities.nodes[node.parentId];
  };

  const getNormalizedChildren = (id: string): NormalizedNode[] => {
    const node = entities.nodes[id];
    if (!node) return [];
    return node.childIds
      .map((childId) => entities.nodes[childId])
      .filter((n): n is NormalizedNode => n !== undefined);
  };

  // Build state path from index path
  const buildStatePath = (indexPath: number[]): (string | number)[] => {
    const statePath: (string | number)[] = ['scene', 'rootNode'];
    for (const idx of indexPath) {
      statePath.push('children', idx);
    }
    return statePath;
  };

  // Update a node's properties
  const updateNode = (id: string, updates: Partial<Node>) => {
    const path = findNodePath(rootNode, id);
    if (!path) return;

    const statePath = buildStatePath(path);
    const node = getNode(id);
    if (node) {
      const updated = { ...node, ...updates };
      setPath(statePath, updated, `Update ${node.name}`);
    }
  };

  // Add a new child node to a parent
  const addNode = (parentId: string, node: Node, index?: number): void => {
    const parent = getNode(parentId);
    if (!parent) return;

    const parentPath = findNodePath(rootNode, parentId);
    if (!parentPath && parentId !== 'root') return;

    const statePath = parentId === 'root'
      ? ['scene', 'rootNode', 'children']
      : [...buildStatePath(parentPath!), 'children'];

    const newChildren = [...parent.children];
    if (index !== undefined && index >= 0 && index <= newChildren.length) {
      newChildren.splice(index, 0, node);
    } else {
      newChildren.push(node);
    }

    setPath(statePath, newChildren, `Add ${node.name}`);
  };

  // Remove a node (and all its children)
  const removeNode = (id: string): void => {
    if (id === 'root') return; // Can't remove root

    const parent = getParent(id);
    if (!parent) return;

    const parentPath = findNodePath(rootNode, parent.id);
    const statePath = parent.id === 'root'
      ? ['scene', 'rootNode', 'children']
      : [...buildStatePath(parentPath!), 'children'];

    const node = getNode(id);
    const newChildren = parent.children.filter((child) => child.id !== id);
    setPath(statePath, newChildren, `Delete ${node?.name || id}`);
  };

  // Remove multiple nodes
  const removeNodes = (ids: string[]): void => {
    // Filter out root and get valid nodes
    const validIds = ids.filter((id) => id !== 'root' && getNode(id));
    if (validIds.length === 0) return;

    // Group by parent for efficient batch update
    const byParent = new Map<string, string[]>();
    for (const id of validIds) {
      const parent = getParent(id);
      if (parent) {
        const existing = byParent.get(parent.id) || [];
        existing.push(id);
        byParent.set(parent.id, existing);
      }
    }

    // Build batch updates
    const updates: Array<{ path: StatePath; value: unknown }> = [];
    for (const [parentId, childIds] of byParent) {
      const parent = getNode(parentId);
      if (!parent) continue;

      const parentPath = findNodePath(rootNode, parentId);
      const statePath = parentId === 'root'
        ? ['scene', 'rootNode', 'children']
        : [...buildStatePath(parentPath!), 'children'];

      const newChildren = parent.children.filter((child) => !childIds.includes(child.id));
      updates.push({ path: statePath, value: newChildren });
    }

    if (updates.length > 0) {
      batchUpdate(updates, `Delete ${validIds.length} node(s)`);
    }
  };

  // Move a node to a new parent (reparent)
  const moveNode = (nodeId: string, newParentId: string, index?: number): void => {
    if (nodeId === 'root') return;
    if (nodeId === newParentId) return;

    // Prevent moving a node into its own descendant (O(1) check via entities)
    if (isDescendantOfNormalized(entities.nodes, nodeId, newParentId)) return;

    const node = getNode(nodeId);
    const oldParent = getParent(nodeId);
    const newParent = getNode(newParentId);

    if (!node || !oldParent || !newParent) return;

    // Remove from old parent
    const oldParentPath = findNodePath(rootNode, oldParent.id);
    const oldStatePath = oldParent.id === 'root'
      ? ['scene', 'rootNode', 'children']
      : [...buildStatePath(oldParentPath!), 'children'];

    const oldChildren = oldParent.children.filter((child) => child.id !== nodeId);

    // Add to new parent
    const newParentPath = findNodePath(rootNode, newParentId);
    const newStatePath = newParentId === 'root'
      ? ['scene', 'rootNode', 'children']
      : [...buildStatePath(newParentPath!), 'children'];

    // Need to recalculate newParent.children since we might have modified the tree
    const targetChildren = newParentId === oldParent.id
      ? oldChildren
      : [...newParent.children];

    if (index !== undefined && index >= 0 && index <= targetChildren.length) {
      targetChildren.splice(index, 0, node);
    } else {
      targetChildren.push(node);
    }

    // Batch update both parents
    if (oldParent.id === newParentId) {
      // Same parent, just reordering
      setPath(oldStatePath, targetChildren, `Reorder ${node.name}`);
    } else {
      batchUpdate([
        { path: oldStatePath, value: oldChildren },
        { path: newStatePath, value: targetChildren },
      ], `Move ${node.name} to ${newParent.name}`);
    }
  };

  // Duplicate a node (and all children)
  const duplicateNode = (id: string): Node | null => {
    if (id === 'root') return null;

    const node = getNode(id);
    const parent = getParent(id);
    if (!node || !parent) return null;

    const clone = cloneNode(node);
    clone.name = `${node.name} (Copy)`;

    // Find index of original and insert after
    const originalIndex = parent.children.findIndex((child) => child.id === id);
    addNode(parent.id, clone, originalIndex + 1);

    return clone;
  };

  // Duplicate multiple nodes
  const duplicateNodes = (ids: string[]): Node[] => {
    const clones: Node[] = [];
    for (const id of ids) {
      const clone = duplicateNode(id);
      if (clone) clones.push(clone);
    }
    return clones;
  };

  // Copy nodes to clipboard
  const copyNodes = (ids: string[]): void => {
    nodeClipboard = ids
      .map((id) => getNode(id))
      .filter((n): n is Node => n !== null && n.id !== 'root')
      .map((n) => cloneNode(n));
  };

  // Paste nodes from clipboard
  const pasteNodes = (parentId: string): Node[] => {
    if (nodeClipboard.length === 0) return [];

    const parent = getNode(parentId);
    if (!parent) return [];

    // Clone again to get fresh IDs
    const pasted = nodeClipboard.map((n) => cloneNode(n));

    const parentPath = findNodePath(rootNode, parentId);
    const statePath = parentId === 'root'
      ? ['scene', 'rootNode', 'children']
      : [...buildStatePath(parentPath!), 'children'];

    setPath(statePath, [...parent.children, ...pasted], `Paste ${pasted.length} node(s)`);
    return pasted;
  };

  // Check if clipboard has nodes
  const hasClipboard = (): boolean => nodeClipboard.length > 0;

  // Create a new empty node
  const createNode = (parentId: string, name: string = 'New Node'): Node => {
    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      type: 'Node',
      children: [],
      components: [],
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      meta: {},
    };
    addNode(parentId, newNode);
    return newNode;
  };

  // Rename a node
  const renameNode = (id: string, newName: string): void => {
    updateNode(id, { name: newName });
  };

  return {
    // Tree-based (backwards compatible, returns Node)
    rootNode,
    getNode,
    getAllNodes,
    getNodePath,
    getParent,

    // O(1) normalized lookups (returns NormalizedNode)
    entities,
    getNormalizedNode,
    getNormalizedParent,
    getNormalizedChildren,

    // Mutation operations
    updateNode,
    addNode,
    removeNode,
    removeNodes,
    moveNode,
    duplicateNode,
    duplicateNodes,
    copyNodes,
    pasteNodes,
    hasClipboard,
    createNode,
    renameNode,
    setPath,
  };
}

/**
 * Hook for transient state - drag, hover, camera orbit
 * These are high-frequency updates that don't create history entries
 */
export function useTransient() {
  const transient = useEngineState((state) => state.transient);
  const startDrag = useEngineState((state) => state.startDrag);
  const updateDrag = useEngineState((state) => state.updateDrag);
  const endDrag = useEngineState((state) => state.endDrag);
  const cancelDrag = useEngineState((state) => state.cancelDrag);
  const setHover = useEngineState((state) => state.setHover);
  const clearHover = useEngineState((state) => state.clearHover);
  const startCameraOrbit = useEngineState((state) => state.startCameraOrbit);
  const endCameraOrbit = useEngineState((state) => state.endCameraOrbit);
  const setTransient = useEngineState((state) => state.setTransient);

  return {
    // State
    drag: transient.drag,
    hover: transient.hover,
    input: transient.input,
    cameraOrbit: transient.cameraOrbit,

    // Drag operations
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    isDragging: transient.drag.active,

    // Hover operations
    setHover,
    clearHover,
    hoveredNodeId: transient.hover.nodeId,
    hoveredGizmoAxis: transient.hover.gizmoAxis,

    // Camera orbit
    startCameraOrbit,
    endCameraOrbit,
    isOrbiting: transient.cameraOrbit.active,

    // Input (for keyboard/mouse state)
    updateInput: (updates: Partial<TransientState['input']>) =>
      setTransient('input', updates),

    // Generic transient update
    setTransient,
  };
}

/**
 * Hook for normalized entities - O(1) lookups without tree overhead
 * Use this when you don't need backwards-compatible tree Node objects
 */
export function useNormalizedEntities() {
  const entities = useEngineState((state) => state.entities);
  const getNodeById = useEngineState((state) => state.getNodeById);
  const getComponentById = useEngineState((state) => state.getComponentById);
  const getNodeParentById = useEngineState((state) => state.getNodeParentById);
  const getNodeChildrenById = useEngineState((state) => state.getNodeChildrenById);

  return {
    // Raw entity maps
    nodes: entities.nodes,
    components: entities.components,
    nodeOrder: entities.nodeOrder,

    // O(1) lookup methods
    getNode: getNodeById,
    getComponent: getComponentById,
    getParent: getNodeParentById,
    getChildren: getNodeChildrenById,

    // Utility functions
    getAncestors: (nodeId: string) => getAncestorIds(entities.nodes, nodeId),
    getDescendants: (nodeId: string) => getDescendantIds(entities.nodes, nodeId),
    isDescendantOf: (ancestorId: string, nodeId: string) =>
      isDescendantOfNormalized(entities.nodes, ancestorId, nodeId),
  };
}

/**
 * Hook for chat functionality
 */
export function useChat() {
  const chat = useEngineState((state) => state.chat);
  const setPath = useEngineState((state) => state.setPath);
  const getPath = useEngineState((state) => state.getPath);

  // Get current conversation
  const currentConversation = chat.conversations.find(
    (c) => c.id === chat.currentConversationId
  );

  // Create a new conversation
  const createConversation = (title?: string): string => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newConversation: Conversation = {
      id,
      title: title || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(['chat', 'conversations'], [...conversations, newConversation], 'Create conversation');
    setPath(['chat', 'currentConversationId'], id, 'Switch conversation');
    return id;
  };

  // Switch to a conversation
  const switchConversation = (id: string) => {
    setPath(['chat', 'currentConversationId'], id, 'Switch conversation');
  };

  // Add a message to current conversation
  const addMessage = (role: 'user' | 'assistant', content: string, status?: ChatMessage['status']): string => {
    const convId = chat.currentConversationId;
    if (!convId) return '';

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessage = {
      id: msgId,
      role,
      content,
      timestamp: Date.now(),
      status: status || 'complete',
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return '';

    const updatedConv = {
      ...conversations[convIdx],
      messages: [...conversations[convIdx].messages, message],
      updatedAt: Date.now(),
    };

    setPath(['chat', 'conversations', convIdx], updatedConv, `Add ${role} message`);
    return msgId;
  };

  // Update a message (for streaming)
  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    const convId = chat.currentConversationId;
    if (!convId) return;

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return;

    const conv = conversations[convIdx];
    const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const updatedMsg = { ...conv.messages[msgIdx], ...updates };
    const updatedMessages = [...conv.messages];
    updatedMessages[msgIdx] = updatedMsg;

    setPath(['chat', 'conversations', convIdx, 'messages'], updatedMessages, 'Update message');
  };

  // Append content to a message (for streaming)
  const appendToMessage = (messageId: string, content: string) => {
    const convId = chat.currentConversationId;
    if (!convId) return;

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return;

    const conv = conversations[convIdx];
    const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const currentContent = conv.messages[msgIdx].content;
    setPath(
      ['chat', 'conversations', convIdx, 'messages', msgIdx, 'content'],
      currentContent + content,
      'Stream content'
    );
  };

  // Set streaming state
  const setStreaming = (isStreaming: boolean) => {
    setPath(['chat', 'isStreaming'], isStreaming, isStreaming ? 'Start streaming' : 'Stop streaming');
  };

  // Update input draft
  const setInputDraft = (draft: string) => {
    // No history tracking for drafts - direct update
    useEngineState.setState((state) => ({
      ...state,
      chat: { ...state.chat, inputDraft: draft },
    }));
  };

  // Branch conversation at a message index
  const branchConversation = (messageIndex: number): string => {
    if (!currentConversation) return '';

    const id = `conv_${Date.now()}`;
    const newConversation: Conversation = {
      id,
      title: `${currentConversation.title} (branch)`,
      messages: currentConversation.messages.slice(0, messageIndex + 1),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: currentConversation.id,
      branchPoint: messageIndex,
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(['chat', 'conversations'], [...conversations, newConversation], 'Branch conversation');
    setPath(['chat', 'currentConversationId'], id, 'Switch to branch');
    return id;
  };

  // Delete a conversation
  const deleteConversation = (id: string) => {
    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(
      ['chat', 'conversations'],
      conversations.filter((c) => c.id !== id),
      'Delete conversation'
    );

    if (chat.currentConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setPath(
        ['chat', 'currentConversationId'],
        remaining.length > 0 ? remaining[remaining.length - 1].id : null,
        'Switch conversation'
      );
    }
  };

  return {
    chat,
    currentConversation,
    conversations: chat.conversations,
    isStreaming: chat.isStreaming,
    inputDraft: chat.inputDraft,
    createConversation,
    switchConversation,
    addMessage,
    updateMessage,
    appendToMessage,
    setStreaming,
    setInputDraft,
    branchConversation,
    deleteConversation,
  };
}

/**
 * Hook for template management
 */
export function useTemplate() {
  const template = useEngineState((state) => state.template);
  const setPath = useEngineState((state) => state.setPath);
  const batchUpdate = useEngineState((state) => state.batchUpdate);
  const log = useEngineState((state) => state.log);

  // Apply a template - updates tools, render settings, etc.
  const applyTemplate = (templateDef: TemplateDefinition) => {
    console.log('[useTemplate] applyTemplate called with:', templateDef.id, templateDef.name);
    const updates: Array<{ path: (string | number)[]; value: unknown }> = [];

    // Update template state
    updates.push({ path: ['template', 'currentId'], value: templateDef.id });
    updates.push({ path: ['template', 'currentName'], value: templateDef.name });
    updates.push({ path: ['template', 'currentIcon'], value: templateDef.icon });
    updates.push({ path: ['template', 'isCustomized'], value: false });

    // Apply render settings if provided
    if (templateDef.render) {
      // Camera mode
      if (templateDef.render.mode) {
        const modeMap: Record<string, string> = {
          isometric: 'orthographic',
          table: 'topdown',
          sidescroll: 'orthographic',
          free3d: 'perspective',
        };
        updates.push({
          path: ['camera', 'mode'],
          value: modeMap[templateDef.render.mode] || 'perspective',
        });
      }

      // Grid
      if (templateDef.render.grid !== undefined) {
        updates.push({
          path: ['views', 'scene', 'showGrid'],
          value: templateDef.render.grid.enabled ?? true,
        });
        if (templateDef.render.grid.size) {
          updates.push({
            path: ['views', 'scene', 'gridSize'],
            value: templateDef.render.grid.size,
          });
        }
      }

      // Post-process / render mode
      if (templateDef.render.postProcess) {
        // Map post-process presets to render modes
        updates.push({
          path: ['views', 'scene', 'renderMode'],
          value: 'lit',
        });
      }
    }

    // Apply tools if provided
    if (templateDef.view?.tools) {
      // Merge template tools with core tools
      const coreTools = {
        select: {
          id: 'select',
          name: 'Select',
          icon: '◇',
          shortcut: 'V',
          cursor: 'default',
          description: 'Select and inspect entities',
        },
        move: {
          id: 'move',
          name: 'Move',
          icon: '✥',
          shortcut: 'G',
          cursor: 'move',
          description: 'Move selected entities',
        },
      };

      const templateTools: Record<string, unknown> = {};
      for (const [id, tool] of Object.entries(templateDef.view.tools)) {
        templateTools[id] = {
          ...tool,
          cursor: 'crosshair',
          description: tool.name,
        };
      }

      updates.push({
        path: ['tools', 'available'],
        value: { ...coreTools, ...templateTools },
      });

      // Set default tool
      if (templateDef.view.defaultTool) {
        updates.push({
          path: ['tools', 'active'],
          value: templateDef.view.defaultTool,
        });
      }
    }

    // Apply all updates as a batch
    console.log('[useTemplate] Applying updates:', updates);
    batchUpdate(updates, `Apply template: ${templateDef.name}`);
    log('success', `Applied template: ${templateDef.name}`);
    console.log('[useTemplate] Template applied successfully');
  };

  // Simple switch (just changes the ID, for when full template def isn't available)
  const switchTemplate = (id: string, name: string, icon?: string) => {
    batchUpdate([
      { path: ['template', 'currentId'], value: id },
      { path: ['template', 'currentName'], value: name },
      { path: ['template', 'currentIcon'], value: icon || '◇' },
      { path: ['template', 'isCustomized'], value: false },
    ], `Switch to ${name} template`);
    log('success', `Switched to template: ${name}`);
  };

  // Mark template as customized
  const markCustomized = () => {
    if (!template.isCustomized) {
      setPath(['template', 'isCustomized'], true, 'Customize template');
    }
  };

  return {
    currentId: template.currentId,
    currentName: template.currentName,
    currentIcon: template.currentIcon,
    availableIds: template.availableIds,
    isCustomized: template.isCustomized,
    switchTemplate,
    applyTemplate,
    markCustomized,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Pipeline Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for render pipeline settings
 */
export function useRenderPipeline() {
  const pipeline = useEngineState((state) => state.renderPipeline);
  const setPath = useEngineState((state) => state.setPath);
  const batchUpdate = useEngineState((state) => state.batchUpdate);

  // Toggle render pass
  const setPassEnabled = (passId: keyof typeof pipeline.passes, enabled: boolean) => {
    setPath(['renderPipeline', 'passes', passId, 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} ${passId} pass`);
  };

  // Update pass settings
  const updatePass = <K extends keyof typeof pipeline.passes>(
    passId: K,
    settings: Partial<typeof pipeline.passes[K]>
  ) => {
    const updates = Object.entries(settings).map(([key, value]) => ({
      path: ['renderPipeline', 'passes', passId, key] as StatePath,
      value,
    }));
    batchUpdate(updates, `Update ${passId} pass`);
  };

  // Get post effect by ID
  const getPostEffect = (id: string): PostEffect | undefined => {
    return pipeline.postEffects.find((e) => e.id === id);
  };

  // Toggle post effect
  const setPostEffectEnabled = (id: string, enabled: boolean) => {
    const idx = pipeline.postEffects.findIndex((e) => e.id === id);
    if (idx !== -1) {
      setPath(
        ['renderPipeline', 'postEffects', idx, 'enabled'],
        enabled,
        `${enabled ? 'Enable' : 'Disable'} ${pipeline.postEffects[idx].name}`
      );
    }
  };

  // Update post effect settings
  const updatePostEffect = (id: string, settings: Partial<PostEffect>) => {
    const idx = pipeline.postEffects.findIndex((e) => e.id === id);
    if (idx === -1) return;

    const updates = Object.entries(settings).map(([key, value]) => ({
      path: ['renderPipeline', 'postEffects', idx, key] as StatePath,
      value,
    }));
    batchUpdate(updates, `Update ${pipeline.postEffects[idx].name}`);
  };

  // Reorder post effects
  const reorderPostEffect = (id: string, newIndex: number) => {
    const idx = pipeline.postEffects.findIndex((e) => e.id === id);
    if (idx === -1 || idx === newIndex) return;

    const effects = [...pipeline.postEffects];
    const [removed] = effects.splice(idx, 1);
    effects.splice(newIndex, 0, removed);

    setPath(['renderPipeline', 'postEffects'], effects, `Reorder ${removed.name}`);
  };

  // Set debug view
  const setDebugView = (view: DebugViewMode) => {
    setPath(['renderPipeline', 'debugView'], view, `Set debug view: ${view}`);
  };

  // Toggle stats
  const toggleStats = () => {
    setPath(['renderPipeline', 'showStats'], !pipeline.showStats, `${pipeline.showStats ? 'Hide' : 'Show'} stats`);
  };

  return {
    passes: pipeline.passes,
    postEffects: pipeline.postEffects,
    debugView: pipeline.debugView,
    showStats: pipeline.showStats,
    setPassEnabled,
    updatePass,
    getPostEffect,
    setPostEffectEnabled,
    updatePostEffect,
    reorderPostEffect,
    setDebugView,
    toggleStats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lighting Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for lighting system
 */
export function useLighting() {
  const lighting = useEngineState((state) => state.lighting);
  const setPath = useEngineState((state) => state.setPath);

  // Sun controls
  const setSunEnabled = (enabled: boolean) => {
    setPath(['lighting', 'sun', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} sun`);
  };

  const setSunDirection = (direction: [number, number, number]) => {
    setPath(['lighting', 'sun', 'direction'], direction, 'Set sun direction');
  };

  const setSunColor = (color: [number, number, number]) => {
    setPath(['lighting', 'sun', 'color'], color, 'Set sun color');
  };

  const setSunIntensity = (intensity: number) => {
    setPath(['lighting', 'sun', 'intensity'], intensity, 'Set sun intensity');
  };

  const setSunShadows = (enabled: boolean) => {
    setPath(['lighting', 'sun', 'castShadows'], enabled, `${enabled ? 'Enable' : 'Disable'} sun shadows`);
  };

  // Ambient controls
  const setAmbientColor = (color: [number, number, number]) => {
    setPath(['lighting', 'ambient', 'color'], color, 'Set ambient color');
  };

  const setAmbientIntensity = (intensity: number) => {
    setPath(['lighting', 'ambient', 'intensity'], intensity, 'Set ambient intensity');
  };

  // Point/spot lights
  const addLight = (light: SceneLight) => {
    setPath(['lighting', 'lights'], [...lighting.lights, light], `Add light: ${light.id}`);
  };

  const removeLight = (id: string) => {
    setPath(
      ['lighting', 'lights'],
      lighting.lights.filter((l) => l.id !== id),
      `Remove light: ${id}`
    );
  };

  const updateLight = (id: string, updates: Partial<SceneLight>) => {
    const idx = lighting.lights.findIndex((l) => l.id === id);
    if (idx === -1) return;

    const updatedLight = { ...lighting.lights[idx], ...updates };
    const lights = [...lighting.lights];
    lights[idx] = updatedLight;
    setPath(['lighting', 'lights'], lights, `Update light: ${id}`);
  };

  const getLight = (id: string): SceneLight | undefined => {
    return lighting.lights.find((l) => l.id === id);
  };

  // GI controls
  const setGIEnabled = (enabled: boolean) => {
    setPath(['lighting', 'gi', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} GI`);
  };

  const setGIIntensity = (intensity: number) => {
    setPath(['lighting', 'gi', 'intensity'], intensity, 'Set GI intensity');
  };

  return {
    sun: lighting.sun,
    ambient: lighting.ambient,
    lights: lighting.lights,
    gi: lighting.gi,
    setSunEnabled,
    setSunDirection,
    setSunColor,
    setSunIntensity,
    setSunShadows,
    setAmbientColor,
    setAmbientIntensity,
    addLight,
    removeLight,
    updateLight,
    getLight,
    setGIEnabled,
    setGIIntensity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for environment settings (sky, fog, time of day)
 */
export function useEnvironment() {
  const env = useEngineState((state) => state.environment);
  const setPath = useEngineState((state) => state.setPath);
  const batchUpdate = useEngineState((state) => state.batchUpdate);

  // Sky controls
  const setSkyType = (type: SkyboxType) => {
    setPath(['environment', 'skybox', 'type'], type, `Set sky type: ${type}`);
  };

  const setSkyGradient = (gradient: { zenith?: [number, number, number]; horizon?: [number, number, number]; ground?: [number, number, number] }) => {
    const updates: Array<{ path: StatePath; value: unknown }> = [];
    if (gradient.zenith) updates.push({ path: ['environment', 'skybox', 'gradient', 'zenith'], value: gradient.zenith });
    if (gradient.horizon) updates.push({ path: ['environment', 'skybox', 'gradient', 'horizon'], value: gradient.horizon });
    if (gradient.ground) updates.push({ path: ['environment', 'skybox', 'gradient', 'ground'], value: gradient.ground });
    if (updates.length > 0) batchUpdate(updates, 'Set sky gradient');
  };

  const setSkyExposure = (exposure: number) => {
    setPath(['environment', 'skybox', 'exposure'], exposure, 'Set sky exposure');
  };

  const setSkyRotation = (rotation: number) => {
    setPath(['environment', 'skybox', 'rotation'], rotation, 'Set sky rotation');
  };

  // Fog controls
  const setFogEnabled = (enabled: boolean) => {
    setPath(['environment', 'fog', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} fog`);
  };

  const setFogType = (type: FogType) => {
    setPath(['environment', 'fog', 'type'], type, `Set fog type: ${type}`);
  };

  const setFogColor = (color: [number, number, number]) => {
    setPath(['environment', 'fog', 'color'], color, 'Set fog color');
  };

  const setFogDensity = (density: number) => {
    setPath(['environment', 'fog', 'density'], density, 'Set fog density');
  };

  const setFogRange = (start: number, end: number) => {
    batchUpdate([
      { path: ['environment', 'fog', 'start'], value: start },
      { path: ['environment', 'fog', 'end'], value: end },
    ], 'Set fog range');
  };

  // Time of day
  const setTimeOfDay = (time: number) => {
    setPath(['environment', 'timeOfDay'], Math.max(0, Math.min(1, time)), 'Set time of day');
  };

  return {
    skybox: env.skybox,
    fog: env.fog,
    timeOfDay: env.timeOfDay,
    setSkyType,
    setSkyGradient,
    setSkyExposure,
    setSkyRotation,
    setFogEnabled,
    setFogType,
    setFogColor,
    setFogDensity,
    setFogRange,
    setTimeOfDay,
  };
}
