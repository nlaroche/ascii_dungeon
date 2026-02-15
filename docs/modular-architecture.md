# Feature Spec: Modular Game Library Architecture

## Overview
Refactor the monolithic Game.js into a modular library architecture where each game system (dungeon generation, combat, player state, AI) is an independent module that can be imported and tested in isolation. The game itself becomes a thin orchestrator that wires systems together. This enables a future workbench UI for testing individual systems.

## Acceptance Criteria
- [ ] Create `src/lib/dungeon.js` - pure dungeon generation (takes config, returns grid data). No dependencies on Game or Renderer.
- [ ] Create `src/lib/combat.js` - pure combat resolution (takes attacker/defender stats, returns combat result with damage, killed flag, loot). No side effects.
- [ ] Create `src/lib/player.js` - player state factory and level-up logic. `createPlayer()` returns a fresh player object. `applyLevelUp(player)` returns updated player. Pure functions.
- [ ] Create `src/lib/ai.js` - AI decision-making. `decideAction(player, dungeon)` returns an action object like `{type: 'move', dx, dy}` or `{type: 'attack', target}`. Pure function.
- [ ] Create `src/lib/index.js` that re-exports all library modules for clean imports.
- [ ] Refactor `src/game/Game.js` to import and use the library modules instead of inline logic. Game.js should delegate to lib functions, not duplicate their logic.
- [ ] All library functions must be pure (no DOM, no renderer, no global state). They take data in, return data out.
- [ ] The build must pass (`npm run build`) with zero errors.
- [ ] The game must still function identically after refactoring - same behavior, just reorganized code.

## Technical Constraints
- Must build without errors (`npm run build`)
- Must not break existing functionality
- Library modules must have zero imports from `src/game/` or `src/renderer/`
- Each library module should export named functions, not classes
- Keep JavaScript (no TypeScript conversion)

## Files to Create
- `src/lib/dungeon.js` - `generateDungeon(config)` returns `{grid, width, height, rooms}`
- `src/lib/combat.js` - `resolveCombat(attacker, defender)` returns `{attackerDamage, defenderDamage, defenderKilled, loot}`
- `src/lib/player.js` - `createPlayer(overrides?)`, `applyLevelUp(player)`, `applyDamage(player, amount)`, `addGold(player, amount)`, `addXp(player, amount)`
- `src/lib/ai.js` - `decideAction(playerPos, dungeonGrid, dungeonSize)` returns action object
- `src/lib/index.js` - barrel export file

## Files to Modify
- `src/game/Game.js` - refactor to use lib modules

## Implementation Notes
- Start with the simplest extraction: player.js (just data), then dungeon.js (generation), then combat.js, then ai.js
- Game.js should import from `../lib/index.js`
- Keep the same random behavior - don't add seeded RNG yet (that's a future spec)
- The lib modules should be designed so they could be called from a test harness or workbench without needing the full game
