import { describe, it, expect } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { createSpyRenderer } from '../../helpers/spy-renderer.js';
import { DungeonSystem } from '../../../src/ecs/systems/DungeonSystem.js';
import { FOVSystem } from '../../../src/ecs/systems/FOVSystem.js';
import { LightingSystem } from '../../../src/ecs/systems/LightingSystem.js';
import { RenderSystem } from '../../../src/ecs/systems/RenderSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('Dungeon → FOV → Lighting → Render integration', () => {
  it('should generate dungeon, compute FOV, light, and render', () => {
    const world = createTestWorld();
    const spy = createSpyRenderer(20, 15);

    world.setResource('renderer', spy);
    world.setResource('cellFlags', { VISIBLE: 1 });
    world.setResource('time', { elapsed: 0 });
    world.setResource('lightSubRes', 1);
    world.setResource('fovConfig', { radius: 8 });

    world.addSystem('dungeon', DungeonSystem);
    world.addSystem('fov', FOVSystem);
    world.addSystem('lighting', LightingSystem);
    world.addSystem('render', RenderSystem);

    // Trigger dungeon generation
    world.setResource('generateDungeon', {
      width: 20, height: 15, roomCount: 3, playerLevel: 1,
    });

    // Spawn player (at 1,1 — should be walkable floor)
    const player = buildEntity(world, 'player', { x: 1, y: 1 });

    // First frame: generate dungeon + compute FOV + light + render
    world.update(0.016);

    // Dungeon should exist
    const dungeon = world.getResource('dungeon');
    expect(dungeon).toBeDefined();
    expect(dungeon.grid).toBeDefined();

    // FOV should have been computed
    const visible = world.getResource('visibleSet');
    expect(visible).toBeDefined();
    expect(visible.size).toBeGreaterThan(0);

    // Light map should exist
    const lightMap = world.getResource('lightMap');
    expect(lightMap).toBeDefined();

    // Renderer should have received cells
    expect(spy.cells.length).toBeGreaterThan(0);
    expect(spy.clearCount).toBe(1);
  });

  it('should render player as @ with correct color', () => {
    const world = createTestWorld();
    const spy = createSpyRenderer(20, 15);

    world.setResource('renderer', spy);
    world.setResource('cellFlags', { VISIBLE: 1 });
    world.setResource('time', { elapsed: 0 });
    world.setResource('lightSubRes', 1);
    world.setResource('fovConfig', { radius: 8 });

    world.addSystem('fov', FOVSystem);
    world.addSystem('render', RenderSystem);

    // Manual dungeon with player in center
    const grid = [];
    for (let y = 0; y < 5; y++) {
      grid[y] = [];
      for (let x = 0; x < 5; x++) {
        grid[y][x] = { type: (x === 0 || x === 4 || y === 0 || y === 4) ? 'wall' : 'floor' };
      }
    }
    world.setResource('dungeon', { grid, width: 5, height: 5 });

    buildEntity(world, 'player', { x: 2, y: 2 });
    world.update(0.016);

    const playerCell = spy.cellAt(2, 2);
    expect(playerCell).not.toBeNull();
    expect(playerCell.char).toBe('@');
    expect(playerCell.fg).toBe('#00ff00');
  });
});
