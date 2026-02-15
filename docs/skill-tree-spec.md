# Skill Tree Spec

## RULES (read these FIRST)
- Output MAX 50 lines per iteration. If you exceed 50 lines, the iteration is REJECTED.
- DO NOT write code. No JavaScript. No data structures. Concept only.
- You MUST pass ALL litmus tests below or your score is 0 on that axis.

## Litmus Tests (pass/fail)

### R1: Endless Scaling
PASS = You describe what a player's skill state looks like at level 1, level 10, level 100, and level 1000. Level 1000 MUST be meaningfully stronger than level 100.
FAIL = Any hard cap, finite thresholds, or "done" state.

### R2: Number Feel
PASS = You show the EXACT stat change from investing point 1, point 10, and point 50 into one skill. Each must give +5 or more to a visible stat.
FAIL = Percentage bonuses under 5%, or "unlock at threshold" with nothing between thresholds.

### R3: Discovery Depth
PASS = You describe at least 2 specific "aha moments" a player would experience that they couldn't predict from the visible UI.
FAIL = Everything visible from the start, or discovery is just "unlock thing at level X."

### R4: Build Diversity
PASS = You describe 3 radically different builds and explain why each is viable. They must play differently, not just have different numbers.
FAIL = All builds converge to the same gameplay.

### R5: Integration
PASS = Skills affect at least 3 different systems (combat, movement, economy, dungeon, items, vision).
FAIL = Skills only modify combat stats.

### R6: Implementability
PASS = Can be built as pure functions with plain objects. No external deps.
FAIL = Requires engine changes or complex state.

## Iteration Format (EXACTLY this structure)
```
## Iteration N: [Name]
**Core idea**: [2 sentences max]
**How growth works**: [3 sentences. Must address level 1 vs 10 vs 100 vs 1000]
**Number examples**: Point 1 gives ___, point 10 gives ___, point 50 gives ___
**Aha moments**: [2 specific scenarios]
**3 different builds**: [1 sentence each, how they PLAY differently]
**Systems touched**: [list which systems and how]
**Weaknesses**: [2-3 bullets]
```

## Game Context (brief)
ASCII dungeon roguelike. Player has attack/defense/hp/stamina/gold/level. Combat is flat attack-defense. Items have "Living Records" (kill/treasure/explore/survive) that level 0-10 and give stat bonuses. Equipment: weapon/armor/amulet. Pure JS functions, Svelte workbench.

## Iteration 1: Momentum System
**Core idea**: Skills build "momentum" that compounds over time—the more you use a skill, the stronger it gets. Switching focus decays unused momentum.

**How growth works**: At level 1 (1 pt), skill adds flat bonus to its domain. At level 10, unlocks "chain" effect where kills cascade to nearby actions. At level 100, momentum "overflows" into adjacent skills. At level 1000, player becomes a walking aura passively affecting the world.

**Number examples**: Point 1 gives +5 attack, point 10 gives +50 attack (5 per pt), point 50 gives +250 attack (5 per pt).

**Aha moments**: (1) Stacking momentum in one skill causes "overflow" that unexpectedly boosts related skills you didn't invest in. (2) Momentum decay can be reversed mid-combat by triggering a "breakthrough" at low HP.

**3 different builds**: "Berserker" focuses all momentum into attack for massive single hits but leaves defense vulnerable. "Warden" spreads across defense, creating an aura that damages attackers. "Merchant" converts momentum into gold and item find.

**Systems touched**: Combat (attack/defense), economy (gold gain), dungeon (exploration speed), items (drop rates).

**Weaknesses**: Momentum loss on death, requires constant engagement to maintain, single-focus builds are brittle.

## Judge Feedback (Iteration 1)
- R1: PASS (barely). Level 1/10/100/1000 described but difference between 500 and 1000 unclear.
- R2: FAIL. +5 per point is LINEAR and FLAT. Point 50 gives the same +5 as point 1. This is boring. Growth MUST accelerate — later points should give MORE than earlier points. Think polynomial or exponential.
- R3: PASS. Overflow and breakthrough are good surprises.
- R4: PASS (weak). Builds differ in stats, not gameplay loops.
- R5: PASS. 4 systems.
- R6: PASS.
- CRITICAL: Fix R2. Each point invested must feel BIGGER than the last. Show accelerating numbers like: point 1 = +5, point 10 = +15, point 50 = +100. The curve should reward deep investment.

## Iteration 2: Exponential Momentum System
**Core idea**: Skills use exponential compounding—each point invested multiplies existing power, rewarding deep investment with dramatically higher returns.

**How growth works**: At level 1 (1 pt), skill gives +5 flat bonus. At level 10, compounding reaches ~5× multiplier, giving +25 per point. At level 100, multiplier explodes to ~500×, giving +2500 per point. At level 1000, the player weaponizes momentum as a passive hurricane that ragdolls enemies and reshapes the dungeon itself.

**Number examples**: Point 1 gives +5 attack, point 10 gives +25 attack (5 per pt ×5× multiplier), point 50 gives +250 attack (5 per pt ×50× multiplier).

**Aha moments**: (1) Stacking momentum triggers "resonance" at thresholds (10, 50, 100 pts) where the skill temporarily pulses the entire screen. (2) Dying doesn't reset points but fractures momentum into "shards" that can be collected for massive one-time buffs.

**3 different builds**: "Berserker" concentrates all points into attack, becoming a one-shot kill machine but leaving survival to timing. "Warden" spreads across defense/dodge, turning damage taken into counter-attack momentum. "Archivist" invests in exploration/collection, converting momentum into permanent item bonuses that persist through death.

**Systems touched**: Combat (attack/defense/counter), dungeon (environment interaction), items (bonus affixes), economy (shard selling).

**Weaknesses**: Early game feels weak, high complexity for new players, death penalties can feel harsh without shard collection.

## Iteration 3: Fractal Skill Layers
**Core idea**: Each skill has invisible tiers. At 10, 50, and 200 points invested, the skill "evolves" and reveals hidden sub-skills that didn't exist before, creating a fractal tree that expands as you invest.

**How growth works**: Keep accelerating curve from Iteration 2. At tier 1 (1-9 pts) you see base skill. At tier 2 (10+ pts) a hidden branch unlocks—2 new sub-skills appear, each scaling infinitely with their own accelerating curve. At tier 3 (50+ pts) another branch. At tier 4 (200+ pts) a final branch. The tree literally grows in the UI.

**Number examples**: Base attack at pt1=+5, pt10=+25, pt50=+250. Sub-skill "Cleave" unlocks at 10 pts, giving AoE radius that also accelerates: pt11=1 tile, pt50=5 tiles, pt200=20 tiles.

**Aha moments**: (1) At exactly 10 pts, a completely new skill icon fades in—you didn't know it existed. (2) Sub-skills share momentum: putting 5 pts in sub-skill transfers to parent, letting you "farm" branches then consolidate.

**3 different builds**: "Berserker" invests in Attack tier 2→3→4, unlocking position-based "Leap Slam" (jump over enemies) and "Whirlwind" (spin attack). Gameplay becomes mobile melee dance. "Warden" invests in Defense tier 2→3→4, unlocking "Body Block" (enemies can't walk through you) and "Thorns" (reflect damage). You become a wall enemies must route around. "Archivist" invests in Exploration tier 2→3→4, unlocking "Sense Hidden" (reveal secret rooms) and "Shortcuts" (create temporary passages). You manipulate the map layout.

**Systems touched**: Combat (new attack abilities), Movement (jump/teleport/block), Dungeon (secret rooms, map editing), Vision (hidden reveal), Economy (hidden chests).

**Weaknesses**: UI must clearly show locked vs unlocked tiers, complexity spike at tier 3+, need careful balance so early tiers feel meaningful.

