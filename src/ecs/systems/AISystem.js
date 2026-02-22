/**
 * AISystem — AI entities decide their action each tick.
 * Wraps ai.js decideAction(). Emits action:move and action:attack events.
 *
 * @example
 * world.addSystem('ai', AISystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function AISystem(world, dt) {
  const dungeon = world.getResource('dungeon');
  if (!dungeon) return;

  const aiEntities = world.query([COMPONENTS.POSITION, COMPONENTS.AI]);
  const playerEntities = world.query([COMPONENTS.POSITION, COMPONENTS.PLAYER_TAG]);

  // Find player position
  let playerPos = null;
  let playerId = null;
  for (const id of playerEntities) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    playerPos = pos;
    playerId = id;
    break;
  }

  for (const id of aiEntities) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    const ai = world.getComponent(id, COMPONENTS.AI);

    if (!playerPos) continue;

    // Check if player is adjacent
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist === 1 && ai.behavior === 'aggressive') {
      // Attack player
      world.events.emit(EVENTS.ACTION_ATTACK, {
        attacker: id,
        defender: playerId,
      });
    } else if (dist <= ai.aggroRadius && ai.behavior === 'aggressive') {
      // Move toward player
      const moveX = dx !== 0 ? Math.sign(dx) : 0;
      const moveY = dx === 0 && dy !== 0 ? Math.sign(dy) : 0;
      world.events.emit(EVENTS.ACTION_MOVE, {
        entity: id,
        dx: moveX,
        dy: moveY,
      });
    }
  }
}
