/**
 * LifetimeSystem — auto-destroys entities when their lifetime expires.
 *
 * @example
 * world.addSystem('lifetime', LifetimeSystem);
 */

import { COMPONENTS } from '../components.js';

/**
 * @param {object} world
 * @param {number} dt Delta time in seconds
 */
export function LifetimeSystem(world, dt) {
  const entities = world.query([COMPONENTS.LIFETIME]);
  for (const id of entities) {
    const life = world.getComponent(id, COMPONENTS.LIFETIME);
    life.remaining -= dt;
    if (life.remaining <= 0) {
      world.destroy(id);
    }
  }
}
