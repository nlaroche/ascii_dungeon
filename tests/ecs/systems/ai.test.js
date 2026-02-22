import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { AISystem } from '../../../src/ecs/systems/AISystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('AISystem', () => {
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
    world.addSystem('ai', AISystem);
    world.setResource('dungeon', simpleDungeon(20, 15));
  });

  it('should emit attack when enemy is adjacent to player', () => {
    buildEntity(world, 'player', { x: 5, y: 5 });
    buildEntity(world, 'enemy', { x: 6, y: 5 });

    world.update(0.016);

    const attacks = world.events.drain(EVENTS.ACTION_ATTACK);
    expect(attacks.length).toBe(1);
  });

  it('should emit move toward player within aggro radius', () => {
    buildEntity(world, 'player', { x: 5, y: 5 });
    buildEntity(world, 'enemy', { x: 8, y: 5, aggroRadius: 5 });

    world.update(0.016);

    const moves = world.events.drain(EVENTS.ACTION_MOVE);
    expect(moves.length).toBe(1);
    expect(moves[0].dx).toBe(-1); // moving toward player
  });

  it('should not act when player is out of aggro radius', () => {
    buildEntity(world, 'player', { x: 1, y: 1 });
    buildEntity(world, 'enemy', { x: 15, y: 10, aggroRadius: 5 });

    world.update(0.016);

    expect(world.events.drain(EVENTS.ACTION_ATTACK)).toHaveLength(0);
    expect(world.events.drain(EVENTS.ACTION_MOVE)).toHaveLength(0);
  });

  it('should not act when no player exists', () => {
    buildEntity(world, 'enemy', { x: 5, y: 5 });
    world.update(0.016);
    expect(world.events.drain(EVENTS.ACTION_ATTACK)).toHaveLength(0);
    expect(world.events.drain(EVENTS.ACTION_MOVE)).toHaveLength(0);
  });
});
