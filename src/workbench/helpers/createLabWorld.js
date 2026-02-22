/**
 * Factory for creating isolated lab worlds for workbench tabs.
 * Each tab gets its own world with a subset of systems.
 *
 * @example
 * import { createLabWorld } from './createLabWorld.js';
 * const world = createLabWorld({
 *   systems: ['physics', 'lifetime', 'juice', 'render'],
 *   renderer: myRenderer,
 * });
 */

import { createWorld } from '../../ecs/World.js';
import { EVENT_SCHEMAS } from '../../ecs/events.js';
import { registerPipeline } from '../../ecs/pipeline.js';

/**
 * Create an isolated world for a workbench lab tab.
 *
 * @param {object} opts
 * @param {string[]} [opts.systems] System names to include (default: all)
 * @param {string[]} [opts.exclude] System names to exclude
 * @param {object} [opts.renderer] Renderer instance to set as resource
 * @param {boolean} [opts.devMode=true] Enable dev validation
 * @param {object} [opts.resources] Additional resources to set
 * @returns {object} World instance
 */
export function createLabWorld(opts = {}) {
  const {
    systems,
    exclude,
    renderer,
    devMode = true,
    resources = {},
  } = opts;

  const world = createWorld({
    devMode,
    payloadSchemas: EVENT_SCHEMAS,
  });

  // Register pipeline subset
  registerPipeline(world, {
    only: systems,
    exclude,
  });

  // Set resources
  if (renderer) {
    world.setResource('renderer', renderer);
  }

  world.setResource('cellFlags', { VISIBLE: 1 });
  world.setResource('time', { elapsed: 0 });

  for (const [name, value] of Object.entries(resources)) {
    world.setResource(name, value);
  }

  return world;
}
