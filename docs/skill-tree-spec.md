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

## Iteration 1: The Mutation Model

### Theme
Skills are living entities that evolve based on investment patterns. Each skill has a "DNA" of attributes (blood, ichor, bile, phlegm). Invest in enough blood skills and they mutate into a Vampire strain - gaining lifesteal and cold abilities. Keep investing and they evolve again into something unprecedented.

### Three Key Ideas
1. **Mutation Strains**: Each skill belongs to a strain. At thresholds (5, 15, 30, 50, 100 total strain points), the strain mutates into a new form with completely different child skills. Blood → Vampire → Nosferatu → Leviathan. Player never sees what's next until they reach it.

2. **Resonance Cascade**: Pairs of strains create resonance. Blood (attack) + Bile (magic) = Hemomancy (blood magic). Resonance unlocks at strain level 3+ in both. Multiple resonances stack multiplicatively. Player discovers new resonances by exploring strain combinations.

3. **The Hollow**: Some skills are "void" skills - they exist as absence. Investing in opposite strains (Blood vs Phlegm) creates void space. At critical mass, void skills manifest - these are the most powerful but only reachable through conflict between your strains.

### How it feels to play
You start with basic Attack/Defense/Intelligence. First dungeon run you dump everything into Attack. At 5 Attack points, your strain mutates: "Blood Knight" - now every attack heals you. Your next 10 points feel like a superpower unlock. By run 10, you're dual-stacking Blood + Bile and accidentally discover Hemomancy - your attacks now burn enemies. You scream to your friend "holy shit, there's BLOOD MAGIC?" This is the moment.

### Score
- R1 Endless Scaling: 90 - Each mutation unlocks NEW skills, not just +5% bonuses. Strains go infinite.
- R2 Number Feel: 95 - Mutations at 5/15/30/50/100 are VISIBLE power spikes. Each feels like a new game layer.
- R3 Discovery Depth: 100 - Hidden mutations, hidden resonances, void skills. Player finds things developers didn't plan.
- R4 Build Diversity: 90 - 4 strains × 5 mutations × resonance combinations × void unlock = 50+ viable builds.
- R5 Integration: 80 - Strains modify combat directly. Equipment can boost strain affinity. Dungeon enemies have strain weaknesses. Town shops stock strain-specific items.
- R6 Implementability: 85 - Pure functions. Strain is just a number. Mutation is a lookup table. Resonance is a pair check. Data-driven.

Total: 90

### Weaknesses
- Player might feel "locked in" after mutation - need a respec or mutation reversal mechanic
- Too many hidden things could feel arbitrary - need clear UI hints about what's mutating
- Balancing mutations vs resonances vs void could be complex

### Next Focus
Add the architecture: strain data structures, mutation thresholds, resonance pairing rules, and void unlock formula. Show concrete numbers.
```

## Iteration 2: The Mutation Model - Refined

### Theme
Iteration 1's Mutation Model with three critical fixes: **Strain Transplants** for respec agency, **Whisper Warnings** for transparency, and **Simplified Resonance** for clarity. The core fantasy remains - skills evolve into unexpected forms - but now players feel in control and informed.

### Three Key Ideas
1. **Strain Transplants (Respec)**: At any time, spend gold to "transplant" points from one strain to another. Cost scales exponentially: `cost = 10 * (transplantedPoints ^ 1.5)`. This gives players agency to change paths without feeling locked in. Town NPC "The Biologist" handles transplants.

2. **Whisper Warnings**: When you're 1 point away from a mutation, UI shows a "whisper" - cryptic hint of what's coming. At 4/5 Blood points: "Your blood boils with unspent violence." At 9/10: "The Vampire mutation is nearly complete." No exact numbers, but clear something is happening. Makes mutations feel discovered rather than arbitrary.

3. **Simplified Resonance**: Instead of complex multiplicative stacking, resonances are binary toggles. Blood + Bile = Hemomancy (ON/OFF). Each active resonance grants ONE big bonus: "+5 damage to attacks that also deal magic damage." Max 3 resonances active. Player chooses which 3 of their 6 possible resonances to equip, like skill slots. Much easier to balance, clearer to understand.

### How it feels to play
Run 1: You dump Attack. At 5 points, BOOM - Vampire mutation. You feel powerful. Run 3: You want to try Intelligence. You visit The Biologist, spend 50 gold to transplant 5 points. Now you're on a new path. At 4/5 Intelligence, you see a whisper: "The Arcanist mutation stirs..." You're excited to reach 5. Run 5: You have Blood mutation + Arcane resonance. Your attacks burn AND leech. This is exactly what you wanted. You feel in control.

### Score
- R1 Endless Scaling: 90 - Transplants let you infinite-respec. Mutations still unlock new skill trees. Void still exists for long-term goals.
- R2 Number Feel: 95 - Same visible spikes at 5/15/30/50/100. Whispers make the spike feel earned/anticipated rather than random.
- R3 Discovery Depth: 85 - Whispers reduce pure discovery, but void skills and hidden resonance combos still surprise. Tradeoff acceptable.
- R4 Build Diversity: 90 - Transplants + 3-slot resonances = more viable builds than pure mutation locking. Players can pivot freely.
- R5 Integration: 80 - Same as Iteration 1. Transplants use gold (economy integration). Whispers add flavor text (narrative integration).
- R6 Implementability: 90 - Transplants = simple formula. Whispers = conditional text lookup. Resonance = array of 6 booleans. Simpler than Iteration 1.

Total: 87

### Weaknesses
- Still relatively complex with 4 strains, mutations, resonances, void
- Gold cost for transplants might feel grindy early on
- Whisper system requires writing flavor text for every mutation threshold

### Next Focus
Architecture time! Define: strain point storage, mutation threshold tables, whisper text database, resonance configuration, transplant cost function. Show working JavaScript with example data.
