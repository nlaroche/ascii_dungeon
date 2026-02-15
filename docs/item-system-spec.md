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

### Iteration 0: Empty
No design yet. First iteration should research novel approaches to item systems
that maximize emergence and cross-system impact while staying simple.

Research directions to explore:
- Tag/keyword systems where items interact through shared properties
- Items that modify game rules, not just stats
- Items that change how the dungeon generates
- Items that affect perception (FOV, lighting, information)
- Items as verbs (things you DO) not nouns (stat sticks)
- Ecosystem/ecology approaches where items interact like organisms
- Mathematical structures (graphs, cellular automata, etc.) for item interactions
- Real-world inspiration: chemistry, biology, physics, music theory
