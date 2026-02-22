/**
 * Factory: create a fully configured game world with all systems and resources.
 *
 * @example
 * import { createGameWorld } from './createGameWorld.js';
 * const world = createGameWorld({ renderer });
 * world.update(0.016);
 */

import { createWorld } from '../ecs/World.js';
import { EVENT_SCHEMAS } from '../ecs/events.js';
import { registerPipeline } from '../ecs/pipeline.js';
import { PREFABS, spawnPrefab } from '../ecs/prefabs.js';
import { CELL_FLAGS } from '../renderer/Renderer.js';
import { createRng } from '../lib/rng.js';

/**
 * Create a game world with all systems, resources, and initial entities.
 *
 * @param {object} opts
 * @param {object} opts.renderer Renderer instance
 * @param {number} [opts.seed=Date.now()] RNG seed
 * @param {number} [opts.dungeonWidth=20] Dungeon width
 * @param {number} [opts.dungeonHeight=15] Dungeon height
 * @param {number} [opts.roomCount=5] Number of rooms
 * @returns {object} { world, playerId }
 */
export function createGameWorld(opts) {
  const {
    renderer,
    seed = Date.now(),
    dungeonWidth = 20,
    dungeonHeight = 15,
    roomCount = 5,
  } = opts;

  const world = createWorld({
    devMode: false,
    payloadSchemas: EVENT_SCHEMAS,
  });

  // Register all systems
  registerPipeline(world);

  // Set resources
  const rng = createRng(seed);
  world.setResource('rng', rng);
  world.setResource('renderer', renderer);
  world.setResource('cellFlags', CELL_FLAGS);
  world.setResource('time', { elapsed: 0 });
  world.setResource('input', { key: null });
  world.setResource('fovConfig', { radius: 10 });
  world.setResource('lightSubRes', 3);

  // Trigger dungeon generation
  world.setResource('generateDungeon', {
    width: dungeonWidth,
    height: dungeonHeight,
    roomCount,
    playerLevel: 1,
  });

  // Spawn player
  const playerId = spawnPrefab(world, PREFABS.PLAYER, {
    position: { x: 1, y: 1 },
  });

  // Run one tick to generate dungeon
  world.update(0);

  // Place player in first room if dungeon generated
  const dungeon = world.getResource('dungeon');
  if (dungeon && dungeon.rooms && dungeon.rooms.length > 0) {
    const room = dungeon.rooms[0];
    const pos = world.getComponent(playerId, 'position');
    pos.x = Math.floor(room.x + room.width / 2);
    pos.y = Math.floor(room.y + room.height / 2);
  }

  // Spawn enemies from dungeon contents
  if (dungeon) {
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.grid[y][x];
        if (cell.contents && cell.contents.type === 'enemy') {
          const enemy = spawnPrefab(world, PREFABS.GOBLIN, {
            position: { x, y },
          });
          // Transfer enemy stats from dungeon data
          const health = world.getComponent(enemy, 'health');
          health.hp = cell.contents.hp || 20;
          health.maxHp = cell.contents.hp || 20;
          const stats = world.getComponent(enemy, 'combatStats');
          stats.attack = cell.contents.attack || 5;
          stats.defense = cell.contents.defense || 2;
          const loot = world.getComponent(enemy, 'loot');
          loot.gold = cell.contents.gold || 10;
          loot.xp = cell.contents.xp || 25;
          // Clear contents from grid (entity owns it now)
          cell.contents = null;
        }
      }
    }
  }

  return { world, playerId };
}
