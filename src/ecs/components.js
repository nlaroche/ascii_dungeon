/**
 * Component name constants — frozen to catch typos at reference time.
 *
 * @example
 * import { COMPONENTS } from './components.js';
 * world.addComponent(entity, COMPONENTS.POSITION, { x: 0, y: 0 });
 */

export const COMPONENTS = Object.freeze({
  POSITION:       'position',
  SMOOTH_POSITION:'smoothPosition',
  RENDERABLE:     'renderable',
  HEALTH:         'health',
  COMBAT_STATS:   'combatStats',
  AI:             'ai',
  PLAYER_TAG:     'playerTag',
  LIGHT_SOURCE:   'lightSource',
  EXPERIENCE:     'experience',
  INVENTORY:      'inventory',
  STAMINA:        'stamina',
  LOOT:           'loot',
  NAME:           'name',
  CAMERA_TARGET:  'cameraTarget',
  COLLECTABLE:    'collectable',
  VELOCITY:       'velocity',
  LIFETIME:       'lifetime',
  VISUAL_SCALE:   'visualScale',
  FLASH:          'flash',
});
