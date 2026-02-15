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

## Next Iteration Focus

1. **Visualization**: Add gravity field rendering to TilemapRenderer
2. **Balancing pass**: Add movement speed penalties for heavy loadouts
3. **FOV integration**: Make vision warp near high-mass items
4. **Polish**: Add "gravity trails" for projectiles showing their curved paths
5. **UI**: Show gravity polarity and strength on item tooltips

The "holy shit" moment: Player realizes that by equipping REPULSION items and standing near a wall, they can create a gravity well that DEFLECTS ENEMY PROJECTILES BACK AT THEM. Or discovers that enemy AI gets stuck in orbital patterns around treasure rooms, making them easy to kite.

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
