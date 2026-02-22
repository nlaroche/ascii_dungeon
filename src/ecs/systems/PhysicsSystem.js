/**
 * PhysicsSystem — applies velocity and gravity to positioned entities.
 * Used for particles, projectiles, etc.
 *
 * @example
 * world.addSystem('physics', PhysicsSystem);
 */

import { COMPONENTS } from '../components.js';

/**
 * @param {object} world
 * @param {number} dt Delta time in seconds
 */
export function PhysicsSystem(world, dt) {
  const entities = world.query([COMPONENTS.POSITION, COMPONENTS.VELOCITY]);
  for (const id of entities) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    const vel = world.getComponent(id, COMPONENTS.VELOCITY);

    vel.vy += vel.gravity * dt;
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
}
