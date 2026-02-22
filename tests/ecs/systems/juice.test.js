import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity, seededRng } from '../../helpers/ecs-helpers.js';
import { JuiceSystem } from '../../../src/ecs/systems/JuiceSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('JuiceSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.setResource('rng', seededRng(42));
    world.addSystem('juice', JuiceSystem);
  });

  it('should spawn particles on combat:hit', () => {
    const enemy = buildEntity(world, 'enemy', { x: 5, y: 5 });
    world.events.emit(EVENTS.COMBAT_HIT, {
      attacker: 999, // don't need to exist
      defender: enemy,
      damage: 5,
      pos: { x: 5, y: 5 },
    });

    const beforeCount = world.entityCount();
    world.update(0.016);

    // Should have spawned particles (at least damage-based count)
    const particles = world.query([COMPONENTS.VELOCITY, COMPONENTS.LIFETIME]);
    expect(particles.size).toBeGreaterThan(0);
  });

  it('should add flash component to defender on hit', () => {
    const enemy = buildEntity(world, 'enemy', { x: 5, y: 5 });
    world.events.emit(EVENTS.COMBAT_HIT, {
      attacker: 999,
      defender: enemy,
      damage: 5,
      pos: { x: 5, y: 5 },
    });

    world.update(0.016);
    expect(world.hasComponent(enemy, COMPONENTS.FLASH)).toBe(true);
  });

  it('should spawn golden particles on level up', () => {
    const player = buildEntity(world, 'player', { x: 5, y: 5 });
    world.events.emit(EVENTS.XP_LEVELUP, {
      entity: player,
      newLevel: 2,
    });

    world.update(0.016);

    const particles = world.query([COMPONENTS.VELOCITY, COMPONENTS.LIFETIME]);
    expect(particles.size).toBe(15);
  });

  it('should decrement flash framesLeft and remove when done', () => {
    const e = world.spawn();
    world.addComponent(e, COMPONENTS.FLASH, { color: '#fff', framesLeft: 2 });
    // Need to not emit any events for this test
    world.update(0.016);
    expect(world.getComponent(e, COMPONENTS.FLASH).framesLeft).toBe(1);
    world.update(0.016);
    expect(world.hasComponent(e, COMPONENTS.FLASH)).toBe(false);
  });

  it('should set screen shake on camera resource', () => {
    world.setResource('camera', { shakeIntensity: 0 });
    buildEntity(world, 'enemy', { x: 5, y: 5 });

    world.events.emit(EVENTS.COMBAT_HIT, {
      attacker: 999,
      defender: 999, // doesn't matter for shake
      damage: 10,
      pos: { x: 5, y: 5 },
    });

    world.update(0.016);
    const camera = world.getResource('camera');
    expect(camera.shakeIntensity).toBeGreaterThan(0);
  });
});
