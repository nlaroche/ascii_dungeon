import { describe, it, expect } from 'vitest';
import { createPlayer, applyDamage, addGold, addXp, healPlayer } from '../../src/lib/player.js';

describe('player', () => {
  it('creates player with default stats', () => {
    const p = createPlayer();
    expect(p.hp).toBeGreaterThan(0);
    expect(p.maxHp).toBeGreaterThan(0);
    expect(p.level).toBe(1);
    expect(p.gold).toBe(0);
  });

  it('applyDamage returns new object with reduced hp', () => {
    const p = createPlayer();
    const damaged = applyDamage(p, 5);
    expect(damaged.hp).toBe(p.hp - 5);
    expect(damaged).not.toBe(p); // immutable
  });

  it('addGold returns new object', () => {
    const p = createPlayer();
    const rich = addGold(p, 100);
    expect(rich.gold).toBe(100);
    expect(p.gold).toBe(0); // original unchanged
  });

  it('healPlayer caps at maxHp', () => {
    const p = createPlayer();
    const damaged = applyDamage(p, 10);
    const healed = healPlayer(damaged, 999);
    expect(healed.hp).toBe(p.maxHp);
  });
});
