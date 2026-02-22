import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { RenderSystem } from '../../../src/ecs/systems/RenderSystem.js';
import { createSpyRenderer } from '../../helpers/spy-renderer.js';
import { COMPONENTS } from '../../../src/ecs/components.js';

describe('RenderSystem', () => {
  let world, spy;

  beforeEach(() => {
    world = createTestWorld();
    spy = createSpyRenderer();
    world.setResource('renderer', spy);
    world.setResource('cellFlags', { VISIBLE: 1 });
    world.addSystem('render', RenderSystem);
  });

  it('should call clearGrid before rendering', () => {
    world.update(0.016);
    expect(spy.clearCount).toBe(1);
  });

  it('should render entity with position + renderable', () => {
    const e = world.spawn();
    world.addComponent(e, COMPONENTS.POSITION, { x: 3, y: 4 });
    world.addComponent(e, COMPONENTS.RENDERABLE, { char: '@', fg: '#00ff00' });

    world.update(0.016);

    const cell = spy.cellAt(3, 4);
    expect(cell).not.toBeNull();
    expect(cell.char).toBe('@');
    expect(cell.fg).toBe('#00ff00');
  });

  it('should render dungeon grid from resource', () => {
    const dungeon = {
      width: 3, height: 3,
      grid: [
        [{ type: 'wall' }, { type: 'wall' }, { type: 'wall' }],
        [{ type: 'wall' }, { type: 'floor' }, { type: 'wall' }],
        [{ type: 'wall' }, { type: 'wall' }, { type: 'wall' }],
      ],
    };
    world.setResource('dungeon', dungeon);
    world.update(0.016);

    expect(spy.cellAt(0, 0).char).toBe('#'); // wall
    expect(spy.cellAt(1, 1).char).toBe('.'); // floor
  });

  it('should apply flash color override', () => {
    const e = world.spawn();
    world.addComponent(e, COMPONENTS.POSITION, { x: 5, y: 5 });
    world.addComponent(e, COMPONENTS.RENDERABLE, { char: 'g', fg: '#ff0000' });
    world.addComponent(e, COMPONENTS.FLASH, { color: '#ffffff', framesLeft: 3 });

    world.update(0.016);

    const cell = spy.cellAt(5, 5);
    expect(cell.fg).toBe('#ffffff'); // flash overrides fg
  });

  it('should sort entities by depth', () => {
    const bg = world.spawn();
    world.addComponent(bg, COMPONENTS.POSITION, { x: 5, y: 5 });
    world.addComponent(bg, COMPONENTS.RENDERABLE, { char: '.', fg: '#333', depth: 0 });

    const fg = world.spawn();
    world.addComponent(fg, COMPONENTS.POSITION, { x: 5, y: 5 });
    world.addComponent(fg, COMPONENTS.RENDERABLE, { char: '@', fg: '#0f0', depth: 0.5 });

    world.update(0.016);

    // The last setCell at (5,5) should be the higher-depth entity
    const cell = spy.cellAt(5, 5);
    expect(cell.char).toBe('@');
  });

  it('should not render entities outside visible set', () => {
    const visible = new Set();
    visible.add((5 << 8) | 5);
    world.setResource('visibleSet', visible);

    const e1 = world.spawn();
    world.addComponent(e1, COMPONENTS.POSITION, { x: 5, y: 5 });
    world.addComponent(e1, COMPONENTS.RENDERABLE, { char: '@', fg: '#0f0' });

    const e2 = world.spawn();
    world.addComponent(e2, COMPONENTS.POSITION, { x: 10, y: 10 });
    world.addComponent(e2, COMPONENTS.RENDERABLE, { char: 'g', fg: '#f00' });

    world.update(0.016);

    expect(spy.cellAt(5, 5)).not.toBeNull();
    expect(spy.cellAt(10, 10)).toBeNull();
  });
});
