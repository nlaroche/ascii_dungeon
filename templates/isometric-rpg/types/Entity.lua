-- ═══════════════════════════════════════════════════════════════════════════
-- Entity Type - Base type for all game objects in the world
-- ═══════════════════════════════════════════════════════════════════════════

return {
  name = "Entity",
  icon = "◆",
  color = "#888888",
  description = "Base game object that exists in the world",

  components = {
    name = {
      type = "string",
      default = "Entity",
    },
    glyph = {
      type = "string",
      default = "◆",
    },
    position = {
      type = "vec3",
      default = { 0, 0, 0 },
    },
    rotation = {
      type = "float",
      default = 0,
      min = 0,
      max = 360,
    },
    scale = {
      type = "vec3",
      default = { 1, 1, 1 },
    },
    color = {
      type = "color",
      default = { 1, 1, 1, 1 },
    },
    layer = {
      type = "enum",
      options = { "background", "terrain", "entities", "effects", "ui" },
      default = "entities",
    },
    visible = {
      type = "bool",
      default = true,
    },
    tags = {
      type = "array:string",
      default = {},
    },
  },

  inspector = {
    { section = "Transform", fields = { "position", "rotation", "scale" } },
    { section = "Appearance", fields = { "name", "glyph", "color", "visible" } },
    { section = "Metadata", fields = { "layer", "tags" } },
  },

  collection = {
    title = "Entities",
    columns = { "name", "glyph", "layer" },
    groupBy = "layer",
    filter = { "layer", "tags" },
    actions = { "create", "duplicate", "delete" },
  },

  scene = {
    glyph = "glyph",
    label = "name",
    tint = "color",
  },
}
