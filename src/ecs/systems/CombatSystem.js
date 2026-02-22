/**
 * CombatSystem — resolves combat by draining action:attack events.
 * Wraps combat.js resolveCombat(). Emits combat:hit and combat:kill events.
 *
 * @example
 * world.addSystem('combat', CombatSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';
import { resolveCombat } from '../../lib/combat.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function CombatSystem(world, dt) {
  for (const evt of world.events.drain(EVENTS.ACTION_ATTACK)) {
    const { attacker, defender } = evt;

    if (!world.isAlive(attacker) || !world.isAlive(defender)) continue;

    const attackerStats = world.getComponent(attacker, COMPONENTS.COMBAT_STATS);
    const defenderStats = world.getComponent(defender, COMPONENTS.COMBAT_STATS);
    const defenderHealth = world.getComponent(defender, COMPONENTS.HEALTH);
    const attackerHealth = world.getComponent(attacker, COMPONENTS.HEALTH);

    if (!attackerStats || !defenderHealth) continue;

    // Build objects for resolveCombat
    const attackerObj = {
      attack: attackerStats.attack,
      defense: attackerStats.defense,
    };
    const defenderObj = {
      hp: defenderHealth.hp,
      attack: defenderStats ? defenderStats.attack : 0,
      defense: defenderStats ? defenderStats.defense : 0,
      gold: 0,
      xp: 0,
    };

    // Pull loot data if defender has it
    const loot = world.getComponent(defender, COMPONENTS.LOOT);
    if (loot) {
      defenderObj.gold = loot.gold;
      defenderObj.xp = loot.xp;
    }

    const result = resolveCombat(attackerObj, defenderObj);

    // Apply damage to defender
    defenderHealth.hp = Math.max(0, defenderHealth.hp - result.defenderDamage);

    // Get defender position for effects
    const defPos = world.getComponent(defender, COMPONENTS.POSITION);

    // Emit hit event
    world.events.emit(EVENTS.COMBAT_HIT, {
      attacker,
      defender,
      damage: result.defenderDamage,
      pos: defPos ? { x: defPos.x, y: defPos.y } : undefined,
    });

    // Counter-attack damage to attacker
    if (result.attackerDamage > 0 && attackerHealth) {
      attackerHealth.hp = Math.max(0, attackerHealth.hp - result.attackerDamage);
    }

    // Check for kill
    if (defenderHealth.hp <= 0) {
      world.events.emit(EVENTS.COMBAT_KILL, { attacker, defender });
    }
  }
}
