// ═══════════════════════════════════════════════════════════════════════════
// Environment API - Scripting interface for sky, fog, and atmosphere
// ═══════════════════════════════════════════════════════════════════════════

import { useEngineState } from '../../stores/useEngineState';
import type { SkyboxType, FogType, SkyboxSettings, FogSettings } from '../../stores/engineState';

// ─────────────────────────────────────────────────────────────────────────────
// Skybox Control
// ─────────────────────────────────────────────────────────────────────────────

export const sky = {
  /**
   * Get current skybox settings
   */
  get(): SkyboxSettings {
    const store = useEngineState.getState();
    return store.environment.skybox;
  },

  /**
   * Set skybox type
   */
  setType(type: SkyboxType): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'type'], type, `Set sky type: ${type}`);
  },

  /**
   * Set gradient sky colors
   */
  setGradient(
    zenith: [number, number, number],
    horizon: [number, number, number],
    ground: [number, number, number]
  ): void {
    const store = useEngineState.getState();
    store.batchUpdate([
      { path: ['environment', 'skybox', 'gradient', 'zenith'], value: zenith },
      { path: ['environment', 'skybox', 'gradient', 'horizon'], value: horizon },
      { path: ['environment', 'skybox', 'gradient', 'ground'], value: ground },
    ], 'Set sky gradient');
  },

  /**
   * Set zenith color (top of sky)
   */
  setZenithColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'gradient', 'zenith'], [r, g, b], 'Set zenith color');
  },

  /**
   * Set horizon color
   */
  setHorizonColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'gradient', 'horizon'], [r, g, b], 'Set horizon color');
  },

  /**
   * Set ground color (below horizon)
   */
  setGroundColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'gradient', 'ground'], [r, g, b], 'Set ground color');
  },

  /**
   * Set skybox texture (for cubemap/hdri modes)
   */
  setTexture(path: string | null): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'texture'], path, path ? `Set sky texture: ${path}` : 'Clear sky texture');
  },

  /**
   * Set skybox rotation (radians)
   */
  setRotation(radians: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'rotation'], radians, 'Set sky rotation');
  },

  /**
   * Set skybox exposure
   */
  setExposure(exposure: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'exposure'], Math.max(0, exposure), 'Set sky exposure');
  },

  /**
   * Set sun disk size (procedural sky)
   */
  setSunSize(size: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'sunSize'], Math.max(0, size), 'Set sun size');
  },

  /**
   * Set atmosphere density (procedural sky)
   */
  setAtmosphereDensity(density: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'skybox', 'atmosphereDensity'], Math.max(0, density), 'Set atmosphere density');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fog Control
// ─────────────────────────────────────────────────────────────────────────────

export const fog = {
  /**
   * Get current fog settings
   */
  get(): FogSettings {
    const store = useEngineState.getState();
    return store.environment.fog;
  },

  /**
   * Enable or disable fog
   */
  setEnabled(enabled: boolean): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} fog`);
  },

  /**
   * Set fog type
   */
  setType(type: FogType): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'type'], type, `Set fog type: ${type}`);
  },

  /**
   * Set fog color
   */
  setColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'color'], [r, g, b], 'Set fog color');
  },

  /**
   * Set fog density (for exponential fog)
   */
  setDensity(density: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'density'], Math.max(0, density), 'Set fog density');
  },

  /**
   * Set fog start/end distance (for linear fog)
   */
  setRange(start: number, end: number): void {
    const store = useEngineState.getState();
    store.batchUpdate([
      { path: ['environment', 'fog', 'start'], value: Math.max(0, start) },
      { path: ['environment', 'fog', 'end'], value: Math.max(start, end) },
    ], 'Set fog range');
  },

  /**
   * Set fog start distance
   */
  setStart(start: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'start'], Math.max(0, start), 'Set fog start');
  },

  /**
   * Set fog end distance
   */
  setEnd(end: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'end'], Math.max(0, end), 'Set fog end');
  },

  /**
   * Set height falloff (for height fog)
   */
  setHeightFalloff(falloff: number): void {
    const store = useEngineState.getState();
    store.setPath(['environment', 'fog', 'heightFalloff'], Math.max(0, falloff), 'Set fog height falloff');
  },

  /**
   * Quick enable with settings
   */
  enable(options?: {
    type?: FogType;
    color?: [number, number, number];
    density?: number;
    start?: number;
    end?: number;
  }): void {
    const store = useEngineState.getState();
    const updates: Array<{ path: (string | number)[]; value: unknown }> = [
      { path: ['environment', 'fog', 'enabled'], value: true },
    ];

    if (options?.type) updates.push({ path: ['environment', 'fog', 'type'], value: options.type });
    if (options?.color) updates.push({ path: ['environment', 'fog', 'color'], value: options.color });
    if (options?.density !== undefined) updates.push({ path: ['environment', 'fog', 'density'], value: options.density });
    if (options?.start !== undefined) updates.push({ path: ['environment', 'fog', 'start'], value: options.start });
    if (options?.end !== undefined) updates.push({ path: ['environment', 'fog', 'end'], value: options.end });

    store.batchUpdate(updates, 'Enable fog');
  },

  /**
   * Disable fog
   */
  disable(): void {
    fog.setEnabled(false);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Time of Day Control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current time of day (0-1)
 */
export function getTimeOfDay(): number {
  const store = useEngineState.getState();
  return store.environment.timeOfDay;
}

/**
 * Set time of day (0-1, where 0.5 is noon)
 * This affects sun position and sky colors when using procedural sky
 */
export function setTimeOfDay(time: number): void {
  const store = useEngineState.getState();
  store.setPath(['environment', 'timeOfDay'], Math.max(0, Math.min(1, time)), 'Set time of day');
}

/**
 * Set time of day from hours (0-24)
 */
export function setTimeOfDayHours(hours: number): void {
  setTimeOfDay(hours / 24);
}

/**
 * Get time of day as hours (0-24)
 */
export function getTimeOfDayHours(): number {
  return getTimeOfDay() * 24;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export const presets = {
  /**
   * Clear blue sky
   */
  clearSky(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.15, 0.25, 0.5],   // zenith - deep blue
      [0.5, 0.7, 0.9],     // horizon - light blue
      [0.3, 0.25, 0.2]     // ground - brown
    );
    setTimeOfDay(0.5);
  },

  /**
   * Sunset sky
   */
  sunset(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.1, 0.1, 0.2],     // zenith - dark blue
      [0.9, 0.4, 0.2],     // horizon - orange
      [0.2, 0.15, 0.1]     // ground - dark brown
    );
    setTimeOfDay(0.75);
  },

  /**
   * Night sky
   */
  night(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.02, 0.02, 0.05],  // zenith - nearly black
      [0.05, 0.05, 0.1],   // horizon - dark blue
      [0.02, 0.02, 0.03]   // ground - dark
    );
    setTimeOfDay(0);
  },

  /**
   * Overcast sky
   */
  overcast(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.4, 0.45, 0.5],    // zenith - gray
      [0.5, 0.55, 0.6],    // horizon - light gray
      [0.3, 0.3, 0.3]      // ground - gray
    );
    setTimeOfDay(0.5);
  },

  /**
   * Foggy atmosphere
   */
  foggy(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.5, 0.55, 0.6],
      [0.6, 0.65, 0.7],
      [0.5, 0.5, 0.5]
    );
    fog.enable({
      type: 'exponential',
      color: [0.6, 0.65, 0.7],
      density: 0.05,
    });
  },

  /**
   * Dungeon/cave atmosphere
   */
  dungeon(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.05, 0.03, 0.02],
      [0.1, 0.08, 0.05],
      [0.05, 0.04, 0.03]
    );
    fog.enable({
      type: 'exponential',
      color: [0.1, 0.08, 0.05],
      density: 0.03,
    });
  },

  /**
   * Sci-fi / neon atmosphere
   */
  neon(): void {
    sky.setType('gradient');
    sky.setGradient(
      [0.02, 0.02, 0.08],  // zenith - dark purple
      [0.1, 0.05, 0.15],   // horizon - purple
      [0.05, 0.02, 0.05]   // ground
    );
    fog.enable({
      type: 'exponential',
      color: [0.1, 0.05, 0.15],
      density: 0.02,
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Export consolidated API
// ─────────────────────────────────────────────────────────────────────────────

export const Environment = {
  sky,
  fog,
  presets,
  getTimeOfDay,
  setTimeOfDay,
  setTimeOfDayHours,
  getTimeOfDayHours,
};

export default Environment;
