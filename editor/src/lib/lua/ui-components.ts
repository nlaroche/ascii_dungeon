// ═══════════════════════════════════════════════════════════════════════════
// Lua UI Components - React components exposed to Lua
// Provides a declarative UI system for Lua scripts
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Component Definition Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UIComponentDef {
  type: string;
  props: Record<string, unknown>;
  children?: UIComponentDef[];
}

export interface UIComponentMeta {
  name: string;
  description: string;
  category: 'layout' | 'input' | 'display' | 'feedback' | 'data';
  props: UIComponentProp[];
  example: string;
}

export interface UIComponentProp {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Registry
// ─────────────────────────────────────────────────────────────────────────────

export const UI_COMPONENTS: Record<string, UIComponentMeta> = {
  // Layout Components
  column: {
    name: 'column',
    description: 'Vertical flex container that stacks children',
    category: 'layout',
    props: [
      { name: 'gap', type: 'number', description: 'Space between children in pixels', default: 8 },
      { name: 'padding', type: 'number', description: 'Inner padding in pixels', default: 0 },
      { name: 'align', type: 'string', description: 'Horizontal alignment: start, center, end, stretch', default: 'stretch' },
    ],
    example: `ui.column({ gap = 8 }, {
  ui.text("Hello"),
  ui.text("World")
})`,
  },

  row: {
    name: 'row',
    description: 'Horizontal flex container that places children side by side',
    category: 'layout',
    props: [
      { name: 'gap', type: 'number', description: 'Space between children in pixels', default: 8 },
      { name: 'padding', type: 'number', description: 'Inner padding in pixels', default: 0 },
      { name: 'align', type: 'string', description: 'Vertical alignment: start, center, end, stretch', default: 'center' },
      { name: 'justify', type: 'string', description: 'Horizontal distribution: start, center, end, between, around', default: 'start' },
    ],
    example: `ui.row({ gap = 8, justify = "between" }, {
  ui.button({ label = "Cancel" }),
  ui.button({ label = "Save", primary = true })
})`,
  },

  panel: {
    name: 'panel',
    description: 'Container with background, border, and optional header',
    category: 'layout',
    props: [
      { name: 'title', type: 'string', description: 'Optional header title' },
      { name: 'padding', type: 'number', description: 'Inner padding', default: 12 },
      { name: 'collapsible', type: 'boolean', description: 'Can be collapsed', default: false },
      { name: 'collapsed', type: 'boolean', description: 'Initial collapsed state', default: false },
    ],
    example: `ui.panel({ title = "Settings", collapsible = true }, {
  ui.checkbox({ label = "Enable feature", value = true })
})`,
  },

  spacer: {
    name: 'spacer',
    description: 'Flexible space that expands to fill available room',
    category: 'layout',
    props: [
      { name: 'size', type: 'number', description: 'Fixed size in pixels (optional)' },
    ],
    example: `ui.row({}, {
  ui.text("Left"),
  ui.spacer(),
  ui.text("Right")
})`,
  },

  divider: {
    name: 'divider',
    description: 'Horizontal or vertical line separator',
    category: 'layout',
    props: [
      { name: 'vertical', type: 'boolean', description: 'Vertical orientation', default: false },
      { name: 'margin', type: 'number', description: 'Margin around divider', default: 8 },
    ],
    example: `ui.column({}, {
  ui.text("Section 1"),
  ui.divider(),
  ui.text("Section 2")
})`,
  },

  scroll: {
    name: 'scroll',
    description: 'Scrollable container',
    category: 'layout',
    props: [
      { name: 'height', type: 'number|string', description: 'Container height', default: '100%' },
      { name: 'horizontal', type: 'boolean', description: 'Enable horizontal scroll', default: false },
    ],
    example: `ui.scroll({ height = 200 }, {
  ui.column({}, items)
})`,
  },

  // Display Components
  text: {
    name: 'text',
    description: 'Text display with optional styling',
    category: 'display',
    props: [
      { name: 'value', type: 'string', description: 'Text content', required: true },
      { name: 'size', type: 'string', description: 'Size: xs, sm, md, lg, xl', default: 'md' },
      { name: 'color', type: 'string', description: 'Text color: text, muted, dim, accent, success, warning, error' },
      { name: 'bold', type: 'boolean', description: 'Bold weight', default: false },
      { name: 'mono', type: 'boolean', description: 'Monospace font', default: false },
    ],
    example: `ui.text({ value = "Hello World", size = "lg", bold = true })`,
  },

  heading: {
    name: 'heading',
    description: 'Section heading',
    category: 'display',
    props: [
      { name: 'value', type: 'string', description: 'Heading text', required: true },
      { name: 'level', type: 'number', description: 'Heading level 1-6', default: 2 },
    ],
    example: `ui.heading({ value = "Section Title", level = 2 })`,
  },

  icon: {
    name: 'icon',
    description: 'Display an icon or emoji',
    category: 'display',
    props: [
      { name: 'value', type: 'string', description: 'Icon character or emoji', required: true },
      { name: 'size', type: 'number', description: 'Icon size in pixels', default: 16 },
      { name: 'color', type: 'string', description: 'Icon color' },
    ],
    example: `ui.icon({ value = "◆", size = 24, color = "accent" })`,
  },

  badge: {
    name: 'badge',
    description: 'Small label or status indicator',
    category: 'display',
    props: [
      { name: 'value', type: 'string', description: 'Badge text', required: true },
      { name: 'variant', type: 'string', description: 'Variant: default, success, warning, error', default: 'default' },
    ],
    example: `ui.badge({ value = "New", variant = "success" })`,
  },

  code: {
    name: 'code',
    description: 'Code block with syntax highlighting',
    category: 'display',
    props: [
      { name: 'value', type: 'string', description: 'Code content', required: true },
      { name: 'language', type: 'string', description: 'Language for highlighting', default: 'lua' },
      { name: 'lineNumbers', type: 'boolean', description: 'Show line numbers', default: false },
    ],
    example: `ui.code({ value = "print('hello')", language = "lua" })`,
  },

  image: {
    name: 'image',
    description: 'Display an image',
    category: 'display',
    props: [
      { name: 'src', type: 'string', description: 'Image source URL or path', required: true },
      { name: 'width', type: 'number|string', description: 'Image width' },
      { name: 'height', type: 'number|string', description: 'Image height' },
      { name: 'alt', type: 'string', description: 'Alt text' },
    ],
    example: `ui.image({ src = "assets/logo.png", width = 64 })`,
  },

  // Input Components
  button: {
    name: 'button',
    description: 'Clickable button',
    category: 'input',
    props: [
      { name: 'label', type: 'string', description: 'Button text', required: true },
      { name: 'onClick', type: 'function', description: 'Click handler' },
      { name: 'primary', type: 'boolean', description: 'Primary styling', default: false },
      { name: 'disabled', type: 'boolean', description: 'Disabled state', default: false },
      { name: 'icon', type: 'string', description: 'Optional icon' },
    ],
    example: `ui.button({ label = "Save", primary = true, onClick = function() save() end })`,
  },

  input: {
    name: 'input',
    description: 'Text input field',
    category: 'input',
    props: [
      { name: 'value', type: 'string', description: 'Current value' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'type', type: 'string', description: 'Input type: text, number, password', default: 'text' },
    ],
    example: `ui.input({ label = "Name", placeholder = "Enter name...", value = name, onChange = setName })`,
  },

  textarea: {
    name: 'textarea',
    description: 'Multi-line text input',
    category: 'input',
    props: [
      { name: 'value', type: 'string', description: 'Current value' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'rows', type: 'number', description: 'Number of visible rows', default: 4 },
      { name: 'label', type: 'string', description: 'Field label' },
    ],
    example: `ui.textarea({ label = "Description", rows = 6, value = desc })`,
  },

  checkbox: {
    name: 'checkbox',
    description: 'Boolean toggle checkbox',
    category: 'input',
    props: [
      { name: 'value', type: 'boolean', description: 'Checked state' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Checkbox label' },
      { name: 'disabled', type: 'boolean', description: 'Disabled state', default: false },
    ],
    example: `ui.checkbox({ label = "Enable feature", value = enabled, onChange = setEnabled })`,
  },

  select: {
    name: 'select',
    description: 'Dropdown selection',
    category: 'input',
    props: [
      { name: 'value', type: 'string', description: 'Selected value' },
      { name: 'options', type: 'array', description: 'Array of options: {value, label}', required: true },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'placeholder', type: 'string', description: 'Placeholder when no selection' },
    ],
    example: `ui.select({
  label = "Size",
  value = size,
  options = {
    { value = "sm", label = "Small" },
    { value = "md", label = "Medium" },
    { value = "lg", label = "Large" }
  }
})`,
  },

  slider: {
    name: 'slider',
    description: 'Numeric range slider',
    category: 'input',
    props: [
      { name: 'value', type: 'number', description: 'Current value' },
      { name: 'min', type: 'number', description: 'Minimum value', default: 0 },
      { name: 'max', type: 'number', description: 'Maximum value', default: 100 },
      { name: 'step', type: 'number', description: 'Step increment', default: 1 },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'showValue', type: 'boolean', description: 'Show current value', default: true },
    ],
    example: `ui.slider({ label = "Volume", min = 0, max = 100, value = volume })`,
  },

  color: {
    name: 'color',
    description: 'Color picker',
    category: 'input',
    props: [
      { name: 'value', type: 'string|array', description: 'Color value (hex or [r,g,b,a])' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'alpha', type: 'boolean', description: 'Include alpha channel', default: false },
    ],
    example: `ui.color({ label = "Tint", value = "#ff0000", alpha = true })`,
  },

  vec2: {
    name: 'vec2',
    description: '2D vector input (x, y)',
    category: 'input',
    props: [
      { name: 'value', type: 'array', description: 'Vector [x, y]' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'labels', type: 'array', description: 'Axis labels', default: ['X', 'Y'] },
    ],
    example: `ui.vec2({ label = "Position", value = {0, 0} })`,
  },

  vec3: {
    name: 'vec3',
    description: '3D vector input (x, y, z)',
    category: 'input',
    props: [
      { name: 'value', type: 'array', description: 'Vector [x, y, z]' },
      { name: 'onChange', type: 'function', description: 'Change handler' },
      { name: 'label', type: 'string', description: 'Field label' },
      { name: 'labels', type: 'array', description: 'Axis labels', default: ['X', 'Y', 'Z'] },
    ],
    example: `ui.vec3({ label = "Position", value = {0, 0, 0} })`,
  },

  // Data Components
  list: {
    name: 'list',
    description: 'Scrollable list of items',
    category: 'data',
    props: [
      { name: 'items', type: 'array', description: 'Array of items', required: true },
      { name: 'renderItem', type: 'function', description: 'Item render function', required: true },
      { name: 'keyField', type: 'string', description: 'Field to use as key', default: 'id' },
      { name: 'onSelect', type: 'function', description: 'Selection handler' },
      { name: 'selected', type: 'any', description: 'Currently selected item' },
    ],
    example: `ui.list({
  items = entities,
  renderItem = function(item)
    return ui.text({ value = item.name })
  end
})`,
  },

  tree: {
    name: 'tree',
    description: 'Hierarchical tree view',
    category: 'data',
    props: [
      { name: 'items', type: 'array', description: 'Array of tree nodes', required: true },
      { name: 'childrenField', type: 'string', description: 'Field containing children', default: 'children' },
      { name: 'labelField', type: 'string', description: 'Field for node label', default: 'name' },
      { name: 'onSelect', type: 'function', description: 'Selection handler' },
      { name: 'selected', type: 'any', description: 'Currently selected node' },
    ],
    example: `ui.tree({
  items = fileTree,
  labelField = "name",
  childrenField = "children"
})`,
  },

  table: {
    name: 'table',
    description: 'Data table with columns',
    category: 'data',
    props: [
      { name: 'data', type: 'array', description: 'Array of row objects', required: true },
      { name: 'columns', type: 'array', description: 'Column definitions', required: true },
      { name: 'onRowClick', type: 'function', description: 'Row click handler' },
      { name: 'sortable', type: 'boolean', description: 'Enable column sorting', default: false },
    ],
    example: `ui.table({
  data = items,
  columns = {
    { field = "name", header = "Name" },
    { field = "type", header = "Type" },
    { field = "value", header = "Value" }
  }
})`,
  },

  // Feedback Components
  spinner: {
    name: 'spinner',
    description: 'Loading spinner',
    category: 'feedback',
    props: [
      { name: 'size', type: 'number', description: 'Spinner size', default: 24 },
      { name: 'label', type: 'string', description: 'Loading text' },
    ],
    example: `ui.spinner({ label = "Loading..." })`,
  },

  progress: {
    name: 'progress',
    description: 'Progress bar',
    category: 'feedback',
    props: [
      { name: 'value', type: 'number', description: 'Progress 0-100', required: true },
      { name: 'label', type: 'string', description: 'Progress label' },
      { name: 'showPercent', type: 'boolean', description: 'Show percentage', default: true },
    ],
    example: `ui.progress({ value = 75, label = "Downloading..." })`,
  },

  toast: {
    name: 'toast',
    description: 'Notification toast message',
    category: 'feedback',
    props: [
      { name: 'message', type: 'string', description: 'Toast message', required: true },
      { name: 'variant', type: 'string', description: 'Variant: info, success, warning, error', default: 'info' },
      { name: 'duration', type: 'number', description: 'Auto-dismiss duration in ms', default: 3000 },
    ],
    example: `ui.toast({ message = "Saved!", variant = "success" })`,
  },

  empty: {
    name: 'empty',
    description: 'Empty state placeholder',
    category: 'feedback',
    props: [
      { name: 'icon', type: 'string', description: 'Icon to display' },
      { name: 'title', type: 'string', description: 'Title text' },
      { name: 'description', type: 'string', description: 'Description text' },
      { name: 'action', type: 'table', description: 'Optional action button {label, onClick}' },
    ],
    example: `ui.empty({
  icon = "📁",
  title = "No files",
  description = "Create a file to get started",
  action = { label = "Create File", onClick = createFile }
})`,
  },
};

// Get all components in a category
export function getComponentsByCategory(category: string): UIComponentMeta[] {
  return Object.values(UI_COMPONENTS).filter((c) => c.category === category);
}

// Get all categories
export function getCategories(): string[] {
  const categories = new Set<string>();
  Object.values(UI_COMPONENTS).forEach((c) => categories.add(c.category));
  return Array.from(categories);
}
