/**
 * MovementTweenSystem — smoothly interpolates entity positions between grid cells.
 *
 * @example
 * world.addSystem('movementTween', MovementTweenSystem);
 */

import { COMPONENTS } from '../components.js';
import { easeOutQuint } from '../../lib/easing.js';

/**
 * @param {object} world
 * @param {number} dt Delta time in seconds
 */
export function MovementTweenSystem(world, dt) {
  const entities = world.query([COMPONENTS.POSITION, COMPONENTS.SMOOTH_POSITION]);
  for (const id of entities) {
    const smooth = world.getComponent(id, COMPONENTS.SMOOTH_POSITION);
    if (smooth.duration <= 0) continue;

    smooth.elapsed += dt;
    const t = Math.min(smooth.elapsed / smooth.duration, 1.0);
    const eased = easeOutQuint(t);

    smooth.offsetX = (smooth.fromX - smooth.toX) * (1 - eased);
    smooth.offsetY = (smooth.fromY - smooth.toY) * (1 - eased);

    if (t >= 1.0) {
      smooth.offsetX = 0;
      smooth.offsetY = 0;
      smooth.duration = 0;
      smooth.elapsed = 0;
    }
  }
}
