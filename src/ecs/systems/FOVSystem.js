/**
 * FOVSystem — computes field of view for the player entity.
 * Wraps fov.js castFOV(). Emits fov:updated event.
 *
 * @example
 * world.addSystem('fov', FOVSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';
import { castFOV } from '../../lib/fov.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function FOVSystem(world, dt) {
  const dungeon = world.getResource('dungeon');
  if (!dungeon) return;

  const fovConfig = world.getResource('fovConfig') || { radius: 10 };

  // Find player
  const players = world.query([COMPONENTS.POSITION, COMPONENTS.PLAYER_TAG]);
  let playerId = null;
  for (const id of players) {
    playerId = id;
    break;
  }
  if (!playerId) return;

  const pos = world.getComponent(playerId, COMPONENTS.POSITION);
  const gridW = dungeon.width;
  const gridH = dungeon.height;
  const grid = dungeon.grid;

  const isBlocking = (x, y) => {
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return true;
    const cell = grid[y] && grid[y][x];
    return cell ? cell.type === 'wall' : true;
  };

  const visibleSet = castFOV(pos.x, pos.y, fovConfig.radius, gridW, gridH, isBlocking);

  world.setResource('visibleSet', visibleSet);

  world.events.emit(EVENTS.FOV_UPDATED, { visibleSet });
}
