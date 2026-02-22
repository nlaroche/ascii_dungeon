import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { LightingSystem } from '../../../src/ecs/systems/LightingSystem.js';
import { createSpyRenderer } from '../../helpers/spy-renderer.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('LightingSystem', () => {
  let world, spy;

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
    spy = createSpyRenderer(10, 10);
    world.setResource('renderer', spy);
    world.setResource('dungeon', simpleDungeon(10, 10));
    world.setResource('time', { elapsed: 0 });
    world.setResource('lightSubRes', 1); // simple 1:1 for testing
    world.addSystem('lighting', LightingSystem);
  });

  it('should compute light map with a torch', () => {
    buildEntity(world, 'torch', { x: 5, y: 5, radius: 6, flicker: false });
    world.update(0.016);

    const lightMap = world.getResource('lightMap');
    expect(lightMap).toBeDefined();
    expect(lightMap.lightR).toBeDefined();
    // Cell at torch position should have light
    const idx = 5 * 10 + 5;
    expect(lightMap.lightR[idx]).toBeGreaterThan(0);
  });

  it('should add player light automatically', () => {
    buildEntity(world, 'player', { x: 5, y: 5 });
    world.update(0.016);

    const lightMap = world.getResource('lightMap');
    expect(lightMap).toBeDefined();
    const idx = 5 * 10 + 5;
    expect(lightMap.lightR[idx]).toBeGreaterThan(0);
  });

  it('should not run without renderer', () => {
    world.setResource('renderer', null);
    buildEntity(world, 'torch', { x: 5, y: 5 });
    world.update(0.016);
    expect(world.getResource('lightMap')).toBeUndefined();
  });

  it('should not run without dungeon', () => {
    world.setResource('dungeon', null);
    buildEntity(world, 'torch', { x: 5, y: 5 });
    world.update(0.016);
    expect(world.getResource('lightMap')).toBeUndefined();
  });
});
