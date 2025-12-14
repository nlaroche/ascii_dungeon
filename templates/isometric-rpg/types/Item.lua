-- ═══════════════════════════════════════════════════════════════════════════
-- Item Type - Collectible items, equipment, and consumables
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Item",
  icon = "◈",
  color = "#ffaa00",
  description = "Items that can be collected, equipped, or consumed",

  components = {
    name = {
      type = "string",
      default = "Item",
    },
    description = {
      type = "string",
      default = "",
    },
    glyph = {
      type = "string",
      default = "◈",
    },
    icon = {
      type = "asset",
      assetType = "texture",
    },

    -- Category
    category = {
      type = "enum",
      options = { "weapon", "armor", "accessory", "consumable", "material", "key", "misc" },
      default = "misc",
    },
    rarity = {
      type = "enum",
      options = { "common", "uncommon", "rare", "epic", "legendary" },
      default = "common",
    },

    -- Stacking
    stackable = {
      type = "bool",
      default = true,
    },
    maxStack = {
      type = "int",
      default = 99,
      min = 1,
    },

    -- Value
    value = {
      type = "int",
      default = 0,
      min = 0,
    },

    -- Equipment stats (if equippable)
    equippable = {
      type = "bool",
      default = false,
    },
    slot = {
      type = "enum",
      options = { "none", "mainHand", "offHand", "head", "body", "legs", "feet", "accessory" },
      default = "none",
    },
    statModifiers = {
      type = "table",
      default = {},
    },

    -- Consumable effects
    consumable = {
      type = "bool",
      default = false,
    },
    useEffect = {
      type = "string",  -- Lua code or effect ID
      default = "",
    },
  },

  inspector = {
    { section = "Identity", fields = { "name", "description", "glyph", "icon" } },
    { section = "Category", fields = { "category", "rarity" } },
    { section = "Stacking", fields = { "stackable", "maxStack", "value" } },
    { section = "Equipment", fields = { "equippable", "slot", "statModifiers" } },
    { section = "Consumable", fields = { "consumable", "useEffect" } },
  },

  collection = {
    title = "Items",
    view = "grid",
    thumbnail = "icon",
    badge = "rarity",
    columns = { "name", "category", "rarity", "value" },
    groupBy = "category",
    filter = { "category", "rarity", "equippable", "consumable" },
    actions = { "create", "duplicate", "delete" },
  },

  scene = {
    glyph = "glyph",
    label = "name",
    tint = function(self)
      local rarityColors = {
        common = { 0.8, 0.8, 0.8, 1 },
        uncommon = { 0.3, 0.9, 0.3, 1 },
        rare = { 0.3, 0.5, 1, 1 },
        epic = { 0.7, 0.3, 0.9, 1 },
        legendary = { 1, 0.7, 0.2, 1 },
      }
      return rarityColors[self.rarity] or { 1, 1, 1, 1 }
    end,
  },
}
