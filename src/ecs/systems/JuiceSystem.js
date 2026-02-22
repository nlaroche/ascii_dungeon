/**
 * JuiceSystem — ALL visual effects in one place.
 * Listens for combat:hit, combat:kill, xp:levelup events and spawns
 * particles, float text, flashes, screen shake. Eliminates 3x duplication.
 *
 * @example
 * world.addSystem('juice', JuiceSystem);
 */

import { COMPONENTS } from '../components.js';
import { EVENTS } from '../events.js';
import { COLORS } from '../../lib/palette.js';

const PARTICLE_CHARS = ['*', '+', '~', "'", ',', '!', '`', '.', '^'];

/**
 * @param {object} world
 * @param {number} dt
 */
export function JuiceSystem(world, dt) {
  const rng = world.getResource('rng') || Math.random;

  // Combat hit → particles + flash + screen shake
  for (const evt of world.events.drain(EVENTS.COMBAT_HIT)) {
    const { defender, damage, pos } = evt;
    if (!pos) continue;

    // Spawn hit particles
    const count = Math.min(3 + damage, 12);
    for (let i = 0; i < count; i++) {
      const angle = (typeof rng === 'function' ? rng() : Math.random()) * Math.PI * 2;
      const speed = 2 + (typeof rng === 'function' ? rng() : Math.random()) * 4;
      const p = world.spawn();
      world.addComponent(p, COMPONENTS.POSITION, { x: pos.x, y: pos.y });
      world.addComponent(p, COMPONENTS.RENDERABLE, {
        char: PARTICLE_CHARS[Math.floor((typeof rng === 'function' ? rng() : Math.random()) * PARTICLE_CHARS.length)],
        fg: COLORS.damage,
        bg: COLORS.black,
        depth: 0.9,
      });
      world.addComponent(p, COMPONENTS.VELOCITY, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 5,
      });
      world.addComponent(p, COMPONENTS.LIFETIME, {
        remaining: 0.3 + (typeof rng === 'function' ? rng() : Math.random()) * 0.3,
        max: 0.6,
      });
    }

    // Flash on defender
    if (world.isAlive(defender)) {
      if (!world.hasComponent(defender, COMPONENTS.FLASH)) {
        world.addComponent(defender, COMPONENTS.FLASH, { color: COLORS.flash, framesLeft: 3 });
      } else {
        const flash = world.getComponent(defender, COMPONENTS.FLASH);
        flash.color = COLORS.flash;
        flash.framesLeft = 3;
      }
    }

    // Screen shake
    const camera = world.getResource('camera');
    if (camera) {
      camera.shakeIntensity = Math.max(camera.shakeIntensity || 0, damage * 0.1);
    }
  }

  // Combat kill → bigger explosion
  for (const evt of world.events.drain(EVENTS.COMBAT_KILL)) {
    // Kill particles are handled by the hit event above + entity destruction
  }

  // Level up → celebratory particles
  for (const evt of world.events.drain(EVENTS.XP_LEVELUP)) {
    const { entity, newLevel } = evt;
    if (!world.isAlive(entity)) continue;

    const pos = world.getComponent(entity, COMPONENTS.POSITION);
    if (!pos) continue;

    // Golden level-up particles
    for (let i = 0; i < 15; i++) {
      const angle = (typeof rng === 'function' ? rng() : Math.random()) * Math.PI * 2;
      const speed = 3 + (typeof rng === 'function' ? rng() : Math.random()) * 3;
      const p = world.spawn();
      world.addComponent(p, COMPONENTS.POSITION, { x: pos.x, y: pos.y });
      world.addComponent(p, COMPONENTS.RENDERABLE, {
        char: '*',
        fg: COLORS.xpGold,
        bg: COLORS.black,
        depth: 0.9,
      });
      world.addComponent(p, COMPONENTS.VELOCITY, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        gravity: 4,
      });
      world.addComponent(p, COMPONENTS.LIFETIME, {
        remaining: 0.5 + (typeof rng === 'function' ? rng() : Math.random()) * 0.5,
        max: 1.0,
      });
    }
  }

  // Update flashes (decrement frame counter)
  const flashEntities = world.query([COMPONENTS.FLASH]);
  for (const id of flashEntities) {
    const flash = world.getComponent(id, COMPONENTS.FLASH);
    flash.framesLeft--;
    if (flash.framesLeft <= 0) {
      world.removeComponent(id, COMPONENTS.FLASH);
    }
  }
}
