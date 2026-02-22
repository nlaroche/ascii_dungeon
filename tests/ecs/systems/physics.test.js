import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { PhysicsSystem } from '../../../src/ecs/systems/PhysicsSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('PhysicsSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.addSystem('physics', PhysicsSystem);
  });

  it('should apply velocity to position', () => {
    const p = buildEntity(world, 'particle', { x: 0, y: 0, vx: 10, vy: 0, gravity: 0 });
    world.update(0.5);
    const pos = world.getComponent(p, COMPONENTS.POSITION);
    expect(pos.x).toBeCloseTo(5);
    expect(pos.y).toBeCloseTo(0);
  });

  it('should apply gravity to vy', () => {
    const p = buildEntity(world, 'particle', { x: 0, y: 0, vx: 0, vy: 0, gravity: 10 });
    world.update(1.0);
    const vel = world.getComponent(p, COMPONENTS.VELOCITY);
    expect(vel.vy).toBeCloseTo(10);
    const pos = world.getComponent(p, COMPONENTS.POSITION);
    expect(pos.y).toBeCloseTo(10); // gravity applied then position updated
  });

  it('should handle negative velocity', () => {
    const p = buildEntity(world, 'particle', { x: 5, y: 5, vx: -2, vy: -3, gravity: 0 });
    world.update(1.0);
    const pos = world.getComponent(p, COMPONENTS.POSITION);
    expect(pos.x).toBeCloseTo(3);
    expect(pos.y).toBeCloseTo(2);
  });

  it('should not affect entities without velocity', () => {
    const e = world.spawn();
    world.addComponent(e, COMPONENTS.POSITION, { x: 5, y: 5 });
    // No velocity component
    world.update(1.0);
    const pos = world.getComponent(e, COMPONENTS.POSITION);
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(5);
  });
});
