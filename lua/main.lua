-- ASCII Dungeon - Main Lua Entry Point
-- This file will be called by the engine

local state = {}

function init()
    print("Lua init called!")
    -- TODO: Initialize game state
    -- TODO: Register sprites
    -- TODO: Load initial map
end

function update(dt)
    -- TODO: Process input
    -- TODO: Update game state
    -- TODO: Update entities
end

function render()
    -- TODO: Clear render lists
    -- TODO: Set camera
    -- TODO: Render world
    -- TODO: Render UI
end

-- Engine callbacks
_G.on_init = init
_G.on_update = update
_G.on_render = render
