# Aider Conventions for ASCII Dungeon

You are working on a Svelte 4 + Vite 5 + JavaScript game project. Follow these rules strictly.

## Architecture
- **ECS (Entity-Component-System)** is the core architecture
- `src/ecs/` — World, EventBus, Components, Schemas, Events, Prefabs, Pipeline, Systems
- `src/lib/` — Pure function utilities (combat, dungeon, player, ai, rng, easing, fov, camera, lighting, items, skills, juice)
- `src/game/Game.js` — Thin shell: creates ECS world via `createGameWorld()`, runs game loop, forwards input
- `src/game/createGameWorld.js` — Factory: registers all systems, sets resources, spawns entities
- `src/renderer/` — WebGPU renderer (unchanged, systems call `setCell()`)
- `src/workbench/` — Developer workbench (Svelte components)
- Workbench sections live in `src/workbench/sections/`, reusable controls in `src/workbench/components/`
- `src/workbench/helpers/createLabWorld.js` — Factory for isolated lab worlds with system subsets

## ECS Rules
- **Components** are plain data objects. Use frozen constants from `COMPONENTS` (e.g., `COMPONENTS.POSITION`)
- **Systems** are pure functions `(world, dt) => void`. One system per file. Systems never import each other.
- **Inter-system communication** uses the event bus queue-drain pattern: `world.events.emit()` / `world.events.drain()`
- **Event types** use frozen constants from `EVENTS` (e.g., `EVENTS.COMBAT_HIT`)
- **Prefabs** define entity templates as data objects. Use `spawnPrefab(world, PREFABS.X, overrides)` to create entities.
- **Pipeline** defines system execution order. Registered via `registerPipeline(world)`.
- **Resources** are world-level singletons: `world.setResource(name, value)` / `world.getResource(name)`
- **devMode** enables schema validation in tests — always use `createTestWorld()` from test helpers
- Systems wrap existing `src/lib/` pure functions — don't rewrite working, tested code
- Tiles/dungeon grid are a **resource**, not entities (performance: avoid 3600+ entity overhead)

### New Component Checklist
1. Add name constant to `src/ecs/components.js`
2. Add schema to `src/ecs/schemas.js`
3. Add to relevant prefab(s) in `src/ecs/prefabs.js`
4. Add test in `tests/ecs/schemas.test.js`

### New System Checklist
1. Create `src/ecs/systems/XSystem.js` — export function `XSystem(world, dt)`
2. Add to `src/ecs/pipeline.js` in correct phase position
3. Add to `src/ecs/index.js` barrel export
4. Add test in `tests/ecs/systems/x.test.js`

### New Event Checklist
1. Add constant to `src/ecs/events.js` EVENTS object
2. Add payload schema to `src/ecs/events.js` EVENT_SCHEMAS
3. Document emitter → listener in the event's JSDoc

## Code Style
- JavaScript only (no TypeScript)
- ES modules (`import`/`export`), no CommonJS
- Svelte 4 syntax (not Svelte 5 runes)
- Use `createEventDispatcher` for child-to-parent communication in Svelte
- Keep functions small and focused
- No unnecessary comments or docstrings

## File Rules
- NEVER modify `package.json` scripts (they work as-is)
- NEVER modify `vite.config.js`
- NEVER add new dependencies without being explicitly told to
- All imports in Svelte must be in the top-level `<script>` block (never inside `{#if}`)
- Barrel re-exports go in `src/lib/index.js`

## Build
- The build must pass: `vite build` (runs automatically via test command)
- Fix any build errors before finishing
- Do not introduce unused imports or variables (Svelte will warn)

## When Editing Specs
- Check off completed criteria: `- [ ]` becomes `- [x]`
- Only check off criteria that are fully implemented and verified
