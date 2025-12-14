-- ═══════════════════════════════════════════════════════════════════════════
-- Type System - Define entity types with components and view configurations
-- Types are the schema for game objects. They define what data exists and
-- how it should be displayed in the editor.
-- ═══════════════════════════════════════════════════════════════════════════

local Type = {}
Type.__index = Type

-- Registry of all defined types
local registry = {}

-- ─────────────────────────────────────────────────────────────────────────────
-- Field Types
-- ─────────────────────────────────────────────────────────────────────────────

Type.FieldTypes = {
  string   = { default = "", editor = "text" },
  int      = { default = 0, editor = "number", step = 1 },
  float    = { default = 0.0, editor = "number", step = 0.1 },
  bool     = { default = false, editor = "checkbox" },
  vec2     = { default = {0, 0}, editor = "vec2" },
  vec3     = { default = {0, 0, 0}, editor = "vec3" },
  color    = { default = {1, 1, 1, 1}, editor = "color" },
  enum     = { default = nil, editor = "dropdown" },
  asset    = { default = nil, editor = "asset-picker" },
  ref      = { default = nil, editor = "ref-picker" },
  array    = { default = {}, editor = "array" },
  table    = { default = {}, editor = "object" },
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Type Definition
-- ─────────────────────────────────────────────────────────────────────────────

function Type.define(name, definition)
  local t = setmetatable({}, Type)

  t.name = name
  t.icon = definition.icon or "◆"
  t.color = definition.color or "#888888"
  t.description = definition.description or ""

  -- Component schema
  t.components = {}
  for fieldName, fieldDef in pairs(definition.components or {}) do
    t.components[fieldName] = Type.normalizeField(fieldName, fieldDef)
  end

  -- Inspector configuration
  t.inspector = definition.inspector or Type.autoInspector(t.components)

  -- Collection view (optional - creates a dockable panel showing all instances)
  t.collection = definition.collection

  -- Scene view rendering
  t.scene = definition.scene or {
    glyph = t.icon,
    label = "name",
  }

  -- Preview renderer (optional - for thumbnail/card preview)
  t.preview = definition.preview

  -- Register
  registry[name] = t

  return t
end

-- Normalize field definition to full form
function Type.normalizeField(name, def)
  -- Short form: "string" → { type = "string" }
  if type(def) == "string" then
    def = { type = def }
  end

  local field = {
    name = name,
    type = def.type or "string",
    default = def.default,
    min = def.min,
    max = def.max,
    step = def.step,
    options = def.options,      -- for enum
    assetType = def.assetType,  -- for asset (texture, audio, etc)
    refType = def.refType,      -- for ref (reference to another type)
    itemType = def.itemType,    -- for array
    editor = def.editor,        -- override default editor widget
    hidden = def.hidden or false,
    readonly = def.readonly or false,
  }

  -- Set default value based on type if not specified
  if field.default == nil then
    local typeInfo = Type.FieldTypes[field.type]
    if typeInfo then
      field.default = typeInfo.default
    end
    -- Enum defaults to first option
    if field.type == "enum" and field.options and #field.options > 0 then
      field.default = field.options[1]
    end
  end

  return field
end

-- Auto-generate inspector from components
function Type.autoInspector(components)
  local fields = {}
  for name, _ in pairs(components) do
    table.insert(fields, name)
  end
  table.sort(fields)
  return {{ section = "Properties", fields = fields }}
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Registry Access
-- ─────────────────────────────────────────────────────────────────────────────

function Type.get(name)
  return registry[name]
end

function Type.all()
  return registry
end

function Type.list()
  local names = {}
  for name, _ in pairs(registry) do
    table.insert(names, name)
  end
  table.sort(names)
  return names
end

-- Get all types that have collection views defined
function Type.withCollections()
  local result = {}
  for name, t in pairs(registry) do
    if t.collection then
      table.insert(result, t)
    end
  end
  return result
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Instance Creation
-- ─────────────────────────────────────────────────────────────────────────────

function Type:createInstance(overrides)
  overrides = overrides or {}
  local instance = {
    __type = self.name,
    __id = Type.generateId(),
  }

  -- Initialize all fields with defaults
  for name, field in pairs(self.components) do
    if overrides[name] ~= nil then
      instance[name] = overrides[name]
    else
      instance[name] = Type.deepCopy(field.default)
    end
  end

  return instance
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Utilities
-- ─────────────────────────────────────────────────────────────────────────────

local idCounter = 0
function Type.generateId()
  idCounter = idCounter + 1
  return string.format("%s_%d", os.time(), idCounter)
end

function Type.deepCopy(orig)
  if type(orig) ~= "table" then
    return orig
  end
  local copy = {}
  for k, v in pairs(orig) do
    copy[k] = Type.deepCopy(v)
  end
  return copy
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Serialization (for editor communication)
-- ─────────────────────────────────────────────────────────────────────────────

function Type:toJSON()
  return {
    name = self.name,
    icon = self.icon,
    color = self.color,
    description = self.description,
    components = self.components,
    inspector = self.inspector,
    collection = self.collection,
    scene = self.scene,
    preview = self.preview,
  }
end

function Type.registryToJSON()
  local result = {}
  for name, t in pairs(registry) do
    result[name] = t:toJSON()
  end
  return result
end

return Type
