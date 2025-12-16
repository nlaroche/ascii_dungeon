// ═══════════════════════════════════════════════════════════════════════════
// Built-in Components - Export all standard engine components
// ═══════════════════════════════════════════════════════════════════════════

export { TransformComponent } from './TransformComponent'
export { VisualComponent } from './VisualComponent'
export { HealthComponent } from './HealthComponent'
export { LightComponent } from './LightComponent'
export { FloorGeneratorComponent } from './FloorGeneratorComponent'
export { InteractableComponent } from './InteractableComponent'
export { AIComponent } from './AIComponent'
export { PlayerControllerComponent } from './PlayerControllerComponent'

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
