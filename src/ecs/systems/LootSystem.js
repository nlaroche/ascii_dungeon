/**
 * LootSystem — handles loot collection on combat:kill events.
 * Emits loot:collected for XP system to pick up.
 *
 * @example
 * world.addSystem('loot', LootSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function LootSystem(world, dt) {
  for (const evt of world.events.drain(EVENTS.COMBAT_KILL)) {
    const { attacker, defender } = evt;

    if (!world.isAlive(attacker)) continue;

    // Get loot from defeated entity
    const loot = world.getComponent(defender, COMPONENTS.LOOT);
    const gold = loot ? loot.gold : 0;
    const xp = loot ? loot.xp : 0;

    // Add gold to attacker's inventory
    const inventory = world.getComponent(attacker, COMPONENTS.INVENTORY);
    if (inventory) {
      inventory.gold += gold;
    }

    // Emit loot collected for XP system
    if (gold > 0 || xp > 0) {
      world.events.emit(EVENTS.LOOT_COLLECTED, {
        entity: attacker,
        gold,
        xp,
      });
    }

    // Destroy defeated entity
    world.destroy(defender);
  }
}
