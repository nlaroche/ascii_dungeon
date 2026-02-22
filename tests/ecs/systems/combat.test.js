import { describe, it, expect, beforeEach } from 'vitest';
import { createTestWorld, buildEntity } from '../../helpers/ecs-helpers.js';
import { CombatSystem } from '../../../src/ecs/systems/CombatSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('CombatSystem', () => {
  let world;

  beforeEach(() => {
    world = createTestWorld();
    world.addSystem('combat', CombatSystem);
  });

  it('should resolve combat and emit hit event', () => {
    const player = buildEntity(world, 'player', { attack: 10 });
    const enemy = buildEntity(world, 'enemy', { hp: 50, defense: 2 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    // Should have emitted combat:hit
    const hits = world.events.drain(EVENTS.COMBAT_HIT);
    expect(hits.length).toBe(1);
    expect(hits[0].attacker).toBe(player);
    expect(hits[0].defender).toBe(enemy);
    expect(hits[0].damage).toBeGreaterThan(0);
  });

  it('should apply damage to defender', () => {
    const player = buildEntity(world, 'player', { attack: 15 });
    const enemy = buildEntity(world, 'enemy', { hp: 50 });

    const prevHp = world.getComponent(enemy, COMPONENTS.HEALTH).hp;
    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    const newHp = world.getComponent(enemy, COMPONENTS.HEALTH).hp;
    expect(newHp).toBeLessThan(prevHp);
  });

  it('should emit kill event when defender dies', () => {
    const player = buildEntity(world, 'player', { attack: 100 });
    const enemy = buildEntity(world, 'enemy', { hp: 1 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    const kills = world.events.drain(EVENTS.COMBAT_KILL);
    expect(kills.length).toBe(1);
    expect(kills[0].defender).toBe(enemy);
  });

  it('should apply counter-attack damage to attacker', () => {
    const player = buildEntity(world, 'player', { attack: 8, hp: 100 });
    const enemy = buildEntity(world, 'enemy', { hp: 200, attack: 10, defense: 0 });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    const playerHp = world.getComponent(player, COMPONENTS.HEALTH).hp;
    expect(playerHp).toBeLessThan(100);
  });

  it('should skip dead entities', () => {
    const player = buildEntity(world, 'player');
    const enemy = buildEntity(world, 'enemy');
    world.destroy(enemy);

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    // No events should be emitted
    expect(world.events.drain(EVENTS.COMBAT_HIT)).toHaveLength(0);
  });
});
