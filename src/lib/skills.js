// Path of Exile-style Skill Tree Graph
// A massive interconnected graph with fog of war discovery mechanics

// ── Constants ──

const REGIONS = ['combat', 'defense', 'vitality', 'exploration', 'fortune', 'arcane'];

export const SKILL_GRAPH_NODES = {
  // START NODE - Center of the graph
  'start': { id: 'start', type: 'small', label: 'Origin', char: '●', stat: null, value: 0, description: 'Starting point of your journey', x: 0, y: 0, region: 'combat' },

  // ═══════════════════════════════════════════════════════════════
  // COMBAT BRANCH (radiating up-right, x > 0, y > 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Combat - Layer 1 (near start)
  'c1': { id: 'c1', type: 'small', label: 'Strike', char: '·', stat: 'attack', value: 3, description: '+3 Attack', x: 2, y: 1, region: 'combat' },
  'c2': { id: 'c2', type: 'small', label: 'Edge', char: '·', stat: 'attack', value: 3, description: '+3 Attack', x: 1, y: 2, region: 'combat' },
  'c3': { id: 'c3', type: 'small', label: 'Thrust', char: '·', stat: 'attackSpeed', value: 2, description: '+2% Attack Speed', x: 3, y: 0, region: 'combat' },
  
  // Combat - Layer 2
  'c4': { id: 'c4', type: 'notable', label: 'Fury', char: '◆', stat: 'attackSpeed', value: 8, description: '+8% Attack Speed', x: 4, y: 2, region: 'combat' },
  'c5': { id: 'c5', type: 'small', label: 'Bash', char: '·', stat: 'critChance', value: 1, description: '+1% Crit Chance', x: 2, y: 3, region: 'combat' },
  'c6': { id: 'c6', type: 'small', label: 'Cleave', char: '·', stat: 'aoeRadius', value: 3, description: '+3% Area of Effect', x: 5, y: 1, region: 'combat' },
  
  // Combat - Layer 3
  'c7': { id: 'c7', type: 'small', label: 'Precision', char: '·', stat: 'critChance', value: 2, description: '+2% Crit Chance', x: 4, y: 4, region: 'combat' },
  'c8': { id: 'c8', type: 'notable', label: 'Slaughter', char: '◆', stat: 'damage', value: 12, description: '+12% Damage', x: 6, y: 3, region: 'combat' },
  'c9': { id: 'c9', type: 'small', label: 'Rend', char: '·', stat: 'bleedChance', value: 3, description: '+3% Bleed Chance', x: 3, y: 5, region: 'combat' },
  
  // Combat - Layer 4
  'c10': { id: 'c10', type: 'notable', label: 'Deadly Precision', char: '◆', stat: 'critMultiplier', value: 15, description: '+15% Crit Multiplier', x: 7, y: 5, region: 'combat' },
  'c11': { id: 'c11', type: 'small', label: 'Flay', char: '·', stat: 'attack', value: 4, description: '+4 Attack', x: 5, y: 6, region: 'combat' },
  'c12': { id: 'c12', type: 'small', label: 'Gash', char: '·', stat: 'critChance', value: 2, description: '+2% Crit Chance', x: 8, y: 2, region: 'combat' },
  
  // Combat - Layer 5
  'c13': { id: 'c13', type: 'small', label: 'Violence', char: '·', stat: 'attackSpeed', value: 3, description: '+3% Attack Speed', x: 6, y: 7, region: 'combat' },
  'c14': { id: 'c14', type: 'notable', label: 'Carnage', char: '◆', stat: 'damage', value: 18, description: '+18% Damage', x: 9, y: 4, region: 'combat' },
  'c15': { id: 'c15', type: 'small', label: 'Pierce', char: '·', stat: 'aoeRadius', value: 4, description: '+4% Area of Effect', x: 7, y: 8, region: 'combat' },
  
  // Combat - Layer 6 (Keystone area)
  'c16': { id: 'c16', type: 'notable', label: 'Whirlwind', char: '◆', stat: 'aoeRadius', value: 15, description: '+15% Area of Effect', x: 10, y: 6, region: 'combat' },
  'c17': { id: 'c17', type: 'small', label: 'Onslaught', char: '·', stat: 'attackSpeed', value: 4, description: '+4% Attack Speed', x: 8, y: 9, region: 'combat' },
  'c18': { id: 'c18', type: 'keystone', label: 'Berserker', char: '★', stat: 'critMultiplier', value: 50, description: '+50% Crit Multiplier', x: 12, y: 8, region: 'combat' },
  'c19': { id: 'c19', type: 'keystone', label: 'Annihilator', char: '★', stat: 'damage', value: 80, description: '+80% Damage', x: 11, y: 10, region: 'combat' },
  'c20': { id: 'c20', type: 'keystone', label: 'God of War', char: '★', stat: 'attack', value: 100, description: '+100 Attack', x: 13, y: 5, region: 'combat' },

  // ═══════════════════════════════════════════════════════════════
  // DEFENSE BRANCH (radiating up-left, x < 0, y > 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Defense - Layer 1
  'd1': { id: 'd1', type: 'small', label: 'Guard', char: '·', stat: 'defense', value: 3, description: '+3 Defense', x: -2, y: 1, region: 'defense' },
  'd2': { id: 'd2', type: 'small', label: 'Shield', char: '·', stat: 'defense', value: 3, description: '+3 Defense', x: -1, y: 2, region: 'defense' },
  'd3': { id: 'd3', type: 'small', label: 'Block', char: '·', stat: 'blockChance', value: 1, description: '+1% Block Chance', x: -3, y: 0, region: 'defense' },
  
  // Defense - Layer 2
  'd4': { id: 'd4', type: 'notable', label: 'Iron Skin', char: '◆', stat: 'armor', value: 8, description: '+8 Armor', x: -4, y: 2, region: 'defense' },
  'd5': { id: 'd5', type: 'small', label: 'Parry', char: '·', stat: 'blockChance', value: 2, description: '+2% Block Chance', x: -2, y: 3, region: 'defense' },
  'd6': { id: 'd6', type: 'small', label: 'Dodge', char: '·', stat: 'dodgeChance', value: 1, description: '+1% Dodge Chance', x: -5, y: 1, region: 'defense' },
  
  // Defense - Layer 3
  'd7': { id: 'd7', type: 'small', label: 'Endurance', char: '·', stat: 'damageReduction', value: 2, description: '+2% Damage Reduction', x: -4, y: 4, region: 'defense' },
  'd8': { id: 'd8', type: 'notable', label: 'Stone Wall', char: '◆', stat: 'defense', value: 15, description: '+15 Defense', x: -6, y: 3, region: 'defense' },
  'd9': { id: 'd9', type: 'small', label: 'Thorn', char: '·', stat: 'thorns', value: 2, description: '+2 Thorns', x: -3, y: 5, region: 'defense' },
  
  // Defense - Layer 4
  'd10': { id: 'd10', type: 'notable', label: 'Fortress', char: '◆', stat: 'damageReduction', value: 8, description: '+8% Damage Reduction', x: -7, y: 5, region: 'defense' },
  'd11': { id: 'd11', type: 'small', label: 'Evasion', char: '·', stat: 'dodgeChance', value: 2, description: '+2% Dodge Chance', x: -5, y: 6, region: 'defense' },
  'd12': { id: 'd12', type: 'small', label: 'Reflection', char: '·', stat: 'thorns', value: 3, description: '+3 Thorns', x: -8, y: 2, region: 'defense' },
  
  // Defense - Layer 5
  'd13': { id: 'd13', type: 'small', label: 'Barrier', char: '·', stat: 'blockChance', value: 3, description: '+3% Block Chance', x: -6, y: 7, region: 'defense' },
  'd14': { id: 'd14', type: 'notable', label: 'Titan', char: '◆', stat: 'armor', value: 20, description: '+20 Armor', x: -9, y: 4, region: 'defense' },
  'd15': { id: 'd15', type: 'small', label: 'Spikes', char: '·', stat: 'thorns', value: 4, description: '+4 Thorns', x: -7, y: 8, region: 'defense' },
  
  // Defense - Layer 6 (Keystone area)
  'd16': { id: 'd16', type: 'notable', label: 'Immortal', char: '◆', stat: 'damageReduction', value: 12, description: '+12% Damage Reduction', x: -10, y: 6, region: 'defense' },
  'd17': { id: 'd17', type: 'small', label: 'Shadow', char: '·', stat: 'dodgeChance', value: 3, description: '+3% Dodge Chance', x: -8, y: 9, region: 'defense' },
  'd18': { id: 'd18', type: 'keystone', label: 'Fortress', char: '★', stat: 'armor', value: 60, description: '+60 Armor', x: -12, y: 8, region: 'defense' },
  'd19': { id: 'd19', type: 'keystone', label: 'Unbreakable', char: '★', stat: 'damageReduction', value: 40, description: '+40% Damage Reduction', x: -11, y: 10, region: 'defense' },
  'd20': { id: 'd20', type: 'keystone', label: 'Thornmmander', char: '★', stat: 'thorns', value: 50, description: '+50 Thorns', x: -13, y: 5, region: 'defense' },

  // ═══════════════════════════════════════════════════════════════
  // VITALITY BRANCH (radiating down, y < 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Vitality - Layer 1
  'v1': { id: 'v1', type: 'small', label: 'Vitality', char: '·', stat: 'maxHP', value: 10, description: '+10 Max HP', x: 0, y: -2, region: 'vitality' },
  'v2': { id: 'v2', type: 'small', label: 'Health', char: '·', stat: 'maxHP', value: 10, description: '+10 Max HP', x: 1, y: -2, region: 'vitality' },
  'v3': { id: 'v3', type: 'small', label: 'Blood', char: '·', stat: 'hpRegen', value: 1, description: '+1 HP Regen', x: -1, y: -2, region: 'vitality' },
  
  // Vitality - Layer 2
  'v4': { id: 'v4', type: 'notable', label: 'Regeneration', char: '◆', stat: 'hpRegen', value: 4, description: '+4 HP Regen', x: 2, y: -4, region: 'vitality' },
  'v5': { id: 'v5', type: 'small', label: 'Stamina', char: '·', stat: 'maxHP', value: 15, description: '+15 Max HP', x: 0, y: -4, region: 'vitality' },
  'v6': { id: 'v6', type: 'small', label: 'Pulse', char: '·', stat: 'hpRegen', value: 1, description: '+1 HP Regen', x: -2, y: -4, region: 'vitality' },
  
  // Vitality - Layer 3
  'v7': { id: 'v7', type: 'small', label: 'Vigor', char: '·', stat: 'maxHP', value: 20, description: '+20 Max HP', x: 3, y: -5, region: 'vitality' },
  'v8': { id: 'v8', type: 'notable', label: 'Lifeblood', char: '◆', stat: 'maxHP', value: 40, description: '+40 Max HP', x: 1, y: -6, region: 'vitality' },
  'v9': { id: 'v9', type: 'small', label: 'Flow', char: '·', stat: 'lifesteal', value: 1, description: '+1% Lifesteal', x: -1, y: -6, region: 'vitality' },
  
  // Vitality - Layer 4
  'v10': { id: 'v10', type: 'notable', label: 'Soul Drinker', char: '◆', stat: 'lifesteal', value: 4, description: '+4% Lifesteal', x: 4, y: -7, region: 'vitality' },
  'v11': { id: 'v11', type: 'small', label: 'Hardening', char: '·', stat: 'resistAll', value: 3, description: '+3% All Resistances', x: 2, y: -8, region: 'vitality' },
  'v12': { id: 'v12', type: 'small', label: 'Essence', char: '·', stat: 'healBonus', value: 5, description: '+5% Healing Bonus', x: -2, y: -7, region: 'vitality' },
  
  // Vitality - Layer 5
  'v13': { id: 'v13', type: 'small', label: 'Titan Blood', char: '·', stat: 'maxHP', value: 25, description: '+25 Max HP', x: 5, y: -9, region: 'vitality' },
  'v14': { id: 'v14', type: 'notable', label: 'Potion Master', char: '◆', stat: 'healBonus', value: 15, description: '+15% Healing Bonus', x: 0, y: -9, region: 'vitality' },
  'v15': { id: 'v15', type: 'small', label: 'Stone Skin', char: '·', stat: 'resistAll', value: 4, description: '+4% All Resistances', x: -3, y: -9, region: 'vitality' },
  
  // Vitality - Layer 6 (Keystone area)
  'v16': { id: 'v16', type: 'notable', label: 'Immortal', char: '◆', stat: 'reviveChance', value: 15, description: '+15% Revive Chance', x: 6, y: -10, region: 'vitality' },
  'v17': { id: 'v17', type: 'small', label: 'Giant', char: '·', stat: 'maxHP', value: 30, description: '+30 Max HP', x: 3, y: -11, region: 'vitality' },
  'v18': { id: 'v18', type: 'keystone', label: 'Godtouched', char: '★', stat: 'maxHP', value: 150, description: '+150 Max HP', x: 1, y: -12, region: 'vitality' },
  'v19': { id: 'v19', type: 'keystone', label: 'Blood God', char: '★', stat: 'lifesteal', value: 25, description: '+25% Lifesteal', x: -1, y: -12, region: 'vitality' },
  'v20': { id: 'v20', type: 'keystone', label: 'Phoenix', char: '★', stat: 'reviveChance', value: 50, description: '+50% Revive Chance', x: 4, y: -13, region: 'vitality' },

  // ═══════════════════════════════════════════════════════════════
  // EXPLORATION BRANCH (radiating left, x < 0, y ~ 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Exploration - Layer 1
  'e1': { id: 'e1', type: 'small', label: 'Swift', char: '·', stat: 'moveSpeed', value: 2, description: '+2% Move Speed', x: -2, y: 0, region: 'exploration' },
  'e2': { id: 'e2', type: 'small', label: 'Strider', char: '·', stat: 'moveSpeed', value: 2, description: '+2% Move Speed', x: -2, y: -1, region: 'exploration' },
  'e3': { id: 'e3', type: 'small', label: 'Endurance', char: '·', stat: 'staminaMax', value: 5, description: '+5 Max Stamina', x: -3, y: 1, region: 'exploration' },
  
  // Exploration - Layer 2
  'e4': { id: 'e4', type: 'notable', label: 'Pathfinder', char: '◆', stat: 'moveSpeed', value: 6, description: '+6% Move Speed', x: -4, y: -2, region: 'exploration' },
  'e5': { id: 'e5', type: 'small', label: 'Eagle Eye', char: '·', stat: 'mapReveal', value: 1, description: '+1 Map Reveal', x: -3, y: -3, region: 'exploration' },
  'e6': { id: 'e6', type: 'small', label: 'Surveyor', char: '·', stat: 'secretDetect', value: 2, description: '+2 Secret Detect', x: -5, y: 0, region: 'exploration' },
  
  // Exploration - Layer 3
  'e7': { id: 'e7', type: 'small', label: 'Marathon', char: '·', stat: 'staminaMax', value: 8, description: '+8 Max Stamina', x: -5, y: -3, region: 'exploration' },
  'e8': { id: 'e8', type: 'notable', label: 'Treasure Hunter', char: '◆', stat: 'secretDetect', value: 5, description: '+5 Secret Detect', x: -6, y: -1, region: 'exploration' },
  'e9': { id: 'e9', type: 'small', label: 'Nimble', char: '·', stat: 'trapDisarm', value: 3, description: '+3 Trap Disarm', x: -4, y: -4, region: 'exploration' },
  
  // Exploration - Layer 4
  'e10': { id: 'e10', type: 'notable', label: 'Ghost', char: '◆', stat: 'stealthChance', value: 8, description: '+8% Stealth Chance', x: -7, y: -3, region: 'exploration' },
  'e11': { id: 'e11', type: 'small', label: 'Cartographer', char: '·', stat: 'mapReveal', value: 2, description: '+2 Map Reveal', x: -6, y: -5, region: 'exploration' },
  'e12': { id: 'e12', type: 'small', label: 'Quick Hands', char: '·', stat: 'moveSpeed', value: 3, description: '+3% Move Speed', x: -8, y: 0, region: 'exploration' },
  
  // Exploration - Layer 5
  'e13': { id: 'e13', type: 'small', label: 'Sprinter', char: '·', stat: 'moveSpeed', value: 4, description: '+4% Move Speed', x: -8, y: -4, region: 'exploration' },
  'e14': { id: 'e14', type: 'notable', label: 'Explorer', char: '◆', stat: 'mapReveal', value: 6, description: '+6 Map Reveal', x: -9, y: -2, region: 'exploration' },
  'e15': { id: 'e15', type: 'small', label: 'Shadow Walker', char: '·', stat: 'stealthChance', value: 5, description: '+5% Stealth Chance', x: -7, y: -6, region: 'exploration' },
  
  // Exploration - Layer 6 (Keystone area)
  'e16': { id: 'e16', type: 'notable', label: 'Voyager', char: '◆', stat: 'staminaMax', value: 20, description: '+20 Max Stamina', x: -10, y: -5, region: 'exploration' },
  'e17': { id: 'e17', type: 'small', label: 'Lucky', char: '·', stat: 'secretDetect', value: 5, description: '+5 Secret Detect', x: -9, y: -7, region: 'exploration' },
  'e18': { id: 'e18', type: 'keystone', label: 'Shadow Dancer', char: '★', stat: 'stealthChance', value: 40, description: '+40% Stealth Chance', x: -12, y: -6, region: 'exploration' },
  'e19': { id: 'e19', type: 'keystone', label: 'Trailblazer', char: '★', stat: 'moveSpeed', value: 30, description: '+30% Move Speed', x: -11, y: -8, region: 'exploration' },
  'e20': { id: 'e20', type: 'keystone', label: 'Master Explorer', char: '★', stat: 'mapReveal', value: 30, description: '+30 Map Reveal', x: -13, y: -4, region: 'exploration' },

  // ═══════════════════════════════════════════════════════════════
  // FORTUNE BRANCH (radiating down-right, x > 0, y < 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Fortune - Layer 1
  'f1': { id: 'f1', type: 'small', label: 'Coin', char: '·', stat: 'goldFind', value: 3, description: '+3% Gold Find', x: 2, y: -1, region: 'fortune' },
  'f2': { id: 'f2', type: 'small', label: 'Penny', char: '·', stat: 'goldFind', value: 3, description: '+3% Gold Find', x: 1, y: -2, region: 'fortune' },
  'f3': { id: 'f3', type: 'small', label: 'Gem', char: '·', stat: 'itemRarity', value: 2, description: '+2% Item Rarity', x: 3, y: -1, region: 'fortune' },
  
  // Fortune - Layer 2
  'f4': { id: 'f4', type: 'notable', label: 'Greed', char: '◆', stat: 'goldFind', value: 8, description: '+8% Gold Find', x: 4, y: -3, region: 'fortune' },
  'f5': { id: 'f5', type: 'small', label: 'Bargain', char: '·', stat: 'shopDiscount', value: 2, description: '+2% Shop Discount', x: 2, y: -4, region: 'fortune' },
  'f6': { id: 'f6', type: 'small', label: 'Lucky Find', char: '·', stat: 'dropBonus', value: 2, description: '+2% Drop Bonus', x: 5, y: -1, region: 'fortune' },
  
  // Fortune - Layer 3
  'f7': { id: 'f7', type: 'small', label: 'Chest', char: '·', stat: 'chestBonus', value: 3, description: '+3% Chest Bonus', x: 5, y: -4, region: 'fortune' },
  'f8': { id: 'f8', type: 'notable', label: 'Midas Touch', char: '◆', stat: 'goldFind', value: 12, description: '+12% Gold Find', x: 3, y: -5, region: 'fortune' },
  'f9': { id: 'f9', type: 'small', label: 'Hoard', char: '·', stat: 'vendorPrice', value: 4, description: '+4% Vendor Price', x: 6, y: -2, region: 'fortune' },
  
  // Fortune - Layer 4
  'f10': { id: 'f10', type: 'notable', label: 'Fortune', char: '◆', stat: 'itemRarity', value: 10, description: '+10% Item Rarity', x: 7, y: -4, region: 'fortune' },
  'f11': { id: 'f11', type: 'small', label: 'Trade', char: '·', stat: 'shopDiscount', value: 4, description: '+4% Shop Discount', x: 5, y: -6, region: 'fortune' },
  'f12': { id: 'f12', type: 'small', label: 'Treasure', char: '·', stat: 'chestBonus', value: 5, description: '+5% Chest Bonus', x: 8, y: -1, region: 'fortune' },
  
  // Fortune - Layer 5
  'f13': { id: 'f13', type: 'small', label: 'Riches', char: '·', stat: 'goldFind', value: 6, description: '+6% Gold Find', x: 8, y: -5, region: 'fortune' },
  'f14': { id: 'f14', type: 'notable', label: 'Tycoon', char: '◆', stat: 'shopDiscount', value: 15, description: '+15% Shop Discount', x: 6, y: -7, region: 'fortune' },
  'f15': { id: 'f15', type: 'small', label: 'Plunder', char: '·', stat: 'doubleDropChance', value: 2, description: '+2% Double Drop', x: 9, y: -3, region: 'fortune' },
  
  // Fortune - Layer 6 (Keystone area)
  'f16': { id: 'f16', type: 'notable', label: 'Kingpin', char: '◆', stat: 'chestBonus', value: 20, description: '+20% Chest Bonus', x: 10, y: -6, region: 'fortune' },
  'f17': { id: 'f17', type: 'small', label: 'Jackpot', char: '·', stat: 'dropBonus', value: 5, description: '+5% Drop Bonus', x: 8, y: -8, region: 'fortune' },
  'f18': { id: 'f18', type: 'keystone', label: 'Lucky Star', char: '★', stat: 'goldFind', value: 60, description: '+60% Gold Find', x: 12, y: -7, region: 'fortune' },
  'f19': { id: 'f19', type: 'keystone', label: 'Treasure God', char: '★', stat: 'itemRarity', value: 50, description: '+50% Item Rarity', x: 11, y: -9, region: 'fortune' },
  'f20': { id: 'f20', type: 'keystone', label: 'Magnate', char: '★', stat: 'vendorPrice', value: 40, description: '+40% Vendor Price', x: 13, y: -5, region: 'fortune' },

  // ═══════════════════════════════════════════════════════════════
  // ARCANE BRANCH (radiating down-left, x < 0, y < 0)
  // ═══════════════════════════════════════════════════════════════
  
  // Arcane - Layer 1
  'a1': { id: 'a1', type: 'small', label: 'Spark', char: '·', stat: 'manaMax', value: 5, description: '+5 Max Mana', x: -1, y: -3, region: 'arcane' },
  'a2': { id: 'a2', type: 'small', label: 'Mana', char: '·', stat: 'manaMax', value: 5, description: '+5 Max Mana', x: -2, y: -2, region: 'arcane' },
  'a3': { id: 'a3', type: 'small', label: 'Focus', char: '·', stat: 'spellPower', value: 2, description: '+2 Spell Power', x: 0, y: -3, region: 'arcane' },
  
  // Arcane - Layer 2
  'a4': { id: 'a4', type: 'notable', label: 'Intellect', char: '◆', stat: 'manaMax', value: 12, description: '+12 Max Mana', x: -3, y: -4, region: 'arcane' },
  'a5': { id: 'a5', type: 'small', label: 'Wisdom', char: '·', stat: 'manaRegen', value: 1, description: '+1 Mana Regen', x: -1, y: -4, region: 'arcane' },
  'a6': { id: 'a6', type: 'small', label: 'Power', char: '·', stat: 'spellPower', value: 3, description: '+3 Spell Power', x: -4, y: -2, region: 'arcane' },
  
  // Arcane - Layer 3
  'a7': { id: 'a7', type: 'small', label: 'Channel', char: '·', stat: 'cooldownReduction', value: 2, description: '+2% Cooldown Reduction', x: -4, y: -5, region: 'arcane' },
  'a8': { id: 'a8', type: 'notable', label: 'Sorcerer', char: '◆', stat: 'spellPower', value: 10, description: '+10 Spell Power', x: -2, y: -6, region: 'arcane' },
  'a9': { id: 'a9', type: 'small', label: 'Aura', char: '·', stat: 'auraRange', value: 3, description: '+3% Aura Range', x: -5, y: -3, region: 'arcane' },
  
  // Arcane - Layer 4
  'a10': { id: 'a10', type: 'notable', label: 'Archmage', char: '◆', stat: 'manaMax', value: 20, description: '+20 Max Mana', x: -5, y: -6, region: 'arcane' },
  'a11': { id: 'a11', type: 'small', label: 'Elemental', char: '·', stat: 'elementalDamage', value: 4, description: '+4% Elemental Damage', x: -3, y: -7, region: 'arcane' },
  'a12': { id: 'a12', type: 'small', label: 'Haste', char: '·', stat: 'cooldownReduction', value: 3, description: '+3% Cooldown Reduction', x: -6, y: -4, region: 'arcane' },
  
  // Arcane - Layer 5
  'a13': { id: 'a13', type: 'small', label: 'Mana Flow', char: '·', stat: 'manaRegen', value: 2, description: '+2 Mana Regen', x: -6, y: -7, region: 'arcane' },
  'a14': { id: 'a14', type: 'notable', label: 'Warlock', char: '◆', stat: 'elementalDamage', value: 12, description: '+12% Elemental Damage', x: -4, y: -8, region: 'arcane' },
  'a15': { id: 'a15', type: 'small', label: 'Presence', char: '·', stat: 'auraRange', value: 5, description: '+5% Aura Range', x: -7, y: -5, region: 'arcane' },
  
  // Arcane - Layer 6 (Keystone area)
  'a16': { id: 'a16', type: 'notable', label: 'Time Warp', char: '◆', stat: 'cooldownReduction', value: 10, description: '+10% Cooldown Reduction', x: -7, y: -9, region: 'arcane' },
  'a17': { id: 'a17', type: 'small', label: 'Arcane Mind', char: '·', stat: 'manaMax', value: 15, description: '+15 Max Mana', x: -5, y: -10, region: 'arcane' },
  'a18': { id: 'a18', type: 'keystone', label: 'Archon', char: '★', stat: 'spellPower', value: 50, description: '+50 Spell Power', x: -8, y: -11, region: 'arcane' },
  'a19': { id: 'a19', type: 'keystone', label: 'Mana Siphon', char: '★', stat: 'manaRegen', value: 15, description: '+15 Mana Regen', x: -6, y: -12, region: 'arcane' },
  'a20': { id: 'a20', type: 'keystone', label: 'Aura Master', char: '★', stat: 'auraRange', value: 40, description: '+40% Aura Range', x: -9, y: -10, region: 'arcane' },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL CROSS-LINKS BETWEEN BRANCHES (outer periphery)
  // ═══════════════════════════════════════════════════════════════
  
  // Cross-links connecting the outer edges of branches
  'x1': { id: 'x1', type: 'small', label: 'Fusion', char: '·', stat: 'damageReduction', value: 3, description: '+3% Damage Reduction', x: -10, y: 7, region: 'defense' },
  'x2': { id: 'x2', type: 'small', label: 'Mystic', char: '·', stat: 'spellPower', value: 4, description: '+4 Spell Power', x: -9, y: 6, region: 'arcane' },
  'x3': { id: 'x3', type: 'notable', label: 'Champion', char: '◆', stat: 'attack', value: 15, description: '+15 Attack', x: -11, y: 9, region: 'combat' },
  'x4': { id: 'x4', type: 'small', label: 'Transfusion', char: '·', stat: 'lifesteal', value: 2, description: '+2% Lifesteal', x: -8, y: 8, region: 'vitality' },
  'x5': { id: 'x5', type: 'small', label: 'Wanderer', char: '·', stat: 'moveSpeed', value: 4, description: '+4% Move Speed', x: -11, y: -3, region: 'exploration' },
  'x6': { id: 'x6', type: 'small', label: 'Abundance', char: '·', stat: 'goldFind', value: 5, description: '+5% Gold Find', x: -10, y: -5, region: 'fortune' },
  'x7': { id: 'x7', type: 'notable', label: 'Convergence', char: '◆', stat: 'critChance', value: 5, description: '+5% Crit Chance', x: 10, y: 7, region: 'combat' },
  'x8': { id: 'x8', type: 'small', label: 'Sanctuary', char: '·', stat: 'blockChance', value: 3, description: '+3% Block Chance', x: 9, y: 8, region: 'defense' },
  'x9': { id: 'x9', type: 'small', label: 'Transcendence', char: '·', stat: 'maxHP', value: 20, description: '+20 Max HP', x: 8, y: 9, region: 'vitality' },
  'x10': { id: 'x10', type: 'notable', label: 'Mastermind', char: '◆', stat: 'intelligence', value: 10, description: '+10 Intelligence', x: -7, y: -8, region: 'arcane' },
  'x11': { id: 'x11', type: 'small', label: 'Opportunity', char: '·', stat: 'critMultiplier', value: 5, description: '+5% Crit Multiplier', x: 11, y: -4, region: 'fortune' },
  'x12': { id: 'x12', type: 'small', label: 'Wayfarer', char: '·', stat: 'mapReveal', value: 3, description: '+3 Map Reveal', x: -9, y: -9, region: 'exploration' },
  'x13': { id: 'x13', type: 'small', label: 'Crusader', char: '·', stat: 'defense', value: 10, description: '+10 Defense', x: -9, y: 10, region: 'defense' },
  'x14': { id: 'x14', type: 'small', label: 'Spectral', char: '·', stat: 'elementalDamage', value: 5, description: '+5% Elemental Damage', x: -12, y: -7, region: 'arcane' },
  'x15': { id: 'x15', type: 'small', label: 'Berserker', char: '·', stat: 'attackSpeed', value: 5, description: '+5% Attack Speed', x: 11, y: 9, region: 'combat' },
  'x16': { id: 'x16', type: 'notable', label: 'Avatar', char: '◆', stat: 'maxHP', value: 50, description: '+50 Max HP', x: 9, y: 11, region: 'vitality' },
  'x17': { id: 'x17', type: 'small', label: 'Gambler', char: '·', stat: 'itemRarity', value: 5, description: '+5% Item Rarity', x: 10, y: -8, region: 'fortune' },
  'x18': { id: 'x18', type: 'small', label: 'Scout', char: '·', stat: 'secretDetect', value: 5, description: '+5 Secret Detect', x: -12, y: -5, region: 'exploration' },
  'x19': { id: 'x19', type: 'small', label: 'Guardian', char: '·', stat: 'armor', value: 15, description: '+15 Armor', x: -14, y: 6, region: 'defense' },
  'x20': { id: 'x20', type: 'small', label: 'Phoenix', char: '·', stat: 'reviveChance', value: 10, description: '+10% Revive Chance', x: 7, y: 10, region: 'vitality' },
};

// ═══════════════════════════════════════════════════════════════
// EDGES - Connections between nodes
// ═══════════════════════════════════════════════════════════════

export const SKILL_GRAPH_EDGES = [
  // Start connections
  ['start', 'c1'], ['start', 'c2'], ['start', 'c3'],
  ['start', 'd1'], ['start', 'd2'], ['start', 'd3'],
  ['start', 'e1'], ['start', 'e2'], ['start', 'e3'],
  ['start', 'v1'], ['start', 'v2'], ['start', 'v3'],
  ['start', 'f1'], ['start', 'f2'], ['start', 'f3'],
  ['start', 'a1'], ['start', 'a2'], ['start', 'a3'],
  
  // Combat branch connections
  ['c1', 'c4'], ['c1', 'c5'],
  ['c2', 'c5'], ['c2', 'c4'],
  ['c3', 'c4'], ['c3', 'c6'],
  ['c4', 'c7'], ['c4', 'c8'], ['c4', 'c6'],
  ['c5', 'c7'], ['c5', 'c9'],
  ['c6', 'c8'], ['c6', 'c11'],
  ['c7', 'c10'], ['c7', 'c9'],
  ['c8', 'c10'], ['c8', 'c12'], ['c8', 'c14'],
  ['c9', 'c11'], ['c9', 'c13'],
  ['c10', 'c14'], ['c10', 'c16'],
  ['c11', 'c13'], ['c11', 'c15'],
  ['c12', 'c14'],
  ['c13', 'c15'], ['c13', 'c17'],
  ['c14', 'c16'], ['c14', 'c20'],
  ['c15', 'c17'],
  ['c16', 'c18'], ['c16', 'c19'], ['c16', 'c17'],
  ['c17', 'c18'],
  ['c18', 'c19'], ['c18', 'c20'],
  ['c19', 'c20'],
  
  // Defense branch connections
  ['d1', 'd4'], ['d1', 'd5'],
  ['d2', 'd5'], ['d2', 'd4'],
  ['d3', 'd4'], ['d3', 'd6'],
  ['d4', 'd7'], ['d4', 'd8'], ['d4', 'd6'],
  ['d5', 'd7'], ['d5', 'd9'],
  ['d6', 'd8'], ['d6', 'd12'],
  ['d7', 'd10'], ['d7', 'd9'],
  ['d8', 'd10'], ['d8', 'd12'], ['d8', 'd14'],
  ['d9', 'd11'], ['d9', 'd13'],
  ['d10', 'd14'], ['d10', 'd16'],
  ['d11', 'd13'], ['d11', 'd15'],
  ['d12', 'd14'],
  ['d13', 'd15'],
  ['d14', 'd16'], ['d14', 'd20'],
  ['d15', 'd17'],
  ['d16', 'd18'], ['d16', 'd19'], ['d16', 'd17'],
  ['d17', 'd18'],
  ['d18', 'd19'], ['d18', 'd20'],
  ['d19', 'd20'],
  
  // Vitality branch connections
  ['v1', 'v4'], ['v1', 'v5'],
  ['v2', 'v4'], ['v2', 'v5'],
  ['v3', 'v4'], ['v3', 'v6'],
  ['v4', 'v7'], ['v4', 'v8'], ['v4', 'v6'],
  ['v5', 'v7'], ['v5', 'v8'],
  ['v6', 'v8'], ['v6', 'v9'],
  ['v7', 'v10'], ['v7', 'v11'],
  ['v8', 'v10'], ['v8', 'v12'], ['v8', 'v14'],
  ['v9', 'v11'], ['v9', 'v12'],
  ['v10', 'v14'], ['v10', 'v16'],
  ['v11', 'v13'], ['v11', 'v15'],
  ['v12', 'v14'], ['v12', 'v15'],
  ['v13', 'v16'],
  ['v14', 'v16'], ['v14', 'v18'],
  ['v15', 'v17'],
  ['v16', 'v18'], ['v16', 'v19'], ['v16', 'v17'],
  ['v17', 'v18'],
  ['v18', 'v19'], ['v18', 'v20'],
  ['v19', 'v20'],
  
  // Exploration branch connections
  ['e1', 'e4'], ['e1', 'e5'],
  ['e2', 'e4'], ['e2', 'e5'],
  ['e3', 'e4'], ['e3', 'e6'],
  ['e4', 'e7'], ['e4', 'e8'], ['e4', 'e6'],
  ['e5', 'e7'], ['e5', 'e9'],
  ['e6', 'e8'], ['e6', 'e12'],
  ['e7', 'e10'], ['e7', 'e9'],
  ['e8', 'e10'], ['e8', 'e12'], ['e8', 'e14'],
  ['e9', 'e11'], ['e9', 'e13'],
  ['e10', 'e14'], ['e10', 'e16'],
  ['e11', 'e13'], ['e11', 'e15'],
  ['e12', 'e14'],
  ['e13', 'e15'], ['e13', 'e17'],
  ['e14', 'e16'], ['e14', 'e20'],
  ['e15', 'e17'],
  ['e16', 'e18'], ['e16', 'e19'], ['e16', 'e17'],
  ['e17', 'e18'],
  ['e18', 'e19'], ['e18', 'e20'],
  ['e19', 'e20'],
  
  // Fortune branch connections
  ['f1', 'f4'], ['f1', 'f5'],
  ['f2', 'f4'], ['f2', 'f5'],
  ['f3', 'f4'], ['f3', 'f6'],
  ['f4', 'f7'], ['f4', 'f8'], ['f4', 'f6'],
  ['f5', 'f7'], ['f5', 'f9'],
  ['f6', 'f8'], ['f6', 'f12'],
  ['f7', 'f10'], ['f7', 'f9'],
  ['f8', 'f10'], ['f8', 'f12'], ['f8', 'f14'],
  ['f9', 'f11'], ['f9', 'f13'],
  ['f10', 'f14'], ['f10', 'f16'],
  ['f11', 'f13'], ['f11', 'f15'],
  ['f12', 'f14'],
  ['f13', 'f15'], ['f13', 'f17'],
  ['f14', 'f16'], ['f14', 'f20'],
  ['f15', 'f17'],
  ['f16', 'f18'], ['f16', 'f19'], ['f16', 'f17'],
  ['f17', 'f18'],
  ['f18', 'f19'], ['f18', 'f20'],
  ['f19', 'f20'],
  
  // Arcane branch connections
  ['a1', 'a4'], ['a1', 'a5'],
  ['a2', 'a4'], ['a2', 'a5'],
  ['a3', 'a4'], ['a3', 'a6'],
  ['a4', 'a7'], ['a4', 'a8'], ['a4', 'a6'],
  ['a5', 'a7'], ['a5', 'a8'],
  ['a6', 'a8'], ['a6', 'a9'],
  ['a7', 'a10'], ['a7', 'a9'],
  ['a8', 'a10'], ['a8', 'a12'], ['a8', 'a14'],
  ['a9', 'a11'], ['a9', 'a13'],
  ['a10', 'a14'], ['a10', 'a16'],
  ['a11', 'a13'], ['a11', 'a15'],
  ['a12', 'a14'],
  ['a13', 'a15'], ['a13', 'a17'],
  ['a14', 'a16'], ['a14', 'a20'],
  ['a15', 'a17'],
  ['a16', 'a18'], ['a16', 'a19'], ['a16', 'a17'],
  ['a17', 'a18'],
  ['a18', 'a19'], ['a18', 'a20'],
  ['a19', 'a20'],
  
  // Cross-links between branches (outer periphery)
  // Defense to Combat
  ['d18', 'c19'], ['d19', 'c20'], ['d20', 'x3'],
  ['c18', 'x7'], ['c19', 'x3'],
  
  // Defense to Vitality
  ['d16', 'v16'], ['d17', 'v17'], ['d18', 'v18'], ['d19', 'v19'],
  ['v16', 'x9'], ['v17', 'x9'], ['v18', 'x16'], ['v19', 'x20'],
  
  // Defense to Exploration
  ['d17', 'e17'], ['d18', 'e18'], ['d19', 'e19'], ['d20', 'e20'],
  ['e16', 'x5'], ['e17', 'x5'], ['e18', 'x12'], ['e19', 'x18'],
  
  // Defense to Fortune
  ['d15', 'f15'], ['d16', 'f16'], ['d17', 'f17'],
  ['f14', 'x6'], ['f15', 'x11'], ['f16', 'x17'],
  
  // Defense to Arcane
  ['d14', 'a14'], ['d15', 'a15'], ['d16', 'a16'],
  ['a14', 'x2'], ['a15', 'x10'], ['a16', 'x14'],
  
  // Combat to Vitality
  ['c16', 'v16'], ['c17', 'v17'], ['c18', 'v18'], ['c19', 'v19'],
  ['v15', 'x9'], ['v16', 'x16'], ['v17', 'x20'],
  
  // Combat to Exploration
  ['c15', 'e15'], ['c16', 'e16'], ['c17', 'e17'], ['c18', 'e18'],
  ['e14', 'x5'], ['e15', 'x11'], ['e16', 'x12'],
  
  // Combat to Fortune
  ['c14', 'f14'], ['c15', 'f15'], ['c16', 'f16'],
  ['f13', 'x6'], ['f14', 'x11'], ['f15', 'x17'],
  
  // Combat to Arcane
  ['c12', 'a12'], ['c13', 'a13'], ['c14', 'a14'],
  ['a12', 'x2'], ['a13', 'x10'], ['a14', 'x14'],
  
  // Vitality to Exploration
  ['v13', 'e13'], ['v14', 'e14'], ['v15', 'e15'],
  ['e12', 'x5'], ['e13', 'x11'], ['e14', 'x18'],
  
  // Vitality to Fortune
  ['v14', 'f14'], ['v15', 'f15'], ['v16', 'f16'],
  ['f13', 'x6'], ['f14', 'x11'], ['f15', 'x17'],
  
  // Vitality to Arcane
  ['v12', 'a12'], ['v13', 'a13'], ['v14', 'a14'],
  ['a11', 'x2'], ['a12', 'x10'], ['a13', 'x14'],
  
  // Exploration to Fortune
  ['e13', 'f13'], ['e14', 'f14'], ['e15', 'f15'],
  ['f12', 'x6'], ['f13', 'x11'], ['f14', 'x17'],
  
  // Exploration to Arcane
  ['e12', 'a12'], ['e13', 'a13'], ['e14', 'a14'],
  ['a11', 'x2'], ['a12', 'x10'], ['a13', 'x14'],
  
  // Fortune to Arcane
  ['f12', 'a12'], ['f13', 'a13'], ['f14', 'a14'],
  ['a11', 'x2'], ['a12', 'x10'], ['a13', 'x14'],
  
  // Additional cross-links for connectivity
  ['x1', 'd16'], ['x1', 'x3'],
  ['x2', 'a12'], ['x2', 'x10'],
  ['x3', 'c18'], ['x3', 'c19'],
  ['x4', 'v14'], ['x4', 'x9'],
  ['x5', 'e14'], ['x5', 'e16'],
  ['x6', 'f12'], ['x6', 'f14'],
  ['x7', 'c16'], ['x7', 'c17'],
  ['x8', 'd14'], ['x8', 'd15'],
  ['x9', 'v14'], ['x9', 'v16'],
  ['x10', 'a12'], ['x10', 'a14'],
  ['x11', 'f13'], ['x11', 'f15'],
  ['x12', 'e14'], ['x12', 'e16'],
  ['x13', 'd16'], ['x13', 'd18'],
  ['x14', 'a14'], ['x14', 'a16'],
  ['x15', 'c16'], ['x15', 'c18'],
  ['x16', 'v16'], ['x16', 'v18'],
  ['x17', 'f15'], ['x17', 'f17'],
  ['x18', 'e16'], ['x18', 'e18'],
  ['x19', 'd18'], ['x19', 'd20'],
  ['x20', 'v16'], ['x20', 'v18'],
];

// Build adjacency map from edges
function buildAdjacencyMap(edges) {
  const adj = {};
  for (const [a, b] of edges) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

export const SKILL_GRAPH_ADJACENCY = buildAdjacencyMap(SKILL_GRAPH_EDGES);

// ── Helper Functions ──

export function getRegionColor(region) {
  const colors = {
    combat: '#c4645a',
    defense: '#5a8ec4',
    vitality: '#5ab87e',
    exploration: '#5ab8c4',
    fortune: '#c4b05a',
    arcane: '#9a7ab8'
  };
  return colors[region] || '#888888';
}

export function getNodeTypeChar(type) {
  const chars = {
    small: '·',
    notable: '◆',
    keystone: '★'
  };
  return chars[type] || '?';
}

// ── State Functions ──

export function createSkillTree() {
  return {
    allocated: new Set(['start']),
    totalPoints: 0
  };
}

export function canAllocate(tree, nodeId) {
  const node = SKILL_GRAPH_NODES[nodeId];
  if (!node) return false;
  if (tree.allocated.has(nodeId)) return false;
  
  // Check if node is adjacent to any allocated node
  const adjacent = SKILL_GRAPH_ADJACENCY[nodeId];
  if (!adjacent) return false;
  
  for (const neighborId of adjacent) {
    if (tree.allocated.has(neighborId)) {
      return true;
    }
  }
  return false;
}

export function allocateNode(tree, nodeId) {
  if (!canAllocate(tree, nodeId)) {
    return tree;
  }
  
  const newAllocated = new Set(tree.allocated);
  newAllocated.add(nodeId);
  
  return {
    allocated: newAllocated,
    totalPoints: tree.totalPoints + 1
  };
}

export function deallocateNode(tree, nodeId) {
  // Cannot deallocate start node
  if (nodeId === 'start') {
    return tree;
  }
  
  // Cannot deallocate if not allocated
  if (!tree.allocated.has(nodeId)) {
    return tree;
  }
  
  // Check if removal would disconnect graph
  // Remove the node temporarily
  const testAllocated = new Set(tree.allocated);
  testAllocated.delete(nodeId);
  
  // BFS from start to check if all other allocated nodes are still reachable
  const visited = new Set();
  const queue = ['start'];
  visited.add('start');
  
  while (queue.length > 0) {
    const current = queue.shift();
    const adjacent = SKILL_GRAPH_ADJACENCY[current];
    
    if (adjacent) {
      for (const neighbor of adjacent) {
        if (testAllocated.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  
  // Check if any allocated node is now disconnected
  for (const node of testAllocated) {
    if (!visited.has(node)) {
      // Would disconnect the graph
      return tree;
    }
  }
  
  // Safe to deallocate
  const newAllocated = new Set(tree.allocated);
  newAllocated.delete(nodeId);
  
  return {
    allocated: newAllocated,
    totalPoints: tree.totalPoints - 1
  };
}

export function getVisibleNodes(tree) {
  // Build set of visible node IDs (allocated + neighbors)
  const visibleIds = new Set(tree.allocated);
  
  // Add neighbors of allocated nodes
  for (const nodeId of tree.allocated) {
    const neighbors = SKILL_GRAPH_ADJACENCY[nodeId];
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!tree.allocated.has(neighbor)) {
          visibleIds.add(neighbor);
        }
      }
    }
  }
  
  // Build visible nodes array
  const visible = [];
  for (const nodeId of visibleIds) {
    const node = SKILL_GRAPH_NODES[nodeId];
    const status = tree.allocated.has(nodeId) ? 'allocated' : 'available';
    visible.push({
      ...node,
      status
    });
  }
  
  return visible;
}

export function getVisibleEdges(tree) {
  // Build set of visible node IDs (allocated + neighbors)
  const visibleIds = new Set(tree.allocated);
  
  for (const nodeId of tree.allocated) {
    const neighbors = SKILL_GRAPH_ADJACENCY[nodeId];
    if (neighbors) {
      for (const neighbor of neighbors) {
        visibleIds.add(neighbor);
      }
    }
  }
  
  // Filter edges to only include those where both endpoints are visible
  return SKILL_GRAPH_EDGES.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b));
}

export function getSkillBonuses(tree) {
  const bonuses = {};
  
  for (const nodeId of tree.allocated) {
    const node = SKILL_GRAPH_NODES[nodeId];
    if (node && node.stat && node.value > 0) {
      bonuses[node.stat] = (bonuses[node.stat] || 0) + node.value;
    }
  }
  
  return bonuses;
}

export function getNodeInfo(nodeId) {
  return SKILL_GRAPH_NODES[nodeId] || null;
}

export function getAvailablePoints(playerLevel, floorsCleared) {
  return playerLevel + floorsCleared;
}

export function getRemainingPoints(playerLevel, floorsCleared, tree) {
  return getAvailablePoints(playerLevel, floorsCleared) - tree.totalPoints;
}

export function getTreeStats(tree) {
  const totalAllocated = tree.allocated.size;
  const regionCounts = {
    combat: 0,
    defense: 0,
    vitality: 0,
    exploration: 0,
    fortune: 0,
    arcane: 0
  };
  
  // Count all nodes in graph
  const totalNodes = Object.keys(SKILL_GRAPH_NODES).length;
  
  // Count region distribution for allocated nodes
  for (const nodeId of tree.allocated) {
    const node = SKILL_GRAPH_NODES[nodeId];
    if (node && regionCounts.hasOwnProperty(node.region)) {
      regionCounts[node.region]++;
    }
  }
  
  // Count visible nodes (allocated + available)
  let totalVisible = 0;
  for (const [nodeId] of Object.entries(SKILL_GRAPH_NODES)) {
    if (tree.allocated.has(nodeId) || canAllocate(tree, nodeId)) {
      totalVisible++;
    }
  }
  
  return {
    totalAllocated,
    totalVisible,
    totalNodes,
    regionCounts
  };
}

// Export all regions for convenience
export { REGIONS };
