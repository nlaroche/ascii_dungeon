/**
 * Test helpers for ECS tests.
 * Provides seeded worlds, entity builders, and common fixtures.
 *
 * @example
 * import { createTestWorld, buildEntity } from './ecs-helpers.js';
 * const world = createTestWorld();
 * const player = buildEntity(world, 'player', { x: 5, y: 5 });
 */

import { createWorld } from '../../src/ecs/World.js';
import { COMPONENTS } from '../../src/ecs/components.js';
import { EVENT_SCHEMAS } from '../../src/ecs/events.js';
import { createRng } from '../../src/lib/rng.js';

/**
 * Create a world with devMode enabled and event schemas registered.
 * @param {object} [opts] Additional options
 * @returns {object} World instance
 */
export function createTestWorld(opts = {}) {
  return createWorld({
    devMode: true,
    payloadSchemas: EVENT_SCHEMAS,
    ...opts,
  });
}

/**
 * Create a seeded RNG for deterministic tests.
 * @param {number} [seed=42]
 * @returns {Function} RNG
 */
export function seededRng(seed = 42) {
  return createRng(seed);
}

/**
 * Build a common entity type with components pre-filled.
 * Returns the entity ID.
 *
 * @param {object} world World instance
 * @param {string} type Entity template name
 * @param {object} [overrides] Per-component overrides
 * @returns {number} Entity ID
 */
export function buildEntity(world, type, overrides = {}) {
  const id = world.spawn();

  switch (type) {
    case 'player': {
      world.addComponent(id, COMPONENTS.POSITION, {
        x: overrides.x ?? 5,
        y: overrides.y ?? 5,
      });
      world.addComponent(id, COMPONENTS.RENDERABLE, {
        char: '@', fg: '#00ff00', bg: '#000000', depth: 0.5,
        ...overrides.renderable,
      });
      world.addComponent(id, COMPONENTS.HEALTH, {
        hp: overrides.hp ?? 100,
        maxHp: overrides.maxHp ?? 100,
      });
      world.addComponent(id, COMPONENTS.COMBAT_STATS, {
        attack: overrides.attack ?? 10,
        defense: overrides.defense ?? 5,
      });
      world.addComponent(id, COMPONENTS.PLAYER_TAG, {});
      world.addComponent(id, COMPONENTS.EXPERIENCE, {
        level: overrides.level ?? 1,
        xp: overrides.xp ?? 0,
        xpToNext: overrides.xpToNext ?? 100,
      });
      world.addComponent(id, COMPONENTS.STAMINA, {
        current: overrides.stamina ?? 20,
        max: overrides.maxStamina ?? 20,
      });
      world.addComponent(id, COMPONENTS.INVENTORY, {
        items: [],
        gold: overrides.gold ?? 0,
        equipment: {},
      });
      break;
    }

    case 'enemy': {
      world.addComponent(id, COMPONENTS.POSITION, {
        x: overrides.x ?? 8,
        y: overrides.y ?? 5,
      });
      world.addComponent(id, COMPONENTS.RENDERABLE, {
        char: overrides.char ?? 'g',
        fg: '#ff0000',
        bg: '#000000',
        depth: 0.5,
        ...overrides.renderable,
      });
      world.addComponent(id, COMPONENTS.HEALTH, {
        hp: overrides.hp ?? 20,
        maxHp: overrides.maxHp ?? 20,
      });
      world.addComponent(id, COMPONENTS.COMBAT_STATS, {
        attack: overrides.attack ?? 5,
        defense: overrides.defense ?? 2,
      });
      world.addComponent(id, COMPONENTS.AI, {
        behavior: overrides.behavior ?? 'aggressive',
        aggroRadius: overrides.aggroRadius ?? 5,
      });
      world.addComponent(id, COMPONENTS.LOOT, {
        gold: overrides.lootGold ?? 10,
        xp: overrides.lootXp ?? 25,
      });
      world.addComponent(id, COMPONENTS.NAME, {
        display: overrides.name ?? 'Goblin',
      });
      break;
    }

    case 'particle': {
      world.addComponent(id, COMPONENTS.POSITION, {
        x: overrides.x ?? 0,
        y: overrides.y ?? 0,
      });
      world.addComponent(id, COMPONENTS.RENDERABLE, {
        char: overrides.char ?? '*',
        fg: overrides.fg ?? '#ffffff',
        bg: '#000000',
        depth: 0.8,
      });
      world.addComponent(id, COMPONENTS.VELOCITY, {
        vx: overrides.vx ?? 0,
        vy: overrides.vy ?? 0,
        gravity: overrides.gravity ?? 5,
      });
      world.addComponent(id, COMPONENTS.LIFETIME, {
        remaining: overrides.lifetime ?? 0.5,
        max: overrides.lifetime ?? 0.5,
      });
      break;
    }

    case 'torch': {
      world.addComponent(id, COMPONENTS.POSITION, {
        x: overrides.x ?? 0,
        y: overrides.y ?? 0,
      });
      world.addComponent(id, COMPONENTS.RENDERABLE, {
        char: '!', fg: '#ff8800', bg: '#000000', depth: 0.3,
      });
      world.addComponent(id, COMPONENTS.LIGHT_SOURCE, {
        color: overrides.color ?? [0.9, 0.65, 0.35],
        radius: overrides.radius ?? 12,
        intensity: overrides.intensity ?? 1.0,
        flicker: overrides.flicker ?? true,
        wallMounted: overrides.wallMounted ?? false,
      });
      break;
    }

    default:
      throw new Error(`Unknown entity type: "${type}"`);
  }

  return id;
}
