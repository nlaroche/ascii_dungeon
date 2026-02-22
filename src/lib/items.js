// Living Records Item System
// Items grow and transform based on player actions.
// Kill enemies with a sword -> it gets sharper. Walk far with boots -> they use less stamina.
// Pair items with matching histories -> they resonate and amplify each other.

import { COLORS } from './palette.js';

// ── Record Types (4 core) ──

export const RECORD_TYPES = {
  KILL: 'kill',         // Combat prowess: damage, crit, attack speed
  TREASURE: 'treasure', // Fortune: gold bonus, rare item chance
  EXPLORE: 'explore',   // Wayfinding: stamina efficiency, movement speed, map reveal
  SURVIVE: 'survive',   // Endurance: defense, damage reduction, max HP, lifesteal
};

export const MAX_LEVEL = 10;

export const ITEM_SLOTS = { WEAPON: 'weapon', ARMOR: 'armor', AMULET: 'amulet' };

export const ITEM_TIERS = {
  COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', EPIC: 'epic', LEGENDARY: 'legendary',
};

// ── Base item templates ──

const BASE_ITEMS = {
  weapon: [
    { name: 'Rusty Sword', char: '/', baseDamage: 3 },
    { name: 'Iron Axe', char: ')', baseDamage: 5 },
    { name: 'Bone Dagger', char: '-', baseDamage: 2 },
    { name: 'Crystal Staff', char: '|', baseDamage: 4 },
    { name: 'War Hammer', char: 'T', baseDamage: 6 },
  ],
  armor: [
    { name: 'Leather Vest', char: '[', baseDefense: 2 },
    { name: 'Chain Mail', char: '{', baseDefense: 4 },
    { name: 'Iron Plate', char: '#', baseDefense: 6 },
    { name: 'Bone Shield', char: '0', baseDefense: 3 },
    { name: 'Woven Robe', char: '(', baseDefense: 1 },
  ],
  amulet: [
    { name: 'Stone Pendant', char: '"', baseBonus: 1 },
    { name: 'Glass Eye', char: '*', baseBonus: 2 },
    { name: 'Tooth Charm', char: ',', baseBonus: 1 },
    { name: 'Iron Ring', char: 'o', baseBonus: 3 },
    { name: 'Crystal Shard', char: ';', baseBonus: 2 },
  ],
};

// ── XP Curve ──

export function xpToNextLevel(currentLevel) {
  if (currentLevel >= MAX_LEVEL) return Infinity;
  return 10 * Math.pow(2, currentLevel); // 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120
}

// ── Item Creation ──

export function createItem(slot, floorLevel = 1, rng = Math.random) {
  const templates = BASE_ITEMS[slot] || BASE_ITEMS.weapon;
  const base = templates[Math.floor(rng() * templates.length)];
  const tier = rollTier(floorLevel, rng);

  return {
    id: Math.floor(rng() * 0xFFFFFF).toString(16).padStart(6, '0'),
    slot,
    tier,
    name: base.name,
    char: base.char,
    baseDamage: base.baseDamage || 0,
    baseDefense: base.baseDefense || 0,
    baseBonus: base.baseBonus || 0,
    floorCreated: floorLevel,
    records: {
      kill:     { level: 0, xp: 0 },
      treasure: { level: 0, xp: 0 },
      explore:  { level: 0, xp: 0 },
      survive:  { level: 0, xp: 0 },
    },
    primaryRecord: null,
    visualMarks: [],
  };
}

export function createLegacyItem(slot, floorLevel, recordOverrides = {}, rng = Math.random) {
  const item = createItem(slot, floorLevel, rng);
  for (const [type, level] of Object.entries(recordOverrides)) {
    if (item.records[type]) {
      item.records[type].level = Math.min(level, MAX_LEVEL);
      for (let i = 1; i <= item.records[type].level; i++) {
        item.visualMarks.push(getVisualMark(type, i));
      }
    }
  }
  item.primaryRecord = determinePrimaryRecord(item.records);
  return item;
}

function rollTier(floorLevel, rng) {
  const roll = rng() + floorLevel * 0.02;
  if (roll >= 0.99) return 'legendary';
  if (roll >= 0.95) return 'epic';
  if (roll >= 0.80) return 'rare';
  if (roll >= 0.50) return 'uncommon';
  return 'common';
}

// ── Record XP & Leveling ──

export function addRecordXP(item, recordType, xp) {
  if (!item.records || !item.records[recordType]) return item;

  const record = { ...item.records[recordType] };
  record.xp += xp;
  const newMarks = [...item.visualMarks];

  let needed = xpToNextLevel(record.level);
  while (record.xp >= needed && record.level < MAX_LEVEL) {
    record.xp -= needed;
    record.level += 1;
    newMarks.push(getVisualMark(recordType, record.level));
    needed = xpToNextLevel(record.level);
  }

  const newRecords = { ...item.records, [recordType]: record };
  return {
    ...item,
    records: newRecords,
    primaryRecord: determinePrimaryRecord(newRecords),
    visualMarks: newMarks,
  };
}

function determinePrimaryRecord(records) {
  let maxLevel = 0;
  let primary = null;
  for (const [type, rec] of Object.entries(records)) {
    if (rec.level > maxLevel || (rec.level === maxLevel && rec.xp > (records[primary]?.xp || 0))) {
      maxLevel = rec.level;
      primary = type;
    }
  }
  return maxLevel > 0 ? primary : null;
}

export function getTotalLevel(item) {
  if (!item.records) return 0;
  return Object.values(item.records).reduce((sum, r) => sum + r.level, 0);
}

// ── Visual Marks ──

const VISUAL_MARKS = {
  kill: [
    'sharpened edge', 'blood groove', 'killing notch', 'deadly gleam',
    "murderer's edge", "executioner's mark", "champion's blade",
    'legendary sharpness', 'demon bane', 'godkiller aura',
  ],
  treasure: [
    'golden tint', 'coin impression', 'rich shimmer', "prospector's gleam",
    'midas touch', "fortune's favor", "kingmaker's glow",
    'legendary wealth', "dragon's hoard", "fate's fortune",
  ],
  explore: [
    'compass rune', 'map scratch', "pathfinder's mark", "wayfinder's trail",
    "cartographer's etch", "adventurer's path", "explorer's wisdom",
    'world walker', 'realm traverser', 'omniscient eye',
  ],
  survive: [
    'battle scar', 'warding mark', 'protective notch', "survivor's patina",
    "veteran's shell", "guardian's blessing", "immortal's heart",
    'eternal guardian', 'deathless spirit', "god's protection",
  ],
};

export function getVisualMark(recordType, level) {
  const marks = VISUAL_MARKS[recordType] || VISUAL_MARKS.kill;
  if (level < 1) return null;
  return marks[Math.min(level - 1, marks.length - 1)] || 'unknown mark';
}

// ── Visual Stages (prefix, color per record level) ──

const VISUAL_STAGES = {
  kill: [
    { threshold: 0, color: COLORS.recordBase, prefix: '' },
    { threshold: 1, color: COLORS.recordLow, prefix: 'Sharpened' },
    { threshold: 3, color: COLORS.killMid, prefix: 'Bloodied' },
    { threshold: 5, color: COLORS.killMid, prefix: "Murderer's" },
    { threshold: 7, color: COLORS.killHigh, prefix: "Champion's" },
    { threshold: 10, color: COLORS.killHigh, prefix: 'Legendary' },
  ],
  treasure: [
    { threshold: 0, color: COLORS.recordBase, prefix: '' },
    { threshold: 1, color: COLORS.recordLow, prefix: 'Gilded' },
    { threshold: 3, color: COLORS.treasureMid, prefix: 'Shimmering' },
    { threshold: 5, color: COLORS.treasureMid, prefix: "Fortune's" },
    { threshold: 7, color: COLORS.treasureHigh, prefix: "Kingmaker's" },
    { threshold: 10, color: COLORS.treasureHigh, prefix: 'Legendary' },
  ],
  explore: [
    { threshold: 0, color: COLORS.recordBase, prefix: '' },
    { threshold: 1, color: COLORS.recordLow, prefix: "Wayfinder's" },
    { threshold: 3, color: COLORS.exploreMid, prefix: "Cartographer's" },
    { threshold: 5, color: COLORS.exploreMid, prefix: "World Walker's" },
    { threshold: 7, color: COLORS.exploreHigh, prefix: "Realm Traverser's" },
    { threshold: 10, color: COLORS.exploreHigh, prefix: 'Legendary' },
  ],
  survive: [
    { threshold: 0, color: COLORS.recordBase, prefix: '' },
    { threshold: 1, color: COLORS.recordLow, prefix: 'Warded' },
    { threshold: 3, color: COLORS.surviveMid, prefix: "Veteran's" },
    { threshold: 5, color: COLORS.surviveMid, prefix: "Guardian's" },
    { threshold: 7, color: COLORS.surviveHigh, prefix: "Immortal's" },
    { threshold: 10, color: COLORS.surviveHigh, prefix: 'Legendary' },
  ],
};

export function getVisualStage(recordType, level) {
  const stages = VISUAL_STAGES[recordType] || VISUAL_STAGES.kill;
  let result = stages[0];
  for (const stage of stages) {
    if (level >= stage.threshold) result = stage;
  }
  return result;
}

export function getItemDisplayName(item) {
  if (!item.primaryRecord) return item.name;
  const stage = getVisualStage(item.primaryRecord, item.records[item.primaryRecord].level);
  if (!stage.prefix) return item.name;
  return `${stage.prefix} ${item.name}`;
}

export function getItemColor(item) {
  if (!item.primaryRecord) return COLORS.recordLow;
  return getVisualStage(item.primaryRecord, item.records[item.primaryRecord].level).color;
}

// ── Resonance ──

export const RESONANCE_TYPES = {
  BLOOD_BROTHERS: 'blood_brothers',
  GOLDEN_PAIR: 'golden_pair',
  PATHFINDERS: 'pathfinders',
  IRON_BOND: 'iron_bond',
  WARRIOR_SOUL: 'warrior_soul',
  TREASURE_HUNTER: 'treasure_hunter',
  BERSERKER: 'berserker',
  PALADIN: 'paladin',
};

const RESONANCE_META = {
  blood_brothers:   { label: 'Blood Brothers',   bonus: 'damage',     color: COLORS.bloodBrothers },
  golden_pair:      { label: 'Golden Pair',       bonus: 'gold',       color: COLORS.goldenPair },
  pathfinders:      { label: 'Pathfinders',       bonus: 'movement',   color: COLORS.pathfinders },
  iron_bond:        { label: 'Iron Bond',         bonus: 'defense',    color: COLORS.ironBond },
  warrior_soul:     { label: 'Warrior Soul',      bonus: 'all_combat', color: COLORS.warriorSoul },
  treasure_hunter:  { label: 'Treasure Hunter',   bonus: 'loot_speed', color: COLORS.treasureHunter },
  berserker:        { label: 'Berserker',         bonus: 'offense',    color: COLORS.berserker },
  paladin:          { label: 'Paladin',           bonus: 'tank',       color: COLORS.paladin },
};

const COMP_MAP = {
  'kill,survive':    'warrior_soul',
  'explore,treasure': 'treasure_hunter',
  'kill,treasure':   'berserker',
  'explore,survive': 'paladin',
};

const MATCH_MAP = {
  kill: 'blood_brothers',
  treasure: 'golden_pair',
  explore: 'pathfinders',
  survive: 'iron_bond',
};

const MIN_RESONANCE_LEVEL = 3;

export function detectResonance(itemA, itemB) {
  if (!itemA?.records || !itemB?.records) return null;

  const pA = getPrimaryRecord(itemA.records);
  const pB = getPrimaryRecord(itemB.records);
  if (!pA || !pB) return null;
  if (pA.level < MIN_RESONANCE_LEVEL || pB.level < MIN_RESONANCE_LEVEL) return null;

  const avgLevel = (pA.level + pB.level) / 2;

  if (pA.type === pB.type) {
    const rType = MATCH_MAP[pA.type];
    if (!rType) return null;
    return buildResonance(rType, avgLevel);
  }

  const key = [pA.type, pB.type].sort().join(',');
  const rType = COMP_MAP[key];
  if (!rType) return null;
  return buildResonance(rType, avgLevel * 0.8);
}

function getPrimaryRecord(records) {
  let best = null;
  for (const [type, rec] of Object.entries(records)) {
    if (rec.level > 0 && (!best || rec.level > best.level)) {
      best = { type, level: rec.level };
    }
  }
  return best;
}

function buildResonance(type, avgLevel) {
  const meta = RESONANCE_META[type];
  const strength = Math.min(50, Math.round(avgLevel * 5));
  return {
    type,
    label: meta.label,
    bonus: meta.bonus,
    color: meta.color,
    strength,
    description: `${meta.label}: +${strength}% ${meta.bonus.replace(/_/g, ' ')}`,
  };
}

export function detectEquipmentResonance(equipment) {
  const items = [equipment.weapon, equipment.armor, equipment.amulet].filter(Boolean);
  const resonances = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const r = detectResonance(items[i], items[j]);
      if (r) resonances.push(r);
    }
  }
  return resonances;
}

// ── Individual Stat Modifiers ──

export function getRecordDamage(item) {
  const lv = item.records?.kill?.level || 0;
  if (lv < 1) return 0;
  return Math.floor(2 * Math.pow(1.8, lv - 1));
}

export function getRecordCrit(item) {
  const lv = item.records?.kill?.level || 0;
  if (lv < 5) return 0;
  return Math.min(0.30, (lv - 4) * 0.05);
}

export function getRecordDefense(item) {
  const lv = item.records?.survive?.level || 0;
  if (lv < 1) return 0;
  return Math.floor(2 * Math.pow(1.7, lv - 1));
}

export function getRecordDamageReduction(item) {
  const lv = item.records?.survive?.level || 0;
  return Math.min(0.50, lv * 0.05);
}

export function getRecordMaxHP(item) {
  return (item.records?.survive?.level || 0) * 5;
}

export function getRecordLifesteal(item) {
  const lv = item.records?.survive?.level || 0;
  if (lv < 3) return 0;
  return Math.min(0.25, (lv - 2) * 0.05);
}

export function getRecordStaminaEfficiency(item) {
  const lv = item.records?.explore?.level || 0;
  return Math.max(0.50, 1.0 - lv * 0.05);
}

export function getRecordMovementSpeed(item) {
  const lv = item.records?.explore?.level || 0;
  if (lv < 4) return 0;
  return Math.min(0.50, (lv - 3) * 0.10);
}

export function getRecordMapReveal(item) {
  const lv = item.records?.explore?.level || 0;
  if (lv < 2) return 0;
  return (lv - 1) * 2;
}

export function getRecordGoldBonus(item) {
  const lv = item.records?.treasure?.level || 0;
  if (lv < 2) return 0;
  return Math.min(1.0, (lv - 1) * 0.10);
}

export function getRecordRareChance(item) {
  const lv = item.records?.treasure?.level || 0;
  if (lv < 5) return 0;
  return Math.min(0.25, (lv - 4) * 0.05);
}

// ── Aggregate Stats Across Equipment ──

export function getEquipmentStats(equipment) {
  const items = [equipment.weapon, equipment.armor, equipment.amulet].filter(Boolean);
  const resonances = detectEquipmentResonance(equipment);

  const stats = {
    bonusDamage: 0, critChance: 0, bonusDefense: 0, damageReduction: 0,
    bonusMaxHP: 0, lifesteal: 0, staminaEfficiency: 1.0, movementSpeed: 0,
    mapReveal: 0, goldBonus: 0, rareItemChance: 0,
  };

  for (const item of items) {
    stats.bonusDamage += getRecordDamage(item) + (item.baseDamage || 0);
    stats.critChance += getRecordCrit(item);
    stats.bonusDefense += getRecordDefense(item) + (item.baseDefense || 0);
    stats.damageReduction += getRecordDamageReduction(item);
    stats.bonusMaxHP += getRecordMaxHP(item);
    stats.lifesteal += getRecordLifesteal(item);
    stats.staminaEfficiency = Math.min(stats.staminaEfficiency, getRecordStaminaEfficiency(item));
    stats.movementSpeed += getRecordMovementSpeed(item);
    stats.mapReveal += getRecordMapReveal(item);
    stats.goldBonus += getRecordGoldBonus(item);
    stats.rareItemChance += getRecordRareChance(item);
  }

  for (const r of resonances) {
    const mult = r.strength / 100;
    switch (r.bonus) {
      case 'damage':     stats.bonusDamage = Math.floor(stats.bonusDamage * (1 + mult)); break;
      case 'gold':       stats.goldBonus += mult; break;
      case 'movement':   stats.movementSpeed += mult * 0.3; break;
      case 'defense':    stats.bonusDefense = Math.floor(stats.bonusDefense * (1 + mult)); break;
      case 'all_combat':
        stats.bonusDamage = Math.floor(stats.bonusDamage * (1 + mult));
        stats.bonusDefense = Math.floor(stats.bonusDefense * (1 + mult));
        break;
      case 'loot_speed':
        stats.goldBonus += mult;
        stats.movementSpeed += mult * 0.2;
        break;
      case 'offense':
        stats.bonusDamage = Math.floor(stats.bonusDamage * (1 + mult * 1.5));
        break;
      case 'tank':
        stats.bonusDefense = Math.floor(stats.bonusDefense * (1 + mult));
        stats.damageReduction += mult * 0.5;
        break;
    }
  }

  stats.critChance = Math.min(stats.critChance, 0.50);
  stats.damageReduction = Math.min(stats.damageReduction, 0.75);
  stats.lifesteal = Math.min(stats.lifesteal, 0.50);
  stats.movementSpeed = Math.min(stats.movementSpeed, 1.0);
  stats.rareItemChance = Math.min(stats.rareItemChance, 0.50);

  return { stats, resonances };
}

// ── Tooltip ──

export function getItemTooltip(item) {
  const lines = [];
  lines.push(getItemDisplayName(item));
  lines.push(`[${item.tier}] ${item.slot} | Floor ${item.floorCreated}`);

  if (item.baseDamage) lines.push(`Base Damage: ${item.baseDamage}`);
  if (item.baseDefense) lines.push(`Base Defense: ${item.baseDefense}`);
  if (item.baseBonus) lines.push(`Base Bonus: ${item.baseBonus}`);

  const hasRecord = Object.values(item.records).some(r => r.level > 0 || r.xp > 0);
  if (hasRecord) {
    lines.push('');
    lines.push('--- RECORDS ---');
    for (const [type, rec] of Object.entries(item.records)) {
      if (rec.level === 0 && rec.xp === 0) continue;
      const needed = rec.level >= MAX_LEVEL ? 'MAX' : `${rec.xp}/${xpToNextLevel(rec.level)}`;
      const stage = getVisualStage(type, rec.level);
      const pfx = stage.prefix ? ` (${stage.prefix})` : '';
      lines.push(`  ${type}: Lv${rec.level}${pfx} [${needed}]`);
      const bonus = describeRecordBonus(type, rec.level);
      if (bonus) lines.push(`    > ${bonus}`);
    }
  }

  if (item.visualMarks.length > 0) {
    lines.push('');
    lines.push('--- MARKS ---');
    for (const mark of item.visualMarks.slice(-3)) {
      lines.push(`  * ${mark}`);
    }
    if (item.visualMarks.length > 3) {
      lines.push(`  ...and ${item.visualMarks.length - 3} more`);
    }
  }

  return lines;
}

function describeRecordBonus(type, level) {
  if (level < 1) return null;
  switch (type) {
    case 'kill': {
      const dmg = Math.floor(2 * Math.pow(1.8, level - 1));
      const crit = level >= 5 ? `, ${Math.min(30, (level - 4) * 5)}% crit` : '';
      return `+${dmg} damage${crit}`;
    }
    case 'treasure': {
      const gold = level >= 2 ? `+${(level - 1) * 10}% gold` : 'no bonus yet';
      const rare = level >= 5 ? `, +${(level - 4) * 5}% rare` : '';
      return gold + rare;
    }
    case 'explore': {
      const stam = `${level * 5}% less stamina`;
      const spd = level >= 4 ? `, +${(level - 3) * 10}% speed` : '';
      const map = level >= 2 ? `, +${(level - 1) * 2} reveal` : '';
      return stam + spd + map;
    }
    case 'survive': {
      const def = Math.floor(2 * Math.pow(1.7, level - 1));
      const dr = `${level * 5}% DR`;
      const hp = `+${level * 5} HP`;
      const ls = level >= 3 ? `, ${(level - 2) * 5}% lifesteal` : '';
      return `+${def} def, ${dr}, ${hp}${ls}`;
    }
    default: return null;
  }
}
