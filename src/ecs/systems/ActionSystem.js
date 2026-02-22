/**
 * ActionSystem — resolves action:move events by updating entity positions.
 * Checks collision with dungeon grid. Detects adjacent enemies for auto-attack.
 *
 * @example
 * world.addSystem('action', ActionSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function ActionSystem(world, dt) {
  const dungeon = world.getResource('dungeon');

  for (const evt of world.events.drain(EVENTS.ACTION_MOVE)) {
    const { entity, dx, dy } = evt;
    if (!world.isAlive(entity)) continue;

    const pos = world.getComponent(entity, COMPONENTS.POSITION);
    if (!pos) continue;

    const nx = pos.x + dx;
    const ny = pos.y + dy;

    // Check dungeon bounds and walkability
    if (dungeon) {
      const grid = dungeon.grid;
      if (ny < 0 || ny >= dungeon.height || nx < 0 || nx >= dungeon.width) continue;
      const cell = grid[ny] && grid[ny][nx];
      if (!cell || cell.type === 'wall') continue;
    }

    // Check for entity collision at target position
    const occupant = findEntityAt(world, nx, ny, entity);
    if (occupant !== null) {
      // Convert move into attack if target has health
      if (world.hasComponent(occupant, COMPONENTS.HEALTH)) {
        world.events.emit(EVENTS.ACTION_ATTACK, {
          attacker: entity,
          defender: occupant,
        });
      }
      continue;
    }

    // Update smooth position for tween
    const smooth = world.getComponent(entity, COMPONENTS.SMOOTH_POSITION);
    if (smooth) {
      smooth.fromX = pos.x;
      smooth.fromY = pos.y;
      smooth.toX = nx;
      smooth.toY = ny;
      smooth.elapsed = 0;
      smooth.duration = 0.15;
    }

    pos.x = nx;
    pos.y = ny;

    // Spend stamina if entity has it
    const stamina = world.getComponent(entity, COMPONENTS.STAMINA);
    if (stamina) {
      stamina.current = Math.max(0, stamina.current - 1);
    }
  }
}

/**
 * Find an entity at the given position (excluding `exclude`).
 * @param {object} world
 * @param {number} x
 * @param {number} y
 * @param {number} exclude Entity to exclude
 * @returns {number|null} Entity ID or null
 */
function findEntityAt(world, x, y, exclude) {
  const entities = world.query([COMPONENTS.POSITION]);
  for (const id of entities) {
    if (id === exclude) continue;
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    if (pos.x === x && pos.y === y) return id;
  }
  return null;
}
