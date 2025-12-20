// ═══════════════════════════════════════════════════════════════════════════
// Scripting System - TypeScript component system for ASCII Dungeon
// ═══════════════════════════════════════════════════════════════════════════

// Core
export { Component, ComponentManager } from './Component'
export type { ComponentLifecycle } from './Component'

// Decorators
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
} from './decorators'
export type { PropertyType, PropertyOptions, ComponentMetadata, ComponentOptions } from './decorators'

// Built-in Components
export { AsciiComponent } from './components/AsciiComponent'
export type { RenderMode, CharCell, AsciiFrame } from './components/AsciiComponent'
export { GlyphComponent } from './components/GlyphComponent'
export { TerrainComponent } from './components/TerrainComponent'
export { AnimatorComponent } from './components/AnimatorComponent'
export { ColliderComponent } from './components/ColliderComponent'
export type { ColliderType } from './components/ColliderComponent'
export { InteractableComponent } from './components/InteractableComponent'
export type { InteractionType } from './components/InteractableComponent'
export { AudioComponent, GameAudio, onSoundEnd } from './components/AudioComponent'
export type { SFXCategory, SoundEndEvent } from './components/AudioComponent'
export { DebugComponent, Debug, onDebugMessage } from './components/DebugComponent'
export type { LogLevel, DebugMessageEvent } from './components/DebugComponent'
export {
  CameraComponent,
  CameraTransposerComponent,
  CameraComposerComponent,
  CameraConfinerComponent,
  CameraShakeComponent,
  CameraLetterboxComponent,
  CameraBrain,
  GameCamera,
} from './components/CameraComponent'
export type {
  BlendCurve,
  CameraOutput,
  CameraTransitionEvent,
  CameraShakeEvent,
} from './components/CameraComponent'
export {
  BehaviorComponent,
  BehaviorGraphRegistry,
  ComponentInstanceRegistry,
} from './components/BehaviorComponent'
export type { GraphReference, ExecutionMode } from './components/BehaviorComponent'

// Palettes
export * from './palettes'

// ASCII Art Library
export * from './asciiArt'

// ─────────────────────────────────────────────────────────────────────────────
// Component type map for serialization
// ─────────────────────────────────────────────────────────────────────────────

import { AsciiComponent } from './components/AsciiComponent'
import { GlyphComponent } from './components/GlyphComponent'
import { TerrainComponent } from './components/TerrainComponent'
import { AnimatorComponent } from './components/AnimatorComponent'
import { ColliderComponent } from './components/ColliderComponent'
import { InteractableComponent } from './components/InteractableComponent'
import { AudioComponent } from './components/AudioComponent'
import { DebugComponent } from './components/DebugComponent'
import { CameraComponent, CameraTransposerComponent, CameraComposerComponent, CameraConfinerComponent, CameraShakeComponent, CameraLetterboxComponent } from './components/CameraComponent'
import { BehaviorComponent } from './components/BehaviorComponent'

export const BUILTIN_COMPONENTS = {
  Ascii: AsciiComponent,
  Glyph: GlyphComponent,
  Terrain: TerrainComponent,
  Animator: AnimatorComponent,
  Collider: ColliderComponent,
  Interactable: InteractableComponent,
  Audio: AudioComponent,
  Debug: DebugComponent,
  Camera: CameraComponent,
  CameraTransposer: CameraTransposerComponent,
  CameraComposer: CameraComposerComponent,
  CameraConfiner: CameraConfinerComponent,
  CameraShake: CameraShakeComponent,
  CameraLetterbox: CameraLetterboxComponent,
  Behavior: BehaviorComponent,
} as const

export type BuiltinComponentName = keyof typeof BUILTIN_COMPONENTS

// ─────────────────────────────────────────────────────────────────────────────
// Initialize all built-in components (registers them in the registry)
// ─────────────────────────────────────────────────────────────────────────────

export function initializeComponents(): void {
  // Just importing the components registers them via decorators
  // This function exists to ensure they're all loaded
  console.log('[Scripting] Initialized components:', Object.keys(BUILTIN_COMPONENTS).join(', '))
}
