// ═══════════════════════════════════════════════════════════════════════════
// Template System - TypeScript types and loader
// Mirrors the Lua template system for editor integration
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Field Types
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'vec2'
  | 'vec3'
  | 'color'
  | 'enum'
  | 'asset'
  | 'ref'
  | 'array'
  | 'table';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];        // for enum
  assetType?: string;        // for asset (texture, audio, etc)
  refType?: string;          // for ref (reference to another type)
  itemType?: string;         // for array
  editor?: string;           // override default editor widget
  hidden?: boolean;
  readonly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspector Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface InspectorSection {
  section: string;
  fields: string[];
  editor?: string;           // custom editor for this section
  showIf?: Record<string, unknown>;  // conditional display
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection View Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CollectionConfig {
  title: string;
  view?: 'list' | 'grid';
  thumbnail?: string;        // field to use as thumbnail
  badge?: string;            // field to show as badge
  columns?: string[];        // fields to show in list view
  groupBy?: string;          // field to group by
  filter?: string[];         // fields to filter by
  sort?: string[];           // fields to sort by
  actions?: string[];        // available actions
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene View Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneConfig {
  glyph: string | ((entity: unknown) => string);
  label: string | ((entity: unknown) => string);
  tint?: string | ((entity: unknown) => number[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewConfig {
  template: string;          // preview component name
  width: number;
  height: number;
  showStats?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface TypeDefinition {
  name: string;
  icon: string;
  color: string;
  description?: string;
  extends?: string;          // parent type

  components: Record<string, FieldDefinition>;
  inspector: InspectorSection[];
  collection?: CollectionConfig;
  scene?: SceneConfig;
  preview?: PreviewConfig;
  editor?: string;           // custom editor component
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type RenderMode = 'isometric' | 'table' | 'sidescroll' | 'free3d';

export interface CameraConfig {
  type: 'orthographic' | 'perspective';
  angle?: { pitch: number; yaw: number };
  fov?: number;
  zoom?: { min: number; max: number; default: number };
  pan?: boolean;
  rotate?: boolean;
}

export interface LightingConfig {
  ambient: number[];
  directional?: {
    direction: number[];
    color: number[];
    intensity: number;
    shadows?: boolean;
  };
}

export interface RenderConfig {
  mode: RenderMode;
  camera: CameraConfig;
  grid?: {
    enabled: boolean;
    size?: number;
    color?: number[];
  };
  lighting: LightingConfig;
  background?: number[];
  postProcess?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// View/Editor Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PanelConfig {
  id: string;
  title: string;
  icon: string;
  core?: boolean;
  defaultPosition?: 'left' | 'center' | 'right' | 'bottom';
  component?: string;
  typeId?: string;           // for type-driven panels
}

export interface ToolConfig {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
  cursor?: string;
}

export interface LayoutZone {
  size?: number;
  tabs: string[];
  collapsed?: boolean;
}

export interface LayoutConfig {
  left?: LayoutZone;
  center?: LayoutZone;
  right?: LayoutZone;
  bottom?: LayoutZone;
}

export interface ViewConfig {
  layout: LayoutConfig;
  panels: Record<string, PanelConfig>;
  tools: Record<string, ToolConfig>;
  defaultTool?: string;
  menus?: Record<string, unknown[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  icon: string;

  render: RenderConfig;
  view: ViewConfig;
  types: Record<string, TypeDefinition>;
  systems?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Available Templates (hardcoded for now, would come from filesystem)
// ─────────────────────────────────────────────────────────────────────────────

export const AVAILABLE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'isometric-rpg',
    name: 'Isometric RPG',
    description: 'Top-down isometric RPG with entities, stats, inventory, and dialog systems',
    version: '1.0.0',
    author: 'ASCII Dungeon',
    icon: '🗡',

    render: {
      mode: 'isometric',
      camera: {
        type: 'orthographic',
        angle: { pitch: 45, yaw: 45 },
        zoom: { min: 0.5, max: 4.0, default: 1.0 },
        pan: true,
        rotate: true,
      },
      grid: {
        enabled: true,
        size: 1.0,
        color: [0.2, 0.25, 0.3, 0.4],
      },
      lighting: {
        ambient: [0.25, 0.25, 0.35],
        directional: {
          direction: [-0.5, -1.0, -0.3],
          color: [1.0, 0.95, 0.85],
          intensity: 1.0,
          shadows: true,
        },
      },
      postProcess: 'fantasy',
    },

    view: {
      layout: {
        left: { size: 250, tabs: ['files', 'entities'] },
        center: { tabs: ['scene', 'code'] },
        right: { size: 320, tabs: ['properties', 'chat'] },
        bottom: { size: 180, tabs: ['console', 'assets'] },
      },
      panels: {},
      tools: {
        paint: { id: 'paint', name: 'Paint Tile', icon: '▦', shortcut: 'B' },
        erase: { id: 'erase', name: 'Erase', icon: '✕', shortcut: 'E' },
        spawn: { id: 'spawn', name: 'Spawn Entity', icon: '◆', shortcut: 'P' },
      },
      defaultTool: 'select',
    },

    types: {
      Entity: {
        name: 'Entity',
        icon: '◆',
        color: '#888888',
        description: 'Base game object',
        components: {
          name: { name: 'name', type: 'string', default: 'Entity' },
          glyph: { name: 'glyph', type: 'string', default: '◆' },
          position: { name: 'position', type: 'vec3', default: [0, 0, 0] },
          color: { name: 'color', type: 'color', default: [1, 1, 1, 1] },
        },
        inspector: [
          { section: 'Transform', fields: ['position'] },
          { section: 'Appearance', fields: ['name', 'glyph', 'color'] },
        ],
        collection: {
          title: 'Entities',
          columns: ['name', 'glyph'],
          actions: ['create', 'delete'],
        },
      },
      NPC: {
        name: 'NPC',
        icon: '👤',
        color: '#4a9eff',
        description: 'Non-player character',
        extends: 'Entity',
        components: {
          name: { name: 'name', type: 'string', default: 'Villager' },
          glyph: { name: 'glyph', type: 'string', default: '👤' },
          position: { name: 'position', type: 'vec3', default: [0, 0, 0] },
          faction: { name: 'faction', type: 'enum', options: ['friendly', 'neutral', 'hostile'], default: 'neutral' },
          dialog: { name: 'dialog', type: 'string', default: '' },
        },
        inspector: [
          { section: 'Identity', fields: ['name', 'glyph'] },
          { section: 'Behavior', fields: ['faction', 'dialog'] },
        ],
        collection: {
          title: 'NPCs',
          view: 'grid',
          columns: ['name', 'faction'],
          groupBy: 'faction',
          actions: ['create', 'delete'],
        },
      },
      Item: {
        name: 'Item',
        icon: '◈',
        color: '#ffaa00',
        description: 'Collectible item',
        components: {
          name: { name: 'name', type: 'string', default: 'Item' },
          glyph: { name: 'glyph', type: 'string', default: '◈' },
          category: { name: 'category', type: 'enum', options: ['weapon', 'armor', 'consumable', 'material', 'key'], default: 'material' },
          rarity: { name: 'rarity', type: 'enum', options: ['common', 'uncommon', 'rare', 'epic', 'legendary'], default: 'common' },
          value: { name: 'value', type: 'int', default: 0, min: 0 },
        },
        inspector: [
          { section: 'Identity', fields: ['name', 'glyph'] },
          { section: 'Category', fields: ['category', 'rarity', 'value'] },
        ],
        collection: {
          title: 'Items',
          view: 'grid',
          columns: ['name', 'category', 'rarity'],
          groupBy: 'category',
          actions: ['create', 'delete'],
        },
      },
    },
  },

  {
    id: 'deckbuilder',
    name: 'Deckbuilder',
    description: 'Card game with deck building, effects, and turn-based combat',
    version: '1.0.0',
    author: 'ASCII Dungeon',
    icon: '🃏',

    render: {
      mode: 'table',
      camera: {
        type: 'orthographic',
        angle: { pitch: 90, yaw: 0 },
        zoom: { min: 0.5, max: 2.0, default: 1.0 },
        pan: true,
      },
      grid: { enabled: false },
      lighting: {
        ambient: [0.9, 0.85, 0.8],
      },
      background: [0.12, 0.1, 0.08],
      postProcess: 'cinematic',
    },

    view: {
      layout: {
        left: { size: 280, tabs: ['files', 'cards'] },
        center: { tabs: ['scene', 'card-designer'] },
        right: { size: 320, tabs: ['properties', 'decks', 'chat'] },
        bottom: { size: 200, tabs: ['console', 'playtest'] },
      },
      panels: {
        'card-designer': { id: 'card-designer', title: 'Card Designer', icon: '🎨', defaultPosition: 'center' },
        'playtest': { id: 'playtest', title: 'Play Test', icon: '▶', defaultPosition: 'bottom' },
      },
      tools: {
        placeCard: { id: 'placeCard', name: 'Place Card', icon: '🃏', shortcut: 'C' },
        drawZone: { id: 'drawZone', name: 'Draw Zone', icon: '▢', shortcut: 'Z' },
      },
      defaultTool: 'select',
    },

    types: {
      Card: {
        name: 'Card',
        icon: '🃏',
        color: '#ff6b6b',
        description: 'Playing card with cost and effects',
        components: {
          name: { name: 'name', type: 'string', default: 'New Card' },
          description: { name: 'description', type: 'string', default: '' },
          manaCost: { name: 'manaCost', type: 'int', default: 1, min: 0, max: 15 },
          cardType: { name: 'cardType', type: 'enum', options: ['creature', 'spell', 'artifact'], default: 'creature' },
          rarity: { name: 'rarity', type: 'enum', options: ['common', 'uncommon', 'rare', 'epic', 'legendary'], default: 'common' },
          attack: { name: 'attack', type: 'int', default: 1, min: 0 },
          health: { name: 'health', type: 'int', default: 1, min: 1 },
        },
        inspector: [
          { section: 'Identity', fields: ['name', 'description'] },
          { section: 'Classification', fields: ['cardType', 'rarity', 'manaCost'] },
          { section: 'Combat', fields: ['attack', 'health'] },
        ],
        collection: {
          title: 'Card Library',
          view: 'grid',
          badge: 'manaCost',
          columns: ['name', 'cardType', 'manaCost'],
          groupBy: 'cardType',
          filter: ['cardType', 'rarity', 'manaCost'],
          actions: ['create', 'duplicate', 'delete'],
        },
        preview: {
          template: 'card-frame',
          width: 250,
          height: 350,
        },
      },
      Deck: {
        name: 'Deck',
        icon: '📚',
        color: '#4ecdc4',
        description: 'Collection of cards',
        components: {
          name: { name: 'name', type: 'string', default: 'New Deck' },
          description: { name: 'description', type: 'string', default: '' },
          cardCount: { name: 'cardCount', type: 'int', default: 0, readonly: true },
        },
        inspector: [
          { section: 'Identity', fields: ['name', 'description'] },
          { section: 'Stats', fields: ['cardCount'] },
        ],
        collection: {
          title: 'Decks',
          columns: ['name', 'cardCount'],
          actions: ['create', 'delete'],
        },
      },
      Effect: {
        name: 'Effect',
        icon: '✨',
        color: '#f39c12',
        description: 'Card effect or ability',
        components: {
          name: { name: 'name', type: 'string', default: 'New Effect' },
          trigger: { name: 'trigger', type: 'enum', options: ['onPlay', 'onDeath', 'onDamage', 'onTurnStart', 'onTurnEnd'], default: 'onPlay' },
          effectType: { name: 'effectType', type: 'enum', options: ['damage', 'heal', 'draw', 'buff', 'debuff'], default: 'damage' },
          value: { name: 'value', type: 'int', default: 1 },
        },
        inspector: [
          { section: 'Identity', fields: ['name'] },
          { section: 'Trigger', fields: ['trigger'] },
          { section: 'Effect', fields: ['effectType', 'value'] },
        ],
        collection: {
          title: 'Effects',
          columns: ['name', 'trigger', 'effectType'],
          groupBy: 'effectType',
          actions: ['create', 'delete'],
        },
      },
    },
  },

  {
    id: 'visual-novel',
    name: 'Visual Novel',
    description: 'Story-driven game with characters, dialog, and branching narratives',
    version: '1.0.0',
    icon: '📖',

    render: {
      mode: 'table',
      camera: {
        type: 'orthographic',
        zoom: { min: 1, max: 1, default: 1 },
        pan: false,
      },
      grid: { enabled: false },
      lighting: { ambient: [1, 1, 1] },
    },

    view: {
      layout: {
        left: { size: 250, tabs: ['files', 'characters', 'scenes'] },
        center: { tabs: ['scene', 'script-editor'] },
        right: { size: 350, tabs: ['properties', 'flowchart'] },
        bottom: { size: 200, tabs: ['console', 'preview'] },
      },
      panels: {
        'script-editor': { id: 'script-editor', title: 'Script', icon: '📝', defaultPosition: 'center' },
        'flowchart': { id: 'flowchart', title: 'Flow', icon: '🔀', defaultPosition: 'right' },
      },
      tools: {},
      defaultTool: 'select',
    },

    types: {
      Character: {
        name: 'Character',
        icon: '👤',
        color: '#e91e63',
        description: 'Visual novel character',
        components: {
          name: { name: 'name', type: 'string', default: 'Character' },
          displayName: { name: 'displayName', type: 'string', default: '' },
          color: { name: 'color', type: 'color', default: [1, 1, 1, 1] },
        },
        inspector: [
          { section: 'Identity', fields: ['name', 'displayName', 'color'] },
        ],
        collection: {
          title: 'Characters',
          view: 'grid',
          columns: ['name'],
          actions: ['create', 'delete'],
        },
      },
      Scene: {
        name: 'Scene',
        icon: '🎬',
        color: '#9c27b0',
        description: 'Story scene',
        components: {
          name: { name: 'name', type: 'string', default: 'New Scene' },
          background: { name: 'background', type: 'asset', assetType: 'texture' },
        },
        inspector: [
          { section: 'Scene', fields: ['name', 'background'] },
        ],
        collection: {
          title: 'Scenes',
          columns: ['name'],
          actions: ['create', 'delete'],
        },
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Template Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function getTemplate(id: string): TemplateDefinition | undefined {
  return AVAILABLE_TEMPLATES.find(t => t.id === id);
}

export function getTypeCollections(template: TemplateDefinition): TypeDefinition[] {
  return Object.values(template.types).filter(t => t.collection);
}

export function getTypePanels(template: TemplateDefinition): PanelConfig[] {
  return getTypeCollections(template).map(t => ({
    id: `${t.name.toLowerCase()}s`,
    title: t.collection!.title,
    icon: t.icon,
    typeId: t.name,
    defaultPosition: 'left' as const,
  }));
}
