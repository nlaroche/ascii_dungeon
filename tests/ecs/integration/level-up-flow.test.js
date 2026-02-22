import { describe, it, expect } from 'vitest';
import { createTestWorld, buildEntity, seededRng } from '../../helpers/ecs-helpers.js';
import { CombatSystem } from '../../../src/ecs/systems/CombatSystem.js';
import { LootSystem } from '../../../src/ecs/systems/LootSystem.js';
import { ExperienceSystem } from '../../../src/ecs/systems/ExperienceSystem.js';
import { JuiceSystem } from '../../../src/ecs/systems/JuiceSystem.js';
import { COMPONENTS } from '../../../src/ecs/components.js';
import { EVENTS } from '../../../src/ecs/events.js';

describe('Kill → Loot → XP → Level-up → Juice flow', () => {
  it('should flow from kill through loot, XP, level-up, to juice effects', () => {
    const world = createTestWorld();
    world.setResource('rng', seededRng(42));

    // Register systems in pipeline order
    world.addSystem('combat', CombatSystem);
    world.addSystem('loot', LootSystem);
    world.addSystem('experience', ExperienceSystem);
    world.addSystem('juice', JuiceSystem);

    // Player at level 1, 90 XP — one kill should level up
    const player = buildEntity(world, 'player', {
      attack: 100, x: 5, y: 5, xp: 90, xpToNext: 100,
    });
    const enemy = buildEntity(world, 'enemy', {
      hp: 1, x: 6, y: 5, lootGold: 15, lootXp: 50,
    });

    // Trigger attack
    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    // 1. Enemy should be dead
    expect(world.isAlive(enemy)).toBe(false);

    // 2. Player should have received gold
    const inv = world.getComponent(player, COMPONENTS.INVENTORY);
    expect(inv.gold).toBe(15);

    // 3. Player should have leveled up (90 + 50 = 140 >= 100)
    const exp = world.getComponent(player, COMPONENTS.EXPERIENCE);
    expect(exp.level).toBe(2);

    // 4. Stats should be boosted
    const stats = world.getComponent(player, COMPONENTS.COMBAT_STATS);
    expect(stats.attack).toBe(102); // 100 + 2
    expect(stats.defense).toBe(6);   // 5 + 1

    // 5. Level-up juice particles should exist
    const particles = world.query([COMPONENTS.VELOCITY, COMPONENTS.LIFETIME]);
    expect(particles.size).toBeGreaterThan(0);
  });

  it('should handle multiple level-ups from large XP gain', () => {
    const world = createTestWorld();
    world.setResource('rng', seededRng(42));

    world.addSystem('combat', CombatSystem);
    world.addSystem('loot', LootSystem);
    world.addSystem('experience', ExperienceSystem);
    world.addSystem('juice', JuiceSystem);

    const player = buildEntity(world, 'player', {
      attack: 100, x: 5, y: 5, xp: 0, xpToNext: 10,
    });
    const enemy = buildEntity(world, 'enemy', {
      hp: 1, x: 6, y: 5, lootGold: 0, lootXp: 500,
    });

    world.events.emit(EVENTS.ACTION_ATTACK, { attacker: player, defender: enemy });
    world.update(0.016);

    const exp = world.getComponent(player, COMPONENTS.EXPERIENCE);
    expect(exp.level).toBeGreaterThan(2);
  });
});
