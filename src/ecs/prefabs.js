/**
 * Entity prefabs — data-driven templates for spawning entities.
 * Each prefab is a plain object mapping component names to data.
 * Use spawnPrefab() to create entities from templates.
 *
 * @example
 * import { PREFABS, spawnPrefab } from './prefabs.js';
 * const playerId = spawnPrefab(world, PREFABS.PLAYER, { position: { x: 5, y: 5 } });
 */

import { COMPONENTS } from './components.js';
import { COLORS } from '../lib/palette.js';

export const PREFABS = Object.freeze({
  PLAYER: {
    [COMPONENTS.POSITION]: { x: 1, y: 1 },
    [COMPONENTS.SMOOTH_POSITION]: {},
    [COMPONENTS.RENDERABLE]: { char: '@', fg: COLORS.player, bg: COLORS.black, depth: 0.5 },
    [COMPONENTS.HEALTH]: { hp: 100, maxHp: 100 },
    [COMPONENTS.COMBAT_STATS]: { attack: 10, defense: 5 },
    [COMPONENTS.PLAYER_TAG]: {},
    [COMPONENTS.EXPERIENCE]: { level: 1, xp: 0, xpToNext: 100 },
    [COMPONENTS.STAMINA]: { current: 20, max: 20 },
    [COMPONENTS.INVENTORY]: { items: [], gold: 0, equipment: {} },
    [COMPONENTS.NAME]: { display: 'Hero' },
    [COMPONENTS.CAMERA_TARGET]: { damping: 5.0, deadZoneX: 1.5, deadZoneY: 1.0, zoom: 1.0 },
  },

  GOBLIN: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: 'g', fg: COLORS.goblin, bg: COLORS.black, depth: 0.5 },
    [COMPONENTS.HEALTH]: { hp: 20, maxHp: 20 },
    [COMPONENTS.COMBAT_STATS]: { attack: 5, defense: 2 },
    [COMPONENTS.AI]: { behavior: 'aggressive', aggroRadius: 5 },
    [COMPONENTS.LOOT]: { gold: 10, xp: 25 },
    [COMPONENTS.NAME]: { display: 'Goblin' },
  },

  SKELETON: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: 's', fg: COLORS.skeleton, bg: COLORS.black, depth: 0.5 },
    [COMPONENTS.HEALTH]: { hp: 35, maxHp: 35 },
    [COMPONENTS.COMBAT_STATS]: { attack: 8, defense: 4 },
    [COMPONENTS.AI]: { behavior: 'aggressive', aggroRadius: 6 },
    [COMPONENTS.LOOT]: { gold: 20, xp: 50 },
    [COMPONENTS.NAME]: { display: 'Skeleton' },
  },

  TORCH: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: '!', fg: COLORS.torch, bg: COLORS.black, depth: 0.3 },
    [COMPONENTS.LIGHT_SOURCE]: {
      color: [0.9, 0.65, 0.35],
      radius: 12,
      intensity: 1.0,
      flicker: true,
      wallMounted: false,
    },
  },

  TREASURE: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: '$', fg: COLORS.treasure, bg: COLORS.black, depth: 0.4 },
    [COMPONENTS.COLLECTABLE]: { type: 'treasure', gold: 25, xp: 10 },
    [COMPONENTS.NAME]: { display: 'Treasure' },
  },

  PARTICLE: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: '*', fg: COLORS.particleDefault, bg: COLORS.black, depth: 0.9 },
    [COMPONENTS.VELOCITY]: { vx: 0, vy: 0, gravity: 5 },
    [COMPONENTS.LIFETIME]: { remaining: 0.5, max: 0.5 },
  },

  FLOAT_TEXT: {
    [COMPONENTS.POSITION]: { x: 0, y: 0 },
    [COMPONENTS.RENDERABLE]: { char: ' ', fg: COLORS.damage, bg: COLORS.black, depth: 1.0 },
    [COMPONENTS.VELOCITY]: { vx: 0, vy: -2.5, gravity: 0 },
    [COMPONENTS.LIFETIME]: { remaining: 0.8, max: 0.8 },
  },
});

/**
 * Spawn an entity from a prefab template with optional overrides.
 *
 * @param {object} world World instance
 * @param {object} prefab Prefab template from PREFABS
 * @param {object} [overrides] Per-component overrides: { position: { x: 5 } }
 * @returns {number} Entity ID
 */
export function spawnPrefab(world, prefab, overrides = {}) {
  const id = world.spawn();

  for (const [component, defaultData] of Object.entries(prefab)) {
    const override = overrides[component] || {};
    const data = { ...defaultData, ...override };

    // Deep clone arrays/objects in data
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        data[key] = [...val];
      } else if (typeof val === 'object' && val !== null) {
        data[key] = { ...val };
      }
    }

    world.addComponent(id, component, data);
  }

  return id;
}
