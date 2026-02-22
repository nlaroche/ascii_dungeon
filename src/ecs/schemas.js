/**
 * Component schemas for devMode validation.
 * Each schema maps field names to { type, required, min, max, default }.
 * Validation is only active when devMode=true (zero cost in production).
 *
 * @example
 * import { SCHEMAS, validateComponent } from './schemas.js';
 * validateComponent('position', { x: 5, y: 10 }); // ok
 * validateComponent('position', { x: 'foo' });     // throws in devMode
 */

import { COMPONENTS } from './components.js';

export const SCHEMAS = Object.freeze({
  [COMPONENTS.POSITION]: {
    x: { type: 'number', required: true },
    y: { type: 'number', required: true },
  },

  [COMPONENTS.SMOOTH_POSITION]: {
    offsetX:  { type: 'number', default: 0 },
    offsetY:  { type: 'number', default: 0 },
    fromX:    { type: 'number', default: 0 },
    fromY:    { type: 'number', default: 0 },
    toX:      { type: 'number', default: 0 },
    toY:      { type: 'number', default: 0 },
    elapsed:  { type: 'number', default: 0 },
    duration: { type: 'number', default: 0 },
  },

  [COMPONENTS.RENDERABLE]: {
    char:  { type: 'string', required: true },
    fg:    { type: 'string', required: true },
    bg:    { type: 'string', default: '#000000' },
    depth: { type: 'number', default: 0 },
    layer: { type: 'number', default: 0 },
  },

  [COMPONENTS.HEALTH]: {
    hp:    { type: 'number', required: true, min: 0 },
    maxHp: { type: 'number', required: true, min: 1 },
  },

  [COMPONENTS.COMBAT_STATS]: {
    attack:  { type: 'number', required: true, min: 0 },
    defense: { type: 'number', required: true, min: 0 },
  },

  [COMPONENTS.AI]: {
    behavior:     { type: 'string', required: true },
    aggroRadius:  { type: 'number', default: 5 },
    targetEntity: { type: 'number', default: null },
  },

  [COMPONENTS.PLAYER_TAG]: {},

  [COMPONENTS.LIGHT_SOURCE]: {
    color:       { type: 'object', required: true },  // [r, g, b]
    radius:      { type: 'number', required: true, min: 0 },
    intensity:   { type: 'number', default: 1.0 },
    flicker:     { type: 'boolean', default: false },
    wallMounted: { type: 'boolean', default: false },
  },

  [COMPONENTS.EXPERIENCE]: {
    level:    { type: 'number', required: true, min: 1 },
    xp:       { type: 'number', required: true, min: 0 },
    xpToNext: { type: 'number', required: true, min: 1 },
  },

  [COMPONENTS.INVENTORY]: {
    items:     { type: 'object', default: [] },  // array
    gold:      { type: 'number', default: 0 },
    equipment: { type: 'object', default: {} },
  },

  [COMPONENTS.STAMINA]: {
    current: { type: 'number', required: true, min: 0 },
    max:     { type: 'number', required: true, min: 1 },
  },

  [COMPONENTS.LOOT]: {
    gold: { type: 'number', default: 0 },
    xp:   { type: 'number', default: 0 },
  },

  [COMPONENTS.NAME]: {
    display: { type: 'string', required: true },
  },

  [COMPONENTS.CAMERA_TARGET]: {
    damping:   { type: 'number', default: 5.0 },
    deadZoneX: { type: 'number', default: 1.5 },
    deadZoneY: { type: 'number', default: 1.0 },
    zoom:      { type: 'number', default: 1.0 },
  },

  [COMPONENTS.COLLECTABLE]: {
    type: { type: 'string', required: true },
    gold: { type: 'number', default: 0 },
    xp:   { type: 'number', default: 0 },
  },

  [COMPONENTS.VELOCITY]: {
    vx:      { type: 'number', default: 0 },
    vy:      { type: 'number', default: 0 },
    gravity: { type: 'number', default: 0 },
  },

  [COMPONENTS.LIFETIME]: {
    remaining: { type: 'number', required: true, min: 0 },
    max:       { type: 'number', required: true, min: 0 },
  },

  [COMPONENTS.VISUAL_SCALE]: {
    scaleX: { type: 'number', default: 1.0 },
    scaleY: { type: 'number', default: 1.0 },
  },

  [COMPONENTS.FLASH]: {
    color:      { type: 'string', default: '#ffffff' },
    framesLeft: { type: 'number', required: true, min: 0 },
  },
});

/**
 * Validate a component data object against its schema.
 * Only call in devMode — this is a no-op guard, callers should check devMode.
 *
 * @param {string} name Component name (from COMPONENTS)
 * @param {object} data Component data object
 * @throws {Error} If validation fails
 */
export function validateComponent(name, data) {
  const schema = SCHEMAS[name];
  if (!schema) {
    throw new Error(`Unknown component: "${name}"`);
  }

  // Check required fields
  for (const [field, rule] of Object.entries(schema)) {
    const val = data[field];

    if (rule.required && val === undefined) {
      throw new Error(`Component "${name}": missing required field "${field}"`);
    }

    if (val !== undefined && val !== null && rule.type) {
      if (typeof val !== rule.type) {
        throw new Error(`Component "${name}": field "${field}" expected ${rule.type}, got ${typeof val}`);
      }
    }

    if (val !== undefined && rule.min !== undefined && typeof val === 'number' && val < rule.min) {
      throw new Error(`Component "${name}": field "${field}" must be >= ${rule.min}, got ${val}`);
    }

    if (val !== undefined && rule.max !== undefined && typeof val === 'number' && val > rule.max) {
      throw new Error(`Component "${name}": field "${field}" must be <= ${rule.max}, got ${val}`);
    }
  }

  // Warn about unknown fields
  for (const key of Object.keys(data)) {
    if (!(key in schema)) {
      console.warn(`Component "${name}": unknown field "${key}"`);
    }
  }
}

/**
 * Apply defaults from schema to component data, returning a new object.
 * @param {string} name Component name
 * @param {object} data Partial component data
 * @returns {object} Data with defaults filled in
 */
export function applyDefaults(name, data) {
  const schema = SCHEMAS[name];
  if (!schema) return { ...data };

  const result = { ...data };
  for (const [field, rule] of Object.entries(schema)) {
    if (result[field] === undefined && rule.default !== undefined) {
      result[field] = Array.isArray(rule.default) ? [...rule.default]
        : (typeof rule.default === 'object' && rule.default !== null) ? { ...rule.default }
        : rule.default;
    }
  }
  return result;
}
