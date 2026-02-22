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
export function resolveCombat(attacker, defender, rng) {
  // Calculate attacker damage to defender (±20% variance when rng provided)
  const atkVariance = rng ? rng.float(0.8, 1.2) : 1.0;
  const defenderDamage = Math.max(1, Math.round((attacker.attack - 5) * atkVariance));
  const newDefenderHp = defender.hp - defenderDamage;
  const defenderKilled = newDefenderHp <= 0;

  // Calculate defender counter-attack damage (if not killed)
  let attackerDamage = 0;
  if (!defenderKilled && defender.attack) {
    const defVariance = rng ? rng.float(0.8, 1.2) : 1.0;
    attackerDamage = Math.max(1, Math.round(((defender.attack || 0) - (attacker.defense || 0)) * defVariance));
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
