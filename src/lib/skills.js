/**
 * Skill Tree Module - Fractal Skill Layers
 * Pure functions, no side effects
 *
 * Skills use accelerating growth: bonus = baseValue * (points ^ 1.5)
 * Hidden sub-skills unlock at tier thresholds (10, 50, 200 points)
 * Each sub-skill also scales infinitely with its own curve
 */

// ── Growth ──

const GROWTH_EXP = 1.5;

export function calcBonus(baseValue, points) {
  if (points <= 0) return 0;
  return Math.floor(baseValue * Math.pow(points, GROWTH_EXP));
}

// ── Tier thresholds ──

export const TIER_THRESHOLDS = { 2: 10, 3: 50, 4: 200 };

export function getTier(points) {
  if (points >= 200) return 4;
  if (points >= 50) return 3;
  if (points >= 10) return 2;
  return 1;
}

// ── Schema: data-driven skill definitions ──

export const SKILL_TREE_SCHEMA = {
  attack: {
    label: 'Attack',
    color: '#ff4444',
    char: '/',
    base: { stat: 'attack', baseValue: 5, description: 'Raw striking power' },
    tier2: [
      { id: 'cleave', label: 'Cleave', char: ')', stat: 'aoeRadius', baseValue: 1, description: 'Hit adjacent enemies' },
      { id: 'rush', label: 'Rush', char: '>', stat: 'moveBonus', baseValue: 2, description: 'Attack speed and closing distance' },
    ],
    tier3: [
      { id: 'leap', label: 'Leap Slam', char: '^', stat: 'jumpRange', baseValue: 1, description: 'Jump over enemies to strike' },
      { id: 'whirlwind', label: 'Whirlwind', char: '@', stat: 'spinDamage', baseValue: 10, description: 'Spinning strike hits all nearby' },
    ],
    tier4: [
      { id: 'berserk', label: 'Berserker', char: '!', stat: 'critMultiplier', baseValue: 5, description: 'Massive critical damage' },
    ],
  },
  defense: {
    label: 'Defense',
    color: '#4488ff',
    char: '[',
    base: { stat: 'defense', baseValue: 5, description: 'Damage reduction' },
    tier2: [
      { id: 'dodge', label: 'Dodge', char: '~', stat: 'dodgeFlat', baseValue: 3, description: 'Chance to avoid hits entirely' },
      { id: 'block', label: 'Block', char: '+', stat: 'blockFlat', baseValue: 5, description: 'Absorb incoming damage' },
    ],
    tier3: [
      { id: 'bodyblock', label: 'Body Block', char: '#', stat: 'enemySlow', baseValue: 10, description: 'Enemies can\'t pass through you' },
      { id: 'thorns', label: 'Thorns', char: '*', stat: 'reflectDamage', baseValue: 5, description: 'Reflect damage to attackers' },
    ],
    tier4: [
      { id: 'fortress', label: 'Fortress', char: 'O', stat: 'auraDefense', baseValue: 8, description: 'Defensive aura protects area' },
    ],
  },
  exploration: {
    label: 'Exploration',
    color: '#44ddff',
    char: '.',
    base: { stat: 'staminaBonus', baseValue: 5, description: 'Extra stamina for longer runs' },
    tier2: [
      { id: 'sense', label: 'Sense', char: '?', stat: 'secretDetect', baseValue: 1, description: 'Detect hidden rooms nearby' },
      { id: 'mapping', label: 'Mapping', char: '%', stat: 'revealRadius', baseValue: 2, description: 'See further in the dark' },
    ],
    tier3: [
      { id: 'shortcut', label: 'Shortcut', char: '=', stat: 'doorCreate', baseValue: 1, description: 'Create passages through walls' },
      { id: 'teleport', label: 'Blink', char: '&', stat: 'blinkRange', baseValue: 2, description: 'Teleport short distances' },
    ],
    tier4: [
      { id: 'cartographer', label: 'Cartographer', char: 'M', stat: 'autoReveal', baseValue: 5, description: 'Auto-reveal map as you move' },
    ],
  },
  fortune: {
    label: 'Fortune',
    color: '#ffdd00',
    char: '$',
    base: { stat: 'goldFind', baseValue: 5, description: 'Find more gold everywhere' },
    tier2: [
      { id: 'greed', label: 'Greed', char: 'g', stat: 'chestGold', baseValue: 10, description: 'Chests contain more gold' },
      { id: 'luck', label: 'Luck', char: '!', stat: 'dropBonus', baseValue: 5, description: 'Better item drop rates' },
    ],
    tier3: [
      { id: 'midas', label: 'Midas Touch', char: 'G', stat: 'sellBonus', baseValue: 15, description: 'Items sell for more' },
      { id: 'hoarder', label: 'Hoarder', char: 'H', stat: 'carryBonus', baseValue: 20, description: 'Carry more items' },
    ],
    tier4: [
      { id: 'tycoon', label: 'Tycoon', char: 'T', stat: 'shopDiscount', baseValue: 25, description: 'Everything costs less' },
    ],
  },
};

// ── State management ──

export function createSkillTree() {
  const skills = {};
  for (const key of Object.keys(SKILL_TREE_SCHEMA)) {
    skills[key] = { points: 0, subSkills: {} };
  }
  return { skills, totalPointsSpent: 0 };
}

export function allocatePoint(tree, skillPath) {
  const newTree = { skills: {}, totalPointsSpent: tree.totalPointsSpent + 1 };
  for (const [k, v] of Object.entries(tree.skills)) {
    newTree.skills[k] = { points: v.points, subSkills: { ...v.subSkills } };
  }

  const parts = skillPath.split('.');
  const baseId = parts[0];
  const subId = parts[1];

  if (!newTree.skills[baseId]) return tree; // invalid

  if (!subId) {
    newTree.skills[baseId].points++;
  } else {
    // check sub-skill is unlocked
    const tier = getTier(newTree.skills[baseId].points);
    const schema = SKILL_TREE_SCHEMA[baseId];
    const allSubs = getSubSkillsForTier(schema, tier);
    if (!allSubs.find(s => s.id === subId)) return tree; // locked
    newTree.skills[baseId].subSkills[subId] = (newTree.skills[baseId].subSkills[subId] || 0) + 1;
  }

  return newTree;
}

export function allocatePoints(tree, skillPath, count) {
  let result = tree;
  for (let i = 0; i < count; i++) {
    result = allocatePoint(result, skillPath);
  }
  return result;
}

// ── Queries ──

export function getSkillBonuses(tree) {
  const bonuses = {};
  for (const [baseId, schema] of Object.entries(SKILL_TREE_SCHEMA)) {
    const skill = tree.skills[baseId];
    if (!skill) continue;

    // base skill
    const baseBonus = calcBonus(schema.base.baseValue, skill.points);
    if (baseBonus > 0) {
      bonuses[schema.base.stat] = (bonuses[schema.base.stat] || 0) + baseBonus;
    }

    // sub-skills
    const tier = getTier(skill.points);
    const allSubs = getSubSkillsForTier(schema, tier);
    for (const sub of allSubs) {
      const pts = skill.subSkills[sub.id] || 0;
      if (pts > 0) {
        const bonus = calcBonus(sub.baseValue, pts);
        bonuses[sub.stat] = (bonuses[sub.stat] || 0) + bonus;
      }
    }
  }
  return bonuses;
}

export function getVisibleSkills(tree) {
  const visible = {};
  for (const [baseId, schema] of Object.entries(SKILL_TREE_SCHEMA)) {
    const skill = tree.skills[baseId];
    const tier = getTier(skill.points);
    const subs = getSubSkillsForTier(schema, tier);
    visible[baseId] = {
      label: schema.label,
      color: schema.color,
      char: schema.char,
      points: skill.points,
      tier,
      bonus: calcBonus(schema.base.baseValue, skill.points),
      stat: schema.base.stat,
      description: schema.base.description,
      nextTierAt: getNextTierThreshold(skill.points),
      subSkills: subs.map(sub => ({
        id: sub.id,
        label: sub.label,
        char: sub.char,
        stat: sub.stat,
        description: sub.description,
        points: skill.subSkills[sub.id] || 0,
        bonus: calcBonus(sub.baseValue, skill.subSkills[sub.id] || 0),
        tierSource: getSubTierSource(schema, sub.id),
      })),
    };
  }
  return visible;
}

export function getAvailablePoints(playerLevel, floorsCleared) {
  return playerLevel + floorsCleared;
}

export function getRemainingPoints(playerLevel, floorsCleared, tree) {
  return getAvailablePoints(playerLevel, floorsCleared) - tree.totalPointsSpent;
}

// ── Helpers ──

function getSubSkillsForTier(schema, tier) {
  const subs = [];
  if (tier >= 2 && schema.tier2) subs.push(...schema.tier2);
  if (tier >= 3 && schema.tier3) subs.push(...schema.tier3);
  if (tier >= 4 && schema.tier4) subs.push(...schema.tier4);
  return subs;
}

function getSubTierSource(schema, subId) {
  if (schema.tier2?.find(s => s.id === subId)) return 2;
  if (schema.tier3?.find(s => s.id === subId)) return 3;
  if (schema.tier4?.find(s => s.id === subId)) return 4;
  return 0;
}

function getNextTierThreshold(points) {
  if (points < 10) return 10;
  if (points < 50) return 50;
  if (points < 200) return 200;
  return null; // all unlocked
}
