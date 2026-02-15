# Aider Conventions for ASCII Dungeon

You are working on a Svelte 4 + Vite 5 + JavaScript game project. Follow these rules strictly.

## Architecture
- Game logic lives in `src/lib/` as pure functions (no side effects, no DOM, no renderer)
- Each lib module exports pure functions that return new objects (immutable pattern)
- `src/game/Game.js` is the orchestrator that imports from `src/lib/`
- `src/renderer/Renderer.js` handles all WebGPU rendering
- `src/workbench/` contains the developer workbench (Svelte components)
- Workbench sections live in `src/workbench/sections/`, reusable controls in `src/workbench/components/`

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
