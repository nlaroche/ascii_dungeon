-- ═══════════════════════════════════════════════════════════════════════════
-- Engine View - Editor Layout and Panel Configuration
-- Defines how the editor is arranged, what panels exist, and how they behave.
-- Templates can customize the entire editing experience.
-- ═══════════════════════════════════════════════════════════════════════════

local View = {}

-- Current view configuration
local config = {}

-- ─────────────────────────────────────────────────────────────────────────────
-- Core Panels (always available, implemented in React)
-- ─────────────────────────────────────────────────────────────────────────────

View.CorePanels = {
  FileExplorer = {
    id = "files",
    title = "Files",
    icon = "📁",
    core = true,  -- Cannot be removed
    defaultPosition = "left",
  },

  SceneView = {
    id = "scene",
    title = "Scene",
    icon = "🎬",
    core = true,
    defaultPosition = "center",
    toolbar = true,  -- Has a toolbar
  },

  Properties = {
    id = "properties",
    title = "Properties",
    icon = "⚙",
    core = true,
    defaultPosition = "right",
    -- Loads type-specific inspectors dynamically
    dynamic = true,
  },

  Console = {
    id = "console",
    title = "Console",
    icon = "▸",
    core = true,
    defaultPosition = "bottom",
  },

  Assets = {
    id = "assets",
    title = "Assets",
    icon = "◈",
    core = true,
    defaultPosition = "bottom",
  },

  AIChat = {
    id = "chat",
    title = "AI",
    icon = "◆",
    core = true,
    defaultPosition = "right",
  },
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Panel Registry (template-defined panels)
-- ─────────────────────────────────────────────────────────────────────────────

local customPanels = {}

function View.definePanel(id, definition)
  customPanels[id] = {
    id = id,
    title = definition.title or id,
    icon = definition.icon or "◇",
    core = false,
    defaultPosition = definition.position or "right",

    -- Panel content source
    component = definition.component,  -- React component name
    luaView = definition.luaView,      -- Or Lua-defined UI

    -- For type-driven panels (auto-created from Type.collection)
    typeId = definition.typeId,

    -- Panel behavior
    singleton = definition.singleton ~= false,  -- Only one instance
    closable = definition.closable ~= false,
    floatable = definition.floatable ~= false,

    -- Toolbar actions
    toolbar = definition.toolbar,
  }
  return customPanels[id]
end

function View.getPanel(id)
  return View.CorePanels[id] or customPanels[id]
end

function View.allPanels()
  local all = {}
  for id, panel in pairs(View.CorePanels) do
    all[id] = panel
  end
  for id, panel in pairs(customPanels) do
    all[id] = panel
  end
  return all
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Layout Configuration
-- ─────────────────────────────────────────────────────────────────────────────

View.Layouts = {
  -- Default layout for general use
  default = {
    left = {
      size = 250,
      tabs = { "files", "entities" },
    },
    center = {
      tabs = { "scene", "code" },
    },
    right = {
      size = 300,
      tabs = { "properties", "chat" },
    },
    bottom = {
      size = 200,
      tabs = { "console", "assets" },
      collapsed = false,
    },
  },

  -- Minimal layout for focused work
  minimal = {
    center = {
      tabs = { "scene" },
    },
    right = {
      size = 300,
      tabs = { "properties" },
    },
  },

  -- Wide layout for map editing
  wide = {
    left = {
      size = 200,
      tabs = { "files" },
    },
    center = {
      tabs = { "scene" },
    },
    right = {
      size = 350,
      tabs = { "properties", "entities" },
    },
    bottom = {
      size = 150,
      tabs = { "console" },
    },
  },
}

function View.setLayout(layoutName)
  if View.Layouts[layoutName] then
    config.layout = View.Layouts[layoutName]
  end
end

function View.defineLayout(name, layout)
  View.Layouts[name] = layout
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Type-Driven Panels
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-create collection panels from Type definitions
function View.createTypePanels(Type)
  for _, t in pairs(Type.withCollections()) do
    View.definePanel(t.name .. ":collection", {
      title = t.collection.title or (t.name .. "s"),
      icon = t.icon,
      typeId = t.name,
      position = "left",

      -- Collection view settings from type definition
      view = t.collection.view or "list",
      columns = t.collection.columns,
      groupBy = t.collection.groupBy,
      thumbnail = t.collection.thumbnail,
      filter = t.collection.filter,
      actions = t.collection.actions or { "create", "delete" },
    })
  end
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Editor Tools
-- ─────────────────────────────────────────────────────────────────────────────

local tools = {}

View.CoreTools = {
  select = {
    id = "select",
    name = "Select",
    icon = "◇",
    shortcut = "V",
    cursor = "default",
  },
  move = {
    id = "move",
    name = "Move",
    icon = "✥",
    shortcut = "G",
    cursor = "move",
  },
  rotate = {
    id = "rotate",
    name = "Rotate",
    icon = "↻",
    shortcut = "R",
    cursor = "crosshair",
  },
  scale = {
    id = "scale",
    name = "Scale",
    icon = "⤡",
    shortcut = "S",
    cursor = "nwse-resize",
  },
}

function View.defineTool(id, definition)
  tools[id] = {
    id = id,
    name = definition.name or id,
    icon = definition.icon or "◇",
    shortcut = definition.shortcut,
    cursor = definition.cursor or "crosshair",

    -- Tool behavior
    onActivate = definition.onActivate,
    onDeactivate = definition.onDeactivate,
    onMouseDown = definition.onMouseDown,
    onMouseMove = definition.onMouseMove,
    onMouseUp = definition.onMouseUp,
  }
  return tools[id]
end

function View.allTools()
  local all = {}
  for id, tool in pairs(View.CoreTools) do
    all[id] = tool
  end
  for id, tool in pairs(tools) do
    all[id] = tool
  end
  return all
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Menu Configuration
-- ─────────────────────────────────────────────────────────────────────────────

local menus = {
  File = {
    { label = "New Project", shortcut = "Ctrl+Shift+N", action = "project.new" },
    { label = "Open Project", shortcut = "Ctrl+O", action = "project.open" },
    { label = "Open Recent", submenu = "recentProjects" },
    { separator = true },
    { label = "Save", shortcut = "Ctrl+S", action = "project.save" },
    { label = "Save As...", shortcut = "Ctrl+Shift+S", action = "project.saveAs" },
    { separator = true },
    { label = "Export", submenu = "exportFormats" },
    { separator = true },
    { label = "Close Project", action = "project.close" },
  },
  Edit = {
    { label = "Undo", shortcut = "Ctrl+Z", action = "edit.undo" },
    { label = "Redo", shortcut = "Ctrl+Y", action = "edit.redo" },
    { separator = true },
    { label = "Cut", shortcut = "Ctrl+X", action = "edit.cut" },
    { label = "Copy", shortcut = "Ctrl+C", action = "edit.copy" },
    { label = "Paste", shortcut = "Ctrl+V", action = "edit.paste" },
    { label = "Delete", shortcut = "Del", action = "edit.delete" },
    { separator = true },
    { label = "Select All", shortcut = "Ctrl+A", action = "edit.selectAll" },
  },
  View = {
    { label = "Panels", submenu = "panels" },
    { label = "Layout", submenu = "layouts" },
    { separator = true },
    { label = "Reset Layout", action = "view.resetLayout" },
  },
}

function View.addMenu(name, items)
  menus[name] = items
end

function View.addMenuItem(menuName, item, position)
  if not menus[menuName] then
    menus[menuName] = {}
  end
  if position then
    table.insert(menus[menuName], position, item)
  else
    table.insert(menus[menuName], item)
  end
end

function View.getMenus()
  return menus
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Context Menus
-- ─────────────────────────────────────────────────────────────────────────────

local contextMenus = {}

function View.defineContextMenu(context, items)
  contextMenus[context] = items
end

function View.getContextMenu(context)
  return contextMenus[context] or {}
end

-- Default context menus
View.defineContextMenu("entity", {
  { label = "Duplicate", shortcut = "Ctrl+D", action = "entity.duplicate" },
  { label = "Delete", shortcut = "Del", action = "entity.delete" },
  { separator = true },
  { label = "Copy", shortcut = "Ctrl+C", action = "entity.copy" },
  { label = "Cut", shortcut = "Ctrl+X", action = "entity.cut" },
  { separator = true },
  { label = "Focus", shortcut = "F", action = "camera.focusEntity" },
})

View.defineContextMenu("file", {
  { label = "Open", action = "file.open" },
  { label = "Rename", shortcut = "F2", action = "file.rename" },
  { label = "Delete", action = "file.delete" },
  { separator = true },
  { label = "New File", action = "file.new" },
  { label = "New Folder", action = "folder.new" },
})

-- ─────────────────────────────────────────────────────────────────────────────
-- Theme Integration
-- ─────────────────────────────────────────────────────────────────────────────

View.Themes = {
  dark = {
    bg = "#0a0a0a",
    bgPanel = "#111111",
    bgHover = "#1a1a1a",
    border = "#2a2a2a",
    text = "#e0e0e0",
    textMuted = "#888888",
    textDim = "#555555",
    accent = "#00d4aa",
    accentBg = "#00d4aa20",
    success = "#00ff88",
    warning = "#ffaa00",
    error = "#ff4444",
  },
  light = {
    bg = "#ffffff",
    bgPanel = "#f5f5f5",
    bgHover = "#eeeeee",
    border = "#dddddd",
    text = "#1a1a1a",
    textMuted = "#666666",
    textDim = "#999999",
    accent = "#0088cc",
    accentBg = "#0088cc20",
    success = "#00aa55",
    warning = "#cc8800",
    error = "#cc2222",
  },
}

-- ─────────────────────────────────────────────────────────────────────────────
-- Full Configuration
-- ─────────────────────────────────────────────────────────────────────────────

function View.configure(options)
  config = {
    layout = options.layout or View.Layouts.default,
    theme = options.theme or "dark",
    tools = options.tools or { "select", "move", "rotate", "scale" },
    defaultTool = options.defaultTool or "select",
  }
  return config
end

function View.getConfig()
  return config
end

-- ─────────────────────────────────────────────────────────────────────────────
-- Serialization
-- ─────────────────────────────────────────────────────────────────────────────

function View.toJSON()
  return {
    config = config,
    corePanels = View.CorePanels,
    customPanels = customPanels,
    layouts = View.Layouts,
    coreTools = View.CoreTools,
    customTools = tools,
    menus = menus,
    contextMenus = contextMenus,
    themes = View.Themes,
  }
end

return View
