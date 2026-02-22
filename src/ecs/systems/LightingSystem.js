/**
 * LightingSystem — computes radial lighting from LightSource entities.
 * Wraps lighting.js computeRadialLight(). Uses FOV visible set.
 *
 * @example
 * world.addSystem('lighting', LightingSystem);
 */

import { COMPONENTS } from '../components.js';
import { computeRadialLight, applyWallLightInheritance, torchFlicker, MIN_AMBIENT } from '../../lib/lighting.js';

/**
 * @param {object} world
 * @param {number} dt
 */
export function LightingSystem(world, dt) {
  const renderer = world.getResource('renderer');
  const dungeon = world.getResource('dungeon');
  if (!renderer || !dungeon) return;

  const time = world.getResource('time') || { elapsed: 0 };
  const visibleSet = world.getResource('visibleSet');
  const subRes = world.getResource('lightSubRes') || 3;
  const gridW = dungeon.width;
  const gridH = dungeon.height;
  const grid = dungeon.grid;

  // Build light sources array from entities
  const sources = [];
  const lightEntities = world.query([COMPONENTS.POSITION, COMPONENTS.LIGHT_SOURCE]);
  for (const id of lightEntities) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    const light = world.getComponent(id, COMPONENTS.LIGHT_SOURCE);
    let intensity = light.intensity;
    if (light.flicker) {
      intensity *= torchFlicker(time.elapsed, pos.x, pos.y);
    }
    sources.push({
      x: pos.x,
      y: pos.y,
      color: light.color,
      radius: light.radius,
      intensity,
      wallMounted: light.wallMounted,
    });
  }

  // Also add player light if exists
  const players = world.query([COMPONENTS.POSITION, COMPONENTS.PLAYER_TAG]);
  for (const id of players) {
    const pos = world.getComponent(id, COMPONENTS.POSITION);
    sources.push({
      x: pos.x,
      y: pos.y,
      color: [0.4, 0.7, 0.5],
      radius: 8,
      intensity: 1.0,
    });
  }

  if (sources.length === 0) return;

  const isFloor = (x, y) => {
    const cell = grid[y] && grid[y][x];
    return cell && cell.type === 'floor';
  };

  const isWall = (x, y) => {
    const cell = grid[y] && grid[y][x];
    return cell && cell.type === 'wall';
  };

  const { lightR, lightG, lightB } = computeRadialLight(
    renderer, sources, gridW, gridH, subRes,
    {
      ambient: MIN_AMBIENT,
      visibleSet,
      isFloor,
    }
  );

  applyWallLightInheritance(
    renderer, lightR, lightG, lightB, gridW, gridH, subRes,
    isWall, isFloor, visibleSet
  );

  world.setResource('lightMap', { lightR, lightG, lightB });
}
