import { describe, it, expect } from 'vitest';
import { createTestWorld, buildEntity, seededRng } from '../../helpers/ecs-helpers.js';
import { CombatSystem } from '../../../src/ecs/systems/CombatSystem.js';
import { JuiceSystem } from '../../../src/ecs/systems/JuiceSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('Combat → Juice integration', () => {
  it('should spawn particles when combat hits', () => {
    const world = createTestWorld();
    world.setResource('rng', seededRng(42));
    world.addSystem('combat', CombatSystem);
    world.addSystem('juice', JuiceSystem);

    const player = buildEntity(world, 'player', { attack: 15 });
    const enemy = buildEntity(world, 'enemy', { hp: 50, x: 6, y: 5 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    // Juice should have spawned particles
    const particles = world.query([COMPONENTS.VELOCITY, COMPONENTS.LIFETIME]);
    expect(particles.size).toBeGreaterThan(0);
  });

  it('should flash the defender on hit', () => {
    const world = createTestWorld();
    world.setResource('rng', seededRng(42));
    world.addSystem('combat', CombatSystem);
    world.addSystem('juice', JuiceSystem);

    const player = buildEntity(world, 'player', { attack: 10 });
    const enemy = buildEntity(world, 'enemy', { hp: 100, x: 6, y: 5 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    expect(world.hasComponent(enemy, COMPONENTS.FLASH)).toBe(true);
  });

  it('should trigger screen shake on combat hit', () => {
    const world = createTestWorld();
    world.setResource('rng', seededRng(42));
    world.setResource('camera', { shakeIntensity: 0 });
    world.addSystem('combat', CombatSystem);
    world.addSystem('juice', JuiceSystem);

    const player = buildEntity(world, 'player', { attack: 20 });
    const enemy = buildEntity(world, 'enemy', { hp: 100, x: 6, y: 5 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    const camera = world.getResource('camera');
    expect(camera.shakeIntensity).toBeGreaterThan(0);
  });
});
