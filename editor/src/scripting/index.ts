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
export { TransformComponent } from './components/TransformComponent'
export { VisualComponent } from './components/VisualComponent'
export { HealthComponent } from './components/HealthComponent'
export { LightComponent } from './components/LightComponent'
export type { LightType } from './components/LightComponent'
export { FloorGeneratorComponent } from './components/FloorGeneratorComponent'
export type { TilePattern } from './components/FloorGeneratorComponent'
export { InteractableComponent } from './components/InteractableComponent'
export type { InteractionType } from './components/InteractableComponent'
export { AIComponent } from './components/AIComponent'
export type { AIState, AIBehavior } from './components/AIComponent'
export { PlayerControllerComponent } from './components/PlayerControllerComponent'
export type { MovementMode } from './components/PlayerControllerComponent'

// ─────────────────────────────────────────────────────────────────────────────
// Component type map for serialization
// ─────────────────────────────────────────────────────────────────────────────

import { TransformComponent } from './components/TransformComponent'
import { VisualComponent } from './components/VisualComponent'
import { HealthComponent } from './components/HealthComponent'
import { LightComponent } from './components/LightComponent'
import { FloorGeneratorComponent } from './components/FloorGeneratorComponent'
import { InteractableComponent } from './components/InteractableComponent'
import { AIComponent } from './components/AIComponent'
import { PlayerControllerComponent } from './components/PlayerControllerComponent'

export const BUILTIN_COMPONENTS = {
  Transform: TransformComponent,
  Visual: VisualComponent,
  Health: HealthComponent,
  Light: LightComponent,
  FloorGenerator: FloorGeneratorComponent,
  Interactable: InteractableComponent,
  AI: AIComponent,
  PlayerController: PlayerControllerComponent,
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
