// ═══════════════════════════════════════════════════════════════════════════
// Built-in Components - Export all standard engine components
// ═══════════════════════════════════════════════════════════════════════════

// Core rendering
export { AsciiComponent } from './AsciiComponent'
export { GlyphComponent } from './GlyphComponent'
export { TerrainComponent } from './TerrainComponent'

// Animation
export { AnimatorComponent } from './AnimatorComponent'

// Physics/Collision
export { ColliderComponent } from './ColliderComponent'
export type { ColliderType, CollisionEventData } from './ColliderComponent'

// Behavior
export { InteractableComponent } from './InteractableComponent'
export type { InteractionType } from './InteractableComponent'

// AI Controllers
export { WanderAIComponent } from './WanderAIComponent'
export { TickWanderAIComponent } from './TickWanderAIComponent'

// World/Scene Management
export { WorldManagerComponent } from './WorldManagerComponent'
export { EdgeTriggerComponent } from './EdgeTriggerComponent'
export { GameDataComponent } from './GameDataComponent'

// Player Input
export { PlayerControllerComponent } from './PlayerControllerComponent'

// Debug/Development
export { DebugComponent, Debug, onDebugMessage } from './DebugComponent'
export type { LogLevel, DebugMessageEvent } from './DebugComponent'

// Audio
export { AudioComponent, GameAudio, onSoundEnd } from './AudioComponent'
export type { SFXCategory, SoundEndEvent } from './AudioComponent'

// Camera
export {
  CameraComponent,
  CameraTransposerComponent,
  CameraComposerComponent,
  CameraConfinerComponent,
  CameraShakeComponent,
  CameraLetterboxComponent,
  CameraBrain,
  GameCamera,
} from './CameraComponent'
export type {
  BlendCurve,
  CameraOutput,
  CameraTransitionEvent,
  CameraShakeEvent,
} from './CameraComponent'

// Re-export decorators for convenience
export {
  component,
  property,
  number,
  string,
  boolean,
  color,
  vec2,
  vec3,
  select,
  getComponentMetadata,
  getRegisteredComponents,
  createComponent,
  componentRegistry,
} from '../decorators'

// Re-export base class
export { Component, ComponentManager } from '../Component'
