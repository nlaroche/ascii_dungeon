# ASCII Dungeon Engine

## Overview

ASCII Dungeon is a modular, data-driven game engine and editor built for creating ASCII-aesthetic games with modern rendering technology. The engine combines the nostalgic charm of roguelike ASCII visuals with contemporary WebGPU-powered 3D rendering, real-time lighting, and AI-assisted development workflows.

The project consists of two main components:
1. **Core Engine** - A C++/Vulkan raytracing renderer for high-fidelity ASCII rendering
2. **Editor** - A Tauri/React/TypeScript application with WebGPU preview and dockable panels

---

## Vision

### The Problem
Game development tools are often monolithic, opinionated, and difficult to customize. Creating genre-specific games (RPGs, card games, visual novels) requires either building from scratch or fighting against the assumptions baked into existing engines.

### Our Solution
ASCII Dungeon takes a **template-first, data-driven approach**:

- **Everything is data** - The entire engine state is a serializable JSON object that can be inspected, modified, and version-controlled
- **Templates define the experience** - Switching from an isometric RPG to a deckbuilder changes the entire editor: panels, tools, types, and rendering mode
- **AI-native development** - Claude Code integration allows natural language interaction with the engine state
- **Lua scripting** - Game logic, types, and behaviors are defined in Lua, making games portable and shareable

### Core Principles

1. **Separation of Concerns**
   - Engine (rendering, physics) stays fixed
   - Data (entities, maps, assets) is template-agnostic
   - Views (editor UI) adapt to the current template

2. **Type-Driven Development**
   - Define a `Card.lua` type and get:
     - Inspector panel with appropriate fields
     - Collection view with filtering/grouping
     - Scene rendering with custom glyphs
     - Preview templates

3. **No Black Boxes**
   - Every piece of state is accessible
   - History tracking with undo/redo
   - Real-time state inspection

---

## Technology Stack

### Core Engine (C++)
| Component | Technology |
|-----------|------------|
| Rendering | Vulkan 1.3 with raytracing extensions |
| Shading | GLSL with real-time GI, reflections, shadows |
| Windowing | GLFW |
| Math | GLM |
| Build | CMake |

### Editor (TypeScript/Rust)
| Component | Technology |
|-----------|------------|
| Framework | Tauri 2.0 (Rust backend) |
| Frontend | React 18 with TypeScript |
| State | Zustand with immutable updates |
| Rendering | WebGPU (preview viewport) |
| Panels | rc-dock (dockable layout) |
| Styling | Tailwind CSS |
| Scripting | Lua (planned: mlua integration) |

### AI Integration
| Component | Technology |
|-----------|------------|
| Assistant | Claude Code CLI |
| Interface | Bidirectional IPC via Tauri commands |
| Context | Full engine state access |

---

## Architecture

### Data-Driven State

The entire application state lives in a single `ENGINE_STATE` object:

```typescript
interface EngineState {
  // Metadata
  _version: number;
  _lastModified: number;

  // UI Configuration
  ui: {
    layout: Layout;
    panels: Record<string, Panel>;
    theme: Theme;
    shortcuts: Record<string, string>;
  };

  // View Settings
  views: {
    scene: SceneView;
    code: CodeView;
    chat: ChatView;
  };

  // Tools
  tools: {
    active: string;
    available: Record<string, ToolDefinition>;
  };

  // Camera
  camera: CameraState;

  // Scene Data
  scene: {
    name: string;
    entities: Entity[];
    lights: Light[];
    map: MapState;
    materials: Record<string, Material>;
  };

  // Project
  project: ProjectState;

  // Selection
  selection: SelectionState;

  // Render Settings
  renderSettings: RenderSettings;

  // Session & History
  session: SessionState;

  // Chat/AI
  chat: ChatState;

  // Template
  template: TemplateState;

  // Runtime (not persisted)
  console: ConsoleState;
  runtime: RuntimeState;
}
```

### State Mutation

All state changes go through a centralized API:

```typescript
// Single value update
setPath(['camera', 'position'], [10, 5, 10], 'Move camera');

// Batch updates (atomic)
batchUpdate([
  { path: ['template', 'currentId'], value: 'deckbuilder' },
  { path: ['camera', 'mode'], value: 'orthographic' },
  { path: ['tools', 'active'], value: 'placeCard' },
], 'Switch to Deckbuilder template');

// Automatic history tracking
undo(); // Reverts last change
redo(); // Reapplies undone change
```

---

## Template System

Templates are the heart of ASCII Dungeon's flexibility. A template defines:

### 1. Render Configuration
```lua
-- engine-render.lua
return {
  mode = "isometric",  -- or "table", "sidescroll", "free3d"
  camera = {
    type = "orthographic",
    angle = { pitch = 45, yaw = 45 },
    zoom = { min = 0.5, max = 4.0, default = 1.0 },
  },
  grid = { enabled = true, size = 1.0 },
  lighting = {
    ambient = { 0.25, 0.25, 0.35 },
    directional = {
      direction = { -0.5, -1.0, -0.3 },
      color = { 1.0, 0.95, 0.85 },
      shadows = true,
    },
  },
  postProcess = "fantasy",
}
```

### 2. View Configuration
```lua
-- engine-view.lua
return {
  layout = {
    left = { size = 250, tabs = { "files", "entities" } },
    center = { tabs = { "scene", "code" } },
    right = { size = 320, tabs = { "properties", "chat" } },
    bottom = { size = 180, tabs = { "console", "assets" } },
  },
  tools = {
    paint = { id = "paint", name = "Paint Tile", icon = "▦", shortcut = "B" },
    erase = { id = "erase", name = "Erase", icon = "✕", shortcut = "E" },
    spawn = { id = "spawn", name = "Spawn Entity", icon = "◆", shortcut = "P" },
  },
  defaultTool = "select",
}
```

### 3. Type Definitions
```lua
-- types/Card.lua
return Type.define({
  name = "Card",
  icon = "🃏",
  color = "#ff6b6b",

  components = {
    name = { type = "string", default = "New Card" },
    manaCost = { type = "int", default = 1, min = 0, max = 15 },
    cardType = { type = "enum", options = { "creature", "spell", "artifact" } },
    attack = { type = "int", default = 1 },
    health = { type = "int", default = 1 },
  },

  inspector = {
    { section = "Identity", fields = { "name", "description" } },
    { section = "Stats", fields = { "manaCost", "attack", "health" } },
  },

  collection = {
    title = "Card Library",
    view = "grid",
    groupBy = "cardType",
    badge = "manaCost",
  },

  preview = {
    template = "card-frame",
    width = 250,
    height = 350,
  },
})
```

### Available Templates

| Template | Description | Render Mode | Key Types |
|----------|-------------|-------------|-----------|
| **Isometric RPG** | Top-down roguelike with entities, stats, inventory | Isometric | Entity, NPC, Item |
| **Deckbuilder** | Card game with deck building and effects | Table (top-down) | Card, Deck, Effect |
| **Visual Novel** | Story-driven with characters and branching dialog | 2D Flat | Character, Scene, Dialog |

---

## Editor Features

### Dockable Panel System
- Drag tabs to rearrange, split, or float
- Panels persist layout across sessions
- Template-specific panel configurations

### Core Panels
| Panel | Description |
|-------|-------------|
| **Files** | Project file browser with Lua/WGSL syntax support |
| **Entities** | Scene hierarchy with drag-and-drop |
| **Scene** | WebGPU 3D viewport with gizmos |
| **Code** | Integrated code editor |
| **Properties** | Context-sensitive inspector |
| **Console** | Log output and command input |
| **AI Chat** | Claude Code integration |
| **Templates** | Browse and switch templates |

### Template-Specific Panels
| Deckbuilder | Visual Novel |
|-------------|--------------|
| Card Library | Characters |
| Deck Manager | Scenes |
| Card Designer | Script Editor |
| Play Test | Story Flow |

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+O` | Open Project |
| `Ctrl+Shift+N` | New Project |

---

## WebGPU Renderer

The editor includes a WebGPU-based preview renderer that provides:

### Features
- Real-time 3D preview of ASCII scenes
- Instanced rendering for thousands of glyphs
- Dynamic lighting with point lights
- Water plane with transparency
- Grid overlay for editing

### Render Pipeline
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Scene State │ ──▶ │ Instance     │ ──▶ │ GPU Buffer  │
│ (Entities)  │     │ Generation   │     │ Upload      │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Final       │ ◀── │ Fragment     │ ◀── │ Vertex      │
│ Composite   │     │ Shader       │     │ Shader      │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Camera Modes
- **Perspective** - Free 3D camera
- **Orthographic** - Isometric view
- **Top-down** - Bird's eye for maps

---

## AI Integration

### Claude Code Chat
The editor embeds Claude Code as an intelligent assistant that can:

- Modify engine state through natural language
- Generate Lua scripts for game logic
- Create and edit entities
- Explain code and architecture
- Debug issues

### Example Interactions
```
User: "Create a goblin enemy at position 5,5 with 25 health"

Claude: I'll add a goblin entity to your scene.
[Modifies scene.entities to add new goblin]

User: "Make all torches flicker faster"

Claude: I'll update the flicker speed for all torch lights.
[Batch updates all lights with type 'torch']
```

---

## Project Structure

```
ascii_dungeon/
├── build/                    # C++ build output
├── shaders/                  # GLSL shaders for Vulkan renderer
│   ├── raytracing/
│   └── compute/
├── src/                      # C++ engine source
│   ├── engine/
│   ├── renderer/
│   └── scripting/
├── editor/                   # Tauri editor application
│   ├── src/                  # React frontend
│   │   ├── components/       # UI components
│   │   ├── stores/           # Zustand state
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities
│   │   ├── styles/           # CSS
│   │   └── renderer/         # WebGPU renderer
│   ├── src-tauri/            # Rust backend
│   │   ├── src/
│   │   └── capabilities/
│   └── package.json
├── templates/                # Game templates
│   ├── core/                 # Base template system
│   ├── isometric-rpg/
│   ├── deckbuilder/
│   └── visual-novel/
└── OVERVIEW.md               # This document
```

---

## Development Workflow

### Running the Editor
```bash
cd editor
npm install
npm run tauri dev
```

### Building for Production
```bash
cd editor
npm run tauri build
```

### Running the C++ Engine
```bash
mkdir build && cd build
cmake ..
cmake --build . --config Release
./ascii_dungeon
```

---

## Roadmap

### Phase 1: Foundation (Current)
- [x] WebGPU preview renderer
- [x] Dockable panel system
- [x] Data-driven state management
- [x] Template system architecture
- [x] Claude Code integration
- [x] File system operations

### Phase 2: Template Implementation
- [ ] Lua runtime integration (mlua)
- [ ] Type system execution
- [ ] Custom inspector widgets
- [ ] Collection views with filtering
- [ ] Preview renderers

### Phase 3: Game Features
- [ ] Entity component system
- [ ] Scripted behaviors
- [ ] Asset pipeline
- [ ] Audio system
- [ ] Save/load game state

### Phase 4: Polish
- [ ] Template marketplace
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Mobile preview
- [ ] Web export

---

## Design Philosophy

### Terminal Aesthetic
The editor embraces a terminal-inspired visual design:
- Monospace typography
- Zinc/slate color palette
- Cyan accent color
- ASCII decorative elements (◆, ◇, ▦, ○)
- Minimal chrome, maximum content

### Performance
- Immutable state updates for predictable rendering
- Instanced GPU rendering for large scenes
- Lazy loading of assets
- Background processing for heavy operations

### Extensibility
- Templates are self-contained and shareable
- Lua scripting for game logic
- Custom panels via component system
- Hook system for editor extensions

---

## Contributing

ASCII Dungeon is a passion project exploring the intersection of:
- Retro ASCII aesthetics
- Modern GPU rendering
- AI-assisted development
- Data-driven architecture

The codebase prioritizes:
- Readability over cleverness
- Explicit over implicit
- Composition over inheritance
- Data over behavior

---

## License

MIT License - See LICENSE file for details.

---

*Built with love for ASCII art, roguelikes, and the joy of creating games.*

**◆ ASCII_DUNGEON** - *Everything is data. Everything can be modified.*
