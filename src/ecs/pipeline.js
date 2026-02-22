/**
 * System execution pipeline — defines the order systems run each frame.
 * Import individual systems and register them via registerPipeline().
 *
 * @example
 * import { registerPipeline } from './pipeline.js';
 * registerPipeline(world);
 * world.update(0.016); // runs all systems in order
 */

import { InputSystem } from './systems/InputSystem.js';
import { AISystem } from './systems/AISystem.js';
import { ActionSystem } from './systems/ActionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { LootSystem } from './systems/LootSystem.js';
import { ExperienceSystem } from './systems/ExperienceSystem.js';
import { MovementTweenSystem } from './systems/MovementTweenSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { LifetimeSystem } from './systems/LifetimeSystem.js';
import { JuiceSystem } from './systems/JuiceSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { FOVSystem } from './systems/FOVSystem.js';
import { LightingSystem } from './systems/LightingSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { DungeonSystem } from './systems/DungeonSystem.js';

/**
 * Full pipeline: all systems in execution order.
 * Each entry: [name, system function, phase].
 */
export const PIPELINE = [
  // Input phase
  ['input',          InputSystem,         'input'],
  ['ai',             AISystem,            'ai'],

  // Action phase
  ['action',         ActionSystem,        'action'],
  ['combat',         CombatSystem,        'action'],
  ['loot',           LootSystem,          'action'],
  ['experience',     ExperienceSystem,    'action'],

  // Physics phase
  ['movementTween',  MovementTweenSystem, 'physics'],
  ['physics',        PhysicsSystem,       'physics'],
  ['lifetime',       LifetimeSystem,      'physics'],

  // Effects phase
  ['juice',          JuiceSystem,         'effects'],
  ['camera',         CameraSystem,        'effects'],

  // Vision phase
  ['fov',            FOVSystem,           'vision'],
  ['lighting',       LightingSystem,      'vision'],

  // Render phase
  ['render',         RenderSystem,        'render'],

  // Setup phase (on demand)
  ['dungeon',        DungeonSystem,       'setup'],
];

/**
 * Register all pipeline systems on a world.
 * @param {object} world
 * @param {object} [opts]
 * @param {string[]} [opts.only] Only register systems with these names
 * @param {string[]} [opts.exclude] Exclude systems with these names
 */
export function registerPipeline(world, opts = {}) {
  const { only, exclude } = opts;

  for (const [name, fn, phase] of PIPELINE) {
    if (only && !only.includes(name)) continue;
    if (exclude && exclude.includes(name)) continue;
    world.addSystem(name, fn, phase);
  }
}
