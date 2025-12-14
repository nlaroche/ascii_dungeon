-- ═══════════════════════════════════════════════════════════════════════════
-- Stats Type - RPG statistics for entities
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Stats",
  icon = "📊",
  color = "#00d4aa",
  description = "RPG statistics and attributes",

  components = {
    -- Vitals
    health = { type = "int", default = 100, min = 0 },
    maxHealth = { type = "int", default = 100, min = 1 },
    mana = { type = "int", default = 50, min = 0 },
    maxMana = { type = "int", default = 50, min = 0 },
    stamina = { type = "int", default = 100, min = 0 },
    maxStamina = { type = "int", default = 100, min = 0 },

    -- Primary attributes
    strength = { type = "int", default = 10, min = 1 },
    dexterity = { type = "int", default = 10, min = 1 },
    intelligence = { type = "int", default = 10, min = 1 },
    vitality = { type = "int", default = 10, min = 1 },

    -- Combat
    attack = { type = "int", default = 10, min = 0 },
    defense = { type = "int", default = 5, min = 0 },
    speed = { type = "int", default = 10, min = 1 },
    critChance = { type = "float", default = 0.05, min = 0, max = 1 },
    critDamage = { type = "float", default = 1.5, min = 1 },

    -- Level
    level = { type = "int", default = 1, min = 1 },
    experience = { type = "int", default = 0, min = 0 },
    experienceToNext = { type = "int", default = 100, min = 1 },
  },

  inspector = {
    { section = "Vitals", fields = { "health", "maxHealth", "mana", "maxMana", "stamina", "maxStamina" } },
    { section = "Attributes", fields = { "strength", "dexterity", "intelligence", "vitality" } },
    { section = "Combat", fields = { "attack", "defense", "speed", "critChance", "critDamage" } },
    { section = "Level", fields = { "level", "experience", "experienceToNext" } },
  },

  -- Stats are usually embedded, not standalone
  collection = nil,

  -- Custom editor widget for inline display
  editor = "stats-bar",
}
