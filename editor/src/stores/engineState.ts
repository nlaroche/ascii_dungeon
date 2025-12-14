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

export interface UIState {
  layout: Layout;
  panels: Record<string, Panel>;
  theme: Theme;
  shortcuts: Record<string, string>;
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
// SCENE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  type: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  glyph: string;
  color: [number, number, number];
  components: string[];
  componentData: Record<string, Record<string, unknown>>;
}

export interface Light {
  id: string;
  type: 'point' | 'directional' | 'spot' | 'ambient';
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  radius: number;
  castShadows: boolean;
  flicker: boolean;
  flickerSpeed: number;
  flickerAmount: number;
}

export interface MapCell {
  glyph: string;
  material: string;
  height: number;
  walkable: boolean;
  blocksSight: boolean;
}

export interface MapState {
  width: number;
  height: number;
  cellSize: number;
  cells: MapCell[][];
}

export interface Material {
  color: [number, number, number];
  roughness: number;
  metallic: number;
  emission: [number, number, number];
}

export interface SceneState {
  name: string;
  entities: Entity[];
  lights: Light[];
  map: MapState;
  materials: Record<string, Material>;
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
  entities: string[];
  files: string[];
  cells: Array<{ x: number; y: number }>;
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
  // Scene
  // ─────────────────────────────────────────────────────────────────────────
  scene: {
    name: 'Untitled Scene',
    entities: [
      {
        id: 'player',
        type: 'player',
        name: 'Player',
        position: [5, 0, 5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        glyph: '@',
        color: [0.2, 0.9, 0.4],
        components: ['Transform', 'Controller', 'Health'],
        componentData: {
          Health: { current: 100, max: 100 },
          Controller: { speed: 5, jumpForce: 10 },
        },
      },
      {
        id: 'goblin_1',
        type: 'enemy',
        name: 'Goblin',
        position: [10, 0, 5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        glyph: 'g',
        color: [0.5, 0.7, 0.3],
        components: ['Transform', 'AI', 'Health'],
        componentData: {
          Health: { current: 25, max: 25 },
          AI: { state: 'patrol', aggroRange: 8 },
        },
      },
    ],
    lights: [
      {
        id: 'torch_1',
        type: 'point',
        position: [8, 3, 10],
        color: [1, 0.6, 0.3],
        intensity: 1.2,
        radius: 15,
        castShadows: true,
        flicker: true,
        flickerSpeed: 8,
        flickerAmount: 0.15,
      },
      {
        id: 'ambient',
        type: 'ambient',
        position: [0, 0, 0],
        color: [0.4, 0.4, 0.5],
        intensity: 0.1,
        radius: 0,
        castShadows: false,
        flicker: false,
        flickerSpeed: 0,
        flickerAmount: 0,
      },
    ],
    map: {
      width: 40,
      height: 30,
      cellSize: 1,
      cells: [],
    },
    materials: {
      stone: {
        color: [0.35, 0.32, 0.3],
        roughness: 0.9,
        metallic: 0,
        emission: [0, 0, 0],
      },
      floor: {
        color: [0.25, 0.25, 0.28],
        roughness: 0.7,
        metallic: 0,
        emission: [0, 0, 0],
      },
      grass: {
        color: [0.3, 0.5, 0.25],
        roughness: 0.85,
        metallic: 0,
        emission: [0, 0, 0],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Project
  // ─────────────────────────────────────────────────────────────────────────
  project: {
    name: 'My Game',
    root: '/project',
    files: [
      { path: '/project/main.lua', type: 'lua', modified: false },
      { path: '/project/game/state.lua', type: 'lua', modified: false },
      { path: '/project/game/combat.lua', type: 'lua', modified: false },
      { path: '/project/entities/player.lua', type: 'lua', modified: false },
      { path: '/project/entities/goblin.lua', type: 'lua', modified: true },
      { path: '/project/sprites/enemies.lua', type: 'lua', modified: false },
      { path: '/project/maps/dungeon_1.lua', type: 'map', modified: false },
      { path: '/project/shaders/fire.wgsl', type: 'wgsl', modified: false },
    ],
    openFiles: ['/project/entities/goblin.lua'],
    selectedFile: '/project/entities/goblin.lua',
    settings: {
      targetFPS: 60,
      resolution: [1280, 720],
      startScene: '/project/maps/dungeon_1.lua',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────────────
  selection: {
    entities: [],
    files: [],
    cells: [],
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
