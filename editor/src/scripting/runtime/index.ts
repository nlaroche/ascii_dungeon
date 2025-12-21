// ═══════════════════════════════════════════════════════════════════════════
// Scripting Runtime - Core runtime for the ASCII Dungeon scripting system
// ═══════════════════════════════════════════════════════════════════════════

// Triple-Phase Event System
export {
  createGameEvent,
  TriplePhaseEventBus,
  GameEventBus,
} from './events'
export type {
  EventPhase,
  EventRouting,
  NodeRef,
  GameEvent,
  EventHandler,
  HandlerRegistration,
  CreateEventOptions,
} from './events'

// Node Lifecycle State Machine
export {
  LifecycleManager,
  GlobalLifecycleManager,
  SeededRandom,
  DEFAULT_LIFECYCLE_CONFIG,
} from './lifecycle'
export type {
  LifecycleState,
  LifecycleConfig,
  NodeLifecycleInfo,
  ConstructionContext,
  InitEventData,
  DisposeEventData,
  EnableEventData,
  ErrorEventData,
} from './lifecycle'

// Expression Evaluator
export {
  compileExpression,
  evaluateExpression,
  evaluateAST,
  evaluateCached,
  clearExpressionCache,
  getExpressionCacheStats,
  isExprWrapper,
  resolveValue,
} from './expressions'
export type {
  ExprValue,
  Vec2,
  ExprContext,
  ExprWrapper,
} from './expressions'

// Logic Graph Runtime
export {
  GraphRuntime,
  GraphExecutor,
  GlobalGraphExecutor,
} from './graph'
export type {
  LogicGraph,
  VariableDef,
  GraphEdge,
  GraphNode,
  SignalNode,
  ActionNode,
  BranchNode,
  FlowNode,
  VariableNode,
  SubGraphNode,
  GraphExecutionContext,
  ComponentInstance,
} from './graph'

// State Machine Runtime
export {
  StateMachineInstance,
  StateMachineManager,
  StateMachineBuilder,
  StateBuilder,
  createStateMachine,
} from './stateMachine'
export type {
  StateDefinition,
  StateTransition,
  StateAction,
  StateMachineDefinition,
  StateMachineContext,
  StateMachineEvent,
  StateMachineEventType,
} from './stateMachine'

// Variables System
export {
  VariablesManager,
  GlobalVariables,
  getGlobal,
  setGlobal,
  getScene,
  setScene,
  getNode,
  setNode,
  defineVar,
  watchVar,
} from './variables'
export type {
  VariableScope,
  VariableType,
  VariableDefinition,
  VariableChangeEvent,
  VariableWatcher,
} from './variables'

// Runtime Manager
export {
  RuntimeManager,
  Runtime,
  startRuntime,
  stopRuntime,
  pauseRuntime,
  resumeRuntime,
  isKeyDown,
  isKeyPressed,
  isMouseDown,
  getTime,
  getDeltaTime,
} from './RuntimeManager'
export type {
  InputState,
  RuntimeStats,
} from './RuntimeManager'

// Graph Serialization
export {
  serializeGraph,
  deserializeGraph,
  validateGraph,
  graphToJSON,
  graphFromJSON,
  cloneGraph,
  graphToReactFlow,
  reactFlowToGraph,
} from './serialization'
export type {
  SerializedGraph,
  SerializedNode,
  SerializedEdge,
  SerializedVariable,
  GraphMetadata,
  ValidationError,
  ReactFlowNode,
  ReactFlowEdge,
} from './serialization'

// Timer Manager
export {
  TimerManager,
  Timers,
  startTimer,
  stopTimer,
  isTimerRunning,
  getTimerRemaining,
  delay,
  interval,
  cancelTimer,
} from './TimerManager'
export type { TimerConfig } from './TimerManager'

// Scene Manager
export {
  SceneManager,
  Scene,
  loadScene,
  reloadScene,
  getSceneName,
  findEntity,
  findEntitiesByTag,
  instantiate,
  destroy,
} from './SceneManager'
export type {
  SceneData,
  EntityData,
  ComponentData,
  PrefabData,
  EntityQuery,
} from './SceneManager'

// Node Executors
export {
  mathExecutors,
  vectorExecutors,
  stringExecutors,
  comparisonExecutors,
  entityExecutors,
  sceneExecutors,
  timerExecutors,
  arrayExecutors,
  debugExecutors,
  nodeExecutors,
  executeNode,
  hasExecutor,
  registerExecutor,
} from './nodeExecutors'
export type { NodeExecutorContext, NodeExecutor } from './nodeExecutors'

// Graph Runner
export {
  GraphRunner,
  globalGraphRunner,
  loadGraph,
  startGraph,
  stopGraph,
  pauseGraph,
  resumeGraph,
  getGraphState,
} from './GraphRunner'
export type {
  GraphRunnerState,
  GraphRunnerEvent,
  GraphRunnerListener,
  ExecutionStats,
} from './GraphRunner'

// Graph Storage
export {
  GraphStorage,
  graphStorage,
  saveGraph,
  loadGraph as loadGraphFromFile,
  listGraphs,
  deleteGraph,
} from './GraphStorage'
export type {
  SavedGraph,
  SavedNode,
  SavedEdge,
  SavedVariable,
  GraphListEntry,
} from './GraphStorage'

// Entity Binding
export {
  EntityBindingManager,
  entityBindingManager,
  bindGraphToEntity,
  unbindGraph,
  startEntityGraphs,
  stopEntityGraphs,
  sendEntityEvent,
} from './EntityBinding'
export type {
  EntityRef,
  BoundGraph,
  ComponentProxy,
} from './EntityBinding'

// Game Hooks
export {
  GameHooks,
  gameHookExecutors,
  registerGameHookExecutors,
} from './GameHooks'
export type {
  AnimationRequest,
  SoundRequest,
  ParticleRequest,
  CameraRequest,
  GameHookHandler,
} from './GameHooks'

// SubGraph System
export {
  subGraphRegistry,
  registerSubGraph,
  getSubGraph,
  getAllSubGraphs,
  createSubGraph,
} from './SubGraph'
export type {
  SubGraphDefinition,
  SubGraphPort,
  SubGraphInstance,
} from './SubGraph'

// Debugger
export {
  GraphDebugger,
  graphDebugger,
  attachDebugger,
  setBreakpoint,
  removeBreakpoint,
  toggleBreakpoint,
  startDebugging,
  stopDebugging,
  continueExecution,
  stepOver,
  stepInto,
  stepOut,
} from './Debugger'
export type {
  Breakpoint,
  DebugState,
  DebugEvent,
  DebugEventListener,
} from './Debugger'

// Hot Reload
export {
  hotReloadManager,
  hotReloadGraph,
  hotReloadFromFile,
  watchGraphFile,
  unwatchGraphFile,
  unwatchAllGraphFiles,
} from './HotReload'
export type {
  HotReloadResult,
  HotReloadOptions,
} from './HotReload'

// Play Mode Manager
export {
  PlayModeManager,
  PlayMode,
  startPlayMode,
  stopPlayMode,
  pausePlayMode,
  resumePlayMode,
  stepPlayMode,
  getPlayModeStatus,
  isPlayModeRunning,
} from './PlayModeManager'
export type {
  PlayModeStatus,
  SceneSnapshot,
  PlayModeState,
  PlayModeStats,
  EntityRuntimeState,
} from './PlayModeManager'
