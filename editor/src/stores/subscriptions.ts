// ═══════════════════════════════════════════════════════════════════════════
// Entity Subscription Manager
// Provides efficient subscriptions for non-React code (renderer, engine systems)
// ═══════════════════════════════════════════════════════════════════════════

import type { NormalizedNode, NormalizedComponent, EntityMaps } from './engineState';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeType = 'create' | 'update' | 'delete';

export type NodeChangeCallback = (
  node: NormalizedNode,
  changeType: ChangeType
) => void;

export type ComponentChangeCallback = (
  component: NormalizedComponent,
  changeType: ChangeType
) => void;

export type EntitiesChangeCallback = (
  entities: EntityMaps,
  changedNodeIds: string[],
  changedComponentIds: string[]
) => void;

export type SelectionChangeCallback = (
  nodeIds: string[],
  primaryId: string | null
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Entity Subscription Manager
// ─────────────────────────────────────────────────────────────────────────────

class EntitySubscriptionManager {
  // Node-specific subscribers (keyed by node ID)
  private nodeSubscribers = new Map<string, Set<NodeChangeCallback>>();

  // Component-specific subscribers (keyed by component ID)
  private componentSubscribers = new Map<string, Set<ComponentChangeCallback>>();

  // Global entity subscribers (notified of any entity change)
  private entitySubscribers = new Set<EntitiesChangeCallback>();

  // Selection subscribers
  private selectionSubscribers = new Set<SelectionChangeCallback>();

  // ─────────────────────────────────────────────────────────────────────────
  // Subscribe Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to changes on a specific node
   * Returns unsubscribe function
   */
  subscribeToNode(nodeId: string, callback: NodeChangeCallback): () => void {
    if (!this.nodeSubscribers.has(nodeId)) {
      this.nodeSubscribers.set(nodeId, new Set());
    }
    this.nodeSubscribers.get(nodeId)!.add(callback);

    return () => {
      this.nodeSubscribers.get(nodeId)?.delete(callback);
      if (this.nodeSubscribers.get(nodeId)?.size === 0) {
        this.nodeSubscribers.delete(nodeId);
      }
    };
  }

  /**
   * Subscribe to changes on a specific component
   * Returns unsubscribe function
   */
  subscribeToComponent(
    componentId: string,
    callback: ComponentChangeCallback
  ): () => void {
    if (!this.componentSubscribers.has(componentId)) {
      this.componentSubscribers.set(componentId, new Set());
    }
    this.componentSubscribers.get(componentId)!.add(callback);

    return () => {
      this.componentSubscribers.get(componentId)?.delete(callback);
      if (this.componentSubscribers.get(componentId)?.size === 0) {
        this.componentSubscribers.delete(componentId);
      }
    };
  }

  /**
   * Subscribe to ALL entity changes (nodes and components)
   * Best for renderers that need to rebuild on any scene change
   * Returns unsubscribe function
   */
  subscribeToEntities(callback: EntitiesChangeCallback): () => void {
    this.entitySubscribers.add(callback);
    return () => {
      this.entitySubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to selection changes
   * Returns unsubscribe function
   */
  subscribeToSelection(callback: SelectionChangeCallback): () => void {
    this.selectionSubscribers.add(callback);
    return () => {
      this.selectionSubscribers.delete(callback);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notify Methods (called by store middleware)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Notify subscribers of a node change
   */
  notifyNodeChange(
    nodeId: string,
    node: NormalizedNode | null,
    changeType: ChangeType
  ): void {
    // Notify node-specific subscribers
    if (node && this.nodeSubscribers.has(nodeId)) {
      this.nodeSubscribers.get(nodeId)!.forEach((cb) => {
        try {
          cb(node, changeType);
        } catch (e) {
          console.error('Error in node subscription callback:', e);
        }
      });
    }
  }

  /**
   * Notify subscribers of a component change
   */
  notifyComponentChange(
    componentId: string,
    component: NormalizedComponent | null,
    changeType: ChangeType
  ): void {
    // Notify component-specific subscribers
    if (component && this.componentSubscribers.has(componentId)) {
      this.componentSubscribers.get(componentId)!.forEach((cb) => {
        try {
          cb(component, changeType);
        } catch (e) {
          console.error('Error in component subscription callback:', e);
        }
      });
    }
  }

  /**
   * Notify global entity subscribers of batch changes
   */
  notifyEntitiesChange(
    entities: EntityMaps,
    changedNodeIds: string[],
    changedComponentIds: string[]
  ): void {
    this.entitySubscribers.forEach((cb) => {
      try {
        cb(entities, changedNodeIds, changedComponentIds);
      } catch (e) {
        console.error('Error in entities subscription callback:', e);
      }
    });
  }

  /**
   * Notify selection subscribers
   */
  notifySelectionChange(nodeIds: string[], primaryId: string | null): void {
    this.selectionSubscribers.forEach((cb) => {
      try {
        cb(nodeIds, primaryId);
      } catch (e) {
        console.error('Error in selection subscription callback:', e);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get count of active subscriptions (for debugging)
   */
  getSubscriptionCounts(): {
    nodes: number;
    components: number;
    entities: number;
    selection: number;
  } {
    return {
      nodes: this.nodeSubscribers.size,
      components: this.componentSubscribers.size,
      entities: this.entitySubscribers.size,
      selection: this.selectionSubscribers.size,
    };
  }

  /**
   * Clear all subscriptions (for cleanup)
   */
  clearAll(): void {
    this.nodeSubscribers.clear();
    this.componentSubscribers.clear();
    this.entitySubscribers.clear();
    this.selectionSubscribers.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────

export const entitySubscriptions = new EntitySubscriptionManager();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Detect changes between entity maps
// ─────────────────────────────────────────────────────────────────────────────

export function detectEntityChanges(
  prev: EntityMaps,
  next: EntityMaps
): { changedNodeIds: string[]; changedComponentIds: string[] } {
  const changedNodeIds: string[] = [];
  const changedComponentIds: string[] = [];

  // Check for new/updated nodes
  for (const id of Object.keys(next.nodes)) {
    if (prev.nodes[id] !== next.nodes[id]) {
      changedNodeIds.push(id);
    }
  }

  // Check for deleted nodes
  for (const id of Object.keys(prev.nodes)) {
    if (!next.nodes[id]) {
      changedNodeIds.push(id);
    }
  }

  // Check for new/updated components
  for (const id of Object.keys(next.components)) {
    if (prev.components[id] !== next.components[id]) {
      changedComponentIds.push(id);
    }
  }

  // Check for deleted components
  for (const id of Object.keys(prev.components)) {
    if (!next.components[id]) {
      changedComponentIds.push(id);
    }
  }

  return { changedNodeIds, changedComponentIds };
}
