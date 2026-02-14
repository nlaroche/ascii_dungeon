/**
 * Player Module - Pure functions for player state management
 * No side effects, no dependencies on Game or Renderer
 */

/**
 * Create a fresh player object
 * @param {Object} overrides - Optional overrides for player properties
 * @returns {Object} Player state object
 */
export function createPlayer(overrides = {}) {
  return {
    name: 'Hero',
    hp: 100,
    maxHp: 100,
    stamina: 20,
    maxStamina: 20,
    attack: 10,
    defense: 5,
    intelligence: 5,
    level: 1,
    xp: 0,
    xpToNext: 100,
    gold: 0,
    inventory: [],
    equipment: {
      weapon: null,
      armor: null,
      amulet: null
    },
    x: 1,
    y: 1,
    ...overrides
  };
}

/**
 * Apply level up to player
 * @param {Object} player - Player object
 * @returns {Object} Updated player object
 */
export function applyLevelUp(player) {
  const newPlayer = { ...player };
  newPlayer.level = newPlayer.level + 1;
  newPlayer.xp = newPlayer.xp - newPlayer.xpToNext;
  newPlayer.xpToNext = Math.floor(newPlayer.xpToNext * 1.5);
  newPlayer.maxHp = newPlayer.maxHp + 10;
  newPlayer.hp = newPlayer.maxHp;
  newPlayer.attack = newPlayer.attack + 2;
  newPlayer.defense = newPlayer.defense + 1;
  return newPlayer;
}

/**
 * Apply damage to player
 * @param {Object} player - Player object
 * @param {number} amount - Damage amount
 * @returns {Object} Updated player object
 */
export function applyDamage(player, amount) {
  const newPlayer = { ...player };
  newPlayer.hp = Math.max(0, newPlayer.hp - amount);
  return newPlayer;
}

/**
 * Heal player by amount, capped at maxHp
 * @param {Object} player - Player object
 * @param {number} amount - Heal amount
 * @returns {Object} Updated player object
 */
export function healPlayer(player, amount) {
  const newPlayer = { ...player };
  newPlayer.hp = Math.min(newPlayer.maxHp, newPlayer.hp + amount);
  return newPlayer;
}

/**
 * Add gold to player
 * @param {Object} player - Player object
 * @param {number} amount - Gold amount
 * @returns {Object} Updated player object
 */
export function addGold(player, amount) {
  const newPlayer = { ...player };
  newPlayer.gold = newPlayer.gold + amount;
  return newPlayer;
}

/**
 * Add XP to player and check for level up
 * @param {Object} player - Player object
 * @param {number} amount - XP amount
 * @returns {Object} Updated player object
 */
export function addXp(player, amount) {
  let newPlayer = { ...player };
  newPlayer.xp = newPlayer.xp + amount;
  
  // Check for level up
  while (newPlayer.xp >= newPlayer.xpToNext) {
    newPlayer = applyLevelUp(newPlayer);
  }
  
  return newPlayer;
}
