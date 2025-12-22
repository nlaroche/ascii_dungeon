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

// Transform Cache - World position caching with dirty flag propagation
export {
  TransformCache,
  getWorldPosition,
  markTransformDirty,
} from './TransformCache'

// Signal Types - Extensible signal system (instant, timed, delayed, custom)
export {
  SignalTypeRegistry,
  InstantSignalType,
  TimedSignalType,
  DelayedSignalType,
  registerBuiltinSignalTypes,
  emitSignal,
  emitInstant,
  emitTimed,
  updateSignals,
  isSignalAnimating,
} from './SignalTypes'
export type {
  SignalType,
  SignalEmitOptions,
  SignalEventData,
  SignalEmitContext,
  ActiveTimedSignal,
} from './SignalTypes'

// Tick System - Roguelike turn-based game logic with smooth animations
export {
  TickSystem,
  Ticks,
  TickEasing,
  triggerTick,
  onTick,
  getTickCount,
  getTickProgress,
  getEasedTickProgress,
  isTickAnimating,
  setTickDuration,
  lerpTick,
} from './TickSystem'
export type { EasingType } from './TickSystem'

// Script Behaviors - TypeScript-based behaviors
export {
  registerScriptBehavior,
  hasScriptBehavior,
  createScriptBehavior,
  getScriptBehaviorIds,
  createWanderBehavior,
  createPatrolBehavior,
  createFollowBehavior,
} from './ScriptBehaviors'
export type {
  ScriptBehaviorContext,
  ScriptBehavior,
  ScriptBehaviorFactory,
} from './ScriptBehaviors'
