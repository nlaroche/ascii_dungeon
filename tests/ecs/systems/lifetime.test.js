import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { LifetimeSystem } from '../../../src/ecs/systems/LifetimeSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('LifetimeSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.addSystem('lifetime', LifetimeSystem);
  });

  it('should destroy entities when lifetime expires', () => {
    const p = buildEntity(world, 'particle', { lifetime: 0.5 });
    world.update(0.6);
    expect(world.isAlive(p)).toBe(false);
  });

  it('should keep entities alive before expiry', () => {
    const p = buildEntity(world, 'particle', { lifetime: 1.0 });
    world.update(0.3);
    expect(world.isAlive(p)).toBe(true);
    const life = world.getComponent(p, COMPONENTS.LIFETIME);
    expect(life.remaining).toBeCloseTo(0.7);
  });

  it('should handle multiple entities independently', () => {
    const a = buildEntity(world, 'particle', { lifetime: 0.2 });
    const b = buildEntity(world, 'particle', { lifetime: 0.8 });
    world.update(0.5);
    expect(world.isAlive(a)).toBe(false);
    expect(world.isAlive(b)).toBe(true);
  });

  it('should decrement across multiple frames', () => {
    const p = buildEntity(world, 'particle', { lifetime: 1.0 });
    world.update(0.3);
    world.update(0.3);
    world.update(0.3);
    expect(world.isAlive(p)).toBe(true);
    world.update(0.2);
    expect(world.isAlive(p)).toBe(false);
  });
});
