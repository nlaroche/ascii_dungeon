/**
 * Items Module - "Living Records" item system
 * Items grow and transform based on player actions
 * Pure functions, no side effects, no classes
 */

// Record type constants
export const RECORD_TYPES = {
  KILL: 'kill',
  TREASURE: 'treasure',
  EXPLORE: 'explore',
  SURVIVE: 'survive'
};

// Item slot constants
export const ITEM_SLOTS = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  AMULET: 'amulet'
};

// Item tier constants
export const ITEM_TIERS = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary'
};

// Visual mark definitions by record type and level
const VISUAL_MARKS = {
  kill: {
    1: "sharpened edge",
    2: "blood groove",
    3: "war notch",
    4: "vengeful edge",
    5: "executioner's mark",
    6: "slayer's groove",
    7: "champion's edge",
    8: "legendary blade",
    9: "mythic wound",
    10: "godkiller aura"
  },
  treasure: {
    1: "golden tint",
    2: "wealth glow",
    3: "fortune's kiss",
    4: "prosperity rune",
    5: "merchant's blessing",
    6: "dragon's hoard",
    7: "king's ransom",
    8: "midas touch",
    9: "eternal wealth",
    10: "legendary fortune"
  },
  explore: {
    1: "compass rune",
    2: "pathfinder's mark",
    3: "wayfinder's sigil",
    4: "cartographer's ink",
    5: "explorer's compass",
    6: "world walker",
    7: "realm mapper",
    8: "dimension skip",
    9: "infinite vista",
    10: "omniscient eye"
  },
  survive: {
    1: "battle scar",
    2: "toughened hide",
    3: "iron will",
    4: "veteran's plaque",
    5: "survivor's emblem",
    6: "immortal resolve",
    7: "phoenix mark",
    8: "eternal guardian",
    9: "death defiance",
    10: "legendary endurance"
  }
};

// Item name templates by slot and tier
const ITEM_NAMES = {
  weapon: {
    common: ["Iron Sword", "Rusty Dagger", "Wooden Club", "Stone Mace"],
    uncommon: ["Steel Blade", "Honed Spear", "Battle Axe"],
    rare: ["Flame Sword", "Frost Blade", "Shadow Dagger"],
    epic: ["Demon Slayer", "Dragon's Bane", "Void Edge"],
    legendary: ["Godkiller", "Worldbreaker", "Eternal Chaos"]
  },
  armor: {
    common: ["Leather Vest", "Cloth Armor", "Padded Jacket"],
    uncommon: ["Chain Mail", "Scale Armor", "Iron Plate"],
    rare: ["Enchanted Robe", "Guardian Plate", "Shadow Cloak"],
    epic: ["Dragon Scale", "Demon Hide", "Ethereal Mail"],
    legendary: ["Armageddon", "World Shield", "Divine Protection"]
  },
  amulet: {
    common: ["Bone Amulet", "Wooden Charm", "Stone Pendant"],
    uncommon: ["Silver Ring", "Copper Talisman", "Bronze Medallion"],
    rare: ["Ruby Amulet", "Sapphire Ring", "Emerald Pendant"],
    epic: ["Dragon Eye", "Phoenix Feather", "Void Crystal"],
    legendary: ["Destiny", "Fate's Touch", "Eternal Spirit"]
  }
};

/**
 * Generate a unique ID for an item
 * @returns {string} Unique ID
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Determine item tier based on floor level
 * @param {number} floorLevel - Current floor level
 * @returns {string} Item tier
 */
function determineTier(floorLevel) {
  const rand = Math.random();
  const total = floorLevel * 0.1;
  
  if (rand < 0.01 + total * 0.01) return ITEM_TIERS.LEGENDARY;
  if (rand < 0.05 + total * 0.02) return ITEM_TIERS.EPIC;
  if (rand < 0.15 + total * 0.05) return ITEM_TIERS.RARE;
  if (rand < 0.35 + total * 0.1) return ITEM_TIERS.UNCOMMON;
  return ITEM_TIERS.COMMON;
}

/**
 * Get visual mark for a record type at a given level
 * @param {string} recordType - Record type
 * @param {number} level - Record level
 * @returns {string} Visual mark description
 */
export function getVisualMark(recordType, level) {
  if (level < 1 || level > 10) return null;
  return VISUAL_MARKS[recordType]?.[level] || `${recordType} mark`;
}

/**
 * Create a living item with records
 * @param {Object} baseItem - Base item properties (name, slot)
 * @param {number} floorLevel - Floor level when item was created
 * @returns {Object} Living item with records
 */
export function createLivingItem(baseItem, floorLevel) {
  const tier = baseItem.tier || determineTier(floorLevel);
  
  return {
    ...baseItem,
    name: baseItem.name,
    slot: baseItem.slot,
    tier: tier,
    id: generateId(),
    floorCreated: floorLevel,
    records: {
      kill: { level: 0, xp: 0 },
      treasure: { level: 0, xp: 0 },
      explore: { level: 0, xp: 0 },
      survive: { level: 0, xp: 0 }
    },
    primaryRecord: null,
    visualMarks: []
  };
}

/**
 * Add XP to a record and handle level ups
 * @param {Object} item - Living item
 * @param {string} recordType - Type of record (kill, treasure, explore, survive)
 * @param {number} xp - XP amount to add
 * @returns {Object} Updated item with new record XP/level
 */
export function addRecordXP(item, recordType, xp) {
  if (!item.records[recordType]) {
    return item; // Invalid record type
  }
  
  const record = item.records[recordType];
  let newXp = record.xp + xp;
  let newLevel = record.level;
  const newVisualMarks = [...item.visualMarks];
  
  // Check for level ups (max level 10)
  while (newLevel < 10 && newXp >= getXpForLevel(newLevel + 1)) {
    newLevel++;
    newXp -= getXpForLevel(newLevel);
    
    // Add visual mark on level up
    const mark = getVisualMark(recordType, newLevel);
    if (mark) {
      newVisualMarks.push(mark);
    }
  }
  
  // Determine primary record (highest level)
  let primaryRecord = item.primaryRecord;
  let highestLevel = -1;
  
  const newRecords = { ...item.records };
  newRecords[recordType] = { level: newLevel, xp: newXp };
  
  for (const [type, rec] of Object.entries(newRecords)) {
    if (rec.level > highestLevel) {
      highestLevel = rec.level;
      primaryRecord = type;
    } else if (rec.level === highestLevel && rec.level > 0) {
      // Tie-breaker: keep existing primary if levels are equal
      if (primaryRecord !== type) {
        // Prefer the one that was just updated
        primaryRecord = recordType;
      }
    }
  }
  
  // If all records are 0, no primary
  if (highestLevel === 0) {
    primaryRecord = null;
  }
  
  return {
    ...item,
    records: newRecords,
    primaryRecord: primaryRecord,
    visualMarks: newVisualMarks
  };
}

/**
 * Get XP required for a given level
 * @param {number} level - Target level
 * @returns {number} XP required
 */
function getXpForLevel(level) {
  return 10 * Math.pow(2, level - 1);
}

/**
 * Get derived stats from item records
 * @param {Object} item - Living item
 * @returns {Object} Derived stats
 */
export function getItemStats(item) {
  const records = item.records;
  const kill = records.kill || { level: 0 };
  const treasure = records.treasure || { level: 0 };
  const explore = records.explore || { level: 0 };
  const survive = records.survive || { level: 0 };
  
  return {
    attackBonus: kill.level * 3,
    critChance: kill.level >= 5 ? (kill.level - 4) * 0.05 : 0,
    defenseBonus: survive.level * 2,
    hpRegen: survive.level >= 3 ? survive.level * 0.5 : 0,
    goldMultiplier: 1 + treasure.level * 0.1,
    visionBonus: explore.level,
    moveSpeedBonus: explore.level >= 4 ? 0.1 * (explore.level - 3) : 0
  };
}

/**
 * Check if equipped items resonate
 * @param {Array} equippedItems - Array of equipped items
 * @returns {Object} Resonance info
 */
export function checkResonance(equippedItems) {
  if (!equippedItems || equippedItems.length < 2) {
    return {
      active: false,
      type: null,
      level: 0,
      bonuses: {}
    };
  }
  
  // Group items by primary record type
  const groups = {};
  for (const item of equippedItems) {
    if (item && item.primaryRecord) {
      const type = item.primaryRecord;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    }
  }
  
  // Find group with most items (minimum 2 for resonance)
  let bestType = null;
  let bestItems = [];
  
  for (const [type, items] of Object.entries(groups)) {
    if (items.length >= 2 && items.length > bestItems.length) {
      bestType = type;
      bestItems = items;
    }
  }
  
  if (!bestType || bestItems.length < 2) {
    return {
      active: false,
      type: null,
      level: 0,
      bonuses: {}
    };
  }
  
  // Resonance level = minimum level of the shared record
  const resonanceLevel = Math.min(...bestItems.map(item => item.records[bestType].level));
  
  // Calculate scaled bonuses based on resonance level
  const bonuses = calculateResonanceBonuses(bestType, resonanceLevel);
  
  return {
    active: true,
    type: bestType,
    level: resonanceLevel,
    bonuses: bonuses
  };
}

/**
 * Calculate resonance bonuses based on type and level
 * @param {string} recordType - Record type
 * @param {number} level - Resonance level
 * @returns {Object} Scaled bonuses
 */
function calculateResonanceBonuses(recordType, level) {
  const base = level * 0.5;
  
  switch (recordType) {
    case 'kill':
      return {
        attackBonus: base * 2,
        critChance: level * 0.02,
        critDamage: level * 0.1
      };
    case 'treasure':
      return {
        goldMultiplier: 1 + level * 0.15,
        rareChance: level * 0.02
      };
    case 'explore':
      return {
        visionBonus: level,
        moveSpeedBonus: base * 0.05,
        revealHidden: level >= 3
      };
    case 'survive':
      return {
        defenseBonus: base * 1.5,
        hpRegen: base * 0.3,
        damageReduction: level * 0.03
      };
    default:
      return {};
  }
}

/**
 * Get visual display info for an item
 * @param {Object} item - Living item
 * @returns {Object} Display properties
 */
export function getVisualInfo(item) {
  // Glyph by slot
  const glyphs = {
    weapon: ')',
    armor: '[',
    amulet: '"'
  };
  
  // Color by primary record type
  const colors = {
    kill: '#ff4444',
    treasure: '#ffdd00',
    explore: '#44aaff',
    survive: '#44ff44',
    none: '#aaaaaa'
  };
  
  const primaryRecord = item.primaryRecord || 'none';
  const glyph = glyphs[item.slot] || '?';
  const color = colors[primaryRecord];
  
  // Build title with record suffix
  let title = item.name;
  if (item.primaryRecord && item.records[item.primaryRecord].level > 0) {
    const recordName = item.primaryRecord.charAt(0).toUpperCase() + item.primaryRecord.slice(1);
    title = `${item.name} of the ${recordName}`;
  }
  
  // Build description
  const level = item.primaryRecord ? item.records[item.primaryRecord].level : 0;
  const markCount = item.visualMarks?.length || 0;
  let description = `A ${item.tier} ${item.slot}`;
  if (markCount > 0) {
    description += ` with ${markCount} ${item.primaryRecord} mark${markCount > 1 ? 's' : ''}`;
  }
  
  // Check for glow (resonance handled at equip time)
  const glowColor = null;
  
  return {
    glyph: glyph,
    color: color,
    glowColor: glowColor,
    name: item.name,
    title: title,
    description: description
  };
}

/**
 * Generate a random item with a given slot
 * @param {number} floorLevel - Current floor level
 * @param {string} slot - Item slot (weapon, armor, amulet)
 * @returns {Object} Generated living item
 */
export function generateRandomItem(floorLevel, slot) {
  // Scale tier chances with floor level
  const tierPool = getTierPoolForFloor(floorLevel);
  const tier = tierPool[Math.floor(Math.random() * tierPool.length)];
  
  // Get name from pool
  const names = ITEM_NAMES[slot]?.[tier] || ITEM_NAMES[slot]?.common || [`${slot} Item`];
  const name = names[Math.floor(Math.random() * names.length)];
  
  return createLivingItem({
    name: name,
    slot: slot,
    tier: tier
  }, floorLevel);
}

/**
 * Get weighted tier pool for a floor level
 * @param {number} floorLevel - Floor level
 * @returns {Array} Array of possible tiers (weighted)
 */
function getTierPoolForFloor(floorLevel) {
  const pool = [];
  
  // Always add common
  for (let i = 0; i < 10; i++) pool.push(ITEM_TIERS.COMMON);
  
  // Add uncommon (appears early)
  if (floorLevel >= 1) {
    for (let i = 0; i < 6; i++) pool.push(ITEM_TIERS.UNCOMMON);
  }
  
  // Add rare (appears around floor 3)
  if (floorLevel >= 3) {
    for (let i = 0; i < 4; i++) pool.push(ITEM_TIERS.RARE);
  }
  
  // Add epic (appears around floor 7)
  if (floorLevel >= 7) {
    for (let i = 0; i < 2; i++) pool.push(ITEM_TIERS.EPIC);
  }
  
  // Add legendary (appears around floor 15+)
  if (floorLevel >= 15) {
    pool.push(ITEM_TIERS.LEGENDARY);
  }
  
  return pool;
}
