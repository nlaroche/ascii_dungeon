-- ═══════════════════════════════════════════════════════════════════════════
-- Deck Type - Collection of cards for a player
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Deck",
  icon = "📚",
  color = "#4ecdc4",
  description = "A collection of cards used by a player",

  components = {
    name = {
      type = "string",
      default = "New Deck",
    },
    description = {
      type = "string",
      default = "",
    },
    cover = {
      type = "asset",
      assetType = "texture",
    },

    -- Cards in the deck (card ID -> count)
    cards = {
      type = "table",
      default = {},
    },

    -- Deck constraints
    minSize = {
      type = "int",
      default = 30,
      min = 1,
    },
    maxSize = {
      type = "int",
      default = 60,
      min = 1,
    },

    -- Deck archetype/theme
    archetype = {
      type = "enum",
      options = { "aggro", "control", "midrange", "combo", "custom" },
      default = "custom",
    },
    colors = {
      type = "array:string",
      default = {},
    },

    -- Stats (computed)
    cardCount = {
      type = "int",
      default = 0,
      readonly = true,
    },
    averageCost = {
      type = "float",
      default = 0,
      readonly = true,
    },
  },

  inspector = {
    { section = "Identity", fields = { "name", "description", "cover" } },
    { section = "Archetype", fields = { "archetype", "colors" } },
    { section = "Constraints", fields = { "minSize", "maxSize" } },
    { section = "Stats", fields = { "cardCount", "averageCost" } },
    { section = "Cards", fields = { "cards" }, editor = "deck-list" },
  },

  collection = {
    title = "Decks",
    view = "list",
    thumbnail = "cover",
    columns = { "name", "archetype", "cardCount" },
    groupBy = "archetype",
    actions = { "create", "duplicate", "delete", "export", "import" },
  },

  preview = {
    template = "deck-preview",
    width = 300,
    height = 400,
    showCurve = true,  -- Mana curve graph
  },
}
