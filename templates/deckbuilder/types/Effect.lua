-- ═══════════════════════════════════════════════════════════════════════════
-- Effect Type - Card effects and abilities
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Effect",
  icon = "✨",
  color = "#f39c12",
  description = "An effect or ability that can be triggered by cards",

  components = {
    name = {
      type = "string",
      default = "New Effect",
    },
    description = {
      type = "string",
      default = "",
    },

    -- Trigger
    trigger = {
      type = "enum",
      options = {
        "onPlay",        -- When card is played
        "onDeath",       -- When creature dies
        "onDamage",      -- When dealing damage
        "onTakeDamage",  -- When receiving damage
        "onTurnStart",   -- At start of turn
        "onTurnEnd",     -- At end of turn
        "onDraw",        -- When drawn
        "onDiscard",     -- When discarded
        "activated",     -- Manual activation
      },
      default = "onPlay",
    },

    -- Effect type
    effectType = {
      type = "enum",
      options = {
        "damage",
        "heal",
        "draw",
        "discard",
        "buff",
        "debuff",
        "summon",
        "destroy",
        "transform",
        "copy",
        "mana",
        "custom",
      },
      default = "damage",
    },

    -- Target
    target = {
      type = "enum",
      options = { "self", "target", "all_enemies", "all_allies", "all", "random_enemy", "random_ally" },
      default = "target",
    },

    -- Value (damage amount, cards to draw, etc)
    value = {
      type = "int",
      default = 1,
    },
    valueScaling = {
      type = "string",  -- e.g., "attack", "manaCost", "cardsInHand"
      default = "",
    },

    -- Duration (for buffs/debuffs)
    duration = {
      type = "enum",
      options = { "instant", "untilEndOfTurn", "permanent", "turns" },
      default = "instant",
    },
    durationTurns = {
      type = "int",
      default = 1,
      min = 1,
    },

    -- Conditions
    condition = {
      type = "string",  -- Lua expression
      default = "",
    },

    -- Animation/VFX
    animation = {
      type = "enum",
      options = { "none", "projectile", "explosion", "heal_glow", "buff_sparkle", "custom" },
      default = "none",
    },
    sound = {
      type = "asset",
      assetType = "audio",
    },
  },

  inspector = {
    { section = "Identity", fields = { "name", "description" } },
    { section = "Trigger", fields = { "trigger" } },
    { section = "Effect", fields = { "effectType", "value", "valueScaling" } },
    { section = "Target", fields = { "target" } },
    { section = "Duration", fields = { "duration", "durationTurns" } },
    { section = "Condition", fields = { "condition" }, editor = "code" },
    { section = "Feedback", fields = { "animation", "sound" } },
  },

  -- Effects are usually embedded in cards, but can be standalone
  collection = {
    title = "Effect Library",
    view = "list",
    columns = { "name", "trigger", "effectType", "value" },
    groupBy = "effectType",
    filter = { "trigger", "effectType" },
    actions = { "create", "duplicate", "delete" },
  },

  -- Custom editor for visual effect building
  editor = "effect-builder",
}
