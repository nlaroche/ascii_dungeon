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
  mode: '2d' | '3d';  // 2d = orthographic top-down, 3d = perspective free camera
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
// RENDER PIPELINE - 2D ASCII-focused post-processing system
// ─────────────────────────────────────────────────────────────────────────────

// CRT/ASCII effect settings (unified shader pass)
export interface CRTSettings {
  scanlines: number;       // 0-1
  curvature: number;       // 0-1
  bloom: number;           // 0-1
  noise: number;           // 0-1
  chromatic: number;       // 0-1
  flicker: number;         // 0-1
  vignette: number;        // 0-1
  pixelate: number;        // 0-1
  colorShift: number;      // -1 to 1 (cool to warm)
}

// Individual post-process effect
export interface PostProcessEffect {
  id: string;
  name: string;
  enabled: boolean;
  intensity?: number;
  params?: Record<string, number | string | number[]>;
}

// Post-processing stack (used for both camera and global)
export interface PostProcessStack {
  enabled: boolean;
  crtEnabled: boolean;
  crtSettings: CRTSettings;
  effects: PostProcessEffect[];
  preset?: string;
}

export type DebugViewMode = 'final' | 'depth' | 'normals' | 'emission';

export interface RenderPipelineState {
  // Global post-processing (applied after camera effects)
  globalPostProcess: PostProcessStack;
  // Debug view mode
  debugView: DebugViewMode;
  showStats: boolean;
}

// Default CRT settings
export const DEFAULT_CRT_SETTINGS: CRTSettings = {
  scanlines: 0,
  curvature: 0,
  bloom: 0,
  noise: 0,
  chromatic: 0,
  flicker: 0,
  vignette: 0,
  pixelate: 0,
  colorShift: 0,
};

// Default post-process stack
export const DEFAULT_POST_PROCESS_STACK: PostProcessStack = {
  enabled: false,
  crtEnabled: false,
  crtSettings: { ...DEFAULT_CRT_SETTINGS },
  effects: [],
};

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
// PLAY MODE TYPES - Unity-like scene execution with snapshot/restore
// ─────────────────────────────────────────────────────────────────────────────

export type PlayModeStatus = 'stopped' | 'playing' | 'paused';

export interface PlayModeSnapshot {
  timestamp: number;
  rootNode: Node;
  entities: EntityMaps;
  globalVariables: Record<string, unknown>;
}

export interface PlayModeState {
  status: PlayModeStatus;
  snapshot: PlayModeSnapshot | null;
  startTime: number;
  frameCount: number;
  elapsedTime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE ENGINE STATE
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ASCII SETTINGS - ASCII-first rendering configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface AsciiSettings {
  palette: string;           // Palette name (e.g., 'phosphor', 'amber', 'c64')
  fontSize: number;          // Base font size for ASCII rendering
  animate: boolean;          // Enable character animations
  animationSpeed: number;    // Animation speed multiplier
}

// ─────────────────────────────────────────────────────────────────────────────
// 2D EDITOR STATE - Terminal-style ASCII editor
// ─────────────────────────────────────────────────────────────────────────────

export interface Editor2DState {
  tool: 'pointer' | 'select' | 'draw' | 'erase';
  showGrid: boolean;
  zoom: number;                // Zoom percentage (100 = 100%)
  currentChar: string;         // Character to draw with
  selection: {                 // Current selection rectangle
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  selectionAscii: string | null; // ASCII content within selection (from terminal grid)
  hoveredNode: string | null;  // Currently hovered node ID
  selectedGlyph: string;       // Currently selected glyph for drawing
  recenterTimestamp: number;   // Increment to trigger recenter on content
  centerOnNodeId: string | null; // Set to node ID to center view on that node
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFAB & PALETTE SYSTEM - Reusable node templates like Unity prefabs
// ─────────────────────────────────────────────────────────────────────────────

export interface Prefab {
  id: string;
  name: string;
  category: string[];           // Hierarchical path e.g. ['buildings', 'houses']
  tags: string[];               // Searchable tags
  description?: string;
  template: Node;               // The template node (including children)
  createdAt: number;
  modifiedAt: number;
}

export interface PrefabInstance {
  prefabId: string;             // Reference to source prefab
  overrides: Record<string, unknown>;  // Path -> value overrides from prefab
}

export interface PaletteCategory {
  id: string;
  name: string;
  icon?: string;                // Optional icon identifier
  children: string[];           // Child category IDs
  prefabs: string[];            // Prefab IDs in this category
}

export interface PaletteState {
  prefabs: Record<string, Prefab>;        // All prefabs by ID
  categories: Record<string, PaletteCategory>;  // Categories by ID
  rootCategories: string[];               // Top-level category IDs
  selectedCategory: string | null;        // Currently selected category
  searchQuery: string;                    // Current search filter
  expandedCategories: string[];           // Expanded category IDs in tree view
}

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

  // ASCII rendering settings
  ascii: AsciiSettings;

  // 2D Editor state
  editor2D: Editor2DState;

  // Prefab & Palette system
  palette: PaletteState;

  // Normalized entity system (O(1) lookups)
  entities: EntityMaps;

  // Transient state (no history tracking - for drag, hover, etc.)
  transient: TransientState;

  // Play mode state (for scene execution)
  playMode: PlayModeState;

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
    mode: '3d',
    position: [12, 8, 12],
    target: [0, 0, 0],
    rotation: [-0.4, -Math.PI * 0.75, 0],
    fov: 60,
    near: 0.1,
    far: 500,
    speed: 10,
    sensitivity: 0.002,
    orthoSize: 15,
    topdownHeight: 50,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Scene - Node-based hierarchy (everything is a node)
  // Simplified structure using TileMap for ASCII dungeon
  // ─────────────────────────────────────────────────────────────────────────
  // Scene - starts empty, user creates content
  scene: {
    name: 'Untitled Scene',
    rootNodeId: 'root',
    rootNode: {
      id: 'root',
      name: 'Scene',
      type: 'Node',
      children: [],
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
  // Render Pipeline - 2D ASCII-focused post-processing
  // ─────────────────────────────────────────────────────────────────────────
  renderPipeline: {
    globalPostProcess: {
      enabled: true,
      crtEnabled: true,
      crtSettings: {
        scanlines: 0.5,
        curvature: 0.3,
        bloom: 0.4,
        noise: 0.15,
        chromatic: 0.3,
        flicker: 0.2,
        vignette: 0.4,
        pixelate: 0,
        colorShift: 0,
      },
      effects: [],
      preset: 'crt',
    },
    debugView: 'final',
    showStats: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ASCII Settings - ASCII-first rendering
  // ─────────────────────────────────────────────────────────────────────────
  ascii: {
    palette: 'phosphor',
    fontSize: 14,
    animate: true,
    animationSpeed: 1.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2D Editor - Terminal-style ASCII editor
  // ─────────────────────────────────────────────────────────────────────────
  editor2D: {
    tool: 'pointer',
    showGrid: true,
    zoom: 100,
    currentChar: '#',
    selection: null,
    selectionAscii: null,
    hoveredNode: null,
    selectedGlyph: '@',
    recenterTimestamp: 0,
    centerOnNodeId: null,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Prefab & Palette - Reusable node templates
  // ─────────────────────────────────────────────────────────────────────────
  palette: {
    prefabs: {
      'prefab-torch': {
        id: 'prefab-torch',
        name: 'Torch',
        category: ['items'],
        tags: ['light', 'fire'],
        description: 'A glowing torch that illuminates nearby tiles',
        template: {
          id: 'torch-template',
          name: 'Torch',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'glyph', script: 'Glyph', enabled: true, properties: { char: '*', fg: [1, 0.6, 0.1], bg: [0, 0, 0], emission: 5 } },
          ],
          meta: { layer: 'objects', light: true },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-campfire': {
        id: 'prefab-campfire',
        name: 'Campfire',
        category: ['items'],
        tags: ['light', 'fire', 'camp'],
        description: 'A warm campfire with strong glow',
        template: {
          id: 'campfire-template',
          name: 'Campfire',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'glyph', script: 'Glyph', enabled: true, properties: { char: 'W', fg: [1, 0.4, 0.1], bg: [0.2, 0.05, 0], emission: 8 } },
          ],
          meta: { layer: 'objects', light: true },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-hut': {
        id: 'prefab-hut',
        name: 'Small Hut',
        category: ['buildings'],
        tags: ['house', 'building'],
        description: 'A small village hut',
        template: {
          id: 'hut-template',
          name: 'Small Hut',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 6, height: 4 } },
            { id: 'glyphmap', script: 'GlyphMap', enabled: true, properties: { cells: '  /\\  \n /##\\ \n |##| \n |==| ' } },
          ],
          meta: { layer: 'objects', zIndex: 1 },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-tree': {
        id: 'prefab-tree',
        name: 'Oak Tree',
        category: ['fauna'],
        tags: ['tree', 'nature', 'plant'],
        description: 'A leafy oak tree',
        template: {
          id: 'tree-template',
          name: 'Oak Tree',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 5, height: 3 } },
            { id: 'glyphmap', script: 'GlyphMap', enabled: true, properties: { cells: ' &&& \n&&&&&\n |#| ' } },
          ],
          meta: { layer: 'objects', zIndex: 1 },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-player': {
        id: 'prefab-player',
        name: 'Player',
        category: ['characters'],
        tags: ['player', 'hero', 'character'],
        description: 'The player character',
        template: {
          id: 'player-template',
          name: 'Player',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'glyph', script: 'Glyph', enabled: true, properties: { char: '@', fg: [0.2, 1, 0.4], bg: [0, 0, 0], emission: 0.3 } },
          ],
          meta: { layer: 'player', isPlayer: true },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-npc': {
        id: 'prefab-npc',
        name: 'NPC',
        category: ['characters'],
        tags: ['npc', 'villager', 'character'],
        description: 'A generic NPC villager',
        template: {
          id: 'npc-template',
          name: 'NPC',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'glyph', script: 'Glyph', enabled: true, properties: { char: 'N', fg: [0.8, 0.7, 0.5], bg: [0, 0, 0] } },
          ],
          meta: { layer: 'entities', npc: true },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
      'prefab-well': {
        id: 'prefab-well',
        name: 'Well',
        category: ['buildings'],
        tags: ['well', 'water', 'structure'],
        description: 'A village well',
        template: {
          id: 'well-template',
          name: 'Well',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'rect', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 4, height: 3 } },
            { id: 'glyphmap', script: 'GlyphMap', enabled: true, properties: { cells: '/--\\\n|~~|\n\\__/' } },
          ],
          meta: { layer: 'objects', zIndex: 1 },
        },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },
    },
    categories: {
      'buildings': { id: 'buildings', name: 'Buildings', icon: '🏠', children: [], prefabs: ['prefab-hut', 'prefab-well'] },
      'characters': { id: 'characters', name: 'Characters', icon: '👤', children: [], prefabs: ['prefab-player', 'prefab-npc'] },
      'items': { id: 'items', name: 'Items', icon: '📦', children: [], prefabs: ['prefab-torch', 'prefab-campfire'] },
      'fauna': { id: 'fauna', name: 'Fauna', icon: '🌿', children: [], prefabs: ['prefab-tree'] },
    },
    rootCategories: ['buildings', 'characters', 'items', 'fauna'],
    selectedCategory: null,
    searchQuery: '',
    expandedCategories: ['buildings', 'characters', 'items', 'fauna'],
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
  // Starts empty - content created by user
  // ─────────────────────────────────────────────────────────────────────────
  entities: {
    nodes: {
      root: {
        id: 'root',
        name: 'Scene',
        type: 'Node',
        parentId: null,
        childIds: [],
        componentIds: [],
        meta: {},
      },
    },
    components: {},
    nodeOrder: ['root'],
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
  // Play Mode (scene execution)
  // ─────────────────────────────────────────────────────────────────────────
  playMode: {
    status: 'stopped',
    snapshot: null,
    startTime: 0,
    frameCount: 0,
    elapsedTime: 0,
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
