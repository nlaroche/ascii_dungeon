-- ═══════════════════════════════════════════════════════════════════════════
-- Card Type - Playing cards with costs, effects, and stats
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Card",
  icon = "🃏",
  color = "#ff6b6b",
  description = "Playing card with mana cost, effects, and combat stats",

  components = {
    -- Identity
    name = {
      type = "string",
      default = "New Card",
    },
    description = {
      type = "string",
      default = "",
    },
    flavorText = {
      type = "string",
      default = "",
    },
    art = {
      type = "asset",
      assetType = "texture",
    },

    -- Card type
    cardType = {
      type = "enum",
      options = { "creature", "spell", "artifact", "enchantment", "land" },
      default = "creature",
    },
    rarity = {
      type = "enum",
      options = { "common", "uncommon", "rare", "epic", "legendary" },
      default = "common",
    },
    set = {
      type = "string",
      default = "base",
    },

    -- Cost
    manaCost = {
      type = "int",
      default = 1,
      min = 0,
      max = 15,
    },
    colorCost = {
      type = "table",  -- { red = 1, blue = 2 }
      default = {},
    },

    -- Combat stats (for creatures)
    attack = {
      type = "int",
      default = 1,
      min = 0,
    },
    health = {
      type = "int",
      default = 1,
      min = 1,
    },

    -- Effects
    effects = {
      type = "array:ref",
      refType = "Effect",
      default = {},
    },
    keywords = {
      type = "array:ref",
      refType = "Keyword",
      default = {},
    },

    -- Targeting
    targetType = {
      type = "enum",
      options = { "none", "creature", "player", "any", "self", "all_creatures", "all_enemies" },
      default = "none",
    },

    -- Deck building
    maxCopies = {
      type = "int",
      default = 4,
      min = 1,
    },
    craftingCost = {
      type = "int",
      default = 100,
      min = 0,
    },
  },

  inspector = {
    { section = "Identity", fields = { "name", "art", "description", "flavorText" } },
    { section = "Classification", fields = { "cardType", "rarity", "set" } },
    { section = "Cost", fields = { "manaCost", "colorCost" } },
    { section = "Combat", fields = { "attack", "health" }, showIf = { cardType = "creature" } },
    { section = "Effects", fields = { "effects", "keywords", "targetType" }, editor = "effect-chain" },
    { section = "Collection", fields = { "maxCopies", "craftingCost" } },
  },

  collection = {
    title = "Card Library",
    view = "grid",
    thumbnail = "art",
    badge = "manaCost",
    columns = { "name", "cardType", "manaCost", "rarity" },
    groupBy = "cardType",
    filter = { "cardType", "rarity", "manaCost", "set" },
    sort = { "manaCost", "name", "rarity" },
    actions = { "create", "duplicate", "delete", "export" },
  },

  -- Card preview (rendered as actual card)
  preview = {
    template = "card-frame",
    width = 250,
    height = 350,
    showStats = true,
  },

  -- Scene representation
  scene = {
    glyph = "🃏",
    label = function(self)
      return string.format("%s (%d)", self.name, self.manaCost)
    end,
    tint = function(self)
      local rarityColors = {
        common = { 0.7, 0.7, 0.7, 1 },
        uncommon = { 0.3, 0.8, 0.4, 1 },
        rare = { 0.3, 0.5, 1, 1 },
        epic = { 0.7, 0.3, 0.9, 1 },
        legendary = { 1, 0.7, 0.2, 1 },
      }
      return rarityColors[self.rarity] or { 1, 1, 1, 1 }
    end,
  },
}
