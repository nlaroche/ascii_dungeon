/**
 * DungeonSystem — generates dungeons by wrapping dungeon.js generateDungeon().
 * Listens for a 'generateDungeon' resource flag. Emits dungeon:generated event.
 *
 * @example
 * world.setResource('generateDungeon', { width: 20, height: 15, roomCount: 5, playerLevel: 1 });
 * world.addSystem('dungeon', DungeonSystem);
 */

import { EVENTS } from '../events.js';
import { generateDungeon } from '../../lib/dungeon.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function DungeonSystem(world, dt) {
  const request = world.getResource('generateDungeon');
  if (!request) return;

  // Clear the request so we don't regenerate every frame
  world.setResource('generateDungeon', null);

  const dungeon = generateDungeon(request);
  world.setResource('dungeon', dungeon);

  world.events.emit(EVENTS.DUNGEON_GENERATED, {
    width: dungeon.width,
    height: dungeon.height,
  });
}
