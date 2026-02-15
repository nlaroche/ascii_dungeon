# Skill Tree Spec - Autonomous Design Document

## Meta: This is a living document
This spec is iteratively refined by an AI agent through multiple rounds.

## Project Context
- Svelte 4 + Vite 5 + JavaScript (no TypeScript)
- Pure function modules in `src/lib/` (no classes, no side effects)
- Player: { hp, maxHp, stamina, maxStamina, attack, defense, intelligence, level, xp, xpToNext, gold, equipment{weapon, armor, amulet} }
- Combat: `attack - 5` for damage, `defender.attack - attacker.defense` for counter (min 1)
- Items: "Living Records" with 4 record types (kill, treasure, explore, survive), level 0-10 via XP, resonance bonuses between pairs
- Workbench: Svelte dev sections with sliders/toggles/buttons

## Design Goals
- **Endless growth**: No cap. Numbers always getting bigger.
- **Big number feel**: Each point invested = visible power spike. Not micro-percentages.
- **Tiers and layers**: Deep investment reveals new hidden layers.
- **Aha moments**: Unexpected synergies reward exploration.
- **Easy to change**: Data-driven. Swap tree shape by changing data, not code.

## Anti-Goals
- Static trees visible from the start
- Micro-percentage bonuses (+0.5% per level)
- One obviously correct build path
- Wiki-required complexity

## Reward Function (0-100 each)

### R1: Endless Scaling
- 100 = truly infinite, always impactful | 50 = soft cap | 0 = hard cap

### R2: Number Feel
- 100 = visible power spikes | 50 = steady but meh | 0 = spreadsheet needed

### R3: Discovery Depth
- 100 = surprises 10 hours in | 50 = some surprises | 0 = all visible from start

### R4: Build Diversity
- 100 = 50+ playstyles | 50 = 10-20 | 0 = one optimal path

### R5: Integration (combat, items, dungeon, economy)
- 100 = changes every system | 50 = stat bonuses only | 0 = isolated

### R6: Implementability
- 100 = pure functions, plain objects | 50 = some complexity | 0 = engine changes

### Total = average of R1-R6. TARGET >= 80

## Phase A: Concept Exploration (iterations 1-3)

KEEP IT SHORT. Each iteration is MAX 60 lines:
1. `## Iteration N: [Theme Name]` header
2. **Theme**: 1-2 sentence core concept
3. **Three Key Ideas**: Bullet each in 2-3 sentences max
4. **How it feels to play**: 3-4 sentence player experience narrative
5. **Score**: R1-R6 with ONE sentence justification each, then total
6. **Weaknesses**: 2-3 bullets
7. **Next Focus**: 1-2 sentences

DO NOT write code in Phase A. DO NOT write data structures. Just the concept.

## Phase B: Architecture (iteration 4)

ONLY after Phase A converges. Build out the winning concept:
1. JavaScript data structures (createSkillTree, allocatePoint, getSkillBonuses)
2. Growth formulas with example numbers at level 1, 10, 50, 100
3. Synergy/discovery mechanics
4. Integration hooks with combat, items, player
5. Keep to ~150 lines max

## Existing Systems

### Player Stats (src/lib/player.js)
Level up: +10 maxHp, +2 attack, +1 defense. XP curve: xpToNext * 1.5 each level.

### Combat (src/lib/combat.js)
damage = max(1, attack - 5), counter = max(1, defender.attack - attacker.defense)

### Item Records (src/lib/items.js)
4 record types (kill/treasure/explore/survive), level 0-10, resonance pairs at lv3+.
Stats: bonusDamage, critChance, bonusDefense, damageReduction, maxHP, lifesteal, staminaEfficiency, moveSpeed, goldBonus, rareChance.

## Iterations

(To be filled by the AI agent)
