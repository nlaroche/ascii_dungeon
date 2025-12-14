-- ═══════════════════════════════════════════════════════════════════════════
-- Deckbuilder Template
-- Card game with deck building, effects, and turn-based combat
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Deckbuilder",
  description = "Card game with deck building, effects, and turn-based combat",
  version = "1.0.0",
  author = "ASCII Dungeon",

  -- ─────────────────────────────────────────────────────────────────────────
  -- Rendering Configuration
  -- ─────────────────────────────────────────────────────────────────────────

  render = {
    mode = "table",  -- Top-down view of the game table

    camera = {
      type = "orthographic",
      angle = { pitch = 90, yaw = 0 },  -- Looking straight down
      zoom = { min = 0.5, max = 2.0, default = 1.0 },
      pan = true,
      rotate = false,
    },

    -- No grid for card games
    grid = {
      enabled = false,
    },

    -- Subtle ambient lighting for table
    lighting = {
      ambient = { 0.9, 0.85, 0.8 },
      directional = {
        direction = { 0, -1, 0.2 },
        color = { 1.0, 0.98, 0.95 },
        intensity = 0.2,
        shadows = true,
      },
    },

    -- Table surface
    background = { 0.12, 0.1, 0.08 },  -- Dark felt

    -- Card rendering
    cards = {
      width = 2.5,
      height = 3.5,
      cornerRadius = 0.15,
      borderWidth = 0.05,
      shadowOffset = { 0.1, 0.15 },
      hoverScale = 1.1,
      selectGlow = true,
    },

    postProcess = "cinematic",
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Editor View Configuration
  -- ─────────────────────────────────────────────────────────────────────────

  view = {
    layout = {
      left = {
        size = 280,
        tabs = { "files", "Card:collection" },
      },
      center = {
        tabs = { "scene", "CardDesigner", "code" },
      },
      right = {
        size = 320,
        tabs = { "properties", "Deck:collection", "chat" },
      },
      bottom = {
        size = 200,
        tabs = { "console", "PlayTest" },
      },
    },

    panels = {
      CardDesigner = {
        title = "Card Designer",
        icon = "🎨",
        component = "deckbuilder/CardDesigner",
        position = "center",
      },
      DeckBuilder = {
        title = "Deck Builder",
        icon = "📚",
        component = "deckbuilder/DeckBuilder",
        position = "right",
      },
      PlayTest = {
        title = "Play Test",
        icon = "▶",
        component = "deckbuilder/PlayTest",
        position = "bottom",
      },
      EffectEditor = {
        title = "Effect Editor",
        icon = "✨",
        component = "deckbuilder/EffectEditor",
        position = "center",
      },
    },

    defaultTool = "select",

    tools = {
      placeCard = {
        name = "Place Card",
        icon = "🃏",
        shortcut = "C",
        cursor = "cell",
      },
      drawZone = {
        name = "Draw Zone",
        icon = "▢",
        shortcut = "Z",
        cursor = "crosshair",
      },
    },

    menus = {
      Game = {
        { label = "New Match", shortcut = "F5", action = "game.newMatch" },
        { label = "Draw Card", shortcut = "D", action = "game.drawCard" },
        { label = "End Turn", shortcut = "Space", action = "game.endTurn" },
        { separator = true },
        { label = "Reset Match", action = "game.resetMatch" },
        { separator = true },
        { label = "Game Rules", action = "game.rules" },
      },
      Cards = {
        { label = "New Card", shortcut = "Ctrl+N", action = "card.new" },
        { label = "Duplicate Card", shortcut = "Ctrl+D", action = "card.duplicate" },
        { separator = true },
        { label = "Import Cards", action = "card.import" },
        { label = "Export Cards", action = "card.export" },
      },
    },
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Types to Load
  -- ─────────────────────────────────────────────────────────────────────────

  types = {
    "Card",
    "Deck",
    "Effect",
    "Keyword",
    "Player",
    "Zone",
    "Match",
  },

  -- ─────────────────────────────────────────────────────────────────────────
  -- Systems to Load
  -- ─────────────────────────────────────────────────────────────────────────

  systems = {
    "TurnManager",
    "CardPlay",
    "EffectResolver",
    "DeckManager",
    "ZoneManager",
  },
}
