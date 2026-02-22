/**
 * RenderSystem — bridges ECS entities to the renderer via setCell().
 * Renders dungeon grid (resource) then entity Renderables sorted by depth.
 *
 * @example
 * world.addSystem('render', RenderSystem);
 */

import { COMPONENTS } from '../components.js';
import { COLORS } from '../../lib/palette.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function RenderSystem(world, dt) {
  const renderer = world.getResource('renderer');
  if (!renderer) return;

  const CELL_FLAGS = world.getResource('cellFlags') || { VISIBLE: 1 };

  renderer.clearGrid();

  // 1. Render dungeon grid (resource, not entities)
  const dungeon = world.getResource('dungeon');
  const visibleSet = world.getResource('visibleSet');

  if (dungeon) {
    const grid = dungeon.grid;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = grid[y][x];
        if (!cell) continue;

        // Visibility check
        const key = (y << 8) | x;
        const isVisible = !visibleSet || visibleSet.has(key);
        if (!isVisible && !cell.explored) continue;

        const flags = isVisible ? CELL_FLAGS.VISIBLE : 0;

        if (cell.type === 'wall') {
          renderer.setCell(x, y, '#', COLORS.wallFg, COLORS.wallBg, 1.0, flags);
        } else if (cell.type === 'floor') {
          renderer.setCell(x, y, '.', COLORS.floorFg, COLORS.floorBg, 0.0, flags);
        }
      }
    }
  }

  // 2. Collect and sort renderable entities by depth
  const entities = world.query([COMPONENTS.POSITION, COMPONENTS.RENDERABLE]);
  const sorted = [];
  for (const id of entities) {
    sorted.push(id);
  }

  // Sort by depth (lower depth rendered first = behind)
  sorted.sort((a, b) => {
    const ra = world.getComponent(a, COMPONENTS.RENDERABLE);
    const rb = world.getComponent(b, COMPONENTS.RENDERABLE);
    return (ra.depth || 0) - (rb.depth || 0);
  });

  // 3. Render entities
  for (const id of sorted) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    const rend = world.getComponent(id, COMPONENTS.RENDERABLE);

    // Apply smooth position offset
    let drawX = pos.x;
    let drawY = pos.y;
    const smooth = world.getComponent(id, COMPONENTS.SMOOTH_POSITION);
    if (smooth) {
      drawX += smooth.offsetX;
      drawY += smooth.offsetY;
    }

    // Apply flash color
    let fg = rend.fg;
    const flash = world.getComponent(id, COMPONENTS.FLASH);
    if (flash) {
      fg = flash.color;
    }

    // Visibility check for entities
    if (visibleSet) {
      const key = (Math.round(pos.y) << 8) | Math.round(pos.x);
      if (!visibleSet.has(key)) continue;
    }

    renderer.setCell(
      Math.round(drawX),
      Math.round(drawY),
      rend.char,
      fg,
      rend.bg,
      rend.depth,
      CELL_FLAGS.VISIBLE
    );
  }
}
