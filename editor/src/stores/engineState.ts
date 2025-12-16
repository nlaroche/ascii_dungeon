// ═══════════════════════════════════════════════════════════════════════════
// ENGINE STATE - Unified Data-Driven State for the ASCII Dungeon Engine
// Everything is data. Everything is serializable. Everything can be modified.
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// UI TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Theme {
  bg: string;
  bgPanel: string;
  bgHover: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentBg: string;
  success: string;
  warning: string;
  error: string;
}

export interface Tab {
  id: string;
  label: string;
  icon: string;
}

export interface Section {
  id: string;
  label: string;
  collapsed: boolean;
}

export interface TabbedPanel {
  type: 'tabs';
  active: string;
  tabs: Tab[];
}

export interface StackPanel {
  type: 'stack';
  sections: Section[];
}

export type Panel = TabbedPanel | StackPanel;

export interface LayoutSlot {
  id: string;
  size: number | 'flex';
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
}

export interface Layout {
  type: 'horizontal' | 'vertical';
  children: LayoutSlot[];
}

export type EditorMode = 'engine' | 'template';

export interface UIState {
  layout: Layout;
  panels: Record<string, Panel>;
  theme: Theme;
  shortcuts: Record<string, string>;
  scale: number; // UI zoom level (0.75 = 75%, 1.0 = 100%, 1.25 = 125%, etc.)
  editorMode: EditorMode; // Engine Mode (raw nodes) vs Template Mode (type-based views)
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneView {
  type: 'scene3d';
  showGrid: boolean;
  showGizmos: boolean;
  showLightRadius: boolean;
  showColliders: boolean;
  gridSize: number;
  gridDivisions: number;
  backgroundColor: [number, number, number];
  renderMode: 'lit' | 'unlit' | 'wireframe' | 'depth';
}

export interface CodeView {
  type: 'editor';
  language: string;
  theme: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  currentFile: string | null;
}

export interface ChatView {
  type: 'chat';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface ViewsState {
  scene: SceneView;
  code: CodeView;
  chat: ChatView;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  shortcut: string;
  cursor: string;
  description: string;
  settings?: Record<string, unknown>;
}

export interface ToolsState {
  active: string;
  available: Record<string, ToolDefinition>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CameraState {
  mode: 'perspective' | 'orthographic' | 'topdown' | 'firstperson';
  position: [number, number, number];
  target: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  near: number;
  far: number;
  speed: number;
  sensitivity: number;
  orthoSize: number;
  topdownHeight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE SYSTEM - Everything is a Node (Godot-inspired)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A component is a Lua script attached to a node.
 * Components define behavior and can expose editor-editable properties.
 */
export interface NodeComponent {
  id: string;
  script: string;           // Lua script path or inline code reference
  enabled: boolean;
  properties: Record<string, unknown>;  // Script-defined properties
}

/**
 * Transform for positioned nodes (optional - not all nodes need it)
 */
export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Visual representation (optional - for rendering)
 */
export interface NodeVisual {
  visible: boolean;
  glyph?: string;           // Single character
  sprite?: string;          // Multi-char sprite ID
  color: [number, number, number];
  opacity: number;
  emission?: [number, number, number];
  emissionPower?: number;
}

/**
 * The core Node - everything in a scene is a node.
 * Scenes are nodes. Entities are nodes. UI elements are nodes.
 */
export interface Node {
  id: string;
  name: string;
  type: string;             // Categorization: 'Node', 'Node2D', 'Node3D', 'Light', 'Camera', etc.
  children: Node[];
  components: NodeComponent[];

  // Optional features - nodes only have what they need
  transform?: Transform;
  visual?: NodeVisual;

  // Expandable custom data
  meta: Record<string, unknown>;
}

/**
 * Scene is just a root node with metadata
 */
export interface SceneState {
  name: string;
  path?: string;            // File path if saved
  rootNode: Node;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY TYPES (keeping for gradual migration)
// ─────────────────────────────────────────────────────────────────────────────

export interface Material {
  color: [number, number, number];
  roughness: number;
  metallic: number;
  emission: [number, number, number];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectFile {
  path: string;
  type: string;
  modified: boolean;
  size?: number;
}

export interface ProjectSettings {
  targetFPS: number;
  resolution: [number, number];
  startScene: string;
}

export interface ProjectState {
  name: string;
  root: string;
  files: ProjectFile[];
  openFiles: string[];
  selectedFile: string | null;
  settings: ProjectSettings;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectionState {
  nodes: string[];         // Selected node IDs
  files: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderSettings {
  // Lighting
  ambient: number;
  shadowsEnabled: boolean;
  shadowStrength: number;
  shadowSoftness: number;
  // Reflections
  reflectionsEnabled: boolean;
  reflectionStrength: number;
  maxBounces: number;
  // GI
  giEnabled: boolean;
  giBounces: number;
  giIntensity: number;
  // Atmosphere
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: [number, number, number];
  // Post-processing
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  tonemapping: 'none' | 'reinhard' | 'aces' | 'filmic';
  exposure: number;
  contrast: number;
  saturation: number;
  vignetteEnabled: boolean;
  vignetteIntensity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION / HISTORY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Diff {
  type: 'set';
  path: (string | number)[];
  oldValue: unknown;
  newValue: unknown;
}

export interface HistoryEntry {
  timestamp: number;
  description: string;
  source: 'user' | 'ai' | 'script' | 'undo' | 'redo';
  diff: Diff[];
}

export interface SessionState {
  history: HistoryEntry[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  historyIndex: number;
  startTime: number;
  lastSaveTime: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT / CONVERSATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  parentId?: string;      // For branching conversations
  branchPoint?: number;   // Message index where branch occurred
}

export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isStreaming: boolean;
  inputDraft: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE / LOG TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface LogEntry {
  type: 'info' | 'warn' | 'error' | 'success';
  time: string;
  msg: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateState {
  currentId: string | null;
  currentName: string;
  currentIcon: string;
  availableIds: string[];
  isCustomized: boolean;  // True if user modified from base template
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE ENGINE STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineState {
  _version: number;
  _lastModified: number;

  ui: UIState;
  views: ViewsState;
  tools: ToolsState;
  camera: CameraState;
  scene: SceneState;
  project: ProjectState;
  selection: SelectionState;
  renderSettings: RenderSettings;
  session: SessionState;
  chat: ChatState;
  template: TemplateState;

  // Runtime state (not persisted)
  console: {
    logs: LogEntry[];
    commandHistory: string[];
  };
  runtime: {
    engineRunning: boolean;
    fps: number;
    frameTime: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

export const INITIAL_ENGINE_STATE: EngineState = {
  _version: 1,
  _lastModified: Date.now(),

  // ─────────────────────────────────────────────────────────────────────────
  // UI Configuration
  // ─────────────────────────────────────────────────────────────────────────
  ui: {
    layout: {
      type: 'horizontal',
      children: [
        { id: 'sidebar', size: 224, minSize: 180, maxSize: 350, resizable: true },
        { id: 'main', size: 'flex' },
        { id: 'inspector', size: 288, minSize: 200, maxSize: 400, resizable: true },
      ],
    },
    panels: {
      sidebar: {
        type: 'tabs',
        active: 'files',
        tabs: [
          { id: 'files', label: 'Files', icon: '○' },
          { id: 'entities', label: 'Entities', icon: '◉' },
          { id: 'assets', label: 'Assets', icon: '◈' },
        ],
      },
      main: {
        type: 'tabs',
        active: 'scene',
        tabs: [
          { id: 'scene', label: 'Scene', icon: '▦' },
          { id: 'code', label: 'Code', icon: '{ }' },
          { id: 'chat', label: 'AI Chat', icon: '◆' },
        ],
      },
      inspector: {
        type: 'stack',
        sections: [
          { id: 'properties', label: 'Properties', collapsed: false },
          { id: 'components', label: 'Components', collapsed: false },
          { id: 'history', label: 'History', collapsed: true },
        ],
      },
    },
    theme: {
      bg: '#09090b',           // zinc-950
      bgPanel: '#18181b',      // zinc-900
      bgHover: '#27272a',      // zinc-800
      border: '#27272a',       // zinc-800
      text: '#d4d4d8',         // zinc-300
      textMuted: '#a1a1aa',    // zinc-400
      textDim: '#71717a',      // zinc-500
      accent: '#22d3ee',       // cyan-400
      accentBg: '#164e63',     // cyan-900
      success: '#34d399',      // emerald-400
      warning: '#fbbf24',      // amber-400
      error: '#f87171',        // red-400
    },
    shortcuts: {
      'ctrl+z': 'undo',
      'ctrl+shift+z': 'redo',
      'ctrl+y': 'redo',
      'ctrl+s': 'save',
      'ctrl+space': 'openChat',
      'delete': 'deleteSelected',
      'escape': 'deselect',
      'f5': 'runGame',
      'f6': 'stopGame',
    },
    scale: 1.0, // Default 100% UI scale
    editorMode: 'engine', // Start in Engine Mode
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Views
  // ─────────────────────────────────────────────────────────────────────────
  views: {
    scene: {
      type: 'scene3d',
      showGrid: true,
      showGizmos: true,
      showLightRadius: false,
      showColliders: false,
      gridSize: 20,
      gridDivisions: 20,
      backgroundColor: [0.05, 0.05, 0.07],
      renderMode: 'lit',
    },
    code: {
      type: 'editor',
      language: 'lua',
      theme: 'dark',
      fontSize: 13,
      tabSize: 2,
      wordWrap: false,
      lineNumbers: true,
      minimap: false,
      currentFile: null,
    },
    chat: {
      type: 'chat',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: `You are an AI assistant embedded in a game engine.
You can modify any part of the engine state, write Lua scripts,
create shaders, spawn entities, and more.`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Tools
  // ─────────────────────────────────────────────────────────────────────────
  tools: {
    active: 'select',
    available: {
      select: {
        id: 'select',
        name: 'Select',
        icon: '◇',
        shortcut: 'V',
        cursor: 'default',
        description: 'Select and inspect entities',
      },
      move: {
        id: 'move',
        name: 'Move',
        icon: '✥',
        shortcut: 'G',
        cursor: 'move',
        description: 'Move selected entities',
        settings: { snapToGrid: true, gridSize: 1 },
      },
      rotate: {
        id: 'rotate',
        name: 'Rotate',
        icon: '↻',
        shortcut: 'R',
        cursor: 'crosshair',
        description: 'Rotate selected entities',
        settings: { snapAngle: 15 },
      },
      paint: {
        id: 'paint',
        name: 'Paint',
        icon: '✎',
        shortcut: 'B',
        cursor: 'crosshair',
        description: 'Paint cells on the map',
        settings: { brush: 'floor', size: 1, shape: 'square' },
      },
      spawn: {
        id: 'spawn',
        name: 'Spawn',
        icon: '✚',
        shortcut: 'E',
        cursor: 'cell',
        description: 'Spawn new entities',
        settings: { entityType: 'goblin', autoSelect: true },
      },
      erase: {
        id: 'erase',
        name: 'Erase',
        icon: '✕',
        shortcut: 'X',
        cursor: 'crosshair',
        description: 'Erase cells or entities',
        settings: { size: 1, eraseEntities: true, eraseCells: true },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────────────────
  camera: {
    mode: 'perspective',
    position: [12, 8, 12],
    target: [0, 0, 0],
    rotation: [-0.4, -Math.PI * 0.75, 0],
    fov: 60,
    near: 0.1,
    far: 500,
    speed: 10,
    sensitivity: 0.002,
    orthoSize: 10,
    topdownHeight: 20,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Scene - Node-based hierarchy (everything is a node)
  // ─────────────────────────────────────────────────────────────────────────
  scene: {
    name: 'Demo Scene',
    rootNode: {
      id: 'root',
      name: 'Root',
      type: 'Node',
      children: [
        // World/Environment group
        {
          id: 'world',
          name: 'World',
          type: 'Node',
          children: [
            // Floor - generated from component
            {
              id: 'floor',
              name: 'Floor',
              type: 'Floor',
              children: [], // Special tiles could be added here
              components: [
                {
                  id: 'floor_gen',
                  script: 'builtin:floor_generator',
                  enabled: true,
                  properties: {
                    tileType: 'checkerboard',
                    size: [21, 21],
                    tileSize: 1,
                    primaryColor: [0.15, 0.15, 0.18, 1],
                    secondaryColor: [0.12, 0.12, 0.14, 1],
                    elevation: 0,
                  },
                },
              ],
              transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
              meta: { isFloor: true },
            },
            {
              id: 'light_main',
              name: 'Main Light',
              type: 'Light',
              children: [],
              components: [],
              transform: { position: [5, 8, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
              visual: {
                visible: true,
                glyph: '☀',
                color: [1, 0.9, 0.7],
                opacity: 1,
                emission: [1, 0.9, 0.7],
                emissionPower: 2,
              },
              meta: { lightType: 'point', intensity: 1.5, radius: 20 },
            },
          ],
          components: [],
          meta: {},
        },
        // Characters group
        {
          id: 'characters',
          name: 'Characters',
          type: 'Node',
          children: [
            {
              id: 'player',
              name: 'Player',
              type: 'Node3D',
              children: [],
              components: [
                { id: 'comp_1', script: 'scripts/player_controller.lua', enabled: true, properties: { speed: 5 } },
                { id: 'comp_2', script: 'scripts/health.lua', enabled: true, properties: { max: 100, current: 100 } },
              ],
              transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
              visual: {
                visible: true,
                glyph: '@',
                color: [0.2, 0.9, 0.4],
                opacity: 1,
              },
              meta: { isPlayer: true },
            },
            {
              id: 'goblin_1',
              name: 'Goblin',
              type: 'Node3D',
              children: [],
              components: [
                { id: 'comp_3', script: 'scripts/enemy_ai.lua', enabled: true, properties: { aggroRange: 8 } },
                { id: 'comp_4', script: 'scripts/health.lua', enabled: true, properties: { max: 25, current: 25 } },
              ],
              transform: { position: [3, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
              visual: {
                visible: true,
                glyph: 'g',
                color: [0.5, 0.7, 0.3],
                opacity: 1,
              },
              meta: { faction: 'enemy' },
            },
          ],
          components: [],
          meta: {},
        },
        // Props group
        {
          id: 'props',
          name: 'Props',
          type: 'Node',
          children: [
            {
              id: 'torch_1',
              name: 'Torch',
              type: 'Light',
              children: [],
              components: [
                { id: 'comp_5', script: 'scripts/flicker.lua', enabled: true, properties: { speed: 8, amount: 0.15 } },
              ],
              transform: { position: [-2, 1.5, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
              visual: {
                visible: true,
                glyph: '¥',
                color: [1, 0.6, 0.3],
                opacity: 1,
                emission: [1, 0.6, 0.3],
                emissionPower: 1.2,
              },
              meta: { lightType: 'point', intensity: 1.2, radius: 8 },
            },
            {
              id: 'chest_1',
              name: 'Treasure Chest',
              type: 'Node3D',
              children: [],
              components: [
                { id: 'comp_6', script: 'scripts/interactable.lua', enabled: true, properties: { action: 'open' } },
              ],
              transform: { position: [4, 0, -1], rotation: [0, 0, 0], scale: [1, 1, 1] },
              visual: {
                visible: true,
                glyph: '▣',
                color: [0.7, 0.5, 0.2],
                opacity: 1,
              },
              meta: { contains: ['gold', 'potion'] },
            },
          ],
          components: [],
          meta: {},
        },
      ],
      components: [],
      meta: {},
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Project
  // ─────────────────────────────────────────────────────────────────────────
  project: {
    name: '',
    root: '', // Empty until a project is opened
    files: [],
    openFiles: [],
    selectedFile: null,
    settings: {
      targetFPS: 60,
      resolution: [1280, 720],
      startScene: '',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────────────
  selection: {
    nodes: [],
    files: [],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Render Settings
  // ─────────────────────────────────────────────────────────────────────────
  renderSettings: {
    ambient: 0.1,
    shadowsEnabled: true,
    shadowStrength: 0.7,
    shadowSoftness: 0.3,
    reflectionsEnabled: true,
    reflectionStrength: 0.5,
    maxBounces: 2,
    giEnabled: true,
    giBounces: 1,
    giIntensity: 0.8,
    fogEnabled: true,
    fogDensity: 0.15,
    fogColor: [0.05, 0.05, 0.08],
    bloomEnabled: true,
    bloomIntensity: 0.6,
    bloomThreshold: 0.5,
    tonemapping: 'aces',
    exposure: 0.3,
    contrast: 1.05,
    saturation: 1.0,
    vignetteEnabled: true,
    vignetteIntensity: 0.3,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Session
  // ─────────────────────────────────────────────────────────────────────────
  session: {
    history: [],
    undoStack: [],
    redoStack: [],
    historyIndex: -1,
    startTime: Date.now(),
    lastSaveTime: null,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chat
  // ─────────────────────────────────────────────────────────────────────────
  chat: {
    conversations: [],
    currentConversationId: null,
    isStreaming: false,
    inputDraft: '',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Template
  // ─────────────────────────────────────────────────────────────────────────
  template: {
    currentId: 'isometric-rpg',
    currentName: 'Isometric RPG',
    currentIcon: '🗡',
    availableIds: ['isometric-rpg', 'deckbuilder', 'visual-novel'],
    isCustomized: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Console (runtime only)
  // ─────────────────────────────────────────────────────────────────────────
  console: {
    logs: [
      { type: 'info', time: '00:00:00', msg: 'Engine initialized' },
      { type: 'success', time: '00:00:00', msg: 'WebGPU context ready' },
    ],
    commandHistory: [],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Runtime (not persisted)
  // ─────────────────────────────────────────────────────────────────────────
  runtime: {
    engineRunning: true,
    fps: 60,
    frameTime: 16.67,
  },
};
