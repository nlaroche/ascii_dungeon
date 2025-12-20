// ═══════════════════════════════════════════════════════════════════════════
// Stores Index - Central exports for state management
// ═══════════════════════════════════════════════════════════════════════════

// Main engine state (unified state, history, undo/redo)
export {
  useEngineState,
  // Convenience hooks
  useTheme,
  useUIScale,
  useEditorMode,
  useActiveTool,
  usePanel,
  useSelection,
  useNodes,
  useNormalizedEntities,
  useTransient,
  useChat,
  useTemplate,
  useRenderPipeline,
  useLighting,
  useEnvironment,
  useAscii,
  // Helper functions
  generateId,
  syncTreeToEntities,
  buildTreeFromEntities,
  computeNodeOrder,
  getAncestorIds,
  getDescendantIds,
  isDescendantOfNormalized,
  findNode,
  findNodePath,
  flattenNodes,
  findParentNode,
  cloneNode,
  isDescendantOf,
  // Types
  type StatePath,
  type EngineStateStore,
} from './useEngineState';

// Engine state types
export type {
  EngineState,
  Node,
  NodeComponent,
  NormalizedNode,
  NormalizedComponent,
  EntityMaps,
  TransientState,
  Transform,
  NodeVisual,
  Theme,
  SceneView,
  PostProcessEffect,
  PostProcessStack,
  CRTSettings,
  SceneLight,
  DebugViewMode,
  SkyboxType,
  FogType,
  LogEntry,
  ChatMessage,
  Conversation,
  HistoryEntry,
  Diff,
  AsciiSettings,
} from './engineState';

export { INITIAL_ENGINE_STATE } from './engineState';

// Entity subscriptions (for non-React code)
export {
  entitySubscriptions,
  detectEntityChanges,
  type ChangeType,
  type NodeChangeCallback,
  type ComponentChangeCallback,
  type EntitiesChangeCallback,
  type SelectionChangeCallback,
} from './subscriptions';

// Tauri IPC store (for native engine communication)
export {
  useEngineStore,
  type EngineStats,
  type CameraState,
} from './engineStore';
