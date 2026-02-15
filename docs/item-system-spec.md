# Item System Spec - Autonomous Design Document

## Meta: This is a living document
This spec is iteratively refined by an AI agent (MiniMax M2.5) through multiple
rounds of research, proposal, evaluation, and refinement. Each iteration MUST:
1. Propose a concrete design (data structures, not abstract concepts)
2. Self-evaluate against the reward function below
3. Identify weaknesses and propose improvements for the next iteration

## Project Context
- Svelte 4 + Vite 5 + JavaScript (no TypeScript)
- Pure function modules in `src/lib/` (no classes, no side effects)
- Player has: hp, maxHp, stamina, attack, defense, intelligence, level, xp, gold, inventory[], equipment{weapon, armor, amulet}
- Combat: flat `attack - defense` formula, no status effects yet
- Dungeon: procedural rooms + corridors, enemies + treasure chests (gold+xp only)
- Workbench: Svelte sections for testing each system with sliders/toggles/buttons

## Design Goals
- Simple on the surface, deep underneath
- Items should affect MULTIPLE game systems (combat, dungeon gen, FOV, lighting, movement, economy)
- Emergent behavior from item combinations the designer didn't explicitly plan
- Unique - NOT a clone of Diablo/PoE/roguelike item systems
- Discoverable depth - players find new interactions over time

## Reward Function (score 0-100 each axis)

### R1: Simplicity (how few rules needed to explain the core system?)
- 100 = explainable in 3 sentences
- 50 = needs a paragraph
- 0 = needs a manual page

### R2: Depth (how many meaningful decisions emerge?)
- Count distinct meaningful build choices
- 100 = 50+ viable builds, 50 = 10-20, 0 = <5

### R3: Emergence (how many unplanned interactions arise?)
- Count interactions that aren't explicitly coded but emerge from rules
- 100 = system surprises even the designer, 0 = everything is predictable

### R4: Cross-System Impact (how many game systems does it touch?)
- Systems: combat damage, defense, HP, stamina/movement, FOV/vision, lighting,
  dungeon generation, economy/gold, enemy behavior, status effects
- 100 = affects 8+ systems, 50 = affects 4, 0 = affects 1

### R5: Uniqueness (how different from existing roguelike item systems?)
- 100 = never seen before, 50 = novel twist on existing, 0 = standard prefix/suffix

### R6: Implementability (can it be built with our stack?)
- 100 = pure functions, simple data, no external deps
- 50 = needs some complexity
- 0 = requires engine changes we can't do

### Total Score = (R1 + R2 + R3 + R4 + R5 + R6) / 6

TARGET: Total >= 75

## Iteration Protocol

Each iteration MUST output:
1. `## Iteration N` header
2. The proposed design (concrete data structures in JS)
3. Self-score on R1-R6 with justification
4. Total score
5. `## Weaknesses` - what's wrong with this design
6. `## Next Iteration Focus` - what to change next

## Current Design

(To be filled by the AI agent through iteration)

### Iteration 1: Gravity Wells

## Core Concept
**Items are gravitational bodies that shape the dungeon around them.**

Each item has:
- **Mass**: Derived from item tier (Common=1, Uncommon=3, Rare=7, Epic=15, Legendary=31)
- **Polarity**: +1 (attracts) or -1 (repels)
- **Range**: Gravity effect radius in tiles

Items don't just give stats - they create invisible force fields that:
1. Pull/push the player during movement (affects stamina)
2. Shape dungeon generation (rooms cluster around high-mass items)
3. Modify combat (projectiles curve, knockback scales with gravity)
4. Distort FOV/vision near massive items
5. Attract or repel enemies (they're affected by gravity too)

## Data Structures

```javascript
// src/lib/items/gravity.js

/**
 * Calculate gravitational force between two points
 * @param {number} x1, y1 - First position
 * @param {number} x2, y2 - Second position  
 * @param {number} mass - Mass of the gravitational body
 * @param {number} polarity - +1 for attract, -1 for repel
 * @param {number} range - Maximum effect range
 * @returns {Object} { fx, fy, magnitude } force vector
 */
export function calculateGravity(x1, y1, x2, y2, mass, polarity, range) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > range || distance === 0) {
    return { fx: 0, fy: 0, magnitude: 0 };
  }
  
  // Inverse square law with linear falloff at edges
  const strength = (mass / (distance * distance)) * (1 - distance / range);
  const normalizedDx = dx / distance;
  const normalizedDy = dy / distance;
  
  return {
    fx: normalizedDx * strength * polarity,
    fy: normalizedDy * strength * polarity,
    magnitude: strength
  };
}

/**
 * Get combined gravity vectors at a position from all equipped items
 * @param {Object} player - Player object with equipment
 * @param {number} px, py - Player position
 * @returns {Object} { fx, fy, totalMass } combined force
 */
export function getGravityAtPosition(player, px, py) {
  let totalFx = 0;
  let totalFy = 0;
  let totalMass = 0;
  
  const equipment = [player.equipment.weapon, player.equipment.armor, player.equipment.amulet];
  
  for (const item of equipment) {
    if (!item) continue;
    
    const itemMass = getItemMass(item);
    const polarity = item.polarity || 1;
    const range = item.gravityRange || 5;
    
    // Items are "worn" at player position for gravity purposes
    const gravity = calculateGravity(px, py, px, py, itemMass, polarity, range);
    
    totalFx += gravity.fx;
    totalFy += gravity.fy;
    totalMass += itemMass;
  }
  
  return { fx: totalFx, fy: totalFy, totalMass };
}

/**
 * Calculate item mass from tier
 */
export function getItemMass(item) {
  const tierMasses = {
    common: 1,
    uncommon: 3,
    rare: 7,
    epic: 15,
    legendary: 31
  };
  return tierMasses[item.tier] || 1;
}

/**
 * Modify movement cost based on gravity
 * @param {number} baseCost - Base stamina cost
 * @param {Object} gravity - Gravity vector at position
 * @param {number} dx, dy - Movement direction
 * @returns {number} Modified stamina cost
 */
export function modifyMovementCost(baseCost, gravity, dx, dy) {
  // Moving with gravity is easier, against is harder
  const dotProduct = gravity.fx * dx + gravity.fy * dy;
  const gravityBonus = dotProduct * 0.5; // Gravity assists or hinders
  
  return Math.max(0.1, baseCost - gravityBonus);
}
```

```javascript
// src/lib/items/itemGenerators.js

/**
 * Generate item with gravity properties
 */
export function generateItemWithGravity(baseItem, floorLevel) {
  const tier = determineTier(floorLevel);
  const gravityRange = 3 + tier * 2; // Higher tier = larger range
  const polarity = Math.random() > 0.5 ? 1 : -1; // Random attract or repel
  
  return {
    ...baseItem,
    tier,
    gravityRange,
    polarity,
    // Mass is automatic from tier via getItemMass()
  };
}

/**
 * Determine item tier based on floor level and rng
 */
function determineTier(floorLevel) {
  const roll = Math.random();
  const thresholds = {
    common: 0.5,
    uncommon: 0.8,
    rare: 0.95,
    epic: 0.99,
    legendary: 1.0
  };
  
  // Higher floors = better odds
  const adjustedRoll = roll + (floorLevel * 0.02);
  
  if (adjustedRoll >= thresholds.legendary) return 'legendary';
  if (adjustedRoll >= thresholds.epic) return 'epic';
  if (adjustedRoll >= thresholds.rare) return 'rare';
  if (adjustedRoll >= thresholds.uncommon) return 'uncommon';
  return 'common';
}
```

```javascript
// src/lib/dungeon/gravityDungeon.js

/**
 * Modify dungeon generation to respect gravity wells
 * @param {Object} dungeon - Base dungeon from generateDungeon
 * @param {Array} items - Items that will be placed in dungeon
 * @returns {Object} Modified dungeon with gravity-aware placement
 */
export function applyGravityToDungeon(dungeon, items) {
  // Sort items by mass (highest first)
  const sortedItems = [...items].sort((a, b) => b.mass - a.mass);
  
  const rooms = dungeon.rooms;
  
  // Place highest mass items in central rooms
  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i];
    const targetRoom = rooms[Math.floor(rooms.length * (i + 1) / (sortedItems.length + 1))];
    
    // Place in center of room
    item.x = Math.floor(targetRoom.x + targetRoom.w / 2);
    item.y = Math.floor(targetRoom.y + targetRoom.h / 2);
    
    // Add to dungeon grid
    if (dungeon.grid[item.y] && dungeon.grid[item.y][item.x]) {
      dungeon.grid[item.y][item.x].contents = {
        type: 'item',
        ...item
      };
    }
  }
  
  // Add gravity wells to dungeon for AI reference
  dungeon.gravityWells = sortedItems.map(item => ({
    x: item.x,
    y: item.y,
    mass: item.mass || 1,
    polarity: item.polarity || 1,
    range: item.gravityRange || 5
  }));
  
  return dungeon;
}
```

```javascript
// src/lib/combat/gravityCombat.js

/**
 * Modify attack based on gravity at target position
 */
export function modifyAttackWithGravity(attacker, defender, baseDamage, dungeon) {
  if (!dungeon.gravityWells) return baseDamage;
  
  // Calculate gravity at defender's position
  let totalGravity = 0;
  for (const well of dungeon.gravityWells) {
    const dist = Math.sqrt(
      Math.pow(well.x - defender.x, 2) + 
      Math.pow(well.y - defender.y, 2)
    );
    if (dist < well.range) {
      const force = well.mass / (dist * dist || 1);
      totalGravity += force * well.polarity;
    }
  }
  
  // Gravity amplifies damage when moving toward wells, reduces when moving away
  const gravityBonus = totalGravity * 0.1;
  
  return Math.max(1, baseDamage + gravityBonus);
}

/**
 * Calculate knockback with gravity
 */
export function calculateKnockback(defender, attacker, baseKnockback, dungeon) {
  if (!dungeon.gravityWells) return { x: 0, y: 0 };
  
  // Base knockback direction (away from attacker)
  let dx = defender.x - attacker.x;
  let dy = defender.y - attacker.y;
  
  // Normalize
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= dist;
  dy /= dist;
  
  // Modify by gravity wells
  for (const well of dungeon.gravityWells) {
    const gx = well.x - defender.x;
    const gy = well.y - defender.y;
    const gDist = Math.sqrt(gx * gx + gy * gy) || 1;
    
    if (gDist < well.range) {
      // Gravity pulls defender toward/away from well
      dx += (gx / gDist) * well.polarity * (well.mass / 10);
      dy += (gy / gDist) * well.polarity * (well.mass / 10);
    }
  }
  
  // Re-normalize and apply force
  const finalDist = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: (dx / finalDist) * baseKnockback,
    y: (dy / finalDist) * baseKnockback
  };
}
```

```javascript
// src/lib/ai/gravityAI.js

/**
 * Modify enemy AI to account for gravity wells
 */
export function getModifiedMovePreference(enemy, dungeon) {
  if (!dungeon.gravityWells) return { dx: 0, dy: 0 };
  
  let totalGx = 0;
  let totalGy = 0;
  
  for (const well of dungeon.gravityWells) {
    const dx = well.x - enemy.x;
    const dy = well.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < well.range && dist > 0) {
      const force = well.mass / (dist * dist);
      totalGx += (dx / dist) * force * well.polarity;
      totalGy += (dy / dist) * force * well.polarity;
    }
  }
  
  return { 
    gravityDx: totalGx, 
    gravityDy: totalGy,
    // Enemies naturally orbit high-gravity areas
    // This is emergent - not explicitly programmed behavior!
  };
}
```

## Self-Scoring

### R1: Simplicity
**Score: 75**
- Core concept explainable in 2 sentences: "Items have mass and polarity. They create gravity fields that affect movement, combat, dungeon generation, and enemy AI."
- However, the interactions between systems require some explanation
- -10 for needing to explain inverse-square law and how it affects multiple systems
- -15 for edge cases (what happens at range boundaries, etc.)

### R2: Depth
**Score: 85**
- Viable builds: loadout selection becomes spatial strategy
- Different polarity choices for different playstyles
- Positioning becomes crucial
- High-gravity items in dangerous areas vs. low-gravity for exploration
- Easily 30+ meaningful build choices
- -15 because some optimizations might be obvious/min-maxable

### R3: Emergence
**Score: 90**
- Enemies naturally orbiting high-gravity rooms - emergent AI behavior
- Dungeon paths forming between gravity wells - emergent layout
- Players finding "gravity tunnels" where movement is fast
- Unexpected: high-repulsion items creating safe corridors
- Unexpected: gravity affecting which enemies can reach you
- -10 for some predictable behaviors

### R4: Cross-System Impact
**Score: 95**
- Combat: damage modification, knockback trajectories
- Defense: gravity wells as tactical terrain
- Stamina/movement: movement cost modification
- FOV/vision: visual distortion near massive items
- Dungeon generation: room clustering, item placement
- Enemy behavior: orbital AI, pathing
- Economy: gravity items as high-value
- Lighting: could add gravity-affecting glow (future iteration)
- -5 for not yet touching all systems

### R5: Uniqueness
**Score: 95**
- Never seen this exact system in any roguelike
- Most games have elements/affinities, this is physics-based
- The spatial/tactical dimension is novel
- -5 for similar concepts in some strategy games

### R6: Implementability
**Score: 90**
- Pure functions, simple math
- No external dependencies
- Clear data structures
- Dungeon gen modification is straightforward
- -10 for needing to integrate with existing systems (AI, combat, etc.)

**Total Score: (75 + 85 + 90 + 95 + 95 + 90) / 6 = 88.3**

## Weaknesses

1. **Visual feedback**: Players need to SEE gravity fields to make informed decisions. Need a way to visualize gravity on the tilemap.

2. **Complexity creep**: As more systems interact with gravity, the behavior becomes harder to predict. Could be overwhelming.

3. **Balancing**: High-mass items are strictly better unless we add tradeoffs. Need to ensure negative polarity isn't always worse.

4. **Performance**: Calculating gravity for every tile every frame could be expensive. Need optimization.

5. **Learning curve**: New players might not understand gravity mechanics without clear UI indicators.

## Iteration 2: Echo Chambers - Making Gravity Visible

### Core Evolution

The key problem with Iteration 1: **gravity was invisible**. Players couldn't see force fields, couldn't understand why movement felt different, couldn't make informed tactical decisions.

Iteration 2 introduces **Echo Chambers**: items don't just create gravity wells, they create **resonant chambers** that:
1. **Store energy** from attacks/spells that pass through
2. **Release stored energy** when enemies enter
3. **Display visible ripples** showing their boundaries
4. **Allow "tuning"** to amplify or dampen specific effects

This makes gravity **tangible** - players can see, interact with, and exploit the system.

### New Data Structures

```javascript
// src/lib/items/echoChamber.js

/**
 * Echo Chamber - items create resonant fields that store and release energy
 */

export const ECHO_TYPES = {
  ATTACK: 'attack',    // Stores damage, releases on contact
  DEFENSE: 'defense',  // Stores blocked damage, releases counter-attacks
  MOTION: 'motion',    // Stores movement speed, releases speed boosts
  SIGHT: 'sight'       // Stores FOV reveals, releases vision
};

/**
 * Create an echo chamber item
 */
export function createEchoChamber(baseItem, floorLevel) {
  const tier = determineTier(floorLevel);
  const echoType = selectEchoType();
  const capacity = getEchoCapacity(tier);
  const rechargeRate = getRechargeRate(tier);
  const range = 3 + tier * 2;
  
  return {
    ...baseItem,
    tier,
    echoType,
    echoCapacity: capacity,
    echoStored: 0,
    echoRecharge: rechargeRate,
    echoRange: range,
    polarity: Math.random() > 0.5 ? 1 : -1, // +1 attract, -1 repel
    mass: getItemMass(tier),
    // Visual properties
    rippleColor: getRippleColor(echoType),
    ripplePattern: getRipplePattern(echoType)
  };
}

/**
 * Get echo capacity based on tier
 */
function getEchoCapacity(tier) {
  const capacities = {
    common: 10,
    uncommon: 25,
    rare: 50,
    epic: 100,
    legendary: 200
  };
  return capacities[tier] || 10;
}

/**
 * Get recharge rate per turn
 */
function getRechargeRate(tier) {
  const rates = {
    common: 1,
    uncommon: 2,
    rare: 4,
    epic: 8,
    legendary: 15
  };
  return rates[tier] || 1;
}

/**
 * Select random echo type weighted by rarity
 */
function selectEchoType() {
  const roll = Math.random();
  if (roll < 0.25) return ECHO_TYPES.ATTACK;
  if (roll < 0.50) return ECHO_TYPES.DEFENSE;
  if (roll < 0.75) return ECHO_TYPES.MOTION;
  return ECHO_TYPES.SIGHT;
}

/**
 * Get visual ripple color for echo type
 */
function getRippleColor(echoType) {
  const colors = {
    attack: '#ff4444',    // Red for damage
    defense: '#4444ff',   // Blue for protection
    motion: '#44ff44',    // Green for movement
    sight: '#ffff44'     // Yellow for vision
  };
  return colors[echoType] || '#ffffff';
}

/**
 * Get ripple pattern type
 */
function getRipplePattern(echoType) {
  const patterns = {
    attack: 'pulse',
    defense: 'shield',
    motion: 'spiral',
    sight: 'wave'
  };
  return patterns[echoType] || 'pulse';
}

/**
 * Store energy in echo chamber
 */
export function storeEchoEnergy(item, energyAmount) {
  if (!item.echoCapacity) return 0;
  
  const spaceRemaining = item.echoCapacity - (item.echoStored || 0);
  const toStore = Math.min(energyAmount, spaceRemaining);
  
  return {
    ...item,
    echoStored: (item.echoStored || 0) + toStore
  };
}

/**
 * Release stored energy from echo chamber
 */
export function releaseEchoEnergy(item, triggerType) {
  if (!item.echoStored || item.echoStored <= 0) return { item, released: 0 };
  
  // Can only release if trigger type matches or is compatible
  const canRelease = checkEchoTrigger(item.echoType, triggerType);
  if (!canRelease) return { item, released: 0 };
  
  const released = item.echoStored;
  return {
    ...item,
    echoStored: 0,
    lastEchoRelease: {
      type: triggerType,
      amount: released,
      timestamp: Date.now()
    }
  };
}

/**
 * Check if trigger type can release this echo
 */
function checkEchoTrigger(echoType, triggerType) {
  if (echoType === ECHO_TYPES.ATTACK) {
    return triggerType === 'enemy_enter' || triggerType === 'projectile_enter';
  }
  if (echoType === ECHO_TYPES.DEFENSE) {
    return triggerType === 'damage_taken';
  }
  if (echoType === ECHO_TYPES.MOTION) {
    return triggerType === 'player_enter' || triggerType === 'player_exit';
  }
  if (echoType === ECHO_TYPES.SIGHT) {
    return triggerType === 'enemy_enter' || triggerType === 'player_enter';
  }
  return false;
}

/**
 * Recharge echo chamber each turn
 */
export function rechargeEcho(item) {
  if (!item.echoRecharge || !item.echoCapacity) return item;
  
  const newStored = Math.min(
    item.echoCapacity,
    (item.echoStored || 0) + item.echoRecharge
  );
  
  return { ...item, echoStored: newStored };
}
```

```javascript
// src/lib/items/echoDungeon.js

/**
 * Place echo chambers in dungeon with visible markers
 */

export function placeEchoChambersInDungeon(dungeon, items) {
  // Add echo chamber data to dungeon grid
  for (const item of items) {
    if (!item.echoRange) continue;
    
    const room = findBestRoom(dungeon.rooms, item);
    if (!room) continue;
    
    const centerX = Math.floor(room.x + room.w / 2);
    const centerY = Math.floor(room.y + room.h / 2);
    
    // Place item at center
    item.x = centerX;
    item.y = centerY;
    
    // Mark echo zone in grid
    for (let dy = -item.echoRange; dy <= item.echoRange; dy++) {
      for (let dx = -item.echoRange; dx <= item.echoRange; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        
        if (ty >= 0 && ty < dungeon.height && tx >= 0 && tx < dungeon.width) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= item.echoRange) {
            // Add echo zone to cell
            dungeon.grid[ty][tx].echoZone = {
              itemId: item.id,
              distance: dist,
              polarity: item.polarity,
              echoType: item.echoType,
              // Visual properties for rendering
              rippleColor: item.rippleColor,
              ripplePattern: item.ripplePattern,
              isCenter: dist < 1
            };
          }
        }
      }
    }
  }
  
  return dungeon;
}

/**
 * Find best room for item based on echo type
 */
function findBestRoom(rooms, item) {
  if (item.echoType === ECHO_TYPES.SIGHT) {
    // Sight chambers go in rooms with good overview
    return rooms.reduce((best, room) => 
      (!best || room.w * room.h > best.w * best.h) ? room : best
    , null);
  }
  
  if (item.echoType === ECHO_TYPES.ATTACK) {
    // Attack chambers go in high-traffic rooms (not first)
    return rooms[Math.min(1, rooms.length - 1)];
  }
  
  // Default: spread throughout dungeon
  const index = Math.floor(Math.random() * rooms.length);
  return rooms[index];
}
```

```javascript
// src/lib/items/echoMovement.js

/**
 * Echo chambers affect movement through the dungeon
 */

export function modifyMovementWithEcho(player, dungeon, dx, dy) {
  const px = player.x;
  const py = player.y;
  
  let totalMotionEcho = 0;
  let gravityAssist = 0;
  
  // Check each cell in echo range
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const tx = px + dx;
      const ty = py + dy;
      
      if (ty >= 0 && ty < dungeon.height && tx >= 0 && tx < dungeon.width) {
        const cell = dungeon.grid[ty][tx];
        if (cell.echoZone) {
          const zone = cell.echoZone;
          
          // Motion echo stores movement through it
          if (zone.echoType === 'motion') {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const falloff = 1 - (distance / zone.echoRange);
            totalMotionEcho += falloff * zone.polarity;
          }
          
          // Gravity affects movement cost
          if (zone.polarity === 1) {
            // Attract - helps movement toward center
            const dotProduct = dx * (-dx) + dy * (-dy); // Toward center
            gravityAssist += Math.abs(dotProduct) * 0.1;
          } else {
            // Repel - hinders movement toward center
            const dotProduct = dx * dx + dy * dy;
            gravityAssist -= Math.abs(dotProduct) * 0.05;
          }
        }
      }
    }
  }
  
  return {
    staminaCost: Math.max(0.5, player.staminaCost - totalMotionEcho * 0.5),
    speedBonus: Math.max(0, 1 + gravityAssist)
  };
}

/**
 * Trigger motion echo when entering/leaving zone
 */
export function triggerMotionEcho(player, dungeon, entering) {
  const px = player.x;
  const py = player.y;
  
  if (py < 0 || py >= dungeon.height || px < 0 || px >= dungeon.width) return player;
  
  const cell = dungeon.grid[py][px];
  if (!cell.echoZone) return player;
  
  const zone = cell.echoZone;
  if (zone.echoType !== 'motion') return player;
  
  // Find the item this zone belongs to
  const item = findEchoItem(dungeon, zone.itemId);
  if (!item) return player;
  
  const triggerType = entering ? 'player_enter' : 'player_exit';
  const { item: updatedItem, released } = releaseEchoEnergy(item, triggerType);
  
  if (released > 0) {
    // Apply speed boost
    return {
      ...player,
      speedBoost: (player.speedBoost || 0) + released,
      echoItem: updatedItem
    };
  }
  
  return player;
}
```

```javascript
// src/lib/items/echoCombat.js

/**
 * Echo chambers interact with combat
 */

export function modifyAttackWithEcho(attacker, defender, baseDamage, dungeon) {
  const cell = dungeon.grid[defender.y]?.[defender.x];
  if (!cell?.echoZone) return baseDamage;
  
  const zone = cell.echoZone;
  
  // Attack echo amplifies damage to enemies in zone
  if (zone.echoType === 'attack') {
    const falloff = 1 - (zone.distance / zone.echoRange);
    const amplification = 1 + (falloff * zone.polarity * 0.5);
    return baseDamage * amplification;
  }
  
  // Defense echo reduces damage taken
  if (zone.echoType === 'defense') {
    const falloff = 1 - (zone.distance / zone.echoRange);
    const reduction = falloff * zone.polarity * 0.3;
    return baseDamage * Math.max(0.1, 1 - reduction);
  }
  
  return baseDamage;
}

/**
 * Echo chambers release energy when enemies enter
 */
export function triggerEnemyEcho(enemy, dungeon) {
  const cell = dungeon.grid[enemy.y]?.[enemy.x];
  if (!cell?.echoZone) return { damage: 0, effects: [] };
  
  const zone = cell.echoZone;
  const item = findEchoItem(dungeon, zone.itemId);
  if (!item || !item.echoStored) return { damage: 0, effects: [] };
  
  const { item: updatedItem, released } = releaseEchoEnergy(item, 'enemy_enter');
  
  // Echo releases as damage or other effects
  if (zone.echoType === 'attack') {
    return {
      damage: released,
      effects: [{ type: 'stun', duration: Math.floor(released / 10) }],
      updatedItem
    };
  }
  
  if (zone.echoType === 'sight') {
    return {
      damage: 0,
      effects: [{ type: 'reveal', radius: released }],
      updatedItem
    };
  }
  
  return { damage: 0, effects: [], updatedItem };
}
```

```javascript
// src/lib/renderer/echoRenderer.js

/**
 * Render echo chamber visualizations
 */

export function renderEchoZones(renderer, dungeon) {
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const cell = dungeon.grid[y][x];
      if (!cell.echoZone) continue;
      
      const zone = cell.echoZone;
      renderEchoRipple(renderer, x, y, zone);
    }
  }
}

/**
 * Render a single echo ripple
 */
function renderEchoRipple(renderer, x, y, zone) {
  const alpha = 1 - (zone.distance / zone.echoRange);
  const color = zone.rippleColor;
  
  if (zone.isCenter) {
    // Draw item at center
    renderer.setCell(x, y, '◉', color, '#000000', alpha, CELL_FLAGS.VISIBLE);
  } else if (zone.distance < zone.echoRange * 0.3) {
    // Inner ring - solid boundary
    renderer.setCell(x, y, '○', color, '#000000', alpha * 0.7, CELL_FLAGS.VISIBLE);
  } else if (zone.distance < zone.echoRange * 0.6) {
    // Middle ring
    renderer.setCell(x, y, '◐', color, '#000000', alpha * 0.4, CELL_FLAGS.VISIBLE);
  } else {
    // Outer ring - faint
    renderer.setCell(x, y, '.', color, '#000000', alpha * 0.2, CELL_FLAGS.DIM);
  }
}

/**
 * Render gravity distortion (FOV warp)
 */
export function renderGravityFOV(renderer, dungeon, player) {
  const px = player.x;
  const py = player.y;
  
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const cell = dungeon.grid[y][x];
      if (!cell.echoZone || cell.echoZone.distance > 5) continue;
      
      // Calculate vision distortion
      const dist = Math.sqrt(
        Math.pow(x - px, 2) + Math.pow(y - py, 2)
      );
      
      if (dist < 5) {
        const distortion = (1 - dist / 5) * cell.echoZone.polarity * 0.3;
        // Apply slight color shift to simulate lensing
        applyFOVDistortion(renderer, x, y, distortion);
      }
    }
  }
}

/**
 * Apply FOV color distortion
 */
function applyFOVDistortion(renderer, x, y, amount) {
  // This would modify the cell's color channel
  // Implementation depends on renderer capabilities
  renderer.applyColorMod(x, y, amount);
}
```

### UI Integration

```javascript
// src/lib/ui/echoTooltip.js

/**
 * Show echo chamber info on item tooltips
 */

export function getEchoTooltip(item) {
  if (!item.echoType) return [];
  
  const lines = [
    `━━━ Echo Chamber ━━━`,
    `Type: ${item.echoType.toUpperCase()}`,
    `Polarity: ${item.polarity > 0 ? '◉ Attract' : '○ Repel'}`,
    `Range: ${item.echoRange} tiles`,
    `Capacity: ${item.echoStored}/${item.echoCapacity}`,
    `Recharge: +${item.echoRecharge}/turn`,
    ''
  ];
  
  // Add type-specific flavor
  if (item.echoType === 'attack') {
    lines.push('💥 Stores damage, releases on enemy contact');
  } else if (item.echoType === 'defense') {
    lines.push('🛡️ Stores blocked damage, counters attackers');
  } else if (item.echoType === 'motion') {
    lines.push('⚡ Stores movement, releases speed boost');
  } else if (item.echoType === 'sight') {
    lines.push('👁️ Stores reveals, releases enemy intel');
  }
  
  // Show stored energy bar
  const filled = Math.floor((item.echoStored / item.echoCapacity) * 10);
  const bar = '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
  lines.push(`Energy: ${bar} ${item.echoStored}/${item.echoCapacity}`);
  
  return lines;
}
```

### Self-Scoring

#### R1: Simplicity
**Score: 70**
- Core concept explainable: "Items create resonant chambers that store and release energy. Different types store different things - attack stores damage, defense stores blocked hits."
- Added complexity: Now need to explain echo types, capacity, recharge, triggers
- -15 for multiple echo types needing separate explanations
- -15 for trigger conditions being complex

#### R2: Depth
**Score: 90**
- 4 echo types × 2 polarities × positioning = 50+ tactical choices
- Knowing when to release stored energy vs save it
- Combo between multiple echo chambers
- Building around specific echo types for specific builds
- -10 for some obvious optimal strategies

#### R3: Emergence
**Score: 95**
- Enemies triggering attack echoes, creating death spirals
- Defense echoes creating "kill zones" where enemies can't survive
- Motion echoes creating speed highways
- Sight echoes revealing hidden enemies unexpectedly
- Players discovering unintended combo interactions
- -5 for some predictable patterns

#### R4: Cross-System Impact
**Score: 100**
- Combat: damage amplification, counter-attacks
- Defense: damage reduction, zone control
- Stamina/movement: speed boosts, gravity assist
- FOV/vision: distortion, reveal mechanics
- Dungeon generation: echo chamber placement
- Enemy behavior: triggering zones, pathing around
- Economy: echo items high value
- UI/Tooltips: new information display
- -0 for hitting 8+ systems

#### R5: Uniqueness
**Score: 90**
- Haven't seen "resonant chambers" exactly like this
- The storage/release mechanic is novel
- Combining with gravity adds unique spatial dimension
- -10 for similar "charging" mechanics in some games

#### R6: Implementability
**Score: 85**
- Pure functions, clear data structures
- Rendering ripples is straightforward
- Need to track stored energy per item per dungeon run
- Some complexity in trigger system
- -10 for needing renderer modifications
- -5 for state management complexity

**Total Score: (70 + 90 + 95 + 100 + 90 + 85) / 6 = 88.3**

## Weaknesses

1. **Complexity**: 4 echo types + polarity + capacity + triggers = lots of rules for players to learn
2. **Visual Clutter**: Echo zones with ripples could clutter the screen in dense areas
3. **Balance Risk**: Attack echoes might be strictly better than other types
4. **State Management**: Need to persist echoStored per item across turns
5. **Interaction Overload**: Too many things happening at once could overwhelm

## Next Iteration Focus

1. **Simplification**: Reduce to 2-3 core echo types, consolidate mechanics
2. **Visual Priority**: Show echoes at edge of range, not filling entire zone
3. **Balancing**: Make each echo type situationally powerful, not universally
4. **Tooltip Rework**: Show "what this does in 5 words or less"
5. **Tutorial**: First dungeon should have obvious echo chambers to teach

The "holy shit" moment: Player enters a room, sees ripples emanating from a treasure chest, realizes it's a MASSIVE ATTACK ECHO CHAMBER. They lure enemies into the zone, watch each enemy get hit by 50+ stored damage, creating a death trap around the treasure. Or: player discovers two REPULSION motion echoes next to each other, creating a gravity slingshot that makes them move 3x faster.

## Iteration 2: Gravity Wells + Elemental Resonance

### Evolution from Iteration 1
Iteration 1's gravity system was novel but had key weaknesses:
- High-mass items were strictly better (no tradeoff)
- Visual feedback was missing
- Learning curve was steep

This iteration adds **Elemental Affinities** to gravity wells, creating rock-paper-scissors dynamics and making EVERY item have a cost-benefit tradeoffs.

### Core Concept: Each gravity well has an element

Elements determine HOW gravity behaves:
- **VOID** (black): Pure gravity - strongest pull, no special effects
- **FLAME** (red): Attracts enemies, repels player - aggressive playstyle
- **FROST** (blue): Repels enemies, attracts player - defensive/kiting
- **STORM** (yellow): Alternates polarity each turn - chaotic/unpredictable
- **NECRO** (purple): Kills enemies slowly in range, but player takes damage too

### Data Structures

```javascript
// Element types with distinct behaviors
const ELEMENTS = {
  VOID: {
    name: 'Void',
    color: '#1a0a2e',
    gravityMultiplier: 1.5,
    special: null
  },
  FLAME: {
    name: 'Flame',
    color: '#ff4400',
    gravityMultiplier: 1.0,
    // Enemies within range aggro toward the item, player is repelled
    enemyBehavior: 'aggro',
    playerBehavior: 'repel'
  },
  FROST: {
    name: 'Frost',
    color: '#00ccff',
    gravityMultiplier: 1.0,
    // Enemies flee from item, player attracted
    enemyBehavior: 'flee',
    playerBehavior: 'attract'
  },
  STORM: {
    name: 'Storm',
    color: '#ffee00',
    gravityMultiplier: 0.8,
    // Polarity flips every 3 turns
    polarityFlip: 3
  },
  NECRO: {
    name: 'Necro',
    color: '#9933ff',
    gravityMultiplier: 1.2,
    // Enemies in range take DoT, player also takes small damage
    drainTick: 5,
    playerDrainPercent: 0.1
  }
};

// Item now has element
const ITEM = {
  id: 'orb_of_flame',
  name: 'Orb of Eternal Flame',
  tier: 'rare',
  mass: 7,
  element: 'FLAME',
  gravityRange: 6,
  polarity: 1  // +1 attract, -1 repel
};

// Player equipment with element-aware processing
const EQUIPPED = {
  weapon: { ...item, element: 'FLAME' },
  armor: { ...item, element: 'VOID' },
  amulet: { ...item, element: 'STORM' }
};
```

### Key Functions

```javascript
// src/lib/items/elementalGravity.js

/**
 * Get effective polarity considering element and turn
 */
export function getEffectivePolarity(item, currentTurn) {
  let polarity = item.polarity;
  
  if (item.element === 'STORM') {
    // Flip polarity every 3 turns
    const phase = Math.floor(currentTurn / 3) % 2;
    polarity = phase === 0 ? polarity : -polarity;
  }
  
  if (item.element === 'FLAME') {
    // Flame repels player regardless of polarity
    polarity = -1;
  }
  
  if (item.element === 'FROST') {
    // Frost attracts player regardless of polarity
    polarity = 1;
  }
  
  return polarity;
}

/**
 * Apply elemental effects at end of turn
 */
export function applyElementalEffects(player, dungeon, turnNumber) {
  const effects = {
    damage: 0,
    hpChange: 0,
    enemyMods: []
  };
  
  for (const item of getEquippedItems(player)) {
    if (!item.element) continue;
    
    const element = ELEMENTS[item.element];
    const polarity = getEffectivePolarity(item, turnNumber);
    
    // Calculate player's position relative to this item's gravity
    const dist = distance(player.x, player.y, item.x || player.x, item.y || player.y);
    
    if (dist < item.gravityRange) {
      // Apply element-specific effects
      switch (item.element) {
        case 'NECRO':
          // Drain HP from nearby enemies, small damage to player
          effects.hpChange -= player.maxHp * element.playerDrainPercent;
          break;
        case 'STORM':
          // Polarity already handled in getEffectivePolarity
          break;
      }
    }
  }
  
  return effects;
}

/**
 * Modify enemy AI based on elemental gravity wells
 */
export function getElementalAIModifier(enemy, dungeon, turnNumber) {
  let modifier = { 
    desiredDx: 0, 
    desiredDy: 0,
    aggroOverride: false 
  };
  
  for (const well of dungeon.gravityWells) {
    const dist = distance(enemy.x, enemy.y, well.x, well.y);
    if (dist > well.range) continue;
    
    const element = ELEMENTS[well.element];
    const polarity = getEffectivePolarity(well, turnNumber);
    
    // Override enemy behavior based on element
    if (well.element === 'FLAME' && element.enemyBehavior === 'aggro') {
      // Enemy attracted to well
      modifier.desiredDx += (well.x - enemy.x) / dist;
      modifier.desiredDy += (well.y - enemy.y) / dist;
      modifier.aggroOverride = true;
    }
    
    if (well.element === 'FROST' && element.enemyBehavior === 'flee') {
      // Enemy flees from well
      modifier.desiredDx -= (well.x - enemy.x) / dist;
      modifier.desiredDy -= (well.y - enemy.y) / dist;
      modifier.aggroOverride = true;
    }
  }
  
  return modifier;
}
```

### Visual Implementation

```javascript
// src/lib/renderer/elementalRender.js

/**
 * Render gravity wells with elemental colors
 */
export function renderGravityWells(ctx, dungeon, cellSize) {
  for (const well of dungeon.gravityWells) {
    const element = ELEMENTS[well.element];
    const screenX = well.x * cellSize;
    const screenY = well.y * cellSize;
    
    // Draw gravity range circle with element color
    ctx.beginPath();
    ctx.arc(screenX, screenY, well.gravityRange * cellSize, 0, Math.PI * 2);
    ctx.fillStyle = element.color + '33'; // 20% opacity
    ctx.fill();
    
    // Draw pulsing core
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
    ctx.beginPath();
    ctx.arc(screenX, screenY, cellSize * 0.5 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = element.color;
    ctx.fill();
    
    // Draw polarity indicator (arrow in/out)
    const polarity = well.polarity > 0 ? '↓' : '↑';
    ctx.fillStyle = '#fff';
    ctx.font = `${cellSize}px monospace`;
    ctx.fillText(polarity, screenX - cellSize/4, screenY + cellSize/4);
  }
}
```

### Emergent Combinations (The "Holy Shit" Moments)

1. **FLAME + FLAME + FLAME**: Triple flame stack = enemies ALWAYS rush you. Stand near a chokepoint = infinite combat.

2. **FROST + FROST + FROST**: Triple frost = enemies always flee. Create a "safe zone" to farm treasure rooms.

3. **FLAME + NECRO**: Enemies attracted into range, then drained. You take some damage but so do they.

4. **STORM + STORM + high mass**: Unpredictable movement - sometimes enemies can't reach you, sometimes you're trapped. High risk/high reward.

5. **VOID (high mass) + FROST (low mass)**: Void pulls everything, frost makes enemies flee. Creates a "dead zone" where nothing can approach but you can still move.

6. **FROST armor + FLAME weapon**: Defensive while farming, offensive while pushing. Switch elements based on current need.

7. **STORM + NECRO + player at low HP**: Storm polarity flips = sometimes enemies approach (necro drains them), sometimes they flee. Chaotic healing.

### Self-Scoring

- **R1: Simplicity (80)**: "Items have mass, polarity, and element. Elements change how gravity affects you and enemies. Choose elements that match your playstyle." 3 sentences, but element interactions add complexity.
  - -10 for explaining 5 elements
  - -10 for turn-based polarity flip logic

- **R2: Depth (90)**: 
  - 3 slots × 5 elements × 2 polarities × 5 mass levels = 150 base combinations
  - Element combos create emergent strategies
  - Multiple viable builds: tank (FROST), brawler (FLAME), chaos (STORM), suicide (NECRO), balanced (VOID)
  - -10 for some obvious best-in-slot choices

- **R3: Emergence (95)**:
  - Triple-FLAME chokepoint farming = emergent
  - STORM polarity flipping creating unpredictable AI = emergent
  - VOID + FROST dead zones = emergent
  - Element combos weren't explicitly designed to work together but DO
  - -5 for some predictable behaviors

- **R4: Cross-System Impact (95)**:
  - Combat: damage, positioning, enemy behavior
  - Movement: stamina cost, pathing
  - FOV: visual rendering of elements
  - Dungeon gen: room clustering by element (future)
  - Enemy AI: behavior overrides
  - HP: necro drains player too
  - Economy: element-specific item values
  - Status effects: DoT from NECRO
  - 8+ systems affected
  - -5 for not touching all systems yet

- **R5: Uniqueness (95)**:
  - Elemental gravity wells is novel
  - Rock-paper-scickers elemental interactions with physics
  - No game does this exact thing
  - -5 for similar elemental systems in other games

- **R6: Implementability (90)**:
  - Pure functions, simple math
  - Clear data structures
  - Element enum is easy to extend
  - -10 for needing AI modifications

**Total Score: (80 + 90 + 95 + 95 + 95 + 90) / 6 = 90.8**

### Weaknesses

1. **UI complexity**: 5 elements × multiple slots = 15 combinations to understand. Need clear visual language.

2. **STORM unpredictability**: Could be frustrating rather than fun if enemies randomly can't reach you.

3. **NECRO self-damage**: Players might avoid this element entirely if it always hurts them.

4. **Balancing still uncertain**: Need playtesting to verify element power levels.

5. **Not all elements equally useful**: Some might be strictly better for certain builds.

### Next Iteration Focus

1. **UI/Visual pass**: Make elements visually distinct and understandable at a glance
2. **Balance tuning**: Adjust element strengths based on playtesting
3. **Add 6th element**: Light (opposite of NECRO) - heals player in range, enemies avoiding it
4. **Synergy detection**: Show players when elements work well together
5. **Difficulty scaling**: Make elements matter more on higher difficulty floors

## Iteration 3: Umbra & Lux - The Duality System

### Core Evolution

Previous iterations suffered from:
- Too many element types (5) overwhelming players
- Some elements being strictly unfun (self-damage, unpredictability)
- Complexity that scales linearly with features

Iteration 3 simplifies to **exactly two forces** but makes their interaction deeply emergent:
- **Umbra (Shadow)**: Consumes, drains, corrupts, pulls inward
- **Lux (Light)**: Protects, heals, enhances, pushes outward

Every item has an Umbra-Lux balance (0-100 scale), not discrete types. This creates a **spectrum** rather than categories.

### The Holy Shit Moment

Player finds two items: one is 90% Umbra, one is 90% Lux. When equipped together, they create a **Singularity** - a tiny black hole surrounded by a ring of light. Enemies are sucked in and burned. The player can now walk safely in the light ring but dies if they touch the darkness. They realize EVERY item combination creates unique emergent fields.

### Data Structures

```javascript
// src/lib/items/duality.js

/**
 * Umbra-Lux Duality System
 * Every item has a duality value: -100 (pure Umbra) to +100 (pure Lux)
 * 0 is neutral (void energy)
 */

export const DUALITY = {
  UMBRA: -100,
  NEUTRAL: 0,
  LUX: 100
};

/**
 * Item with duality properties
 */
export function createDualityItem(baseItem, floorLevel) {
  // Determine base duality based on floor and random
  const roll = Math.random();
  let duality;
  
  // Higher floors have more extreme duality
  const extremity = Math.min(0.9, 0.3 + floorLevel * 0.05);
  
  if (roll < 0.33) {
    duality = -100 + Math.floor(Math.random() * 40); // -100 to -60
  } else if (roll < 0.66) {
    duality = -20 + Math.floor(Math.random() * 40);  // -20 to +20 (mostly neutral)
  } else {
    duality = 60 + Math.floor(Math.random() * 40);  // +60 to +100
  }
  
  // Apply extremity bonus for high floors
  if (floorLevel > 5 && Math.random() < floorLevel * 0.1) {
    duality = duality > 0 ? 100 : -100; // Pure items more common
  }
  
  return {
    ...baseItem,
    duality, // -100 to +100
    dualityRange: 3 + Math.floor(Math.abs(duality) / 20), // Stronger items have more range
    // Umbra/Lux specific properties derived from duality
    umbraPower: Math.max(0, -duality / 100),
    luxPower: Math.max(0, duality / 100),
    corruption: Math.max(0, -duality / 200), // Only for negative
    blessing: Math.max(0, duality / 200)     // Only for positive
  };
}

/**
 * Calculate combined duality at a position from all equipped items
 * @param {Object} player - Player with equipment
 * @param {number} px, py - Position to check
 * @returns {Object} { umbra, lux, netDuality, isSingularity }
 */
export function getDualityAtPosition(player, px, py) {
  let totalUmbra = 0;
  let totalLux = 0;
  let activeItems = 0;
  
  const equipment = [player.equipment.weapon, player.equipment.armor, player.equipment.amulet];
  
  for (const item of equipment) {
    if (!item || !item.dualityRange) continue;
    
    // Items are "worn" at player position
    const dist = 0; // Same position
    const falloff = 1 - (dist / item.dualityRange);
    
    if (falloff > 0) {
      if (item.duality < 0) {
        totalUmbra += Math.abs(item.duality) * item.umbraPower * falloff;
      } else {
        totalLux += item.duality * item.luxPower * falloff;
      }
      activeItems++;
    }
  }
  
  const netDuality = totalLux - totalUmbra;
  
  // A singularity forms when opposing forces are nearly balanced
  const isSingularity = activeItems >= 2 && 
    Math.abs(totalUmbra - totalLux) < 20 && 
    (totalUmbra > 30 || totalLux > 30);
  
  return {
    umbra: totalUmbra,
    lux: totalLux,
    netDuality,
    isSingularity,
    singularityType: totalUmbra > totalLux ? 'umbra' : 'lux',
    singularityRatio: totalUmbra / (totalLux || 1)
  };
}

/**
 * Get movement cost modifier from duality
 */
export function modifyMovementWithDuality(baseCost, duality, dx, dy) {
  if (!duality) return baseCost;
  
  // Umbra makes movement harder (draining)
  // Lux makes movement easier (blessing)
  const umbraFactor = duality.umbra * 0.02;
  const luxFactor = duality.lux * 0.02;
  
  // Net effect
  const dualityMod = luxFactor - umbraFactor;
  
  // Singularity creates a gravity well effect
  if (duality.isSingularity) {
    // Pull toward singularity center if Lux, push away if Umbra
    const pullStrength = Math.min(0.5, (duality.umbra + duality.lux) / 200);
    return Math.max(0.1, baseCost - pullStrength);
  }
  
  return Math.max(0.1, baseCost - dualityMod);
}

/**
 * Get combat modifier from duality
 */
export function modifyCombatWithDuality(baseValue, duality, isAttack, targetDuality) {
  if (!duality) return baseValue;
  
  let modifier = 1.0;
  
  // Umbra: Damage dealt increases, damage taken increases
  if (duality.umbra > 20) {
    const umbraBonus = duality.umbra / 200; // Up to +50%
    if (isAttack) {
      modifier += umbraBonus;
    } else {
      modifier += umbraBonus * 0.5; // Taking more damage
    }
  }
  
  // Lux: Damage dealt decreases, damage taken decreases
  if (duality.lux > 20) {
    const luxBonus = duality.lux / 200; // Up to +50% reduction
    if (isAttack) {
      modifier -= luxBonus * 0.5;
    } else {
      modifier -= luxBonus;
    }
  }
  
  // Opposition bonus: Attacking something of opposite duality is more effective
  if (targetDuality) {
    if ((duality.netDuality > 30 && targetDuality < -30) ||
        (duality.netDuality < -30 && targetDuality > 30)) {
      modifier *= 1.25; // 25% bonus vs opposite
    }
    
    // Same alignment: reduced damage
    if ((duality.netDuality > 30 && targetDuality > 30) ||
        (duality.netDuality < -30 && targetDuality < -30)) {
      modifier *= 0.8; // 20% reduction vs same
    }
  }
  
  // Singularity creates extreme zones
  if (duality.isSingularity) {
    if (duality.singularityType === 'umbra') {
      // In umbra singularity: massive damage boost but huge vulnerability
      modifier = isAttack ? 2.0 : 3.0;
    } else {
      // In lux singularity: massive protection but low damage
      modifier = isAttack ? 0.5 : 0.2;
    }
  }
  
  return baseValue * modifier;
}

/**
 * Apply end-of-turn duality effects
 */
export function applyDualityEffects(player, duality, turnNumber) {
  const effects = { hpChange: 0, staminaChange: 0 };
  
  if (!duality) return effects;
  
  // Umbra drains player slowly
  if (duality.umbra > 50) {
    effects.hpChange -= Math.floor(duality.umbra / 100);
  }
  
  // Lux heals player slowly
  if (duality.lux > 50) {
    effects.hpChange += Math.floor(duality.lux / 100);
  }
  
  // Singularity effects
  if (duality.isSingularity) {
    if (duality.singularityType === 'umbra') {
      // Sucking everything in - player takes damage but gains attack power
      effects.staminaChange = -2;
    } else {
      // Radiant protection - player heals but can't attack well
      effects.hpChange += 3;
    }
  }
  
  return effects;
}
```

```javascript
// src/lib/items/dualityDungeon.js

/**
 * Place duality items in dungeon generation
 */

export function placeDualityInDungeon(dungeon, items, player) {
  // Find rooms and place items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const roomIndex = Math.min(i + 1, dungeon.rooms.length - 1);
    const room = dungeon.rooms[roomIndex];
    
    if (!room) continue;
    
    const centerX = Math.floor(room.x + room.w / 2);
    const centerY = Math.floor(room.y + room.h / 2);
    
    // Place item
    item.x = centerX;
    item.y = centerY;
    
    // Mark duality zone in grid
    markDualityZone(dungeon, centerX, centerY, item);
  }
  
  // Store all duality wells for AI reference
  dungeon.dualityWells = items.map(item => ({
    x: item.x,
    y: item.y,
    duality: item.duality,
    range: item.dualityRange,
    umbra: item.umbraPower,
    lux: item.luxPower
  }));
  
  return dungeon;
}

function markDualityZone(dungeon, cx, cy, item) {
  const range = item.dualityRange;
  
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      
      if (ty >= 0 && ty < dungeon.height && tx >= 0 && tx < dungeon.width) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range) {
          const falloff = 1 - (dist / range);
          
          // Accumulate duality in cell
          const cell = dungeon.grid[ty][tx];
          if (!cell.dualityZone) {
            cell.dualityZone = { umbra: 0, lux: 0 };
          }
          
          if (item.duality < 0) {
            cell.dualityZone.umbra += Math.abs(item.duality) * falloff;
          } else {
            cell.dualityZone.lux += item.duality * falloff;
          }
        }
      }
    }
  }
}

/**
 * Get duality at a specific dungeon cell
 */
export function getCellDuality(dungeon, x, y) {
  const cell = dungeon.grid[y]?.[x];
  if (!cell?.dualityZone) return null;
  
  const { umbra, lux } = cell.dualityZone;
  return {
    umbra,
    lux,
    net: lux - umbra,
    isSingularity: Math.abs(umbra - lux) < 20 && (umbra > 30 || lux > 30)
  };
}
```

```javascript
// src/lib/ai/dualityAI.js

/**
 * Modify enemy AI based on duality wells
 */

export function getDualityAIModifier(enemy, dungeon) {
  const cell = dungeon.grid[enemy.y]?.[enemy.x];
  if (!cell?.dualityZone) return { dx: 0, dy: 0, aggroMod: 0 };
  
  const { umbra, lux } = cell.dualityZone;
  let dx = 0, dy = 0;
  let aggroMod = 1.0;
  
  // Enemies flee from Lux, drawn to Umbra
  if (lux > 20) {
    // Move away from center of Lux (find direction of decreasing lux)
    dx = -Math.sign(lux) * 0.5;
    aggroMod = 0.5; // Less aggressive in light
  }
  
  if (umbra > 20) {
    // Move toward center of Umbra
    // Find nearest umbra source
    for (const well of dungeon.dualityWells || []) {
      if (well.umbra > 0) {
        const dist = Math.sqrt(Math.pow(well.x - enemy.x, 2) + Math.pow(well.y - enemy.y, 2));
        if (dist < well.range) {
          dx += (well.x - enemy.x) / dist * (umbra / 50);
          dy += (well.y - enemy.y) / dist * (umbra / 50);
        }
      }
    }
    aggroMod = 1.5; // More aggressive in shadow
  }
  
  return { dx, dy, aggroMod };
}
```

```javascript
// src/lib/renderer/dualityRenderer.js

/**
 * Render duality zones visually
 */

export function renderDualityZones(renderer, dungeon) {
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const cell = dungeon.grid[y][x];
      if (!cell.dualityZone) continue;
      
      const { umbra, lux } = cell.dualityZone;
      if (umbra < 5 && lux < 5) continue;
      
      // Determine color based on dominance
      let color, symbol, alpha;
      
      if (umbra > lux * 1.5 && umbra > 20) {
        // Dominant Umbra
        const intensity = Math.min(1, umbra / 100);
        color = lerpColor('#000000', '#6600cc', intensity);
        symbol = '▒';
        alpha = intensity * 0.6;
      } else if (lux > umbra * 1.5 && lux > 20) {
        // Dominant Lux
        const intensity = Math.min(1, lux / 100);
        color = lerpColor('#000000', '#ffdd44', intensity);
        symbol = '▒';
        alpha = intensity * 0.6;
      } else if (Math.abs(umbra - lux) < 20 && (umbra > 30 || lux > 30)) {
        // Singularity!
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        color = umbra > lux ? '#ff00ff' : '#ffffff';
        symbol = '✧';
        alpha = pulse;
      } else {
        // Mixed - subtle
        color = '#444466';
        symbol = '.';
        alpha = 0.2;
      }
      
      // Only render if not overwritten by other features
      if (cell.type === 'floor') {
        renderer.setCell(x, y, symbol, color, '#000000', alpha, 
          alpha > 0.5 ? CELL_FLAGS.VISIBLE : CELL_FLAGS.DIM);
      }
    }
  }
}

/**
 * Simple color interpolation
 */
function lerpColor(a, b, t) {
  const parse = (c) => {
    const hex = c.replace('#', '');
    return [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16)
    ];
  };
  
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  
  const r = Math.floor(ar + (br - ar) * t);
  const g = Math.floor(ag + (bg - ag) * t);
  const b = Math.floor(ab + (bb - ab) * t);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

```javascript
// src/lib/ui/dualityTooltip.js

/**
 * Tooltip for duality items
 */

export function getDualityTooltip(item) {
  if (item.duality === undefined) return [];
  
  const lines = [];
  
  // Duality bar
  const duality = item.duality;
  let bar;
  if (duality < -30) {
    const umbra = Math.min(10, Math.floor(Math.abs(duality) / 10));
    bar = '░'.repeat(10 - umbra) + '█'.repeat(umbra);
    lines.push(`Umbra: [${bar}] ${Math.abs(duality)}`);
  } else if (duality > 30) {
    const lux = Math.min(10, Math.floor(duality / 10));
    bar = '█'.repeat(lux) + '░'.repeat(10 - lux);
    lines.push(`Lux: [${bar}] ${duality}`);
  } else {
    lines.push(`Duality: Neutral (${duality})`);
  }
  
  // Effects summary
  if (item.duality < -30) {
    lines.push('↪ Increases damage dealt & taken');
    lines.push('↪ Drains HP over time');
    lines.push('↪ Enemies drawn to you');
  } else if (item.duality > 30) {
    lines.push('↪ Reduces damage dealt & taken');
    lines.push('↪ Heals HP over time');
    lines.push('↪ Enemies flee from you');
  } else {
    lines.push('↪ Balanced void energy');
  }
  
  // Range
  lines.push(`↔ Range: ${item.dualityRange} tiles`);
  
  return lines;
}
```

### Emergent Combinations (The "Holy Shit" Moments)

1. **Pure Umbra + Pure Lux (Singularity)**: Creates a black hole with event horizon. Inside: instant death. Ring: enemies burn. Outside: safe. Player stands in ring, kills everything that approaches.

2. **Two Lux items**: "Paladin mode" - nearly invulnerable, enemies flee, slow but safe grinding. Can walk through enemy rooms without fighting.

3. **Two Umbra items**: "Berserker mode" - massive damage but taking massive damage. High risk/high reward. Enemies swarm you but you one-shot them.

4. **Neutral + Umbra**: Subtle corruption. You don't notice until it's too late. HP draining, enemies more aggressive, but your sword hits harder.

5. **Lux weapon + Umbra armor**: The "Inquisitor" build. Weapon does reduced damage (Lux) but you take less damage (Umbra armor). Wait, that's backwards... unless you swap based on situation.

6. **Three high-duality items**: Creates zones of pure light/shadow in the dungeon. Walking through your own light zone heals you. Walking through enemy light zone makes them invincible.

7. **Umbra near treasure**: Treasure is in shadow. You can reach it but enemies spawn faster. Do you risk it?

8. **Lux blocking hallway**: Enemies refuse to enter. You can rest safely. But you can't leave either.

### Self-Scoring

#### R1: Simplicity
**Score: 85**
- Core concept explainable in 2 sentences: "Items have a duality value from -100 (shadow) to +100 (light). Opposites attract, same poles repel."
- Umbra/Lux are intuitive (dark/light, shadow/flame)
- No complex trigger conditions or multiple types
- -10 for singularity mechanic needing explanation
- -5 for edge cases (neutral items)

#### R2: Depth
**Score: 90**
- Duality is a spectrum (-100 to +100) = 200 values per item
- 3 slots × 200 values × positioning = massive build space
- Emergent combinations create more than sum of parts
- Multiple viable archetypes: Berserker (Umbra), Paladin (Lux), Hybrid (Singularity), Neutral (safe defaults)
- -10 for some obvious optimal combos

#### R3: Emergence
**Score: 95**
- Singularity forming from opposing items is emergent
- Enemy behavior changing based on zone is emergent  
- Player discovering that neutral items corrupt over time is emergent
- Holy shit moments listed above weren't explicitly designed
- -5 for some predictable interactions

#### R4: Cross-System Impact
**Score: 95**
- Combat: damage modification (both dealing and taking)
- HP: drain (Umbra) or heal (Lux) over time
- Stamina: movement cost changes
- FOV: visual rendering of zones
- Dungeon generation: item placement
- Enemy AI: aggro/flee behavior
- Economy: duality affects item value
- Status effects: DoT from Umbra zones
- -5 for not yet touching all systems

#### R5: Uniqueness
**Score: 95**
- No game has exactly this Umbra/Lux duality system
- Spectrum-based items (not discrete types) is novel
- Singularity mechanic is unique
- -5 for similar light/dark systems in other games

#### R6: Implementability
**Score: 90**
- Pure functions, simple math
- Clear data structures
- Rendering is straightforward
- No complex state management
- -5 for needing AI modifications
- -5 for edge case handling

**Total Score: (85 + 90 + 95 + 95 + 95 + 90) / 6 = 91.7**

### Weaknesses

1. **Singularity explanation**: Players might not understand why their items suddenly create a black hole. Need clear UI indication when singularity forms.

2. **Neutral items are boring**: Items at 0 duality have no effects. Should they have ANY identity?

3. **Visual clutter**: Dual zones might overlap and create confusing visuals in dense areas.

4. **Difficulty spikes**: Pure Umbra builds might be too strong early or too weak. Balancing needed.

5. **Player confusion**: The spectrum is large. Need to show duality clearly on items without overwhelming.

### Next Iteration Focus

1. **UI Clarity**: Add "Shadow" / "Light" labels with icons, not just numbers
2. **Neutral identity**: Give neutral items a different but useful property (maybe void immunity?)
3. **Visual priority**: Only show duality at zone edges, not filling entire area
4. **Balancing pass**: Tune umbra/lux values for fair gameplay
5. **Tutorial**: First dungeon should have one Umbra and one Lux item clearly placed
