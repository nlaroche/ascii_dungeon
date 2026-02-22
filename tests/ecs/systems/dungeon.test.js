import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld } from '../../helpers/ecs-helpers.js';
import { DungeonSystem } from '../../../src/ecs/systems/DungeonSystem.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('DungeonSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.addSystem('dungeon', DungeonSystem);
  });

  it('should generate dungeon when request resource is set', () => {
    world.setResource('generateDungeon', {
      width: 20, height: 15, roomCount: 3, playerLevel: 1,
    });

    world.update(0.016);

    const dungeon = world.getResource('dungeon');
    expect(dungeon).toBeDefined();
    expect(dungeon.width).toBe(20);
    expect(dungeon.height).toBe(15);
    expect(dungeon.grid).toBeDefined();
  });

  it('should emit dungeon:generated event', () => {
    world.setResource('generateDungeon', {
      width: 20, height: 15, roomCount: 3, playerLevel: 1,
    });

    world.update(0.016);

    const events = world.events.drain(EVENTS.DUNGEON_GENERATED);
    expect(events.length).toBe(1);
    expect(events[0].width).toBe(20);
    expect(events[0].height).toBe(15);
  });

  it('should clear request after generation', () => {
    world.setResource('generateDungeon', {
      width: 20, height: 15, roomCount: 3, playerLevel: 1,
    });

    world.update(0.016);
    expect(world.getResource('generateDungeon')).toBeNull();
  });

  it('should not generate when request is null', () => {
    world.update(0.016);
    expect(world.getResource('dungeon')).toBeUndefined();
  });
});
