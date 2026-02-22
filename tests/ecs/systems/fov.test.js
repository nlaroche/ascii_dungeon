import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { FOVSystem } from '../../../src/ecs/systems/FOVSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('FOVSystem', () => {
  let world;

  function simpleDungeon(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid[y] = [];
      for (let x = 0; x < w; x++) {
        grid[y][x] = {
          type: (x === 0 || x === w - 1 || y === 0 || y === h - 1) ? 'wall' : 'floor',
        };
      }
    }
    return { grid, width: w, height: h };
  }

  beforeEach(() => {
    world = createTestWorld();
    world.setResource('dungeon', simpleDungeon(20, 15));
    world.setResource('fovConfig', { radius: 8 });
    world.addSystem('fov', FOVSystem);
  });

  it('should compute visible set and store as resource', () => {
    buildEntity(world, 'player', { x: 10, y: 7 });
    world.update(0.016);

    const visible = world.getResource('visibleSet');
    expect(visible).toBeDefined();
    expect(visible instanceof Set).toBe(true);
    // Center should be visible
    expect(visible.has((7 << 8) | 10)).toBe(true);
  });

  it('should emit fov:updated event', () => {
    buildEntity(world, 'player', { x: 10, y: 7 });
    world.update(0.016);

    const events = world.events.drain(EVENTS.FOV_UPDATED);
    expect(events.length).toBe(1);
    expect(events[0].visibleSet).toBeDefined();
  });

  it('should not run without dungeon resource', () => {
    world.setResource('dungeon', null);
    buildEntity(world, 'player', { x: 5, y: 5 });
    world.update(0.016);
    expect(world.getResource('visibleSet')).toBeUndefined();
  });

  it('should not run without player', () => {
    world.update(0.016);
    expect(world.getResource('visibleSet')).toBeUndefined();
  });

  it('should block vision through walls', () => {
    const dungeon = simpleDungeon(20, 15);
    // Add a wall in the middle
    dungeon.grid[7][8] = { type: 'wall' };
    world.setResource('dungeon', dungeon);
    world.setResource('fovConfig', { radius: 10 });

    buildEntity(world, 'player', { x: 10, y: 7 });
    world.update(0.016);

    const visible = world.getResource('visibleSet');
    // Wall itself should be visible
    expect(visible.has((7 << 8) | 8)).toBe(true);
    // Behind wall should not be visible (cells to the left)
    expect(visible.has((7 << 8) | 6)).toBe(false);
  });
});
