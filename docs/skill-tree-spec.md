# Skill Tree Spec - Autonomous Design Document

## Meta: This is a living document
This spec is iteratively refined by an AI agent (MiniMax M2.5) through multiple
rounds of research, proposal, evaluation, and refinement. Each iteration MUST:
1. Propose a concrete design (data structures, not abstract concepts)
2. Self-evaluate against the reward function below
3. Identify weaknesses and propose improvements for the next iteration

## Project Context
- Svelte 4 + Vite 5 + JavaScript (no TypeScript)
- Pure function modules in `src/lib/` (no classes, no side effects)
- Player has: hp, maxHp, stamina, maxStamina, attack, defense, intelligence, level, xp, xpToNext, gold, inventory[], equipment{weapon, armor, amulet}
- Combat: flat `attack - 5` for damage, `defender.attack - attacker.defense` for counter-attack (min 1 both)
- Dungeon: procedural rooms + corridors, enemies scale with playerLevel
- Item system: "Living Records" — items have 4 record types (kill, treasure, explore, survive) that level 0-10 via XP. Records give stat bonuses. Item pairs create resonance bonuses.
- Workbench: Svelte sections for testing each system with sliders/toggles/buttons

## Design Goals — WHAT THE PLAYER SHOULD FEEL
- **Endless growth**: Numbers ALWAYS getting bigger. No cap. The tree grows forever.
- **Bigger numbers dopamine**: Each investment should feel impactful. Not +0.5% — big jumps.
- **Tiers and layers**: The tree should have visible depth. Investing deep into a branch should unlock new layers that weren't visible before.
- **Aha moments**: "Holy shit, THAT'S what happens when I combine these?" Unexpected synergies that reward exploration.
- **Easy to change**: Data-driven definitions. Swap out the entire tree shape by changing data, not code.

## Anti-Goals — WHAT TO AVOID
- Static skill trees where you see everything from the start (boring, no discovery)
- Percentage-based micro-bonuses (+1.2% crit chance per level — feels like nothing)
- Mandatory paths where there's one obviously correct build
- Systems that require reading a wiki to understand

## Reward Function (score 0-100 each axis)

### R1: Endless Scaling (does the system support infinite meaningful growth?)
- 100 = truly infinite, each level always feels impactful, numbers visibly grow
- 50 = has a soft cap where growth slows to a crawl
- 0 = hard cap, finite skill points, done in 30 minutes

### R2: Number Feel (do the numbers FEEL good? Big jumps, satisfying progression?)
- 100 = every investment is a visible power spike, "oh hell yes" moments
- 50 = growth is steady but unremarkable
- 0 = micro-percentages, spreadsheet required to notice difference

### R3: Discovery Depth (are there hidden layers, surprises, aha moments?)
- 100 = players discover new mechanics 10 hours in, emergent combos surprise the designer
- 50 = some surprises but mostly predictable
- 0 = everything visible from minute one, no secrets

### R4: Build Diversity (how many meaningfully different builds are viable?)
- 100 = 50+ distinct playstyles, no dominant strategy
- 50 = 10-20 viable builds
- 0 = one optimal path, everything else is a trap

### R5: Integration (how well does it connect to combat, items, dungeon, economy?)
- 100 = skills fundamentally change how you interact with every system
- 50 = skills add stat bonuses to combat only
- 0 = skills are isolated, cosmetic only

### R6: Implementability (can it be built as pure functions in our stack?)
- 100 = pure functions, plain objects, no external deps, easy to test
- 50 = needs some complexity but doable
- 0 = requires engine changes, external libraries, or complex state management

### Total Score = (R1 + R2 + R3 + R4 + R5 + R6) / 6

TARGET: Total >= 80

## Iteration Protocol

Each iteration MUST output:
1. `## Iteration N` header
2. The proposed design (concrete data structures in JavaScript — show createSkillTree(), allocatePoint(), getSkillBonuses() etc.)
3. Self-score on R1-R6 with justification
4. Total score
5. `## Weaknesses` — what's wrong with this design
6. `## Next Iteration Focus` — what to change next

## Existing Systems to Synergize With

### Player Stats (src/lib/player.js)
```javascript
{ hp, maxHp, stamina, maxStamina, attack, defense, intelligence, level, xp, xpToNext, gold }
```
- Level up: +10 maxHp, +2 attack, +1 defense
- XP curve: xpToNext * 1.5 each level

### Combat (src/lib/combat.js)
```javascript
defenderDamage = Math.max(1, attacker.attack - 5)
attackerDamage = Math.max(1, defender.attack - attacker.defense)
```

### Item Records (src/lib/items.js)
- 4 record types: kill, treasure, explore, survive
- Each levels 0-10, gives specific bonuses
- Resonance between item pairs at level 3+
- Stats: bonusDamage, critChance, bonusDefense, damageReduction, maxHP, lifesteal, staminaEfficiency, moveSpeed, goldBonus, rareChance

## Current Design

(To be filled by the AI agent through iteration)
