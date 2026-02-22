/**
 * InputSystem — reads keyboard input resource and emits action events.
 * The input resource is set externally (from Game.js or workbench).
 *
 * @example
 * world.setResource('input', { key: 'ArrowUp' });
 * world.addSystem('input', InputSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';

const KEY_DIRS = {
  ArrowUp:    { dx:  0, dy: -1 },
  ArrowDown:  { dx:  0, dy:  1 },
  ArrowLeft:  { dx: -1, dy:  0 },
  ArrowRight: { dx:  1, dy:  0 },
  w:          { dx:  0, dy: -1 },
  s:          { dx:  0, dy:  1 },
  a:          { dx: -1, dy:  0 },
  d:          { dx:  1, dy:  0 },
};

/**
 * @param {object} world
 * @param {number} dt
 */
export function InputSystem(world, dt) {
  const input = world.getResource('input');
  if (!input || !input.key) return;

  const dir = KEY_DIRS[input.key];
  if (!dir) return;

  // Find player entity
  const players = world.query([COMPONENTS.POSITION, COMPONENTS.PLAYER_TAG]);
  for (const id of players) {
    world.events.emit(EVENTS.ACTION_MOVE, {
      entity: id,
      dx: dir.dx,
      dy: dir.dy,
    });
    break;
  }

  // Clear input after processing
  input.key = null;
}
