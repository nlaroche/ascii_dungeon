import { describe, it, expect } from 'vitest';
import {
  createPlayer, applyLevelUp, applyDamage, healPlayer, addGold, addXp
} from '../../src/lib/player.js';

describe('createPlayer', () => {
  it('creates player with default stats', () => {
    const p = createPlayer();
    expect(p.hp).toBe(100);
    expect(p.maxHp).toBe(100);
    expect(p.level).toBe(1);
    expect(p.gold).toBe(0);
    expect(p.xp).toBe(0);
    expect(p.xpToNext).toBe(100);
    expect(p.equipment).toEqual({ weapon: null, armor: null, amulet: null });
  });

  it('applies overrides', () => {
    const p = createPlayer({ name: 'Bob', hp: 50, attack: 20 });
    expect(p.name).toBe('Bob');
    expect(p.hp).toBe(50);
    expect(p.attack).toBe(20);
    expect(p.defense).toBe(5); // default kept
  });
});

describe('applyLevelUp', () => {
  it('increments level and scales stats', () => {
    const p = createPlayer({ xp: 100, xpToNext: 100 });
    const leveled = applyLevelUp(p);
    expect(leveled.level).toBe(2);
    expect(leveled.xp).toBe(0);
    expect(leveled.xpToNext).toBe(150);
    expect(leveled.maxHp).toBe(110);
    expect(leveled.hp).toBe(110);
    expect(leveled.attack).toBe(12);
    expect(leveled.defense).toBe(6);
  });

  it('does not mutate original', () => {
    const p = createPlayer();
    applyLevelUp(p);
    expect(p.level).toBe(1);
  });
});

describe('applyDamage', () => {
  it('reduces hp by amount', () => {
    const p = createPlayer();
    const damaged = applyDamage(p, 5);
    expect(damaged.hp).toBe(95);
    expect(damaged).not.toBe(p);
  });

  it('clamps hp at 0', () => {
    const p = createPlayer({ hp: 10 });
    const damaged = applyDamage(p, 50);
    expect(damaged.hp).toBe(0);
  });

  it('does not mutate original', () => {
    const p = createPlayer();
    applyDamage(p, 30);
    expect(p.hp).toBe(100);
  });
});

describe('healPlayer', () => {
  it('increases hp', () => {
    const p = createPlayer({ hp: 50, maxHp: 100 });
    const healed = healPlayer(p, 20);
    expect(healed.hp).toBe(70);
  });

  it('caps at maxHp', () => {
    const p = createPlayer();
    const damaged = applyDamage(p, 10);
    const healed = healPlayer(damaged, 999);
    expect(healed.hp).toBe(p.maxHp);
  });
});

describe('addGold', () => {
  it('adds gold without mutating', () => {
    const p = createPlayer();
    const rich = addGold(p, 100);
    expect(rich.gold).toBe(100);
    expect(p.gold).toBe(0);
  });
});

describe('addXp', () => {
  it('adds xp without leveling', () => {
    const p = createPlayer();
    const result = addXp(p, 50);
    expect(result.xp).toBe(50);
    expect(result.level).toBe(1);
  });

  it('triggers level up at threshold', () => {
    const p = createPlayer();
    const result = addXp(p, 100);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(0);
  });

  it('triggers multiple level ups', () => {
    const p = createPlayer();
    // 100 to reach level 2, then xpToNext becomes 150, 150 more = level 3
    const result = addXp(p, 250);
    expect(result.level).toBe(3);
  });

  it('carries over excess xp', () => {
    const p = createPlayer();
    const result = addXp(p, 110);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(10);
  });
});
