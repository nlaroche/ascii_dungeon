# Feature Spec: Developer Workbench v1

## Overview
A separate `/workbench` route that provides a full development environment for testing, tuning, and visualizing every game system in isolation. Uses Svelte + HTML/CSS for the control panels and the shared game engine/renderer for previews. All sections import from `src/lib/` directly - zero code duplication. Workbench state is persisted to JSON files (export/import) with localStorage as working cache, supporting A/B config comparison.

## Architecture

### Routing
- Hash-based routing: `/#/game` (default) and `/#/workbench`
- `src/App.svelte` becomes a router shell that conditionally renders either the game or the workbench
- URL defaults to `/#/game` so the game works as before

### Layout
- Workbench has a fixed left sidebar for section navigation
- Main content area shows the active section
- Each section is a standalone Svelte component under `src/workbench/sections/`
- Sections receive no props - they import what they need from `src/lib/` directly

### File Structure
```
src/
  workbench/
    Workbench.svelte          # Main workbench layout (sidebar + content area)
    sections/
      DungeonGen.svelte       # Dungeon generator
      CombatSim.svelte        # Combat simulator
      PlayerEditor.svelte     # Player stat editor
      AIViewer.svelte          # AI behavior step-through
      EconomySim.svelte       # Economy/timing simulator with graphs
      GraphicsLab.svelte      # Visual effects, tweens, tick rendering
      IntelligenceLab.svelte  # AI autoplay config (placeholder)
      SkillTreeLab.svelte     # Skill trees and classes (placeholder)
    components/
      Sidebar.svelte          # Navigation sidebar
      ParamSlider.svelte      # Reusable labeled slider with value display
      ParamToggle.svelte      # Reusable toggle switch
      ParamSelect.svelte      # Reusable dropdown select
      StatBar.svelte          # HP/stamina/XP bar visualization
      MiniChart.svelte        # Lightweight SVG line/bar chart component
      JsonExport.svelte       # Save/load state as JSON file
      AsciiPreview.svelte     # Renders ASCII grid in a monospace <pre> block
    state.js                  # Workbench state management (localStorage + file export/import)
```

---

## Phase 1: Workbench Shell

### Acceptance Criteria
- [ ] Create hash-based router in `src/App.svelte` that renders Game at `/#/game` (default) and Workbench at `/#/workbench`
- [ ] Create `src/workbench/Workbench.svelte` with sidebar navigation and content area
- [ ] Create `src/workbench/components/Sidebar.svelte` with section list, active section highlighting, and a "Back to Game" link
- [ ] Create `src/workbench/components/ParamSlider.svelte` - reusable slider: props `label`, `min`, `max`, `step`, `value`, dispatches `change` event
- [ ] Create `src/workbench/components/ParamToggle.svelte` - reusable toggle: props `label`, `value`, dispatches `change` event
- [ ] Create `src/workbench/components/ParamSelect.svelte` - reusable dropdown: props `label`, `options` (array of {value, label}), `value`, dispatches `change` event
- [ ] Create `src/workbench/components/StatBar.svelte` - horizontal bar: props `label`, `value`, `max`, `color`
- [ ] The workbench must render with a dark theme consistent with the game aesthetic (dark background, monospace fonts, green/amber/cyan accent colors)
- [ ] Sidebar sections listed: Dungeon, Combat, Player, AI, Economy, Graphics, Intelligence, Skill Trees
- [ ] Clicking a section in the sidebar shows that section's component in the content area
- [ ] Build must pass (`npm run build`)

### Technical Constraints
- Router must NOT use any external routing library - just `window.location.hash` and a Svelte reactive statement
- All workbench styles scoped to workbench components (don't affect game)
- ParamSlider, ParamToggle, ParamSelect must use Svelte's `createEventDispatcher` for events

### Files to Create
- `src/workbench/Workbench.svelte`
- `src/workbench/components/Sidebar.svelte`
- `src/workbench/components/ParamSlider.svelte`
- `src/workbench/components/ParamToggle.svelte`
- `src/workbench/components/ParamSelect.svelte`
- `src/workbench/components/StatBar.svelte`

### Files to Modify
- `src/App.svelte` - add hash-based routing

---

## Phase 2: Dungeon Generator Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/DungeonGen.svelte`
- [ ] Parameter controls: width (10-50), height (8-30), roomCount (2-15), playerLevel (1-20), enemyDensity slider, treasureDensity slider
- [ ] "Generate" button that calls `generateDungeon()` from `src/lib/dungeon.js` with current params
- [ ] ASCII preview of the generated dungeon using `src/workbench/components/AsciiPreview.svelte` - shows walls as `#`, floors as `.`, enemies as their symbol, treasure as `$`
- [ ] Create `src/workbench/components/AsciiPreview.svelte` - renders a 2D grid as colored monospace text in a `<pre>` block. Props: `grid`, `width`, `height`, `cellRenderer` (function that returns {char, color} for each cell)
- [ ] Stats panel showing: total floor tiles, total rooms, enemies placed, treasure placed, corridor length
- [ ] "Randomize" button that generates with random valid params
- [ ] Seed input field - when provided, dungeon generation uses this seed for reproducibility (requires adding seed support to `src/lib/dungeon.js`)
- [ ] Build must pass

### Technical Constraints
- Must import `generateDungeon` from `src/lib/dungeon.js` - do NOT duplicate generation logic
- AsciiPreview must be reusable (will be used by AI Viewer section too)
- Seed support: add an optional `config.seed` param to `generateDungeon`. Use a simple seeded PRNG (mulberry32 or similar) instead of `Math.random()` when seed is provided. When no seed, use `Math.random()` as before.

### Files to Create
- `src/workbench/sections/DungeonGen.svelte`
- `src/workbench/components/AsciiPreview.svelte`

### Files to Modify
- `src/lib/dungeon.js` - add optional `config.seed` parameter with seeded PRNG
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 3: Combat Simulator Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/CombatSim.svelte`
- [ ] Attacker panel: sliders for `attack` (1-50), `defense` (0-30), `hp` (1-500), `maxHp` (1-500)
- [ ] Defender panel: sliders for `attack` (1-50), `defense` (0-30), `hp` (1-500), `gold` (0-100), `xp` (0-200)
- [ ] "Fight Once" button: calls `resolveCombat()` from `src/lib/combat.js`, displays result (damage dealt, damage received, killed, loot)
- [ ] "Simulate N Fights" with count input (10-10000): runs N combats with the configured stats, displays summary statistics:
  - Win rate (% of fights where defender is killed)
  - Average damage dealt per fight
  - Average damage received per fight
  - Average rounds to kill (requires looping `resolveCombat` until one side dies)
- [ ] Results displayed in a table and as a bar chart using `MiniChart.svelte`
- [ ] Create `src/workbench/components/MiniChart.svelte` - lightweight SVG chart component. Props: `data` (array of {label, value}), `type` ("bar" | "line"), `width`, `height`, `color`. Renders inline SVG.
- [ ] "Reset to Defaults" button that restores initial slider values
- [ ] Combat log panel showing the last single-fight result step by step
- [ ] Build must pass

### Technical Constraints
- Must import `resolveCombat` from `src/lib/combat.js` - do NOT duplicate combat logic
- For "simulate N fights", create a helper `simulateCombatBatch(attacker, defender, n)` in `src/lib/combat.js` that returns aggregate stats. This keeps simulation logic in the library.
- MiniChart.svelte must be pure SVG (no external charting library)

### Files to Create
- `src/workbench/sections/CombatSim.svelte`
- `src/workbench/components/MiniChart.svelte`

### Files to Modify
- `src/lib/combat.js` - add `simulateCombatBatch()` function
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 4: Player Editor Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/PlayerEditor.svelte`
- [ ] Full player stat editor with sliders/inputs for every `createPlayer()` field: name (text input), hp, maxHp, stamina, maxStamina, attack, defense, intelligence, level, xp, xpToNext, gold
- [ ] "Create Default" button that resets to `createPlayer()` defaults
- [ ] "Level Up" button that calls `applyLevelUp()` and updates display
- [ ] "Simulate N Level-Ups" with count slider (1-100): shows stat progression as a table AND as a multi-line chart (HP, Attack, Defense, XP-to-next over levels)
- [ ] XP curve visualization: line chart showing XP required per level from 1 to N
- [ ] StatBar components showing current HP/maxHP, Stamina, XP progress as colored bars
- [ ] Equipment section showing weapon/armor/amulet slots (display only for v1, editing in future spec)
- [ ] "Export Player JSON" button that copies player object to clipboard
- [ ] Build must pass

### Technical Constraints
- Must import `createPlayer`, `applyLevelUp`, `addXp`, `addGold` from `src/lib/player.js`
- Level-up simulation must call `applyLevelUp` in a loop (not duplicate the math)

### Files to Create
- `src/workbench/sections/PlayerEditor.svelte`

### Files to Modify
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 5: AI Behavior Viewer Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/AIViewer.svelte`
- [ ] Generates a dungeon (using DungeonGen params or defaults) and places a player in it
- [ ] "Step" button: calls `decideAction()` once, shows the action returned, updates player position on the grid
- [ ] "Play/Pause" toggle: auto-steps at configurable speed (slider: 50ms - 2000ms per tick)
- [ ] Speed slider labeled "Tick Speed" controlling auto-step interval
- [ ] ASCII grid preview (reuse `AsciiPreview.svelte`) showing dungeon with player `@` position updated each tick
- [ ] Decision log panel: shows last N decisions with type (move/attack), direction, target info
- [ ] Stats panel: steps taken, enemies killed, treasure collected, current HP/stamina
- [ ] "Reset" button: regenerates dungeon, resets player to start
- [ ] Manual entity placement: click a floor tile to cycle through empty/enemy/treasure (stretch goal, can be basic)
- [ ] Build must pass

### Technical Constraints
- Must import `decideAction` from `src/lib/ai.js`, `generateDungeon` from `src/lib/dungeon.js`, `resolveCombat` from `src/lib/combat.js`, player functions from `src/lib/player.js`
- The viewer maintains its own local game state (player, dungeon, stats) - does NOT use `Game.js`
- Each tick: call `decideAction`, apply the result (move or combat), update state

### Files to Create
- `src/workbench/sections/AIViewer.svelte`

### Files to Modify
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 6: Economy & Timing Simulator Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/EconomySim.svelte`
- [ ] This section simulates full game runs at high speed to analyze the economy and pacing of the incremental game loop
- [ ] Configurable simulation parameters:
  - Number of dungeon runs to simulate (1-1000)
  - Starting player level (1-50)
  - Dungeon size scaling per level (toggle + multiplier)
  - Enemy scaling formula display (shows current: `hp = 20 + level * 10`)
  - Gold scaling formula display
  - XP scaling formula display
- [ ] "Run Simulation" button: simulates N full dungeon runs back-to-back, tracking:
  - Gold earned per run (line chart over runs)
  - XP earned per run (line chart)
  - Player level over runs (step chart)
  - Average run duration in ticks
  - Total enemies killed, treasure found
  - Time to reach each level milestone (table)
- [ ] Create `src/lib/simulator.js` with `simulateRuns(config)` that returns time series data. Config includes: `{ runCount, startingLevel, dungeonConfig }`. Returns: `{ runs: [{gold, xp, enemiesKilled, treasureFound, stepsTaken, levelReached}], player: finalPlayerState }`
- [ ] Multi-line chart showing gold/xp/level curves over time (reuse MiniChart or extend it to support multiple series)
- [ ] Extend `MiniChart.svelte` to support `multiline` mode: props `series` (array of {label, data, color}), renders overlaid line charts with a legend
- [ ] Table showing milestone levels: level reached, total gold at that point, total XP, runs needed
- [ ] "Compare" feature: run simulation with config A, then config B, overlay both curves on same chart
- [ ] Build must pass

### Technical Constraints
- `src/lib/simulator.js` must import from other lib modules - NOT duplicate game logic
- Simulator runs the AI decision loop headlessly (no rendering) at max speed
- Charts must handle 1000+ data points without lagging (use SVG path, not individual elements)

### Files to Create
- `src/workbench/sections/EconomySim.svelte`
- `src/lib/simulator.js` - headless run simulator

### Files to Modify
- `src/lib/index.js` - re-export simulator
- `src/workbench/components/MiniChart.svelte` - add multi-series support
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 7: Graphics Lab Section

### Acceptance Criteria
- [ ] Create `src/workbench/sections/GraphicsLab.svelte`
- [ ] Canvas preview area that uses the actual `Renderer` from `src/renderer/Renderer.js` (or a Canvas2D fallback if WebGPU unavailable)
- [ ] Tick system controls:
  - Tick rate slider (1-60 FPS)
  - Pause/resume toggle
  - Step forward one tick button
  - Current tick counter display
- [ ] Text rendering preview: input field for ASCII text, renders it live on the canvas with the game renderer
- [ ] Color picker for text color, background color
- [ ] Shader parameter controls (if WebGPU available):
  - Scanline intensity slider (0-1)
  - Vignette intensity slider (0-1)
  - CRT curvature slider (0-0.1)
  - These map to the shader uniforms in `Renderer.js`
- [ ] Tween playground:
  - Select easing function (linear, easeIn, easeOut, easeInOut, bounce)
  - Duration slider (100ms - 3000ms)
  - Preview animation: a character moves from A to B using the selected easing
  - Create `src/lib/tween.js` with `ease(type, t)` function that takes easing name and normalized time (0-1), returns eased value
- [ ] Font size slider (12-36px) for ASCII text rendering
- [ ] Grid overlay toggle showing cell boundaries
- [ ] Build must pass

### Technical Constraints
- Must use the actual `Renderer` class for canvas preview - do NOT create a separate renderer
- Shader param controls require extending `Renderer.js` to accept configurable uniform values (currently hardcoded in shader). Add a `setShaderParams(params)` method.
- Tween functions in `src/lib/tween.js` must be pure (no DOM, no timers)
- If WebGPU is unavailable, show a Canvas2D fallback with basic text rendering (no shader controls)

### Files to Create
- `src/workbench/sections/GraphicsLab.svelte`
- `src/lib/tween.js` - pure easing functions

### Files to Modify
- `src/renderer/Renderer.js` - add `setShaderParams()` method, make scanline/vignette/curvature configurable via uniforms
- `src/lib/index.js` - re-export tween
- `src/workbench/Workbench.svelte` - register this section

---

## Phase 8: Placeholder Sections

### Acceptance Criteria
- [ ] Create `src/workbench/sections/IntelligenceLab.svelte` with placeholder content: title "AI Intelligence Lab", description "Configure autoplay behavior, decision weights, and exploration vs exploitation strategies. Coming soon.", and a mockup of what controls will exist (listed as disabled/grayed out text)
- [ ] Create `src/workbench/sections/SkillTreeLab.svelte` with placeholder content: title "Skill Trees & Classes", description "Design and test skill trees, class archetypes, and progression paths. Coming soon.", and a mockup list of planned features
- [ ] Both placeholders must render without errors
- [ ] Build must pass

### Files to Create
- `src/workbench/sections/IntelligenceLab.svelte`
- `src/workbench/sections/SkillTreeLab.svelte`

### Files to Modify
- `src/workbench/Workbench.svelte` - register these sections

---

## Phase 9: State Persistence

### Acceptance Criteria
- [ ] Create `src/workbench/state.js` with:
  - `saveState(sectionName, state)` - saves to localStorage under key `workbench:{sectionName}`
  - `loadState(sectionName, defaults)` - loads from localStorage, returns defaults if not found
  - `exportAllState()` - returns all workbench state as a single JSON object
  - `importState(json)` - replaces all workbench state from JSON object
  - `listSavedConfigs()` - returns array of saved config names
  - `saveNamedConfig(name, state)` - saves entire workbench state under a name (for A/B testing)
  - `loadNamedConfig(name)` - loads a named config
  - `deleteNamedConfig(name)` - deletes a named config
- [ ] Create `src/workbench/components/JsonExport.svelte`:
  - "Export State" button that downloads all workbench state as a `.json` file (browser download)
  - "Import State" button with file picker that loads a `.json` file and restores state
  - "Save Config As..." button with name input, saves current state as a named config
  - Dropdown listing saved configs with "Load" and "Delete" buttons
- [ ] Add JsonExport component to the workbench sidebar (bottom area, always visible)
- [ ] Each section component should call `saveState()` on parameter changes and `loadState()` on mount to restore last values
- [ ] Build must pass

### Technical Constraints
- localStorage keys prefixed with `workbench:` to avoid conflicts
- Named configs stored under `workbench:configs:{name}` keys
- JSON export includes a version field for future migration: `{ version: 1, timestamp, sections: {...} }`
- File download uses `Blob` + `URL.createObjectURL` + temporary `<a>` element
- File import uses `<input type="file">` with `.json` accept filter

### Files to Create
- `src/workbench/state.js`
- `src/workbench/components/JsonExport.svelte`

### Files to Modify
- `src/workbench/components/Sidebar.svelte` - add JsonExport to bottom
- All section components - add saveState/loadState calls

---

## Global Technical Constraints
- Must build without errors (`npm run build`)
- Must not break the existing game (game route `/#/game` works identically)
- All game logic stays in `src/lib/` as pure functions - workbench imports from there
- No external dependencies beyond what's already in package.json (Svelte, Vite)
- Charts are pure SVG rendered by Svelte (no Chart.js, no D3)
- Workbench styling: dark background (#111), monospace font, accent colors: green (#00ff00), amber (#ffaa00), cyan (#00ffff), red (#ff4444)
- Every component must be self-contained with scoped `<style>` blocks

## Implementation Notes
- Implement phases in order (1 through 9) - each phase builds on the previous
- Phase 1 is the foundation - get routing and reusable components right
- Phases 2-5 are independent sections that can be built in any order after Phase 1
- Phase 6 (Economy) depends on phases 2-5 being complete since it uses all lib modules
- Phase 7 (Graphics) modifies the Renderer so be careful not to break the game
- Phase 8 is trivial placeholder work
- Phase 9 (State) should be done last so all sections exist to integrate with
- When implementing MiniChart.svelte, use SVG `<path>` for lines (not individual `<circle>` elements) to handle 1000+ points
- The seeded PRNG for dungeon.js should be a simple function like mulberry32: takes a seed number, returns a function that produces deterministic floats 0-1
