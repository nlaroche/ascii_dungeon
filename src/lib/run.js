/**
 * @typedef {Object} RunState
 * @property {string} id
 * @property {number} day
 * @property {number} floor
 * @property {number} maxFloors
 * @property {string} phase
 * @property {Object} startingPlayer
 * @property {RunStats} stats
 * @property {FloorResult[]} floors
 * @property {string[]} lootBag
 * @property {Object|null} outcome
 */

/**
 * @typedef {Object} RunStats
 * @property {number} enemiesKilled
 * @property {number} goldCollected
 * @property {number} xpGained
 * @property {number} itemsFound
 * @property {number} floorsCleared
 * @property {number} damageDealt
 * @property {number} damageTaken
 * @property {number} staminaUsed
 * @property {number} secretsFound
 * @property {number} timeStarted
 */

/**
 * @typedef {Object} FloorResult
 * @property {number} floor
 * @property {number} enemiesKilled
 * @property {number} goldFound
 * @property {number} xpGained
 * @property {string[]} itemsFound
 * @property {number} staminaSpent
 * @property {number} playerHpAfter
 * @property {string[]} events
 */

/**
 * @typedef {Object} CalendarState
 * @property {number} currentDay
 * @property {number} currentWeek
 * @property {number} totalDays
 * @property {number} runsCompleted
 * @property {number} bestFloor
 * @property {number} totalGoldEarned
 * @property {number} totalEnemiesKilled
 * @property {Object[]} history
 */

// ============================================
// Run Lifecycle
// ============================================

/**
 * Creates a fresh run state.
 * @param {number} day - The current day number
 * @param {Object} player - The player state at run start
 * @param {Object} config - Configuration object
 * @param {number} [config.maxFloors=5] - Maximum floors per run
 * @param {string} [config.difficulty='normal'] - Difficulty setting
 * @returns {RunState}
 */
export function createRun(day, player, config = {}) {
  const maxFloors = config.maxFloors || 5;
  return {
    id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    day,
    floor: 1,
    maxFloors,
    phase: 'dungeon',
    startingPlayer: { ...player },
    stats: {
      enemiesKilled: 0,
      goldCollected: 0,
      xpGained: 0,
      itemsFound: 0,
      floorsCleared: 0,
      damageDealt: 0,
      damageTaken: 0,
      staminaUsed: 0,
      secretsFound: 0,
      timeStarted: Date.now(),
    },
    floors: [],
    lootBag: [],
    outcome: null,
  };
}

/**
 * Increments floor, returns new run.
 * @param {RunState} run
 * @returns {RunState|null} - Returns null if already at max floor
 */
export function advanceFloor(run) {
  if (run.floor >= run.maxFloors) {
    return null;
  }
  return {
    ...run,
    floor: run.floor + 1,
  };
}

/**
 * Records floor result, accumulates stats.
 * @param {RunState} run
 * @param {FloorResult} floorResult
 * @returns {RunState}
 */
export function completeFloor(run, floorResult) {
  return {
    ...run,
    stats: {
      ...run.stats,
      enemiesKilled: run.stats.enemiesKilled + floorResult.enemiesKilled,
      goldCollected: run.stats.goldCollected + floorResult.goldFound,
      xpGained: run.stats.xpGained + floorResult.xpGained,
      itemsFound: run.stats.itemsFound + floorResult.itemsFound.length,
      floorsCleared: run.stats.floorsCleared + 1,
      staminaUsed: run.stats.staminaUsed + floorResult.staminaSpent,
    },
    floors: [...run.floors, floorResult],
    lootBag: [...run.lootBag, ...floorResult.itemsFound],
    phase: 'floor_complete',
  };
}

/**
 * Ends the run.
 * @param {RunState} run
 * @param {string} reason - 'death'|'cleared'|'retired'
 * @returns {RunState}
 */
export function endRun(run, reason) {
  const duration = Date.now() - run.stats.timeStarted;
  return {
    ...run,
    phase: 'run_complete',
    outcome: {
      reason,
      floor: run.floor,
      finalStats: { ...run.stats, duration },
    },
  };
}

/**
 * Transition to a new phase.
 * @param {RunState} run
 * @param {string} phase
 * @returns {RunState}
 */
export function setPhase(run, phase) {
  return {
    ...run,
    phase,
  };
}

// ============================================
// Difficulty Scaling
// ============================================

/**
 * Returns difficulty modifiers for a floor.
 * @param {number} floor
 * @param {number} day
 * @returns {Object}
 */
export function getFloorDifficulty(floor, day) {
  const floorScale = 1 + (floor - 1) * 0.15;
  const dayScale = 1 + (day - 1) * 0.05;
  const baseScale = floorScale * dayScale;

  return {
    enemyHpMult: baseScale,
    enemyAtkMult: baseScale * 0.9,
    enemyCount: Math.floor(3 + floor * 1.5 + day * 0.2),
    treasureMult: 1 + (floor - 1) * 0.1 + day * 0.02,
  };
}

/**
 * Returns config for generateDungeon().
 * @param {number} floor
 * @param {number} day
 * @returns {Object}
 */
export function getDungeonConfig(floor, day) {
  return {
    width: 20 + Math.floor(floor / 2) * 2,
    height: 15 + Math.floor(floor / 3) * 2,
    roomCount: 4 + floor + Math.floor(day / 3),
    playerLevel: 1 + Math.floor((day - 1) / 7),
  };
}

// ============================================
// Run Stats
// ============================================

/**
 * Returns a clean summary object for display.
 * @param {RunState} run
 * @returns {Object}
 */
export function getRunSummary(run) {
  const duration = run.outcome ? run.outcome.finalStats.duration : Date.now() - run.stats.timeStarted;
  return {
    day: run.day,
    floorsCleared: run.stats.floorsCleared,
    totalGold: run.stats.goldCollected,
    totalXp: run.stats.xpGained,
    enemiesKilled: run.stats.enemiesKilled,
    itemsFound: run.stats.itemsFound,
    outcome: run.outcome ? run.outcome.reason : null,
    duration,
  };
}

/**
 * Returns a letter grade based on performance.
 * @param {RunState} run
 * @returns {string}
 */
export function getRunGrade(run) {
  const { enemiesKilled, floorsCleared, goldCollected } = run.stats;
  const maxFloors = run.maxFloors;
  const difficulty = run.day * 0.5 + floorsCleored * 0.3;

  const score = (floorsCleared / maxFloors) * 40 +
    Math.min(enemiesKilled / (difficulty * 5), 1) * 30 +
    Math.min(goldCollected / (difficulty * 100), 1) * 30;

  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ============================================
// Calendar / Meta
// ============================================

/**
 * Creates fresh calendar state.
 * @returns {CalendarState}
 */
export function createCalendar() {
  return {
    currentDay: 1,
    currentWeek: 1,
    totalDays: 0,
    runsCompleted: 0,
    bestFloor: 0,
    totalGoldEarned: 0,
    totalEnemiesKilled: 0,
    history: [],
  };
}

/**
 * Adds completed run to calendar history.
 * @param {CalendarState} calendar
 * @param {Object} runSummary
 * @returns {CalendarState}
 */
export function recordRun(calendar, runSummary) {
  const history = [...calendar.history, runSummary].slice(-50);
  return {
    ...calendar,
    currentDay: calendar.currentDay + 1,
    currentWeek: Math.ceil(calendar.currentDay / 7),
    totalDays: calendar.totalDays + 1,
    runsCompleted: calendar.runsCompleted + 1,
    bestFloor: Math.max(calendar.bestFloor, runSummary.floorsCleared),
    totalGoldEarned: calendar.totalGoldEarned + runSummary.totalGold,
    totalEnemiesKilled: calendar.totalEnemiesKilled + runSummary.enemiesKilled,
    history,
  };
}

/**
 * Returns aggregate stats for the current week.
 * @param {CalendarState} calendar
 * @returns {Object}
 */
export function getWeekSummary(calendar) {
  const weekStart = (calendar.currentWeek - 1) * 7;
  const weekRuns = calendar.history.filter(r => r.day > weekStart);
  return {
    runs: weekRuns.length,
    floorsCleared: weekRuns.reduce((sum, r) => sum + r.floorsCleared, 0),
    goldEarned: weekRuns.reduce((sum, r) => sum + r.totalGold, 0),
    enemiesKilled: weekRuns.reduce((sum, r) => sum + r.enemiesKilled, 0),
  };
}

/**
 * Returns time of day based on day number (cycles every 6 runs).
 * @param {number} day
 * @returns {string}
 */
export function getCurrentTimeOfDay(day) {
  const times = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];
  return times[(day - 1) % 6];
}

// ============================================
// Stamina
// ============================================

const STAMINA_COSTS = {
  move: 1,
  attack: 2,
  explore: 3,
  rest: 0,
};

/**
 * Returns stamina cost for an action.
 * @param {string} action - 'move'|'attack'|'explore'|'rest'
 * @returns {number}
 */
export function getStaminaCost(action) {
  return STAMINA_COSTS[action] ?? 0;
}

/**
 * Returns boolean if player has enough stamina.
 * @param {Object} player
 * @param {string} action
 * @returns {boolean}
 */
export function hasStamina(player, action) {
  const cost = getStaminaCost(action);
  return (player.stamina ?? player.maxStamina) >= cost;
}

/**
 * Returns new player with stamina reduced.
 * @param {Object} player
 * @param {string} action
 * @returns {Object}
 */
export function spendStamina(player, action) {
  const cost = getStaminaCost(action);
  return {
    ...player,
    stamina: Math.max(0, (player.stamina ?? player.maxStamina) - cost),
  };
}

/**
 * Returns new player with stamina restored.
 * @param {Object} player
 * @param {number} amount
 * @returns {Object}
 */
export function restoreStamina(player, amount) {
  const maxStamina = player.maxStamina ?? 100;
  return {
    ...player,
    stamina: Math.min(maxStamina, (player.stamina ?? maxStamina) + amount),
  };
}
