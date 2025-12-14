# ASCII Raytraced Engine

A flexible engine for ASCII-aesthetic games with hardware raytraced lighting. The engine is a dumb renderer—Lua owns all game state, logic, and decides what to render.

---

## Core Principle

**Engine renders. Lua decides.**

The engine provides rendering primitives and handles Vulkan/RT complexity. Lua owns the game: state, logic, camera, what appears on screen. Want first-person? Isometric? Top-down? Split-screen? That's all Lua—engine doesn't care.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            LUA LAYER                                │
│                                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│   │ Game State  │  │   Camera    │  │  Renderer   │                │
│   │             │  │   Control   │  │  Commands   │                │
│   │ - map       │  │             │  │             │                │
│   │ - entities  │  │ - position  │  │ - 3d glyphs │                │
│   │ - player    │  │ - mode      │  │ - sprites   │                │
│   │ - inventory │  │ - target    │  │ - ui glyphs │                │
│   │ - combat    │  │ - lerp      │  │ - lights    │                │
│   │ - quests    │  │             │  │             │                │
│   └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│   │   Input     │  │     UI      │  │   Audio     │                │
│   │  Handling   │  │   Logic     │  │  Commands   │                │
│   │             │  │             │  │             │                │
│   │ - bindings  │  │ - menus     │  │ - play sfx  │                │
│   │ - modes     │  │ - hud       │  │ - play music│                │
│   │ - context   │  │ - dialogue  │  │ - stop      │                │
│   └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │   Engine API        │
                   │                     │
                   │ • render_*          │
                   │ • camera_*          │
                   │ • audio_*           │
                   │ • input (polled)    │
                   └──────────┬──────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                          ENGINE (C++)                               │
│                                                                     │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│   │  Vulkan RT       │  │  UI Renderer     │  │  Audio         │   │
│   │                  │  │                  │  │                │   │
│   │ - accel struct   │  │ - glyph buffer   │  │ - mixer        │   │
│   │ - ray pipeline   │  │ - text effects   │  │ - sfx pool     │   │
│   │ - materials      │  │ - font atlas     │  │ - music stream │   │
│   │ - post process   │  │ - compositing    │  │                │   │
│   └──────────────────┘  └──────────────────┘  └────────────────┘   │
│                                                                     │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐   │
│   │  Window/Input    │  │  Hot Reload      │  │  Lua Runtime   │   │
│   │                  │  │                  │  │                │   │
│   │ - GLFW           │  │ - file watcher   │  │ - sol2         │   │
│   │ - poll events    │  │ - shader reload  │  │ - sandboxed    │   │
│   │ - key states     │  │ - lua reload     │  │ - error catch  │   │
│   └──────────────────┘  └──────────────────┘  └────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Engine API

The engine exposes these functions to Lua. Nothing more.

### Rendering - 3D World

```lua
-- Clear the 3D render list (call at start of frame)
engine.clear_3d()

-- Add a 3D glyph to render
engine.glyph_3d {
    pos = {x, y, z},            -- World position
    glyph = "#",                -- Character
    
    -- Geometry
    height = 1.0,               -- Extrusion
    bevel = 0.1,                -- Edge rounding
    scale = 1.0,                -- Size multiplier
    rotation = 0.0,             -- Y-axis rotation (radians)
    
    -- Material
    color = {0.5, 0.5, 0.5},
    roughness = 0.8,
    metallic = 0.0,
    
    -- Emission (optional - makes it a light)
    emission = {1.0, 0.5, 0.1},
    emission_power = 5.0,
}

-- Add a billboard sprite (multi-glyph, always faces camera)
engine.sprite_3d {
    pos = {x, y, z},
    sprite_id = "goblin",       -- Registered sprite
    scale = 1.0,
    
    -- Optional overrides
    tint = {1, 1, 1},           -- Color multiply
    emission_boost = 0.0,       -- Add to all emission
}

-- Add a flat quad (floor, ceiling, decal)
engine.quad_3d {
    pos = {x, y, z},
    normal = {0, 1, 0},         -- Facing direction
    size = {1, 1},
    glyph = ".",
    color = {0.3, 0.3, 0.3},
    roughness = 0.9,
}

-- Add a point light (no geometry, just light)
engine.light_3d {
    pos = {x, y, z},
    color = {1.0, 0.8, 0.6},
    power = 10.0,
    radius = 15.0,
}
```

### Rendering - UI Layer

```lua
-- Clear UI (call at start of frame)
engine.clear_ui()

-- Add a UI glyph
engine.glyph_ui {
    col = 10,                   -- Character column
    row = 5,                    -- Character row
    glyph = "A",
    
    fg = {1, 1, 1, 1},          -- Foreground RGBA
    bg = {0, 0, 0, 0},          -- Background RGBA
    
    -- Effects (bitmask or table)
    effects = FX_GLOW | FX_PULSE,
    
    -- Effect parameters
    glow_intensity = 0.5,
    pulse_speed = 2.0,
    pulse_amount = 0.3,
    shake_intensity = 0.0,
    wave_amplitude = 0.0,
    wave_frequency = 0.0,
    
    -- For animated effects
    effect_time = 0.0,          -- Seconds since effect started
}

-- Convenience: render a string
engine.text_ui {
    col = 10,
    row = 5,
    text = "Hello World",
    fg = {1, 1, 1, 1},
    effects = FX_NONE,
    -- ... same params as glyph_ui, applied to all chars
}

-- Convenience: render a box
engine.box_ui {
    col = 5, row = 5,
    width = 20, height = 10,
    fg = {1, 1, 1, 1},          -- Border color
    bg = {0, 0, 0, 0.8},        -- Fill color
    style = "single",           -- "single", "double", "thick", "ascii"
}
```

### Camera

```lua
-- Set camera for this frame
engine.camera {
    pos = {x, y, z},            -- Eye position
    target = {x, y, z},         -- Look-at point (optional if using angles)
    
    -- Or use angles
    yaw = 0.0,                  -- Radians
    pitch = 0.0,
    
    fov = 75.0,                 -- Field of view
    near = 0.1,
    far = 100.0,
    
    -- Projection mode
    mode = "perspective",       -- "perspective" or "orthographic"
    ortho_size = 10.0,          -- For orthographic
}
```

### Input (Polled)

```lua
-- Check key state
engine.key_down("W")            -- Currently held
engine.key_pressed("space")     -- Just pressed this frame
engine.key_released("escape")   -- Just released this frame

-- Mouse
engine.mouse_pos()              -- Returns {x, y} in pixels
engine.mouse_delta()            -- Returns {dx, dy} since last frame
engine.mouse_down(1)            -- Button 1, 2, 3...
engine.mouse_pressed(1)
engine.mouse_released(1)

-- Gamepad (optional)
engine.gamepad_connected(0)
engine.gamepad_axis(0, "left_x")
engine.gamepad_button(0, "a")
```

### Audio

```lua
engine.play_sfx("sword_hit", { volume = 1.0, pitch = 1.0 })
engine.play_music("dungeon_ambient", { volume = 0.5, loop = true })
engine.stop_music(fade_seconds)
engine.set_master_volume(0.8)
```

### Sprites (Registration)

```lua
-- Register a sprite (typically at startup)
engine.register_sprite {
    id = "goblin",
    art = {
        "  ^  ",
        " (g) ",
        " /|\\ ",
        " / \\ ",
    },
    materials = {
        ["^"] = { color = {0.2, 0.4, 0.2} },
        ["g"] = { color = {0.3, 0.6, 0.3}, emission = {0.1, 0.2, 0.1}, emission_power = 0.3 },
    },
    default_material = { color = {0.3, 0.5, 0.3} },
}
```

### System

```lua
engine.delta_time()             -- Seconds since last frame
engine.total_time()             -- Seconds since start
engine.screen_size()            -- Returns {width, height} in pixels
engine.ui_size()                -- Returns {cols, rows} in characters
engine.quit()                   -- Request exit
```

---

## Lua Game Structure

```
/lua
│
├── main.lua                    # Entry point, called by engine
│
├── /engine
│   ├── api.lua                 # Thin wrappers, helpers
│   ├── vec.lua                 # Vector math
│   └── utils.lua               # General utilities
│
├── /game
│   ├── state.lua               # Master game state
│   ├── map.lua                 # Map data structure
│   ├── entity.lua              # Entity management
│   ├── player.lua              # Player-specific logic
│   ├── combat.lua              # Combat system
│   ├── inventory.lua           # Items, equipment
│   └── save.lua                # Serialization
│
├── /view
│   ├── camera.lua              # Camera controller
│   ├── renderer.lua            # Translates game state → render commands
│   │
│   ├── /modes
│   │   ├── first_person.lua    # FP camera + rendering
│   │   ├── isometric.lua       # Iso camera + rendering
│   │   ├── top_down.lua        # Top-down view
│   │   └── side_scroll.lua     # 2D side view
│   │
│   └── /styles
│       ├── dungeon.lua         # Dark, torchlit
│       ├── overworld.lua       # Bright, outdoor
│       └── void.lua            # Abstract, minimal
│
├── /ui
│   ├── manager.lua             # UI state machine
│   ├── components.lua          # Reusable widgets
│   ├── hud.lua                 # In-game HUD
│   ├── combat_ui.lua           # Combat interface
│   ├── dialogue.lua            # Dialogue system
│   ├── inventory_ui.lua        # Inventory screen
│   └── menu.lua                # Menus (main, pause, etc.)
│
├── /input
│   ├── handler.lua             # Input processing
│   ├── bindings.lua            # Key bindings
│   └── modes.lua               # Context-sensitive input
│
├── /content
│   ├── sprites.lua             # All sprite definitions
│   ├── materials.lua           # Material presets
│   ├── enemies.lua             # Enemy templates
│   ├── items.lua               # Item definitions
│   └── maps/
│       ├── test.lua
│       └── dungeon_1.lua
│
└── /experiments
    └── sandbox.lua             # Your playground
```

---

## Main Loop (Lua Side)

```lua
-- main.lua

local state = require("game.state")
local input = require("input.handler")
local view = require("view.renderer")
local ui = require("ui.manager")

function init()
    -- Register sprites
    require("content.sprites").register_all()
    
    -- Load initial map
    state.load_map("test")
    
    -- Set initial view mode
    view.set_mode("first_person")
end

function update(dt)
    -- Process input
    input.update(dt)
    
    -- Update game state
    state.update(dt)
    
    -- Update UI
    ui.update(dt)
end

function render()
    -- Clear render lists
    engine.clear_3d()
    engine.clear_ui()
    
    -- Set camera based on current view mode
    view.set_camera()
    
    -- Render world
    view.render_world(state)
    
    -- Render UI
    ui.render()
end

-- Engine calls these
_G.on_init = init
_G.on_update = update
_G.on_render = render
```

---

## View Modes

### First Person

```lua
-- view/modes/first_person.lua

local fp = {}

local camera = {
    grid_pos = {x = 5, y = 5},
    facing = 0,                     -- 0=N, 1=E, 2=S, 3=W
    
    -- Interpolated
    render_pos = {x = 5, y = 0.6, z = 5},
    render_yaw = 0,
    
    eye_height = 0.6,
    fov = 75,
    move_speed = 8,
    turn_speed = 10,
}

function fp.update(dt, input_state)
    -- Grid movement
    if input_state.move_forward then
        local dir = facing_to_dir(camera.facing)
        local target = vec.add(camera.grid_pos, dir)
        if state.map:is_walkable(target) then
            camera.grid_pos = target
        end
    end
    
    if input_state.turn_left then
        camera.facing = (camera.facing - 1) % 4
    end
    if input_state.turn_right then
        camera.facing = (camera.facing + 1) % 4
    end
    
    -- Interpolate render position
    local target_pos = {
        x = camera.grid_pos.x,
        y = camera.eye_height,
        z = camera.grid_pos.y
    }
    camera.render_pos = vec.lerp(camera.render_pos, target_pos, camera.move_speed * dt)
    
    local target_yaw = camera.facing * (math.pi / 2)
    camera.render_yaw = lerp_angle(camera.render_yaw, target_yaw, camera.turn_speed * dt)
end

function fp.set_camera()
    local dir = {
        x = math.sin(camera.render_yaw),
        y = 0,
        z = math.cos(camera.render_yaw)
    }
    
    engine.camera {
        pos = camera.render_pos,
        target = vec.add(camera.render_pos, dir),
        fov = camera.fov,
        mode = "perspective",
    }
end

function fp.render_world(state)
    -- Render map cells
    for y = 0, state.map.height - 1 do
        for x = 0, state.map.width - 1 do
            local cell = state.map:get(x, y)
            if cell.glyph ~= " " then
                render_cell_3d(x, y, cell)
            end
        end
    end
    
    -- Render entities (excluding player)
    for _, entity in ipairs(state.entities) do
        if entity ~= state.player then
            engine.sprite_3d {
                pos = entity_world_pos(entity),
                sprite_id = entity.sprite_id,
                scale = entity.scale or 1.0,
            }
        end
    end
end

return fp
```

### Isometric

```lua
-- view/modes/isometric.lua

local iso = {}

local camera = {
    target = {x = 5, y = 5},        -- Grid position we're looking at
    distance = 20,
    angle = math.pi / 4,            -- 45 degrees
    height_angle = math.atan(0.5),  -- Classic iso angle
    
    -- Interpolated
    render_target = {x = 5, y = 0, z = 5},
}

function iso.update(dt, input_state)
    -- Pan with arrow keys or follow player
    if input_state.follow_player then
        camera.target = state.player.grid_pos
    end
    
    -- Interpolate
    local target = {
        x = camera.target.x,
        y = 0,
        z = camera.target.y
    }
    camera.render_target = vec.lerp(camera.render_target, target, 5 * dt)
end

function iso.set_camera()
    local offset = {
        x = math.sin(camera.angle) * math.cos(camera.height_angle) * camera.distance,
        y = math.sin(camera.height_angle) * camera.distance,
        z = math.cos(camera.angle) * math.cos(camera.height_angle) * camera.distance,
    }
    
    engine.camera {
        pos = vec.add(camera.render_target, offset),
        target = camera.render_target,
        mode = "orthographic",
        ortho_size = 15,
    }
end

function iso.render_world(state)
    -- Same map rendering, different camera makes it isometric
    for y = 0, state.map.height - 1 do
        for x = 0, state.map.width - 1 do
            local cell = state.map:get(x, y)
            if cell.glyph ~= " " then
                render_cell_3d(x, y, cell)
            end
        end
    end
    
    -- Entities (including player visible from above)
    for _, entity in ipairs(state.entities) do
        engine.sprite_3d {
            pos = entity_world_pos(entity),
            sprite_id = entity.sprite_id,
            scale = entity.scale or 1.0,
        }
    end
end

return iso
```

### Top-Down (Classic Roguelike)

```lua
-- view/modes/top_down.lua

local td = {}

local camera = {
    target = {x = 5, y = 5},
    height = 15,
}

function td.set_camera()
    engine.camera {
        pos = {camera.target.x, camera.height, camera.target.y},
        target = {camera.target.x, 0, camera.target.y},
        mode = "orthographic",
        ortho_size = 20,
    }
end

function td.render_world(state)
    -- Render floor as quads
    for y = 0, state.map.height - 1 do
        for x = 0, state.map.width - 1 do
            local cell = state.map:get(x, y)
            
            -- Floor quad
            engine.quad_3d {
                pos = {x, 0, y},
                normal = {0, 1, 0},
                size = {1, 1},
                glyph = cell.glyph,
                color = cell.color,
            }
            
            -- Walls as short extrusions
            if cell.height > 0 then
                engine.glyph_3d {
                    pos = {x, cell.height / 2, y},
                    glyph = cell.glyph,
                    height = cell.height,
                    color = cell.color,
                }
            end
        end
    end
end

return td
```

---

## Game State

```lua
-- game/state.lua

local State = {}

State.map = nil
State.entities = {}
State.player = nil
State.combat = nil
State.time = 0
State.turn = 0

function State.load_map(name)
    local map_data = require("content.maps." .. name)
    State.map = Map.new(map_data)
    State.entities = {}
    
    -- Spawn entities from map data
    for _, spawn in ipairs(map_data.spawns) do
        local entity = Entity.new(spawn)
        table.insert(State.entities, entity)
        
        if spawn.is_player then
            State.player = entity
        end
    end
end

function State.update(dt)
    State.time = State.time + dt
    
    -- Update entities
    for _, entity in ipairs(State.entities) do
        entity:update(dt)
    end
    
    -- Combat update (if active)
    if State.combat then
        State.combat:update(dt)
    end
end

function State.start_combat(participants)
    State.combat = Combat.new(participants)
end

function State.end_combat()
    State.combat = nil
end

return State
```

---

## Map Data Structure

```lua
-- game/map.lua

local Map = {}
Map.__index = Map

function Map.new(data)
    local self = setmetatable({}, Map)
    
    self.width = data.width
    self.height = data.height
    self.cells = {}
    
    -- Parse map string or cell array
    if data.ascii then
        self:parse_ascii(data.ascii, data.legend)
    else
        self.cells = data.cells
    end
    
    return self
end

function Map:get(x, y)
    if x < 0 or x >= self.width or y < 0 or y >= self.height then
        return { glyph = " ", walkable = false }
    end
    return self.cells[y * self.width + x + 1]
end

function Map:set(x, y, cell)
    if x >= 0 and x < self.width and y >= 0 and y < self.height then
        self.cells[y * self.width + x + 1] = cell
    end
end

function Map:is_walkable(pos)
    local cell = self:get(pos.x, pos.y)
    return cell.walkable
end

function Map:parse_ascii(lines, legend)
    for y, line in ipairs(lines) do
        for x = 1, #line do
            local char = line:sub(x, x)
            local template = legend[char] or { glyph = char }
            
            self.cells[(y-1) * self.width + x] = {
                glyph = template.glyph or char,
                height = template.height or 0,
                color = template.color or {0.5, 0.5, 0.5},
                roughness = template.roughness or 0.8,
                metallic = template.metallic or 0,
                emission = template.emission,
                emission_power = template.emission_power or 0,
                walkable = template.walkable ~= false,
                blocks_sight = template.blocks_sight or false,
            }
        end
    end
end

return Map
```

---

## Content Example: Map Definition

```lua
-- content/maps/test.lua

return {
    width = 20,
    height = 15,
    
    ascii = {
        "####################",
        "#..................#",
        "#..###..........#..#",
        "#..#*#..........#..#",
        "#..###..........#..#",
        "#.........g........#",
        "#..................#",
        "#.....~~~~~~.......#",
        "#.....~~~~~~.......#",
        "#.....~~~~~~.......#",
        "#..................#",
        "#..........T.......#",
        "#...@..............#",
        "#..................#",
        "####################",
    },
    
    legend = {
        ["#"] = {
            glyph = "#",
            height = 1.0,
            color = {0.4, 0.4, 0.45},
            roughness = 0.9,
            walkable = false,
            blocks_sight = true,
        },
        ["."] = {
            glyph = ".",
            height = 0,
            color = {0.25, 0.25, 0.25},
            roughness = 0.95,
            walkable = true,
        },
        ["~"] = {
            glyph = "~",
            height = -0.1,
            color = {0.1, 0.3, 0.5},
            roughness = 0.1,
            walkable = false,
            animated = true,
        },
        ["*"] = {
            glyph = "*",
            height = 0.3,
            color = {1.0, 0.6, 0.2},
            emission = {1.0, 0.6, 0.2},
            emission_power = 8.0,
            walkable = false,
        },
    },
    
    spawns = {
        { x = 4, y = 12, is_player = true, sprite_id = "player" },
        { x = 10, y = 5, type = "enemy", template = "goblin" },
        { x = 11, y = 11, type = "enemy", template = "troll" },
    },
}
```

---

## Entity Definition

```lua
-- game/entity.lua

local Entity = {}
Entity.__index = Entity

function Entity.new(data)
    local self = setmetatable({}, Entity)
    
    self.id = data.id or generate_id()
    self.type = data.type or "prop"
    
    -- Position
    self.grid_pos = { x = data.x, y = data.y }
    self.render_pos = { x = data.x, y = 0, z = data.y }
    self.facing = data.facing or 0
    
    -- Visual
    self.sprite_id = data.sprite_id
    self.scale = data.scale or 1.0
    
    -- Apply template
    if data.template then
        local template = require("content.enemies")[data.template]
        for k, v in pairs(template) do
            self[k] = v
        end
    end
    
    -- Stats
    self.hp = self.hp or self.max_hp or 10
    self.max_hp = self.max_hp or 10
    self.mp = self.mp or 0
    self.max_mp = self.max_mp or 0
    
    self.strength = self.strength or 5
    self.defense = self.defense or 5
    self.agility = self.agility or 5
    
    -- State
    self.state = "idle"
    self.state_time = 0
    
    return self
end

function Entity:update(dt)
    self.state_time = self.state_time + dt
    
    -- Interpolate render position
    local target = { x = self.grid_pos.x, y = 0.3, z = self.grid_pos.y }
    self.render_pos = vec.lerp(self.render_pos, target, 10 * dt)
end

function Entity:take_damage(amount)
    self.hp = math.max(0, self.hp - amount)
    self.state = "hit"
    self.state_time = 0
    
    if self.hp <= 0 then
        self.state = "dead"
    end
end

return Entity
```

---

## Combat System

```lua
-- game/combat.lua

local Combat = {}
Combat.__index = Combat

Combat.PHASES = {
    START = "start",
    PLAYER_INPUT = "player_input",
    PLAYER_EXECUTE = "player_execute",
    ENEMY_TURN = "enemy_turn",
    ENEMY_EXECUTE = "enemy_execute",
    RESOLVE = "resolve",
    VICTORY = "victory",
    DEFEAT = "defeat",
}

function Combat.new(participants)
    local self = setmetatable({}, Combat)
    
    self.participants = participants
    self.phase = Combat.PHASES.START
    self.phase_time = 0
    
    self.turn_order = {}
    self.current_turn = 1
    
    self.current_action = nil
    self.action_source = nil
    self.action_target = nil
    
    self.damage_numbers = {}
    self.messages = {}
    
    return self
end

function Combat:update(dt)
    self.phase_time = self.phase_time + dt
    
    -- Update damage numbers
    for i = #self.damage_numbers, 1, -1 do
        local dmg = self.damage_numbers[i]
        dmg.time = dmg.time + dt
        if dmg.time > dmg.duration then
            table.remove(self.damage_numbers, i)
        end
    end
    
    -- Phase logic
    if self.phase == Combat.PHASES.START then
        self:sort_turn_order()
        self:transition(Combat.PHASES.PLAYER_INPUT, 0.5)
        
    elseif self.phase == Combat.PHASES.PLAYER_EXECUTE then
        if self.phase_time > 0.5 then
            self:apply_action()
            self:advance_turn()
        end
        
    elseif self.phase == Combat.PHASES.ENEMY_TURN then
        local enemy = self:current_entity()
        local ai = require("content.ai." .. (enemy.ai or "basic"))
        local decision = ai.decide(enemy, self)
        
        self.current_action = decision.action
        self.action_target = decision.target
        self:transition(Combat.PHASES.ENEMY_EXECUTE)
        
    elseif self.phase == Combat.PHASES.ENEMY_EXECUTE then
        if self.phase_time > 0.5 then
            self:apply_action()
            self:advance_turn()
        end
    end
end

function Combat:player_action(action, target)
    self.current_action = action
    self.action_target = target
    self:transition(Combat.PHASES.PLAYER_EXECUTE)
end

function Combat:apply_action()
    local damage = self.current_action.damage or 0
    self.action_target:take_damage(damage)
    
    self:spawn_damage_number(self.action_target, damage)
end

function Combat:spawn_damage_number(entity, value)
    table.insert(self.damage_numbers, {
        value = value,
        pos = { x = entity.render_pos.x, y = entity.render_pos.y + 1, z = entity.render_pos.z },
        time = 0,
        duration = 1.5,
        is_heal = value < 0,
    })
end

function Combat:transition(phase, delay)
    self.phase = phase
    self.phase_time = -(delay or 0)
end

return Combat
```

---

## UI System

```lua
-- ui/manager.lua

local UI = {}

UI.stack = {}           -- Stack of active UI states
UI.toasts = {}          -- Floating notifications

function UI.push(screen)
    table.insert(UI.stack, screen)
    if screen.on_enter then screen:on_enter() end
end

function UI.pop()
    local screen = table.remove(UI.stack)
    if screen and screen.on_exit then screen:on_exit() end
end

function UI.current()
    return UI.stack[#UI.stack]
end

function UI.update(dt)
    -- Update toasts
    for i = #UI.toasts, 1, -1 do
        local toast = UI.toasts[i]
        toast.time = toast.time + dt
        if toast.time > toast.duration then
            table.remove(UI.toasts, i)
        end
    end
    
    -- Update current screen
    local current = UI.current()
    if current and current.update then
        current:update(dt)
    end
end

function UI.render()
    -- Render all screens in stack (for transparency)
    for _, screen in ipairs(UI.stack) do
        if screen.render then
            screen:render()
        end
    end
    
    -- Render toasts
    UI.render_toasts()
end

function UI.toast(text, duration)
    table.insert(UI.toasts, {
        text = text,
        time = 0,
        duration = duration or 2.0,
    })
end

function UI.render_toasts()
    local cols, rows = engine.ui_size()
    local y = rows - 5
    
    for i, toast in ipairs(UI.toasts) do
        local alpha = 1.0
        if toast.time > toast.duration - 0.5 then
            alpha = (toast.duration - toast.time) / 0.5
        end
        
        local x = math.floor((cols - #toast.text) / 2)
        engine.text_ui {
            col = x,
            row = y - (i - 1) * 2,
            text = toast.text,
            fg = {1, 1, 1, alpha},
            effects = FX_GLOW | FX_SHADOW,
            glow_intensity = 0.5,
        }
    end
end

return UI
```

---

## Input Handling

```lua
-- input/handler.lua

local Input = {}

Input.mode = "exploration"      -- exploration, combat, menu, dialogue
Input.state = {}                -- Current frame input state

local bindings = {
    exploration = {
        W = "move_forward",
        S = "move_backward",
        A = "turn_left",
        D = "turn_right",
        Q = "strafe_left",
        E = "strafe_right",
        space = "interact",
        escape = "menu",
        tab = "inventory",
    },
    combat = {
        ["1"] = "action_1",
        ["2"] = "action_2",
        ["3"] = "action_3",
        ["4"] = "action_4",
        escape = "flee",
    },
}

function Input.update(dt)
    Input.state = {}
    
    local mode_bindings = bindings[Input.mode] or {}
    
    for key, action in pairs(mode_bindings) do
        if engine.key_pressed(key) then
            Input.state[action] = true
        end
    end
end

function Input.set_mode(mode)
    Input.mode = mode
end

return Input
```

---

## Text Effects Reference

| Effect | Flag | Parameters | Description |
|--------|------|------------|-------------|
| Glow | `FX_GLOW` | `glow_intensity` | Bloom-friendly brightness |
| Shake | `FX_SHAKE` | `shake_intensity` | Position jitter |
| Wave | `FX_WAVE` | `wave_amplitude`, `wave_frequency` | Sine wave offset |
| Pulse | `FX_PULSE` | `pulse_speed`, `pulse_amount` | Color/alpha throb |
| Typewriter | `FX_TYPEWRITER` | `chars_per_sec` | Reveal over time |
| Glitch | `FX_GLITCH` | `glitch_intensity` | Random char swap |
| Rainbow | `FX_RAINBOW` | `rainbow_speed` | Hue cycle |
| Shadow | `FX_SHADOW` | - | Drop shadow |
| Outline | `FX_OUTLINE` | - | Character outline |
| Fade In | `FX_FADE_IN` | `fade_duration` | Alpha fade in |
| Fade Out | `FX_FADE_OUT` | `fade_duration` | Alpha fade out |
| Scale Pop | `FX_SCALE_POP` | - | Bounce on appear |
| Scramble | `FX_SCRAMBLE` | `scramble_duration` | Decode effect |
| Float Up | `FX_FLOAT_UP` | `float_speed` | Drift upward |
| Chromatic | `FX_CHROMATIC` | `chromatic_intensity` | RGB split |
| Blink | `FX_BLINK` | `blink_speed` | On/off flash |
| Scanline | `FX_SCANLINE` | - | CRT lines |

---

## Engine C++ (Minimal Interface)

The C++ side is thin—just Vulkan setup and executing Lua's render commands.

```cpp
// main.cpp (simplified)

int main() {
    // Init
    Window window(1920, 1080, "ASCII RT");
    VulkanContext vulkan(window);
    RTRenderer renderer(vulkan);
    UIRenderer ui_renderer(vulkan);
    LuaRuntime lua;
    
    // Bind engine API to Lua
    lua.bind("engine", EngineAPI{
        .renderer = &renderer,
        .ui = &ui_renderer,
        .window = &window,
    });
    
    // Load Lua game
    lua.run_file("lua/main.lua");
    lua.call("on_init");
    
    // Main loop
    while (!window.should_close()) {
        window.poll_events();
        float dt = window.delta_time();
        
        // Update
        lua.call("on_update", dt);
        
        // Render
        lua.call("on_render");
        
        // Execute render commands
        vulkan.begin_frame();
        renderer.render();                    // 3D RT pass
        ui_renderer.render();                 // UI pass
        vulkan.end_frame();
    }
    
    return 0;
}
```

---

## Directory Structure (Final)

```
/ascii_rt_engine
│
├── /src
│   ├── main.cpp
│   ├── window.cpp
│   ├── vulkan_context.cpp
│   ├── rt_renderer.cpp
│   ├── ui_renderer.cpp
│   ├── lua_runtime.cpp
│   ├── engine_api.cpp          # Binds engine functions to Lua
│   ├── audio.cpp
│   └── file_watcher.cpp
│
├── /shaders
│   ├── rt_raygen.rgen
│   ├── rt_closesthit.rchit
│   ├── rt_miss.rmiss
│   ├── rt_shadow.rchit
│   ├── ui.vert
│   ├── ui.frag
│   └── post_*.frag
│
├── /lua
│   ├── main.lua
│   ├── /engine                 # API helpers
│   ├── /game                   # Game state, logic
│   ├── /view                   # Camera, rendering
│   ├── /ui                     # UI screens
│   ├── /input                  # Input handling
│   ├── /content                # Sprites, maps, enemies
│   └── /experiments            # Playground
│
├── /assets
│   ├── /fonts
│   └── /audio
│
├── /third_party
│
├── CMakeLists.txt
└── README.md
```

---

## Flexibility Achieved

Want to change view modes?

```lua
-- In game
if engine.key_pressed("F1") then
    view.set_mode("first_person")
elseif engine.key_pressed("F2") then
    view.set_mode("isometric")
elseif engine.key_pressed("F3") then
    view.set_mode("top_down")
end
```

Want split-screen?

```lua
function render()
    -- Left half: player 1 first-person
    engine.set_viewport(0, 0, 0.5, 1.0)
    view.set_camera(player1_camera)
    view.render_world(state)
    
    -- Right half: player 2 first-person
    engine.set_viewport(0.5, 0, 0.5, 1.0)
    view.set_camera(player2_camera)
    view.render_world(state)
    
    -- Full screen UI
    engine.set_viewport(0, 0, 1, 1)
    ui.render()
end
```

Want a completely different game? Same engine, different Lua.

---

This is the final architecture. Engine renders, Lua decides everything else.
