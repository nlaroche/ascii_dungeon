/**
 * Combat Module - Pure combat resolution
 * No side effects, takes data in, returns data out
 */

/**
 * Resolve combat between attacker and defender
 * @param {Object} attacker - Attacker object with attack, defense
 * @param {Object} defender - Defender object with hp, attack, defense
 * @returns {Object} Combat result with damage, killed flag, loot
 */
export function resolveCombat(attacker, defender) {
  // Calculate attacker damage to defender
  const defenderDamage = Math.max(1, attacker.attack - 5);
  const newDefenderHp = defender.hp - defenderDamage;
  const defenderKilled = newDefenderHp <= 0;
  
  // Calculate defender counter-attack damage (if not killed)
  let attackerDamage = 0;
  if (!defenderKilled && defender.attack) {
    attackerDamage = Math.max(1, (defender.attack || 0) - (attacker.defense || 0));
  }
  
  // Calculate loot if defender is killed
  let loot = null;
  if (defenderKilled && defender.gold !== undefined) {
    loot = {
      gold: defender.gold,
      xp: defender.xp || 0
    };
  }
  
  return {
    attackerDamage,
    defenderDamage,
    defenderKilled,
    defenderHp: newDefenderHp,
    loot
  };
}

/**
 * Collect treasure
 * @param {Object} treasure - Treasure object with gold and xp
 * @returns {Object} Loot result
 */
export function collectTreasure(treasure) {
  return {
    gold: treasure.gold,
    xp: treasure.xp
  };
}
