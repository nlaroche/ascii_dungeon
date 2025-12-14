-- ═══════════════════════════════════════════════════════════════════════════
-- Template Loader - Loads and initializes game templates
-- A template defines the "flavor" of game: what types exist, how they render,
-- and how the editor is configured.
-- ═══════════════════════════════════════════════════════════════════════════

local Template = {}

local Type = require("templates.core.type")
local Render = require("templates.core.engine-render")
local View = require("templates.core.engine-view")

-- Current loaded template
local current = nil

-- ─────────────────────────────────────────────────────────────────────────────
-- Template Structure
-- ─────────────────────────────────────────────────────────────────────────────

--[[
A template folder should contain:

  template-name/
    init.lua          -- Main template definition
    types/            -- Type definitions (Entity.lua, Card.lua, etc.)
    systems/          -- Game systems (Combat.lua, TurnManager.lua, etc.)
    prefabs/          -- Pre-made entities/objects
    assets/           -- Default assets (textures, sounds)

init.lua should return:
{
  name = "Template Name",
  description = "What this template is for",
  version = "1.0.0",

  -- Rendering mode
  render = {
    mode = "isometric",  -- or "table", "sidescroll", "free3d"
    ...overrides
  },

  -- Editor configuration
  view = {
    layout = "default",  -- or custom layout name
    panels = { ... },    -- additional panels
    tools = { ... },     -- additional tools
  },

  -- Types to load (or "all" to load everything in types/)
  types = { "Entity", "NPC", "Item" },

  -- Systems to load
  systems = { "Movement", "Combat", "Dialog" },
}
]]

-- ─────────────────────────────────────────────────────────────────────────────
-- Template Loading
-- ─────────────────────────────────────────────────────────────────────────────

function Template.load(templatePath)
  -- Load the template init file
  local initPath = templatePath .. ".init"
  local ok, definition = pcall(require, initPath)

  if not ok then
    error("Failed to load template: " .. tostring(definition))
  end

  current = {
    path = templatePath,
    definition = definition,
    types = {},
    systems = {},
  }

  -- Configure rendering
  if definition.render then
    Render.configure(definition.render)
  end

  -- Configure editor view
  if definition.view then
    View.configure(definition.view)

    -- Register custom panels
    for id, panel in pairs(definition.view.panels or {}) do
      View.definePanel(id, panel)
    end

    -- Register custom tools
    for id, tool in pairs(definition.view.tools or {}) do
      View.defineTool(id, tool)
    end

    -- Add menu items
    for menuName, items in pairs(definition.view.menus or {}) do
      for _, item in ipairs(items) do
        View.addMenuItem(menuName, item)
      end
    end
  end

  -- Load types
  local typesToLoad = definition.types or {}
  for _, typeName in ipairs(typesToLoad) do
    local typePath = templatePath .. ".types." .. typeName
    local typeOk, typeDef = pcall(require, typePath)
    if typeOk then
      Type.define(typeName, typeDef)
      current.types[typeName] = typeDef
    else
      print("Warning: Failed to load type " .. typeName .. ": " .. tostring(typeDef))
    end
  end

  -- Create type-driven panels
  View.createTypePanels(Type)

  -- Load systems
  local systemsToLoad = definition.systems or {}
  for _, systemName in ipairs(systemsToLoad) do
    local systemPath = templatePath .. ".systems." .. systemName
    local sysOk, sysDef = pcall(require, systemPath)
    if sysOk then
      current.systems[systemName] = sysDef
    else
      print("Warning: Failed to load system " .. systemName .. ": " .. tostring(sysDef))
    end
  end

  return current
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Template Access
-- ─────────────────────────────────────────────────────────────────────────────

function Template.current()
  return current
end

function Template.name()
  return current and current.definition.name or "None"
end

function Template.description()
  return current and current.definition.description or ""
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Available Templates
-- ─────────────────────────────────────────────────────────────────────────────

-- In a real implementation, this would scan the templates directory
Template.available = {
  {
    id = "isometric-rpg",
    name = "Isometric RPG",
    description = "Top-down isometric RPG with entities, stats, and dialog",
    icon = "🗡",
  },
  {
    id = "deckbuilder",
    name = "Deckbuilder",
    description = "Card game with deck building, effects, and turn-based combat",
    icon = "🃏",
  },
  {
    id = "visual-novel",
    name = "Visual Novel",
    description = "Story-driven game with characters, dialog, and branching paths",
    icon = "📖",
  },
  {
    id = "roguelike",
    name = "Roguelike",
    description = "Turn-based dungeon crawler with procedural generation",
    icon = "💀",
  },
  {
    id = "platformer",
    name = "Platformer",
    description = "Side-scrolling action game with physics and levels",
    icon = "🏃",
  },
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Serialization (for editor communication)
-- ─────────────────────────────────────────────────────────────────────────────

function Template.toJSON()
  return {
    current = current and {
      path = current.path,
      name = current.definition.name,
      description = current.definition.description,
      version = current.definition.version,
    } or nil,
    available = Template.available,
    types = Type.registryToJSON(),
    render = Render.toJSON(),
    view = View.toJSON(),
  }
end

return Template
