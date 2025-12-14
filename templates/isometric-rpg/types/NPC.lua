-- ═══════════════════════════════════════════════════════════════════════════
-- NPC Type - Non-player characters with dialog and behavior
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "NPC",
  icon = "👤",
  color = "#4a9eff",
  description = "Non-player character with dialog, stats, and AI behavior",

  -- Inherits from Entity
  extends = "Entity",

  components = {
    -- Identity
    name = {
      type = "string",
      default = "Villager",
    },
    title = {
      type = "string",
      default = "",
    },
    portrait = {
      type = "asset",
      assetType = "texture",
    },

    -- Behavior
    faction = {
      type = "enum",
      options = { "friendly", "neutral", "hostile" },
      default = "neutral",
    },
    aiType = {
      type = "enum",
      options = { "static", "wander", "patrol", "follow", "flee" },
      default = "static",
    },
    patrolPath = {
      type = "array:vec3",
      default = {},
    },

    -- Dialog
    dialog = {
      type = "ref",
      refType = "Dialog",
    },
    greeting = {
      type = "string",
      default = "Hello, traveler.",
    },

    -- Stats
    stats = {
      type = "ref",
      refType = "Stats",
    },

    -- Inventory
    inventory = {
      type = "ref",
      refType = "Inventory",
    },
    shopkeeper = {
      type = "bool",
      default = false,
    },

    -- Quest
    questGiver = {
      type = "bool",
      default = false,
    },
    quests = {
      type = "array:ref",
      refType = "Quest",
      default = {},
    },
  },

  inspector = {
    { section = "Identity", fields = { "name", "title", "portrait", "glyph", "color" } },
    { section = "Transform", fields = { "position", "rotation" } },
    { section = "Behavior", fields = { "faction", "aiType", "patrolPath" } },
    { section = "Dialog", fields = { "dialog", "greeting" } },
    { section = "Stats", fields = { "stats" } },
    { section = "Commerce", fields = { "shopkeeper", "inventory" } },
    { section = "Quests", fields = { "questGiver", "quests" } },
  },

  collection = {
    title = "NPCs",
    view = "grid",
    thumbnail = "portrait",
    columns = { "name", "faction", "aiType" },
    groupBy = "faction",
    filter = { "faction", "shopkeeper", "questGiver" },
    actions = { "create", "duplicate", "delete" },
  },

  scene = {
    glyph = function(self)
      if self.faction == "hostile" then return "💀"
      elseif self.faction == "friendly" then return "😊"
      else return "👤" end
    end,
    label = "name",
    tint = function(self)
      if self.faction == "hostile" then return { 1, 0.3, 0.3, 1 }
      elseif self.faction == "friendly" then return { 0.3, 1, 0.5, 1 }
      else return { 0.8, 0.8, 0.8, 1 } end
    end,
  },

  preview = {
    template = "npc-card",
    width = 200,
    height = 250,
  },
}
