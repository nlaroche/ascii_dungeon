/**
 * Event type constants and payload schemas.
 * Frozen to catch typos. Payload schemas used in devMode validation.
 *
 * @example
 * import { EVENTS } from './events.js';
 * world.events.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5, pos: { x: 3, y: 4 } });
 */

export const EVENTS = Object.freeze({
  // Actions
  ACTION_MOVE:   'action:move',
  ACTION_ATTACK: 'action:attack',

  // Combat
  COMBAT_HIT:  'combat:hit',
  COMBAT_KILL: 'combat:kill',

  // Economy
  LOOT_COLLECTED: 'loot:collected',
  XP_LEVELUP:     'xp:levelup',

  // Vision
  FOV_UPDATED:       'fov:updated',
  DUNGEON_GENERATED: 'dungeon:generated',
});

/**
 * Payload schemas for devMode validation.
 * Maps event type → field rules.
 */
export const EVENT_SCHEMAS = Object.freeze({
  [EVENTS.ACTION_MOVE]: {
    entity: { type: 'number', required: true },
    dx:     { type: 'number', required: true },
    dy:     { type: 'number', required: true },
  },
  [EVENTS.ACTION_ATTACK]: {
    attacker: { type: 'number', required: true },
    defender: { type: 'number', required: true },
  },
  [EVENTS.COMBAT_HIT]: {
    attacker: { type: 'number', required: true },
    defender: { type: 'number', required: true },
    damage:   { type: 'number', required: true },
  },
  [EVENTS.COMBAT_KILL]: {
    attacker: { type: 'number', required: true },
    defender: { type: 'number', required: true },
  },
  [EVENTS.LOOT_COLLECTED]: {
    entity: { type: 'number', required: true },
    gold:   { type: 'number', required: true },
    xp:     { type: 'number', required: true },
  },
  [EVENTS.XP_LEVELUP]: {
    entity:   { type: 'number', required: true },
    newLevel: { type: 'number', required: true },
  },
  [EVENTS.FOV_UPDATED]: {
    visibleSet: { type: 'object', required: true },
  },
  [EVENTS.DUNGEON_GENERATED]: {
    width:  { type: 'number', required: true },
    height: { type: 'number', required: true },
  },
});
