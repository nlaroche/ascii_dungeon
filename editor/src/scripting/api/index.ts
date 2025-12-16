// ═══════════════════════════════════════════════════════════════════════════
// Scripting API - Combined exports for engine scripting
// ═══════════════════════════════════════════════════════════════════════════

// Individual APIs
export { Animate, animateTo, animateFrom, animateFromTo, animateVectorTo, createTimeline, Easing } from './animate';
export { Render } from './render';
export { Lighting, sun, ambient, gi } from './lighting';
export { Environment, sky, fog } from './environment';

// Re-export types
export type { AnimateOptions, AnimateResult, TimelineItem } from './animate';

// Combined API object for convenient access
import { Animate } from './animate';
import { Render } from './render';
import { Lighting } from './lighting';
import { Environment } from './environment';

export const API = {
  Animate,
  Render,
  Lighting,
  Environment,
};

export default API;
