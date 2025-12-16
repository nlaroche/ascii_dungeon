// ═══════════════════════════════════════════════════════════════════════════
// Render API - Scripting interface for render pipeline control
// ═══════════════════════════════════════════════════════════════════════════

import { useEngineState } from '../../stores/useEngineState';
import type { PostEffect, DebugViewMode, RenderPasses } from '../../stores/engineState';

// ─────────────────────────────────────────────────────────────────────────────
// Render Pass Control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enable or disable a render pass
 */
export function setPassEnabled(passId: keyof RenderPasses, enabled: boolean): void {
  const store = useEngineState.getState();
  store.setPath(['renderPipeline', 'passes', passId, 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} ${passId} pass`);
}

/**
 * Get current state of a render pass
 */
export function getPass<K extends keyof RenderPasses>(passId: K): RenderPasses[K] | undefined {
  const store = useEngineState.getState();
  return store.getPath(['renderPipeline', 'passes', passId]);
}

/**
 * Update render pass settings
 */
export function updatePass<K extends keyof RenderPasses>(
  passId: K,
  settings: Partial<RenderPasses[K]>
): void {
  const store = useEngineState.getState();
  const current = store.getPath<RenderPasses[K]>(['renderPipeline', 'passes', passId]);
  if (current) {
    store.setPath(
      ['renderPipeline', 'passes', passId],
      { ...current, ...settings },
      `Update ${passId} pass`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Effect Control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all post effects in order
 */
export function getPostEffects(): PostEffect[] {
  const store = useEngineState.getState();
  return store.renderPipeline.postEffects;
}

/**
 * Get a specific post effect by ID
 */
export function getPostEffect(id: string): PostEffect | undefined {
  return getPostEffects().find((e) => e.id === id);
}

/**
 * Enable or disable a post effect
 */
export function setPostEffectEnabled(id: string, enabled: boolean): void {
  const store = useEngineState.getState();
  const effects = store.renderPipeline.postEffects;
  const idx = effects.findIndex((e) => e.id === id);

  if (idx !== -1) {
    store.setPath(
      ['renderPipeline', 'postEffects', idx, 'enabled'],
      enabled,
      `${enabled ? 'Enable' : 'Disable'} ${effects[idx].name}`
    );
  }
}

/**
 * Update post effect settings
 */
export function setPostEffect(id: string, settings: Partial<PostEffect>): void {
  const store = useEngineState.getState();
  const effects = store.renderPipeline.postEffects;
  const idx = effects.findIndex((e) => e.id === id);

  if (idx !== -1) {
    const updated = { ...effects[idx], ...settings };
    const newEffects = [...effects];
    newEffects[idx] = updated;
    store.setPath(['renderPipeline', 'postEffects'], newEffects, `Update ${effects[idx].name}`);
  }
}

/**
 * Reorder a post effect to a new position
 */
export function reorderPostEffect(id: string, newIndex: number): void {
  const store = useEngineState.getState();
  const effects = [...store.renderPipeline.postEffects];
  const idx = effects.findIndex((e) => e.id === id);

  if (idx !== -1 && idx !== newIndex && newIndex >= 0 && newIndex < effects.length) {
    const [removed] = effects.splice(idx, 1);
    effects.splice(newIndex, 0, removed);
    store.setPath(['renderPipeline', 'postEffects'], effects, `Reorder ${removed.name}`);
  }
}

/**
 * Move a post effect up in the stack
 */
export function movePostEffectUp(id: string): void {
  const effects = getPostEffects();
  const idx = effects.findIndex((e) => e.id === id);
  if (idx > 0) {
    reorderPostEffect(id, idx - 1);
  }
}

/**
 * Move a post effect down in the stack
 */
export function movePostEffectDown(id: string): void {
  const effects = getPostEffects();
  const idx = effects.findIndex((e) => e.id === id);
  if (idx < effects.length - 1) {
    reorderPostEffect(id, idx + 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug View Control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the debug view mode
 */
export function setDebugView(view: DebugViewMode): void {
  const store = useEngineState.getState();
  store.setPath(['renderPipeline', 'debugView'], view, `Set debug view: ${view}`);
}

/**
 * Get current debug view mode
 */
export function getDebugView(): DebugViewMode {
  const store = useEngineState.getState();
  return store.renderPipeline.debugView;
}

/**
 * Cycle through debug views
 */
export function cycleDebugView(): DebugViewMode {
  const views: DebugViewMode[] = ['final', 'depth', 'normals', 'shadow', 'albedo'];
  const current = getDebugView();
  const idx = views.indexOf(current);
  const next = views[(idx + 1) % views.length];
  setDebugView(next);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle render stats display
 */
export function toggleStats(): void {
  const store = useEngineState.getState();
  const current = store.renderPipeline.showStats;
  store.setPath(['renderPipeline', 'showStats'], !current, `${current ? 'Hide' : 'Show'} stats`);
}

/**
 * Set stats visibility
 */
export function setStatsVisible(visible: boolean): void {
  const store = useEngineState.getState();
  store.setPath(['renderPipeline', 'showStats'], visible, `${visible ? 'Show' : 'Hide'} stats`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enable multiple post effects at once
 */
export function enablePostEffects(...ids: string[]): void {
  for (const id of ids) {
    setPostEffectEnabled(id, true);
  }
}

/**
 * Disable multiple post effects at once
 */
export function disablePostEffects(...ids: string[]): void {
  for (const id of ids) {
    setPostEffectEnabled(id, false);
  }
}

/**
 * Disable all post effects
 */
export function disableAllPostEffects(): void {
  const effects = getPostEffects();
  for (const effect of effects) {
    setPostEffectEnabled(effect.id, false);
  }
}

/**
 * Reset all post effects to default state
 */
export function resetPostEffects(): void {
  const store = useEngineState.getState();
  // Just disable all for now - could restore defaults in future
  disableAllPostEffects();
}

// ─────────────────────────────────────────────────────────────────────────────
// Export consolidated API
// ─────────────────────────────────────────────────────────────────────────────

export const Render = {
  // Passes
  setPassEnabled,
  getPass,
  updatePass,

  // Post Effects
  getPostEffects,
  getPostEffect,
  setPostEffectEnabled,
  setPostEffect,
  reorderPostEffect,
  movePostEffectUp,
  movePostEffectDown,
  enablePostEffects,
  disablePostEffects,
  disableAllPostEffects,
  resetPostEffects,

  // Debug
  setDebugView,
  getDebugView,
  cycleDebugView,

  // Stats
  toggleStats,
  setStatsVisible,
};

export default Render;
