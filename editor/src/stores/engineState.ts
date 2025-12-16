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
  rootNodeId: string;       // Reference to root node in entities (for normalized access)
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZED ENTITY SYSTEM - O(1) lookups, proper subscriptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized node - stores parent/child references instead of nested children.
 * This enables O(1) lookups by ID and efficient tree mutations.
 */
export interface NormalizedNode {
  id: string;
  name: string;
  type: string;

  // Hierarchy references (O(1) lookups)
  parentId: string | null;  // null for root node
  childIds: string[];       // ordered list of child IDs

  // Component references (stored separately in entities.components)
  componentIds: string[];

  // Optional features - same as Node
  transform?: Transform;
  visual?: NodeVisual;
  meta: Record<string, unknown>;
}

/**
 * Normalized component - stored separately from nodes.
 * Enables O(1) component lookups and component-type queries.
 */
export interface NormalizedComponent {
  id: string;
  nodeId: string;           // Which node owns this component
  script: string;           // Lua script path or builtin reference
  enabled: boolean;
  properties: Record<string, unknown>;
}

/**
 * Entity storage maps - all entities stored by ID for O(1) access.
 */
export interface EntityMaps {
  nodes: Record<string, NormalizedNode>;
  components: Record<string, NormalizedComponent>;
  nodeOrder: string[];      // Depth-first traversal order for iteration
}

/**
 * Transient state - high-frequency updates that bypass history tracking.
 * Used for dragging, hovering, and other interactive state.
 */
export interface TransientState {
  drag: {
    active: boolean;
    nodeId: string | null;
    startTransform: Transform | null;
    axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' | null;
  };
  hover: {
    nodeId: string | null;
    componentId: string | null;
    gizmoAxis: string | null;
  };
  input: {
    keysDown: Set<string>;
    mousePosition: [number, number];
    mouseButtons: number;
  };
  cameraOrbit: {
    active: boolean;
    startYaw: number;
    startPitch: number;
  };
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
// RENDER SETTINGS (Legacy - keeping for compatibility)
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
// RENDER PIPELINE - Flexible, reorderable post-processing system
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderPassSettings {
  enabled: boolean;
  [key: string]: unknown;
}

export type ShadowType = 'pcf' | 'vsm' | 'pcss';

export interface ShadowSettings {
  enabled: boolean;
  type: ShadowType;
  resolution: number;
  bias: number;
  normalBias: number;
  softness: number;        // 0-1, controls PCF kernel size or VSM blur
  cascades: number;
  cascadeSplits: [number, number, number];  // Split distances for CSM
}

export interface ReflectionSettings {
  enabled: boolean;
  type: 'planar' | 'ssr' | 'cubemap';
  floorReflectivity: number;   // 0-1
  waterReflectivity: number;   // 0-1
  ssrMaxSteps: number;
  ssrThickness: number;
  ssrRoughnessFade: number;
}

export interface RenderPasses {
  shadow: RenderPassSettings & {
    resolution: number;
    bias: number;
    cascades: number;
  };
  main: RenderPassSettings;
  glyph: RenderPassSettings;
  sky: RenderPassSettings & {
    zenithColor: [number, number, number];
    horizonColor: [number, number, number];
    groundColor: [number, number, number];
  };
  grid: RenderPassSettings & {
    majorSize: number;
    minorSize: number;
    fadeDistance: number;
  };
}

export interface PostEffect {
  id: string;
  name: string;
  enabled: boolean;
  [key: string]: unknown;
}

export type DebugViewMode = 'final' | 'depth' | 'normals' | 'shadow' | 'albedo';

export interface RenderPipelineState {
  passes: RenderPasses;
  postEffects: PostEffect[];
  shadows: ShadowSettings;
  reflections: ReflectionSettings;
  debugView: DebugViewMode;
  showStats: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING - Full multi-light system
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectionalLight {
  enabled: boolean;
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  castShadows: boolean;
}

export interface AmbientLight {
  color: [number, number, number];
  intensity: number;
  skyContribution: number;
}

export type LightType = 'point' | 'spot';

export interface SceneLight {
  id: string;
  type: LightType;
  enabled: boolean;
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  range: number;
  castShadows: boolean;
  // Spot light specific
  spotAngle?: number;
  spotPenumbra?: number;
}

export interface GlobalIllumination {
  enabled: boolean;
  bounces: number;
  intensity: number;
}

export interface LightingState {
  sun: DirectionalLight;
  ambient: AmbientLight;
  lights: SceneLight[];
  gi: GlobalIllumination;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT - Sky, fog, and atmosphere
// ─────────────────────────────────────────────────────────────────────────────

export type SkyboxType = 'gradient' | 'procedural' | 'cubemap' | 'hdri';

export interface GradientSky {
  zenith: [number, number, number];
  horizon: [number, number, number];
  ground: [number, number, number];
}

export interface SkyboxSettings {
  type: SkyboxType;
  gradient: GradientSky;
  texture: string | null;
  rotation: number;
  exposure: number;
  // Procedural sky
  sunSize: number;
  atmosphereDensity: number;
}

export type FogType = 'linear' | 'exponential' | 'height';

export interface FogSettings {
  enabled: boolean;
  type: FogType;
  color: [number, number, number];
  density: number;
  start: number;
  end: number;
  heightFalloff: number;
}

export interface EnvironmentState {
  skybox: SkyboxSettings;
  fog: FogSettings;
  timeOfDay: number; // 0-1, controls sun position and colors
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

  // New render pipeline system
  renderPipeline: RenderPipelineState;
  lighting: LightingState;
  environment: EnvironmentState;

  // Normalized entity system (O(1) lookups)
  entities: EntityMaps;

  // Transient state (no history tracking - for drag, hover, etc.)
  transient: TransientState;

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
    rootNodeId: 'root',
    rootNode: {
      id: 'root',
      name: 'Scene',
      type: 'Node',
      children: [
        // Floor - Dark forest floor matching reference
        {
          id: 'floor',
          name: 'Floor',
          type: 'Node',
          children: [],
          components: [
            {
              id: 'floor_gen',
              script: 'builtin:floor_generator',
              enabled: true,
              properties: {
                tileType: 'checkerboard',
                size: [21, 21],
                tileSize: 1,
                primaryColor: [0.04, 0.08, 0.06, 1],    // Dark tile
                secondaryColor: [0.06, 0.12, 0.08, 1],  // Slightly lighter tile
                gridLineColor: [0.1, 0.22, 0.15, 1],    // Subtle grid lines
                elevation: 0,
              },
            },
          ],
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Main Light
        {
          id: 'light_main',
          name: 'Main Light',
          type: 'Node',
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
        // Player - Green hero character
        {
          id: 'player',
          name: 'Player',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_1', script: 'scripts/player_controller.ts', enabled: true, properties: { speed: 5 } },
            { id: 'comp_2', script: 'scripts/health.ts', enabled: true, properties: { max: 100, current: 100 } },
          ],
          transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: '@',
            color: [0.2, 0.9, 0.5],
            opacity: 1,
            emission: [0.2, 0.9, 0.5],
            emissionPower: 0.3,
          },
          meta: {},
        },
        // Goblin
        {
          id: 'goblin_1',
          name: 'Goblin',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_3', script: 'scripts/enemy_ai.ts', enabled: true, properties: { aggroRange: 8 } },
            { id: 'comp_4', script: 'scripts/health.ts', enabled: true, properties: { max: 25, current: 25 } },
          ],
          transform: { position: [3, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: 'g',
            color: [0.5, 0.7, 0.3],
            opacity: 1,
          },
          meta: {},
        },
        // Torch
        {
          id: 'torch_1',
          name: 'Torch',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_5', script: 'scripts/flicker.ts', enabled: true, properties: { speed: 8, amount: 0.15 } },
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
        // Treasure Chest
        {
          id: 'chest_1',
          name: 'Treasure Chest',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_6', script: 'scripts/interactable.ts', enabled: true, properties: { action: 'open' } },
          ],
          transform: { position: [4, 0, -1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: '▣',
            color: [0.7, 0.5, 0.2],
            opacity: 1,
          },
          meta: {},
        },
        // ─────────────────────────────────────────────────────────────────────
        // Demo Scene Content - Trees, Crystals, Water, Characters
        // ─────────────────────────────────────────────────────────────────────
        // Tree 1
        {
          id: 'tree_1',
          name: 'Tree',
          type: 'Node',
          children: [],
          components: [
            { id: 'tree_gen_1', script: 'builtin:tree_generator', enabled: true, properties: { height: 3, foliageRadius: 2 } },
          ],
          transform: { position: [4, 0, -3.5], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Tree 2
        {
          id: 'tree_2',
          name: 'Tree',
          type: 'Node',
          children: [],
          components: [
            { id: 'tree_gen_2', script: 'builtin:tree_generator', enabled: true, properties: { height: 4, foliageRadius: 2.5 } },
          ],
          transform: { position: [-4, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Tree 3
        {
          id: 'tree_3',
          name: 'Tree',
          type: 'Node',
          children: [],
          components: [
            { id: 'tree_gen_3', script: 'builtin:tree_generator', enabled: true, properties: { height: 3.5, foliageRadius: 2 } },
          ],
          transform: { position: [-5, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Tree 4
        {
          id: 'tree_4',
          name: 'Tree',
          type: 'Node',
          children: [],
          components: [
            { id: 'tree_gen_4', script: 'builtin:tree_generator', enabled: true, properties: { height: 2.5, foliageRadius: 1.5 } },
          ],
          transform: { position: [5, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Crystal - Cyan
        {
          id: 'crystal_cyan',
          name: 'Crystal',
          type: 'Node',
          children: [],
          components: [],
          transform: { position: [2.5, 0, -4], rotation: [0, 0.3, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: '◆',
            color: [0.3, 0.85, 0.95],
            opacity: 1,
            emission: [0.3, 0.85, 0.95],
            emissionPower: 0.5,
          },
          meta: { lightType: 'point', intensity: 0.8, radius: 4 },
        },
        // Crystal - Magenta
        {
          id: 'crystal_magenta',
          name: 'Crystal',
          type: 'Node',
          children: [],
          components: [],
          transform: { position: [-3, 0, -3], rotation: [0, -0.5, 0], scale: [0.8, 0.8, 0.8] },
          visual: {
            visible: true,
            glyph: '◆',
            color: [0.9, 0.3, 0.7],
            opacity: 1,
            emission: [0.9, 0.3, 0.7],
            emissionPower: 0.5,
          },
          meta: { lightType: 'point', intensity: 0.6, radius: 3 },
        },
        // Crystal - Amber
        {
          id: 'crystal_amber',
          name: 'Crystal',
          type: 'Node',
          children: [],
          components: [],
          transform: { position: [6, 0, 0], rotation: [0, 0.8, 0], scale: [1.2, 1.2, 1.2] },
          visual: {
            visible: true,
            glyph: '◆',
            color: [1.0, 0.7, 0.2],
            opacity: 1,
            emission: [1.0, 0.7, 0.2],
            emissionPower: 0.6,
          },
          meta: { lightType: 'point', intensity: 1.0, radius: 5 },
        },
        // Water Pond
        {
          id: 'water_pond',
          name: 'Pond',
          type: 'Node',
          children: [],
          components: [
            { id: 'water_gen', script: 'builtin:water_generator', enabled: true, properties: { radius: 2, depth: 0.3, reflectivity: 0.6 } },
          ],
          transform: { position: [-2, 0, -2], rotation: [0, 0, 0], scale: [1, 1, 1] },
          meta: {},
        },
        // Character - Cyan Mage
        {
          id: 'char_cyan',
          name: 'Mage',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_7', script: 'scripts/npc_idle.ts', enabled: true, properties: { bobSpeed: 2, bobAmount: 0.05 } },
          ],
          transform: { position: [-1, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: '♦',
            color: [0.3, 0.85, 0.95],
            opacity: 1,
            emission: [0.3, 0.85, 0.95],
            emissionPower: 0.3,
          },
          meta: {},
        },
        // Character - Magenta Rogue
        {
          id: 'char_magenta',
          name: 'Rogue',
          type: 'Node',
          children: [],
          components: [
            { id: 'comp_8', script: 'scripts/npc_idle.ts', enabled: true, properties: { bobSpeed: 1.5, bobAmount: 0.03 } },
          ],
          transform: { position: [2, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visual: {
            visible: true,
            glyph: '♠',
            color: [0.9, 0.3, 0.7],
            opacity: 1,
            emission: [0.9, 0.3, 0.7],
            emissionPower: 0.3,
          },
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
  // Render Pipeline - Flexible post-processing system
  // ─────────────────────────────────────────────────────────────────────────
  renderPipeline: {
    passes: {
      shadow: { enabled: true, resolution: 1024, bias: 0.005, cascades: 3 },
      main: { enabled: true },
      glyph: { enabled: true },
      sky: {
        enabled: true,
        zenithColor: [0.02, 0.03, 0.06],     // Dark night sky
        horizonColor: [0.08, 0.12, 0.18],    // Subtle blue-gray horizon
        groundColor: [0.03, 0.04, 0.03],     // Dark ground reflection
      },
      grid: { enabled: true, majorSize: 10, minorSize: 1, fadeDistance: 200 },
    },
    postEffects: [
      { id: 'ssao', name: 'SSAO', enabled: false, radius: 0.5, bias: 0.025, intensity: 0.8, samples: 16 },
      { id: 'fog', name: 'Fog', enabled: false, density: 0.03, color: [0.015, 0.02, 0.03], start: 10, end: 80, fogType: 1 },
      { id: 'bloom', name: 'Bloom', enabled: false, threshold: 0.6, intensity: 0.8, radius: 6 },
      { id: 'colorGrading', name: 'Color Grading', enabled: false, exposure: 0.1, contrast: 1.05, saturation: 1.0, tonemapping: 'aces' },
      { id: 'vignette', name: 'Vignette', enabled: false, intensity: 0.25, smoothness: 0.4, roundness: 0.6 },
      { id: 'chromaticAberration', name: 'Chromatic Aberration', enabled: false, intensity: 0.01 },
      { id: 'filmGrain', name: 'Film Grain', enabled: false, intensity: 0.1 },
      { id: 'pixelate', name: 'Pixelate', enabled: false, pixelSize: 4 },
      { id: 'outline', name: 'Outline', enabled: false, thickness: 1, color: [0, 0, 0, 1] },
      { id: 'sharpen', name: 'Sharpen', enabled: false, intensity: 0.5 },
      { id: 'fxaa', name: 'FXAA', enabled: false, quality: 'high' },
    ],
    shadows: {
      enabled: true,
      type: 'pcf',
      resolution: 1024,
      bias: 0.005,
      normalBias: 0.02,
      softness: 0.5,           // Medium softness
      cascades: 1,
      cascadeSplits: [0.1, 0.3, 0.5],
    },
    reflections: {
      enabled: true,
      type: 'planar',
      floorReflectivity: 0.15,
      waterReflectivity: 0.6,
      ssrMaxSteps: 64,
      ssrThickness: 0.5,
      ssrRoughnessFade: 0.8,
    },
    debugView: 'final',
    showStats: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Lighting - Multi-light system
  // ─────────────────────────────────────────────────────────────────────────
  lighting: {
    sun: {
      enabled: true,
      direction: [-0.5, -1, -0.3],
      color: [1.0, 0.95, 0.9],
      intensity: 1.0,
      castShadows: true,
    },
    ambient: {
      color: [0.3, 0.35, 0.4],
      intensity: 0.3,
      skyContribution: 0.2,
    },
    lights: [],
    gi: {
      enabled: false,
      bounces: 1,
      intensity: 0.5,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Environment - Sky and atmosphere
  // ─────────────────────────────────────────────────────────────────────────
  environment: {
    skybox: {
      type: 'gradient',
      gradient: {
        zenith: [0.02, 0.03, 0.06],     // Dark night sky
        horizon: [0.08, 0.12, 0.18],    // Subtle blue-gray horizon
        ground: [0.03, 0.04, 0.03],     // Dark ground reflection
      },
      texture: null,
      rotation: 0,
      exposure: 1.0,
      sunSize: 0.05,
      atmosphereDensity: 1.0,
    },
    fog: {
      enabled: true,
      type: 'exponential',
      color: [0.015, 0.02, 0.03],       // Dark fog matching scene atmosphere
      density: 0.03,
      start: 10,
      end: 80,
      heightFalloff: 0.3,
    },
    timeOfDay: 0.2, // Evening/night
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Entities - Normalized entity storage for O(1) lookups
  // ─────────────────────────────────────────────────────────────────────────
  entities: {
    nodes: {
      root: {
        id: 'root',
        name: 'Scene',
        type: 'Node',
        parentId: null,
        childIds: ['floor', 'light_main', 'player', 'goblin_1', 'torch_1', 'chest_1', 'tree_1', 'tree_2', 'tree_3', 'tree_4', 'crystal_cyan', 'crystal_magenta', 'crystal_amber', 'water_pond', 'char_cyan', 'char_magenta'],
        componentIds: [],
        meta: {},
      },
      floor: {
        id: 'floor',
        name: 'Floor',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['floor_gen'],
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      light_main: {
        id: 'light_main',
        name: 'Main Light',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: [],
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
      player: {
        id: 'player',
        name: 'Player',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_1', 'comp_2'],
        transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: '@',
          color: [0.2, 0.9, 0.5],
          opacity: 1,
          emission: [0.2, 0.9, 0.5],
          emissionPower: 0.3,
        },
        meta: {},
      },
      goblin_1: {
        id: 'goblin_1',
        name: 'Goblin',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_3', 'comp_4'],
        transform: { position: [3, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: 'g',
          color: [0.5, 0.7, 0.3],
          opacity: 1,
        },
        meta: {},
      },
      torch_1: {
        id: 'torch_1',
        name: 'Torch',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_5'],
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
      chest_1: {
        id: 'chest_1',
        name: 'Treasure Chest',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_6'],
        transform: { position: [4, 0, -1], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: '▣',
          color: [0.7, 0.5, 0.2],
          opacity: 1,
        },
        meta: {},
      },
      // Demo Scene Nodes
      tree_1: {
        id: 'tree_1',
        name: 'Tree',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['tree_gen_1'],
        transform: { position: [4, 0, -3.5], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      tree_2: {
        id: 'tree_2',
        name: 'Tree',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['tree_gen_2'],
        transform: { position: [-4, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      tree_3: {
        id: 'tree_3',
        name: 'Tree',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['tree_gen_3'],
        transform: { position: [-5, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      tree_4: {
        id: 'tree_4',
        name: 'Tree',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['tree_gen_4'],
        transform: { position: [5, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      crystal_cyan: {
        id: 'crystal_cyan',
        name: 'Crystal',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: [],
        transform: { position: [2.5, 0, -4], rotation: [0, 0.3, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: '◆',
          color: [0.3, 0.85, 0.95],
          opacity: 1,
          emission: [0.3, 0.85, 0.95],
          emissionPower: 0.5,
        },
        meta: { lightType: 'point', intensity: 0.8, radius: 4 },
      },
      crystal_magenta: {
        id: 'crystal_magenta',
        name: 'Crystal',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: [],
        transform: { position: [-3, 0, -3], rotation: [0, -0.5, 0], scale: [0.8, 0.8, 0.8] },
        visual: {
          visible: true,
          glyph: '◆',
          color: [0.9, 0.3, 0.7],
          opacity: 1,
          emission: [0.9, 0.3, 0.7],
          emissionPower: 0.5,
        },
        meta: { lightType: 'point', intensity: 0.6, radius: 3 },
      },
      crystal_amber: {
        id: 'crystal_amber',
        name: 'Crystal',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: [],
        transform: { position: [6, 0, 0], rotation: [0, 0.8, 0], scale: [1.2, 1.2, 1.2] },
        visual: {
          visible: true,
          glyph: '◆',
          color: [1.0, 0.7, 0.2],
          opacity: 1,
          emission: [1.0, 0.7, 0.2],
          emissionPower: 0.6,
        },
        meta: { lightType: 'point', intensity: 1.0, radius: 5 },
      },
      water_pond: {
        id: 'water_pond',
        name: 'Pond',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['water_gen'],
        transform: { position: [-2, 0, -2], rotation: [0, 0, 0], scale: [1, 1, 1] },
        meta: {},
      },
      char_cyan: {
        id: 'char_cyan',
        name: 'Mage',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_7'],
        transform: { position: [-1, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: '♦',
          color: [0.3, 0.85, 0.95],
          opacity: 1,
          emission: [0.3, 0.85, 0.95],
          emissionPower: 0.3,
        },
        meta: {},
      },
      char_magenta: {
        id: 'char_magenta',
        name: 'Rogue',
        type: 'Node',
        parentId: 'root',
        childIds: [],
        componentIds: ['comp_8'],
        transform: { position: [2, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
        visual: {
          visible: true,
          glyph: '♠',
          color: [0.9, 0.3, 0.7],
          opacity: 1,
          emission: [0.9, 0.3, 0.7],
          emissionPower: 0.3,
        },
        meta: {},
      },
    },
    components: {
      floor_gen: {
        id: 'floor_gen',
        nodeId: 'floor',
        script: 'builtin:floor_generator',
        enabled: true,
        properties: {
          tileType: 'checkerboard',
          size: [21, 21],
          tileSize: 1,
          primaryColor: [0.04, 0.08, 0.06, 1],    // Dark tile
          secondaryColor: [0.06, 0.12, 0.08, 1],  // Slightly lighter tile
          gridLineColor: [0.1, 0.22, 0.15, 1],    // Subtle grid lines
          elevation: 0,
        },
      },
      comp_1: {
        id: 'comp_1',
        nodeId: 'player',
        script: 'scripts/player_controller.ts',
        enabled: true,
        properties: { speed: 5 },
      },
      comp_2: {
        id: 'comp_2',
        nodeId: 'player',
        script: 'scripts/health.ts',
        enabled: true,
        properties: { max: 100, current: 100 },
      },
      comp_3: {
        id: 'comp_3',
        nodeId: 'goblin_1',
        script: 'scripts/enemy_ai.ts',
        enabled: true,
        properties: { aggroRange: 8 },
      },
      comp_4: {
        id: 'comp_4',
        nodeId: 'goblin_1',
        script: 'scripts/health.ts',
        enabled: true,
        properties: { max: 25, current: 25 },
      },
      comp_5: {
        id: 'comp_5',
        nodeId: 'torch_1',
        script: 'scripts/flicker.ts',
        enabled: true,
        properties: { speed: 8, amount: 0.15 },
      },
      comp_6: {
        id: 'comp_6',
        nodeId: 'chest_1',
        script: 'scripts/interactable.ts',
        enabled: true,
        properties: { action: 'open' },
      },
      // Demo scene components
      tree_gen_1: {
        id: 'tree_gen_1',
        nodeId: 'tree_1',
        script: 'builtin:tree_generator',
        enabled: true,
        properties: { height: 3, foliageRadius: 2 },
      },
      tree_gen_2: {
        id: 'tree_gen_2',
        nodeId: 'tree_2',
        script: 'builtin:tree_generator',
        enabled: true,
        properties: { height: 4, foliageRadius: 2.5 },
      },
      tree_gen_3: {
        id: 'tree_gen_3',
        nodeId: 'tree_3',
        script: 'builtin:tree_generator',
        enabled: true,
        properties: { height: 3.5, foliageRadius: 2 },
      },
      tree_gen_4: {
        id: 'tree_gen_4',
        nodeId: 'tree_4',
        script: 'builtin:tree_generator',
        enabled: true,
        properties: { height: 2.5, foliageRadius: 1.5 },
      },
      water_gen: {
        id: 'water_gen',
        nodeId: 'water_pond',
        script: 'builtin:water_generator',
        enabled: true,
        properties: { radius: 2, depth: 0.3, reflectivity: 0.6 },
      },
      comp_7: {
        id: 'comp_7',
        nodeId: 'char_cyan',
        script: 'scripts/npc_idle.ts',
        enabled: true,
        properties: { bobSpeed: 2, bobAmount: 0.05 },
      },
      comp_8: {
        id: 'comp_8',
        nodeId: 'char_magenta',
        script: 'scripts/npc_idle.ts',
        enabled: true,
        properties: { bobSpeed: 1.5, bobAmount: 0.03 },
      },
    },
    nodeOrder: ['root', 'floor', 'light_main', 'player', 'goblin_1', 'torch_1', 'chest_1', 'tree_1', 'tree_2', 'tree_3', 'tree_4', 'crystal_cyan', 'crystal_magenta', 'crystal_amber', 'water_pond', 'char_cyan', 'char_magenta'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Transient state - high-frequency updates (no history)
  // ─────────────────────────────────────────────────────────────────────────
  transient: {
    drag: {
      active: false,
      nodeId: null,
      startTransform: null,
      axis: null,
    },
    hover: {
      nodeId: null,
      componentId: null,
      gizmoAxis: null,
    },
    input: {
      keysDown: new Set<string>(),
      mousePosition: [0, 0] as [number, number],
      mouseButtons: 0,
    },
    cameraOrbit: {
      active: false,
      startYaw: 0,
      startPitch: 0,
    },
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
