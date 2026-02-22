/**
 * ECS World — entity CRUD, component storage, queries, update loop.
 *
 * Entities are integer IDs. Components are plain data objects stored in
 * per-component-type Maps. Systems are pure functions (world, dt) => void.
 *
 * @example
 * const world = createWorld({ devMode: true });
 * const e = world.spawn();
 * world.addComponent(e, 'position', { x: 0, y: 0 });
 * world.addComponent(e, 'renderable', { char: '@', fg: '#fff' });
 * const movers = world.query(['position', 'velocity']);
 * world.update(0.016);
 */

import { createEventBus } from './EventBus.js';
import { validateComponent, applyDefaults } from './schemas.js';

/**
 * Create a new ECS World.
 * @param {object} [opts]
 * @param {boolean} [opts.devMode=false] Enable schema validation and checks
 * @param {object} [opts.payloadSchemas] Event payload schemas for devMode
 * @returns {object} World instance
 */
export function createWorld(opts = {}) {
  const devMode = opts.devMode ?? false;
  const payloadSchemas = opts.payloadSchemas ?? {};

  let nextEntityId = 1;

  /** @type {Set<number>} */
  const alive = new Set();

  /** @type {Map<string, Map<number, object>>} Component stores: name → (entityId → data) */
  const stores = new Map();

  /** @type {Map<string, object>} World-level singleton resources */
  const resources = new Map();

  /** @type {Array<{ name: string, fn: Function, phase: string }>} */
  const systems = [];

  const events = createEventBus({ devMode, payloadSchemas });

  /** Query cache: key → Set<number>. Invalidated on component add/remove. */
  const queryCache = new Map();
  let queryCacheDirty = true;

  function invalidateQueryCache() {
    queryCacheDirty = true;
    queryCache.clear();
  }

  /**
   * Get or create a component store for a given component name.
   * @param {string} name
   * @returns {Map<number, object>}
   */
  function getStore(name) {
    let store = stores.get(name);
    if (!store) {
      store = new Map();
      stores.set(name, store);
    }
    return store;
  }

  const world = {
    /** Whether devMode validation is active. */
    devMode,

    /** The event bus. */
    events,

    // ── Entity CRUD ──

    /**
     * Create a new entity and return its ID.
     * @returns {number} Entity ID
     */
    spawn() {
      const id = nextEntityId++;
      alive.add(id);
      return id;
    },

    /**
     * Destroy an entity and remove all its components.
     * @param {number} id Entity ID
     */
    destroy(id) {
      if (devMode && !alive.has(id)) {
        console.warn(`World.destroy: entity ${id} does not exist`);
        return;
      }
      alive.delete(id);
      for (const store of stores.values()) {
        store.delete(id);
      }
      invalidateQueryCache();
    },

    /**
     * Check if an entity is alive.
     * @param {number} id
     * @returns {boolean}
     */
    isAlive(id) {
      return alive.has(id);
    },

    /**
     * Get count of alive entities.
     * @returns {number}
     */
    entityCount() {
      return alive.size;
    },

    // ── Component CRUD ──

    /**
     * Add a component to an entity.
     * @param {number} id Entity ID
     * @param {string} name Component name (use COMPONENTS constants)
     * @param {object} data Component data
     */
    addComponent(id, name, data = {}) {
      if (devMode) {
        if (!alive.has(id)) {
          throw new Error(`World.addComponent: entity ${id} does not exist`);
        }
        validateComponent(name, data);
      }
      const withDefaults = applyDefaults(name, data);
      getStore(name).set(id, withDefaults);
      invalidateQueryCache();
    },

    /**
     * Remove a component from an entity.
     * @param {number} id Entity ID
     * @param {string} name Component name
     */
    removeComponent(id, name) {
      const store = stores.get(name);
      if (store) {
        store.delete(id);
        invalidateQueryCache();
      }
    },

    /**
     * Get a component for an entity (or undefined).
     * @param {number} id Entity ID
     * @param {string} name Component name
     * @returns {object|undefined}
     */
    getComponent(id, name) {
      const store = stores.get(name);
      return store ? store.get(id) : undefined;
    },

    /**
     * Check if an entity has a component.
     * @param {number} id Entity ID
     * @param {string} name Component name
     * @returns {boolean}
     */
    hasComponent(id, name) {
      const store = stores.get(name);
      return store ? store.has(id) : false;
    },

    // ── Queries ──

    /**
     * Get all entities that have ALL specified components.
     * Returns a Set of entity IDs. Cached until components change.
     *
     * @param {string[]} componentNames Array of component names
     * @returns {Set<number>}
     */
    query(componentNames) {
      const key = componentNames.join(',');
      if (!queryCacheDirty && queryCache.has(key)) {
        return queryCache.get(key);
      }

      const result = new Set();

      // Start with the smallest store for efficiency
      let smallestStore = null;
      let smallestSize = Infinity;
      for (const name of componentNames) {
        const store = stores.get(name);
        const size = store ? store.size : 0;
        if (size < smallestSize) {
          smallestSize = size;
          smallestStore = store;
        }
      }

      if (smallestStore) {
        for (const id of smallestStore.keys()) {
          if (!alive.has(id)) continue;
          let hasAll = true;
          for (const name of componentNames) {
            const store = stores.get(name);
            if (!store || !store.has(id)) {
              hasAll = false;
              break;
            }
          }
          if (hasAll) result.add(id);
        }
      }

      queryCache.set(key, result);
      // Only clear dirty flag when all pending queries resolved
      // (we clear it on first successful cache build)
      queryCacheDirty = false;
      return result;
    },

    // ── Resources ──

    /**
     * Set a world-level resource (singleton).
     * @param {string} name Resource name
     * @param {*} value Resource value
     */
    setResource(name, value) {
      resources.set(name, value);
    },

    /**
     * Get a world-level resource.
     * @param {string} name Resource name
     * @returns {*}
     */
    getResource(name) {
      return resources.get(name);
    },

    /**
     * Check if a resource exists.
     * @param {string} name
     * @returns {boolean}
     */
    hasResource(name) {
      return resources.has(name);
    },

    // ── Systems ──

    /**
     * Register a system function.
     * @param {string} name System name (for debugging)
     * @param {Function} fn System function: (world, dt) => void
     * @param {string} [phase='update'] Execution phase
     */
    addSystem(name, fn, phase = 'update') {
      systems.push({ name, fn, phase });
    },

    /**
     * Run all systems in registration order.
     * @param {number} dt Delta time in seconds
     */
    update(dt) {
      for (const sys of systems) {
        sys.fn(world, dt);
      }
    },

    /**
     * Get registered system count.
     * @returns {number}
     */
    systemCount() {
      return systems.length;
    },

    // ── Bulk operations ──

    /**
     * Destroy all entities matching a query.
     * @param {string[]} componentNames
     * @returns {number} Count of destroyed entities
     */
    destroyAll(componentNames) {
      const matches = [...world.query(componentNames)];
      for (const id of matches) {
        world.destroy(id);
      }
      return matches.length;
    },

    /**
     * Reset the entire world (entities, components, resources, systems, events).
     */
    reset() {
      alive.clear();
      stores.clear();
      resources.clear();
      systems.length = 0;
      events.reset();
      queryCache.clear();
      queryCacheDirty = true;
      nextEntityId = 1;
    },
  };

  return world;
}
