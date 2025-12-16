// ═══════════════════════════════════════════════════════════════════════════
// Lighting API - Scripting interface for multi-light system control
// ═══════════════════════════════════════════════════════════════════════════

import { useEngineState } from '../../stores/useEngineState';
import type { SceneLight, LightType, DirectionalLight, AmbientLight } from '../../stores/engineState';

// ─────────────────────────────────────────────────────────────────────────────
// Sun (Directional Light) Control
// ─────────────────────────────────────────────────────────────────────────────

export const sun = {
  /**
   * Enable or disable the sun
   */
  setEnabled(enabled: boolean): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'sun', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} sun`);
  },

  /**
   * Get sun state
   */
  get(): DirectionalLight {
    const store = useEngineState.getState();
    return store.lighting.sun;
  },

  /**
   * Set sun direction (will be normalized)
   */
  setDirection(x: number, y: number, z: number): void {
    const store = useEngineState.getState();
    // Normalize
    const len = Math.sqrt(x * x + y * y + z * z);
    const dir: [number, number, number] = len > 0 ? [x / len, y / len, z / len] : [0, -1, 0];
    store.setPath(['lighting', 'sun', 'direction'], dir, 'Set sun direction');
  },

  /**
   * Set sun color (RGB 0-1)
   */
  setColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'sun', 'color'], [r, g, b], 'Set sun color');
  },

  /**
   * Set sun intensity
   */
  setIntensity(intensity: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'sun', 'intensity'], Math.max(0, intensity), 'Set sun intensity');
  },

  /**
   * Enable or disable sun shadows
   */
  setShadowEnabled(enabled: boolean): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'sun', 'castShadows'], enabled, `${enabled ? 'Enable' : 'Disable'} sun shadows`);
  },

  /**
   * Set sun position from angle (azimuth, elevation in radians)
   */
  setFromAngles(azimuth: number, elevation: number): void {
    const x = Math.cos(elevation) * Math.sin(azimuth);
    const y = -Math.sin(elevation);
    const z = Math.cos(elevation) * Math.cos(azimuth);
    sun.setDirection(x, y, z);
  },

  /**
   * Set sun position from time of day (0-1, where 0.5 is noon)
   */
  setFromTimeOfDay(time: number): void {
    const angle = (time - 0.25) * Math.PI * 2; // 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    const elevation = Math.sin(angle) * (Math.PI / 3); // Max elevation 60 degrees
    const azimuth = time * Math.PI * 2;
    sun.setFromAngles(azimuth, elevation);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Ambient Light Control
// ─────────────────────────────────────────────────────────────────────────────

export const ambient = {
  /**
   * Get ambient light state
   */
  get(): AmbientLight {
    const store = useEngineState.getState();
    return store.lighting.ambient;
  },

  /**
   * Set ambient color (RGB 0-1)
   */
  setColor(r: number, g: number, b: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'ambient', 'color'], [r, g, b], 'Set ambient color');
  },

  /**
   * Set ambient intensity
   */
  setIntensity(intensity: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'ambient', 'intensity'], Math.max(0, intensity), 'Set ambient intensity');
  },

  /**
   * Set sky contribution to ambient
   */
  setSkyContribution(contribution: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'ambient', 'skyContribution'], Math.max(0, Math.min(1, contribution)), 'Set sky contribution');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Point/Spot Light Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all scene lights
 */
export function getLights(): SceneLight[] {
  const store = useEngineState.getState();
  return store.lighting.lights;
}

/**
 * Get a light by ID
 */
export function getLight(id: string): SceneLight | undefined {
  return getLights().find((l) => l.id === id);
}

/**
 * Add a new point light
 */
export function addPointLight(
  id: string,
  options: {
    position?: [number, number, number];
    color?: [number, number, number];
    intensity?: number;
    range?: number;
    shadows?: boolean;
  } = {}
): SceneLight {
  const store = useEngineState.getState();
  const light: SceneLight = {
    id,
    type: 'point',
    enabled: true,
    position: options.position ?? [0, 0, 0],
    color: options.color ?? [1, 1, 1],
    intensity: options.intensity ?? 1,
    range: options.range ?? 10,
    castShadows: options.shadows ?? false,
  };

  store.setPath(
    ['lighting', 'lights'],
    [...store.lighting.lights, light],
    `Add point light: ${id}`
  );

  return light;
}

/**
 * Add a new spot light
 */
export function addSpotLight(
  id: string,
  options: {
    position?: [number, number, number];
    color?: [number, number, number];
    intensity?: number;
    range?: number;
    spotAngle?: number;
    spotPenumbra?: number;
    shadows?: boolean;
  } = {}
): SceneLight {
  const store = useEngineState.getState();
  const light: SceneLight = {
    id,
    type: 'spot',
    enabled: true,
    position: options.position ?? [0, 0, 0],
    color: options.color ?? [1, 1, 1],
    intensity: options.intensity ?? 1,
    range: options.range ?? 10,
    castShadows: options.shadows ?? false,
    spotAngle: options.spotAngle ?? Math.PI / 4,
    spotPenumbra: options.spotPenumbra ?? 0.1,
  };

  store.setPath(
    ['lighting', 'lights'],
    [...store.lighting.lights, light],
    `Add spot light: ${id}`
  );

  return light;
}

/**
 * Remove a light by ID
 */
export function removeLight(id: string): void {
  const store = useEngineState.getState();
  store.setPath(
    ['lighting', 'lights'],
    store.lighting.lights.filter((l) => l.id !== id),
    `Remove light: ${id}`
  );
}

/**
 * Update a light's properties
 */
export function updateLight(id: string, updates: Partial<SceneLight>): void {
  const store = useEngineState.getState();
  const lights = store.lighting.lights;
  const idx = lights.findIndex((l) => l.id === id);

  if (idx !== -1) {
    const updated = { ...lights[idx], ...updates };
    const newLights = [...lights];
    newLights[idx] = updated;
    store.setPath(['lighting', 'lights'], newLights, `Update light: ${id}`);
  }
}

/**
 * Enable or disable a light
 */
export function setLightEnabled(id: string, enabled: boolean): void {
  updateLight(id, { enabled });
}

/**
 * Set a light's position
 */
export function setLightPosition(id: string, x: number, y: number, z: number): void {
  updateLight(id, { position: [x, y, z] });
}

/**
 * Set a light's color
 */
export function setLightColor(id: string, r: number, g: number, b: number): void {
  updateLight(id, { color: [r, g, b] });
}

/**
 * Set a light's intensity
 */
export function setLightIntensity(id: string, intensity: number): void {
  updateLight(id, { intensity: Math.max(0, intensity) });
}

/**
 * Set a light's range
 */
export function setLightRange(id: string, range: number): void {
  updateLight(id, { range: Math.max(0, range) });
}

/**
 * Remove all scene lights
 */
export function removeAllLights(): void {
  const store = useEngineState.getState();
  store.setPath(['lighting', 'lights'], [], 'Remove all lights');
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Illumination Control
// ─────────────────────────────────────────────────────────────────────────────

export const gi = {
  /**
   * Enable or disable global illumination
   */
  setEnabled(enabled: boolean): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'gi', 'enabled'], enabled, `${enabled ? 'Enable' : 'Disable'} GI`);
  },

  /**
   * Set GI bounces
   */
  setBounces(bounces: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'gi', 'bounces'], Math.max(0, Math.min(4, Math.floor(bounces))), 'Set GI bounces');
  },

  /**
   * Set GI intensity
   */
  setIntensity(intensity: number): void {
    const store = useEngineState.getState();
    store.setPath(['lighting', 'gi', 'intensity'], Math.max(0, intensity), 'Set GI intensity');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

export const presets = {
  /**
   * Bright daylight preset
   */
  daylight(): void {
    sun.setEnabled(true);
    sun.setColor(1.0, 0.98, 0.95);
    sun.setIntensity(1.2);
    sun.setFromTimeOfDay(0.5); // Noon
    ambient.setColor(0.4, 0.45, 0.5);
    ambient.setIntensity(0.4);
  },

  /**
   * Sunset preset
   */
  sunset(): void {
    sun.setEnabled(true);
    sun.setColor(1.0, 0.5, 0.2);
    sun.setIntensity(0.8);
    sun.setFromTimeOfDay(0.75);
    ambient.setColor(0.3, 0.25, 0.35);
    ambient.setIntensity(0.3);
  },

  /**
   * Night preset
   */
  night(): void {
    sun.setEnabled(false);
    ambient.setColor(0.1, 0.12, 0.2);
    ambient.setIntensity(0.15);
  },

  /**
   * Dungeon/interior preset
   */
  dungeon(): void {
    sun.setEnabled(false);
    ambient.setColor(0.15, 0.1, 0.08);
    ambient.setIntensity(0.2);
  },

  /**
   * Overcast preset
   */
  overcast(): void {
    sun.setEnabled(true);
    sun.setColor(0.8, 0.85, 0.9);
    sun.setIntensity(0.5);
    sun.setFromTimeOfDay(0.5);
    sun.setShadowEnabled(false);
    ambient.setColor(0.5, 0.55, 0.6);
    ambient.setIntensity(0.5);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Export consolidated API
// ─────────────────────────────────────────────────────────────────────────────

export const Lighting = {
  sun,
  ambient,
  gi,
  presets,
  getLights,
  getLight,
  addPointLight,
  addSpotLight,
  removeLight,
  removeAllLights,
  updateLight,
  setLightEnabled,
  setLightPosition,
  setLightColor,
  setLightIntensity,
  setLightRange,
};

export default Lighting;
