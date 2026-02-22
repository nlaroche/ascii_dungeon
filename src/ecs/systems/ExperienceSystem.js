/**
 * ExperienceSystem — handles XP gains from loot:collected events.
 * Emits xp:levelup when enough XP is gained.
 *
 * @example
 * world.addSystem('experience', ExperienceSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function ExperienceSystem(world, dt) {
  for (const evt of world.events.drain(EVENTS.LOOT_COLLECTED)) {
    const { entity, xp } = evt;

    if (!world.isAlive(entity)) continue;

    const exp = world.getComponent(entity, COMPONENTS.EXPERIENCE);
    if (!exp || xp <= 0) continue;

    exp.xp += xp;

    // Check for level ups
    while (exp.xp >= exp.xpToNext) {
      exp.xp -= exp.xpToNext;
      exp.level++;
      exp.xpToNext = Math.floor(exp.xpToNext * 1.5);

      // Boost stats on level up
      const health = world.getComponent(entity, COMPONENTS.HEALTH);
      if (health) {
        health.maxHp += 10;
        health.hp = health.maxHp;
      }

      const stats = world.getComponent(entity, COMPONENTS.COMBAT_STATS);
      if (stats) {
        stats.attack += 2;
        stats.defense += 1;
      }

      world.events.emit(EVENTS.XP_LEVELUP, {
        entity,
        newLevel: exp.level,
      });
    }
  }
}
