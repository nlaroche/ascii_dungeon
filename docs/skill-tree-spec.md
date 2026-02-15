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

## Iterations

