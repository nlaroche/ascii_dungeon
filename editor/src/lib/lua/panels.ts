// ═══════════════════════════════════════════════════════════════════════════
// Custom Lua Panels - User-defined panels that become dock tabs
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomPanel {
  id: string;
  name: string;
  icon: string;
  luaCode: string;
  createdAt: number;
  updatedAt: number;
}

const PANELS_STORAGE_KEY = 'ascii-dungeon-custom-panels';

// ─────────────────────────────────────────────────────────────────────────────
// Panel Storage (localStorage for now, could be project files later)
// ─────────────────────────────────────────────────────────────────────────────

export function getCustomPanels(): CustomPanel[] {
  try {
    const stored = localStorage.getItem(PANELS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCustomPanel(panel: Omit<CustomPanel, 'id' | 'createdAt' | 'updatedAt'>): CustomPanel {
  const panels = getCustomPanels();

  // Generate a unique ID
  const id = `custom-${panel.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const newPanel: CustomPanel = {
    ...panel,
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  panels.push(newPanel);
  localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(panels));

  return newPanel;
}

export function updateCustomPanel(id: string, updates: Partial<Omit<CustomPanel, 'id' | 'createdAt'>>): CustomPanel | null {
  const panels = getCustomPanels();
  const index = panels.findIndex(p => p.id === id);

  if (index === -1) return null;

  panels[index] = {
    ...panels[index],
    ...updates,
    updatedAt: Date.now(),
  };

  localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(panels));
  return panels[index];
}

export function deleteCustomPanel(id: string): boolean {
  const panels = getCustomPanels();
  const filtered = panels.filter(p => p.id !== id);

  if (filtered.length === panels.length) return false;

  localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getCustomPanel(id: string): CustomPanel | null {
  const panels = getCustomPanels();
  return panels.find(p => p.id === id) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Example Panel Templates
// ─────────────────────────────────────────────────────────────────────────────

export const PANEL_TEMPLATES: Record<string, { name: string; icon: string; code: string }> = {
  notes: {
    name: 'Notes',
    icon: '📝',
    code: `-- Simple notes panel
local notes = state.get("notes") or ""

return ui.panel({ title = "Notes", padding = 12 }, {
  ui.textarea({
    value = notes,
    rows = 20,
    placeholder = "Write your notes here...",
    onChange = function(text)
      state.set("notes", text)
    end
  })
})`,
  },

  todo: {
    name: 'Todo List',
    icon: '☑',
    code: `-- Todo list panel
local todos = state.get("todos") or {}

local items = {}
for i, todo in ipairs(todos) do
  table.insert(items, ui.row({ gap = 8 }, {
    ui.checkbox({
      value = todo.done,
      onChange = function(checked)
        todos[i].done = checked
        state.set("todos", todos)
      end
    }),
    ui.text({
      value = todo.text,
      color = todo.done and "muted" or "text"
    })
  }))
end

return ui.panel({ title = "Todo", padding = 12 }, {
  ui.column({ gap = 8 }, items),
  ui.divider(),
  ui.row({ gap = 8 }, {
    ui.input({
      placeholder = "New task...",
      value = state.get("newTodo") or "",
      onChange = function(text)
        state.set("newTodo", text)
      end
    }),
    ui.button({
      label = "+",
      primary = true,
      onClick = function()
        local text = state.get("newTodo")
        if text and text ~= "" then
          table.insert(todos, { text = text, done = false })
          state.set("todos", todos)
          state.set("newTodo", "")
        end
      end
    })
  })
})`,
  },

  timer: {
    name: 'Timer',
    icon: '⏱',
    code: `-- Simple timer display
local elapsed = state.get("timer_elapsed") or 0
local running = state.get("timer_running") or false

local minutes = math.floor(elapsed / 60)
local seconds = elapsed % 60
local display = string.format("%02d:%02d", minutes, seconds)

return ui.panel({ title = "Timer" }, {
  ui.column({ gap = 16, align = "center" }, {
    ui.text({ value = display, size = "xl", mono = true }),
    ui.row({ gap = 8, justify = "center" }, {
      ui.button({
        label = running and "Pause" or "Start",
        primary = true,
        onClick = function()
          state.set("timer_running", not running)
        end
      }),
      ui.button({
        label = "Reset",
        onClick = function()
          state.set("timer_elapsed", 0)
          state.set("timer_running", false)
        end
      })
    })
  })
})`,
  },

  reference: {
    name: 'Quick Ref',
    icon: '📖',
    code: `-- Quick reference card
return ui.scroll({ height = "100%" }, {
  ui.column({ gap = 12, padding = 12 }, {
    ui.heading({ value = "Keyboard Shortcuts", level = 4 }),
    ui.column({ gap = 4 }, {
      ui.row({ justify = "between" }, {
        ui.text({ value = "Undo", color = "muted" }),
        ui.badge({ value = "Ctrl+Z" })
      }),
      ui.row({ justify = "between" }, {
        ui.text({ value = "Redo", color = "muted" }),
        ui.badge({ value = "Ctrl+Y" })
      }),
      ui.row({ justify = "between" }, {
        ui.text({ value = "Save", color = "muted" }),
        ui.badge({ value = "Ctrl+S" })
      })
    }),
    ui.divider(),
    ui.heading({ value = "Entity Types", level = 4 }),
    ui.column({ gap = 4 }, {
      ui.row({ gap = 8 }, {
        ui.icon({ value = "@", color = "success" }),
        ui.text({ value = "Player" })
      }),
      ui.row({ gap = 8 }, {
        ui.icon({ value = "!", color = "error" }),
        ui.text({ value = "Enemy" })
      }),
      ui.row({ gap = 8 }, {
        ui.icon({ value = "#", color = "warning" }),
        ui.text({ value = "Wall" })
      })
    })
  })
})`,
  },
};
