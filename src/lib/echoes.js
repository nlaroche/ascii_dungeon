// Echo Affinity System
// Skills emerge from your actions, not allocation.
// Your gameplay history becomes your skill tree.

// ── Echo Types ──
export const ECHO_TYPES = {
  KILL: 'kill',
  TREASURE: 'treasure',
  EXPLORE: 'explore',
  SURVIVE: 'survive',
  VOID: 'void',  // Gained on death - hidden until first death
};

// ── Affinity Mutations ──
// Triggered at specific echo levels, auto-applied (not chosen)

const AFFINITY_MUTATIONS = {
  // Single-type affinities (unlocked at echo level threshold)
  BLOOD_KNIGHT: {
    trigger: { kill: 5 },
    label: 'Blood Knight',
    description: '+10% lifesteal on attacks',
    bonus: { lifesteal: 0.10 },
  },
  DEADLY_PRECISION: {
    trigger: { kill: 10 },
    label: 'Deadly Precision',
    description: '+15% crit chance',
    bonus: { critChance: 0.15 },
  },
  MASTERFUL_KILLER: {
    trigger: { kill: 25 },
    label: 'Masterful Killer',
    description: '+50% damage',
    bonus: { damageMultiplier: 1.5 },
  },
  
  FORTUNATE: {
    trigger: { treasure: 5 },
    label: 'Fortunate',
    description: '+25% gold find',
    bonus: { goldBonus: 0.25 },
  },
  TREASURE_HUNTER: {
    trigger: { treasure: 10 },
    label: 'Treasure Hunter',
    description: '+50% gold find, +10% rare chance',
    bonus: { goldBonus: 0.50, rareChance: 0.10 },
  },
  KINGMAKER: {
    trigger: { treasure: 25 },
    label: 'Kingmaker',
    description: '+100% gold find',
    bonus: { goldBonus: 1.0 },
  },
  
  PATHFINDER: {
    trigger: { explore: 5 },
    label: 'Pathfinder',
    description: '-25% stamina cost',
    bonus: { staminaEfficiency: 0.75 },
  },
  SWIFT_WANDERER: {
    trigger: { explore: 10 },
    label: 'Swift Wanderer',
    description: '+25% movement speed',
    bonus: { movementSpeed: 0.25 },
  },
  WORLD_WALKER: {
    trigger: { explore: 25 },
    label: 'World Walker',
    description: '-50% stamina, +50% speed',
    bonus: { staminaEfficiency: 0.5, movementSpeed: 0.50 },
  },
  
  IRON_SKIN: {
    trigger: { survive: 5 },
    label: 'Iron Skin',
    description: '+10% damage reduction',
    bonus: { damageReduction: 0.10 },
  },
  STALWART: {
    trigger: { survive: 10 },
    label: 'Stalwart',
    description: '+20% DR, +50 max HP',
    bonus: { damageReduction: 0.20, maxHpBonus: 50 },
  },
  IMMORTAL: {
    trigger: { survive: 25 },
    label: 'Immortal',
    description: '+40% DR, +100 max HP',
    bonus: { damageReduction: 0.40, maxHpBonus: 100 },
  },
  
  // Void affinities (require void echo - gained on death)
  REVENANT: {
    trigger: { void: 5 },
    label: 'Revenant',
    description: 'Starts with +50% HP on each run',
    bonus: { startHpMultiplier: 1.5 },
  },
  DEATHLESS: {
    trigger: { void: 10 },
    label: 'Deathless',
    description: '50% chance to survive fatal damage with 1 HP',
    bonus: { deathResist: 0.50 },
  },
  PHOENIX: {
    trigger: { void: 25 },
    label: 'Phoenix',
    description: 'On death: revive at 50% HP, gain 25% max HP permanently',
    bonus: { reviveOnce: true },
  },
};

// ── Combination Affinities ──
// Unlocked when TWO echo types both reach threshold

const COMBO_AFFINITIES = {
  BLOOD_BROTHERS: {
    trigger: { kill: 5, survive: 5 },
    label: 'Blood Brothers',
    description: 'Attacks heal for 50% of damage dealt',
    bonus: { lifesteal: 0.50 },
  },
  TREASURE_HUNTER_KILLER: {
    trigger: { kill: 10, treasure: 5 },
    label: 'Treasure Hunter',
    description: '+5 gold per enemy killed',
    bonus: { goldPerKill: 5 },
  },
  EXPLORER_TREASURE: {
    trigger: { explore: 5, treasure: 5 },
    label: 'Lucky Explorer',
    description: '+50% gold from treasure',
    bonus: { treasureGoldMultiplier: 1.5 },
  },
  SURVIVOR_EXPLORER: {
    trigger: { survive: 5, explore: 5 },
    label: 'Trailblazer',
    description: '-25% stamina, +25% speed',
    bonus: { staminaEfficiency: 0.75, movementSpeed: 0.25 },
  },
  
  // VOID combos - the "holy shit" moments
  DEATH_KNIGHT: {
    trigger: { kill: 10, void: 5 },
    label: 'Death Knight',
    description: 'Kills reduce death count by 1, +25% damage',
    bonus: { killsReduceDeaths: true, damageMultiplier: 1.25 },
  },
  VOID_TREASURE: {
    trigger: { treasure: 10, void: 5 },
    label: 'Grave Riches',
    description: '+100% gold from treasure, +10% per void level',
    bonus: { goldBonus: 1.0, voidGoldBonus: 0.10 },
  },
  PHOENIX_KNIGHT: {
    trigger: { kill: 25, void: 10 },
    label: 'Phoenix Knight',
    description: 'Revive at full HP once per run, +50% damage',
    bonus: { fullRevive: true, damageMultiplier: 1.5 },
  },
};

// ── Echo State ──

export function createEchoState() {
  return {
    kill: 0,
    treasure: 0,
    explore: 0,
    survive: 0,
    void: 0,
    unlockedAffinities: [],
    newAffinityThisRun: null,
  };
}

// ── Increment Echo ──

export function incrementEcho(echoState, echoType, amount = 1) {
  if (!echoState[echoType] !== undefined && echoType !== 'void') {
    return echoState; // Invalid echo type
  }
  
  const newState = { ...echoState, [echoType]: echoState[echoType] + amount };
  const unlocked = checkNewAffinities(newState);
  
  // If new affinity unlocked, mark it
  if (unlocked.length > echoState.unlockedAffinities.length) {
    const newOnes = unlocked.filter(a => !echoState.unlockedAffinities.includes(a));
    if (newOnes.length > 0) {
      newState.newAffinityThisRun = newOnes[0];
    }
  }
  
  newState.unlockedAffinities = unlocked;
  return newState;
}

export function clearNewAffinityFlag(echoState) {
  return { ...echoState, newAffinityThisRun: null };
}

// ── Check which affinities are unlocked ──

export function checkNewAffinities(echoState) {
  const unlocked = [];
  
  // Check single-type affinities
  for (const [name, affinity] of Object.entries(AFFINITY_MUTATIONS)) {
    if (checkTrigger(echoState, affinity.trigger)) {
      unlocked.push(name);
    }
  }
  
  // Check combo affinities
  for (const [name, affinity] of Object.entries(COMBO_AFFINITIES)) {
    if (checkTrigger(echoState, affinity.trigger)) {
      unlocked.push(name);
    }
  }
  
  return unlocked;
}

function checkTrigger(echoState, trigger) {
  for (const [type, level] of Object.entries(trigger)) {
    if ((echoState[type] || 0) < level) {
      return false;
    }
  }
  return true;
}

// ── Calculate Bonuses from Active Affinities ──

export function getEchoBonuses(echoState) {
  const bonuses = {
    damageMultiplier: 1.0,
    lifesteal: 0,
    critChance: 0,
    goldBonus: 0,
    rareChance: 0,
    staminaEfficiency: 1.0,
    movementSpeed: 0,
    damageReduction: 0,
    maxHpBonus: 0,
    startHpMultiplier: 1.0,
    deathResist: 0,
    goldPerKill: 0,
    treasureGoldMultiplier: 1.0,
    killsReduceDeaths: false,
    reviveOnce: false,
    fullRevive: false,
  };
  
  // Get all unlocked affinities
  const unlocked = checkNewAffinities(echoState);
  
  // Apply single-type bonuses
  for (const name of unlocked) {
    const affinity = AFFINITY_MUTATIONS[name] || COMBO_AFFINITIES[name];
    if (affinity?.bonus) {
      for (const [key, value] of Object.entries(affinity.bonus)) {
        if (key === 'damageMultiplier') {
          bonuses[key] *= value;
        } else if (key === 'goldBonus' && echoState.void > 0) {
          // Void treasure combo: extra bonus per void level
          bonuses[key] += value + (echoState.void * 0.10);
        } else if (typeof bonuses[key] === 'number') {
          bonuses[key] += value;
        } else {
          bonuses[key] = value;
        }
      }
    }
  }
  
  return bonuses;
}

// ── Get Display Info ──

export function getAffinityInfo(echoState) {
  const unlocked = checkNewAffinities(echoState);
  const affinities = [];
  
  for (const name of unlocked) {
    const affinity = AFFINITY_MUTATIONS[name] || COMBO_AFFINITIES[name];
    if (affinity) {
      affinities.push({
        name,
        label: affinity.label,
        description: affinity.description,
      });
    }
  }
  
  return affinities;
}

export function getNextAffinityHint(echoState) {
  // Find the next attainable affinity
  const allAffinities = { ...AFFINITY_MUTATIONS, ...COMBO_AFFINITIES };
  const unlocked = checkNewAffinities(echoState);
  
  for (const [name, affinity] of Object.entries(allAffinities)) {
    if (!unlocked.includes(name)) {
      // Check if close (within 5 of any requirement)
      let close = false;
      for (const [type, level] of Object.entries(affinity.trigger)) {
        const current = echoState[type] || 0;
        if (current >= level - 5 && current < level) {
          close = true;
          break;
        }
      }
      if (close) {
        return {
          label: affinity.label,
          description: affinity.description,
          trigger: affinity.trigger,
        };
      }
    }
  }
  
  return null;
}
