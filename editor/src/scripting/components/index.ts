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
export type { ColliderType } from './ColliderComponent'

// Behavior
export { InteractableComponent } from './InteractableComponent'
export type { InteractionType } from './InteractableComponent'

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
