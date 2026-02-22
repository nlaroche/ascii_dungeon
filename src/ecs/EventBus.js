/**
 * Queue-drain event bus for inter-system communication.
 * Systems emit events; later systems drain them in the same frame.
 * No callbacks by default — just queues. Optional on/off for external listeners.
 *
 * @example
 * const bus = createEventBus();
 * bus.emit('combat:hit', { damage: 5 });
 * for (const evt of bus.drain('combat:hit')) {
 *   console.log(evt.damage); // 5
 * }
 */

/**
 * Create an event bus instance.
 * @param {object} [opts]
 * @param {boolean} [opts.devMode=false] Enable payload validation
 * @param {object} [opts.payloadSchemas] Map of event type → schema for devMode validation
 * @returns {object} EventBus instance
 */
export function createEventBus(opts = {}) {
  const devMode = opts.devMode ?? false;
  const payloadSchemas = opts.payloadSchemas ?? {};

  /** @type {Map<string, Array>} */
  const queues = new Map();

  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /**
   * Validate event payload against schema in devMode.
   * @param {string} type
   * @param {object} payload
   */
  function validatePayload(type, payload) {
    const schema = payloadSchemas[type];
    if (!schema) return;

    for (const [field, rule] of Object.entries(schema)) {
      const val = payload[field];
      if (rule.required && val === undefined) {
        throw new Error(`Event "${type}": missing required field "${field}"`);
      }
      if (val !== undefined && rule.type && typeof val !== rule.type) {
        throw new Error(`Event "${type}": field "${field}" expected ${rule.type}, got ${typeof val}`);
      }
    }
  }

  return {
    /**
     * Emit an event into the queue.
     * @param {string} type Event type constant
     * @param {object} payload Event data
     */
    emit(type, payload = {}) {
      if (devMode) {
        if (typeof type !== 'string' || type.length === 0) {
          throw new Error(`EventBus.emit: invalid event type "${type}"`);
        }
        validatePayload(type, payload);
      }

      if (!queues.has(type)) {
        queues.set(type, []);
      }
      queues.get(type).push(payload);

      // Notify direct listeners (for external/debug use)
      const subs = listeners.get(type);
      if (subs) {
        for (const fn of subs) {
          fn(payload);
        }
      }
    },

    /**
     * Drain all queued events of a given type. Returns the array and clears the queue.
     * @param {string} type Event type constant
     * @returns {Array<object>} Array of payloads (may be empty)
     */
    drain(type) {
      const queue = queues.get(type);
      if (!queue || queue.length === 0) return [];
      const drained = queue.slice();
      queue.length = 0;
      return drained;
    },

    /**
     * Peek at queued events without draining.
     * @param {string} type
     * @returns {Array<object>}
     */
    peek(type) {
      return queues.get(type) || [];
    },

    /**
     * Subscribe a listener for an event type (for external/debug use).
     * @param {string} type
     * @param {Function} fn
     */
    on(type, fn) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(fn);
    },

    /**
     * Unsubscribe a listener.
     * @param {string} type
     * @param {Function} fn
     */
    off(type, fn) {
      const subs = listeners.get(type);
      if (subs) subs.delete(fn);
    },

    /**
     * Clear all queues (call at end of frame if needed).
     */
    clearAll() {
      for (const queue of queues.values()) {
        queue.length = 0;
      }
    },

    /**
     * Reset entire bus (queues + listeners).
     */
    reset() {
      queues.clear();
      listeners.clear();
    },
  };
}
