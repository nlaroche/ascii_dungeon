-- ═══════════════════════════════════════════════════════════════════════════
-- Isometric RPG Template
-- Classic top-down isometric RPG with entities, stats, inventory, and dialog
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Isometric RPG",
  description = "Top-down isometric RPG with entities, stats, inventory, and dialog systems",
  version = "1.0.0",
  author = "ASCII Dungeon",

  -- ─────────────────────────────────────────────────────────────────────────
  -- Rendering Configuration
  -- ─────────────────────────────────────────────────────────────────────────

  render = {
    mode = "isometric",

    camera = {
      type = "orthographic",
      angle = { pitch = 45, yaw = 45 },
      zoom = { min = 0.5, max = 4.0, default = 1.0 },
      pan = true,
      rotate = true,  -- Allow rotation in 90-degree increments
    },

    grid = {
      enabled = true,
      size = 1.0,
      divisions = 32,
      color = { 0.2, 0.25, 0.3, 0.4 },
    },

    glyphs = {
      size = 1.0,
      billboarding = "y-axis",
      shadows = {
        enabled = true,
        offset = { 0.1, -0.1 },
        color = { 0, 0, 0, 0.4 },
      },
    },

    lighting = {
      ambient = { 0.25, 0.25, 0.35 },
      directional = {
        direction = { -0.5, -1.0, -0.3 },
        color = { 1.0, 0.95, 0.85 },
        intensity = 1.0,
        shadows = true,
      },
    },

    postProcess = "fantasy",
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Editor View Configuration
  -- ─────────────────────────────────────────────────────────────────────────

  view = {
    layout = {
      left = {
        size = 250,
        tabs = { "files", "Entity:collection", "NPC:collection" },
      },
      center = {
        tabs = { "scene", "code" },
      },
      right = {
        size = 320,
        tabs = { "properties", "chat" },
      },
      bottom = {
        size = 180,
        tabs = { "console", "assets" },
      },
    },

    defaultTool = "select",

    tools = {
      paint = {
        name = "Paint Tile",
        icon = "▦",
        shortcut = "B",
        cursor = "crosshair",
      },
      erase = {
        name = "Erase",
        icon = "✕",
        shortcut = "E",
        cursor = "not-allowed",
      },
      spawn = {
        name = "Spawn Entity",
        icon = "◆",
        shortcut = "P",
        cursor = "cell",
      },
      path = {
        name = "Path Tool",
        icon = "⋯",
        shortcut = "T",
        cursor = "crosshair",
      },
    },

    menus = {
      Game = {
        { label = "Play", shortcut = "F5", action = "game.play" },
        { label = "Play From Here", shortcut = "Shift+F5", action = "game.playFromHere" },
        { label = "Stop", shortcut = "Shift+Esc", action = "game.stop" },
        { separator = true },
        { label = "Game Settings", action = "game.settings" },
      },
    },
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Types to Load
  -- ─────────────────────────────────────────────────────────────────────────

  types = {
    "Entity",
    "NPC",
    "Item",
    "Stats",
    "Inventory",
    "Dialog",
    "Quest",
    "Map",
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Systems to Load
  -- ─────────────────────────────────────────────────────────────────────────

  systems = {
    "Movement",
    "Combat",
    "DialogSystem",
    "QuestSystem",
    "InventorySystem",
  },
}
