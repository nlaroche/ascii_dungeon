// ═══════════════════════════════════════════════════════════════════════════
// Lua Bindings - Register all Lua functions and modules
// ═══════════════════════════════════════════════════════════════════════════

import { LuaRuntime, getLuaRuntime } from './runtime';
import { UI_COMPONENTS } from './ui-components';
import { initializeNodeBindings } from '../nodes/bindings';

// ─────────────────────────────────────────────────────────────────────────────
// UI Component Factory
// Creates component definition objects that can be rendered by React
// ─────────────────────────────────────────────────────────────────────────────

function createComponentFactory(_runtime: LuaRuntime) {
  const uiModule: Record<string, (...args: unknown[]) => unknown> = {};

  // Create a factory function for each component
  for (const componentName of Object.keys(UI_COMPONENTS)) {
    uiModule[componentName] = (propsOrChildren?: unknown, children?: unknown) => {
      // Handle both ui.text("hello") and ui.text({ value = "hello" })
      let props: Record<string, unknown> = {};
      let childArray: unknown[] = [];

      if (typeof propsOrChildren === 'string' || typeof propsOrChildren === 'number') {
        // Shorthand: ui.text("hello") -> ui.text({ value = "hello" })
        props = { value: propsOrChildren };
      } else if (Array.isArray(propsOrChildren)) {
        // ui.column({}, { ... })  - first arg is children
        childArray = propsOrChildren;
      } else if (propsOrChildren && typeof propsOrChildren === 'object') {
        props = propsOrChildren as Record<string, unknown>;
      }

      if (Array.isArray(children)) {
        childArray = children;
      } else if (children !== undefined && children !== null) {
        childArray = [children];
      }

      return {
        __ui_component: true,
        type: componentName,
        props,
        children: childArray.length > 0 ? childArray : undefined,
      };
    };
  }

  return uiModule;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialize All Bindings
// ─────────────────────────────────────────────────────────────────────────────

let bindingsInitialized = false;

export function initializeLuaBindings(): LuaRuntime {
  const runtime = getLuaRuntime();

  if (bindingsInitialized) {
    return runtime;
  }

  // Register the UI module
  const uiModule = createComponentFactory(runtime);
  runtime.registerModule('ui', uiModule);

  // Register print function that logs to console
  runtime.registerFunction('print', (...args: unknown[]) => {
    console.log('[Lua]', ...args);
  });

  // Register a function to get available components
  runtime.registerFunction('get_ui_components', () => {
    return Object.keys(UI_COMPONENTS);
  });

  // Register a function to get component info
  runtime.registerFunction('get_component_info', (name: unknown) => {
    if (typeof name === 'string' && UI_COMPONENTS[name]) {
      return UI_COMPONENTS[name];
    }
    return null;
  });

  // Add some utility functions
  runtime.registerModule('util', {
    // Deep copy a table
    deepcopy: (obj: unknown) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      return JSON.parse(JSON.stringify(obj));
    },

    // Merge tables
    merge: (...tables: unknown[]) => {
      const result: Record<string, unknown> = {};
      for (const t of tables) {
        if (t && typeof t === 'object') {
          Object.assign(result, t);
        }
      }
      return result;
    },

    // Format string
    format: (template: unknown, ...args: unknown[]) => {
      if (typeof template !== 'string') return '';
      let result = template;
      args.forEach((arg, i) => {
        result = result.replace(`{${i + 1}}`, String(arg));
      });
      return result;
    },
  });

  // Add state management helpers
  const stateStore: Record<string, unknown> = {};

  runtime.registerModule('state', {
    get: (key: unknown) => {
      if (typeof key === 'string') {
        return stateStore[key];
      }
      return null;
    },

    set: (key: unknown, value: unknown) => {
      if (typeof key === 'string') {
        stateStore[key] = value;
      }
    },

    getAll: () => ({ ...stateStore }),
  });

  // Initialize node graph bindings
  initializeNodeBindings();

  bindingsInitialized = true;
  return runtime;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Lua Code and Get UI Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface UIDefinition {
  __ui_component: true;
  type: string;
  props: Record<string, unknown>;
  children?: UIDefinition[];
}

export function isUIDefinition(obj: unknown): obj is UIDefinition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '__ui_component' in obj &&
    (obj as UIDefinition).__ui_component === true
  );
}

export function runLuaUI(code: string): UIDefinition | null {
  const runtime = initializeLuaBindings();

  try {
    const result = runtime.execute(code);

    if (result && result.type === 'table' && isUIDefinition(result.value)) {
      return result.value;
    }

    // If the code returns a table, check if it's a UI definition
    if (result?.value && typeof result.value === 'object') {
      const value = result.value as Record<string, unknown>;
      if (value.__ui_component) {
        return value as unknown as UIDefinition;
      }
    }

    return null;
  } catch (e) {
    console.error('Lua UI error:', e);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built Lua Code Templates
// ─────────────────────────────────────────────────────────────────────────────

export const LUA_TEMPLATES = {
  simplePanel: `
return ui.panel({ title = "My Panel", padding = 12 }, {
  ui.text({ value = "Hello from Lua!", size = "lg" }),
  ui.divider(),
  ui.row({ gap = 8 }, {
    ui.button({ label = "Click Me" }),
    ui.button({ label = "Cancel" })
  })
})
`,

  formExample: `
return ui.column({ gap = 12 }, {
  ui.heading({ value = "Settings", level = 3 }),
  ui.input({ label = "Name", placeholder = "Enter name..." }),
  ui.select({
    label = "Type",
    options = {
      { value = "a", label = "Option A" },
      { value = "b", label = "Option B" }
    }
  }),
  ui.checkbox({ label = "Enable feature" }),
  ui.slider({ label = "Volume", min = 0, max = 100, value = 50 }),
  ui.divider(),
  ui.row({ justify = "end", gap = 8 }, {
    ui.button({ label = "Cancel" }),
    ui.button({ label = "Save", primary = true })
  })
})
`,

  listExample: `
local items = {
  { id = 1, name = "Sword", type = "weapon" },
  { id = 2, name = "Shield", type = "armor" },
  { id = 3, name = "Potion", type = "consumable" }
}

return ui.panel({ title = "Inventory" }, {
  ui.list({
    items = items,
    renderItem = function(item)
      return ui.row({ gap = 8 }, {
        ui.icon({ value = "◆" }),
        ui.text({ value = item.name }),
        ui.spacer(),
        ui.badge({ value = item.type })
      })
    end
  })
})
`,
};
