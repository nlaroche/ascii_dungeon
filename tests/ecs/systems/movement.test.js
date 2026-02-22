import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld } from '../../helpers/ecs-helpers.js';
import { MovementTweenSystem } from '../../../src/ecs/systems/MovementTweenSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('MovementTweenSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.addSystem('movementTween', MovementTweenSystem);
  });

  function createTweenEntity(from, to, duration) {
    const id = world.spawn();
    world.addComponent(id, COMPONENTS.POSITION, { x: to.x, y: to.y });
    world.addComponent(id, COMPONENTS.SMOOTH_POSITION, {
      offsetX: from.x - to.x,
      offsetY: from.y - to.y,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      elapsed: 0,
      duration,
    });
    return id;
  }

  it('should interpolate offset toward zero over duration', () => {
    const id = createTweenEntity({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.15);
    world.update(0.075); // halfway
    const smooth = world.getComponent(id, COMPONENTS.SMOOTH_POSITION);
    // Offset should be partially resolved (not 0, not full)
    expect(Math.abs(smooth.offsetX)).toBeLessThan(1);
    expect(Math.abs(smooth.offsetX)).toBeGreaterThan(0);
  });

  it('should zero offset when tween completes', () => {
    const id = createTweenEntity({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.15);
    world.update(0.2); // past duration
    const smooth = world.getComponent(id, COMPONENTS.SMOOTH_POSITION);
    expect(smooth.offsetX).toBe(0);
    expect(smooth.offsetY).toBe(0);
    expect(smooth.duration).toBe(0);
  });

  it('should skip entities with zero duration', () => {
    const id = world.spawn();
    world.addComponent(id, COMPONENTS.POSITION, { x: 5, y: 5 });
    world.addComponent(id, COMPONENTS.SMOOTH_POSITION, {
      offsetX: 1, offsetY: 0,
      fromX: 4, fromY: 5, toX: 5, toY: 5,
      elapsed: 0, duration: 0,
    });
    world.update(0.016);
    const smooth = world.getComponent(id, COMPONENTS.SMOOTH_POSITION);
    // Should not have changed since duration=0
    expect(smooth.offsetX).toBe(1);
  });
});
