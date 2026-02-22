import { describe, it, expect } from 'vitest';
import { resolveCombat, collectTreasure } from '../../src/lib/combat.js';

describe('resolveCombat', () => {
  it('deals minimum 1 damage', () => {
    const result = resolveCombat({ attack: 1, defense: 0 }, { hp: 50, attack: 0, defense: 0 });
    expect(result.defenderDamage).toBe(1);
  });

  it('calculates damage as attack - 5 (min 1)', () => {
    const result = resolveCombat({ attack: 15, defense: 0 }, { hp: 50, attack: 0, defense: 0 });
    expect(result.defenderDamage).toBe(10);
  });

  it('reduces defender HP correctly', () => {
    const result = resolveCombat({ attack: 15 }, { hp: 50, attack: 0 });
    expect(result.defenderHp).toBe(40);
  });

  it('flags defenderKilled when HP drops to 0', () => {
    const result = resolveCombat({ attack: 55 }, { hp: 50, attack: 0 });
    expect(result.defenderKilled).toBe(true);
    expect(result.defenderHp).toBeLessThanOrEqual(0);
  });

  it('does not flag kill when defender survives', () => {
    const result = resolveCombat({ attack: 6 }, { hp: 50, attack: 0 });
    expect(result.defenderKilled).toBe(false);
  });

  it('calculates counter-attack damage when defender survives', () => {
    const result = resolveCombat(
      { attack: 6, defense: 3 },
      { hp: 50, attack: 10, defense: 0 }
    );
    expect(result.attackerDamage).toBe(Math.max(1, 10 - 3));
  });

  it('counter-attack damage is min 1', () => {
    const result = resolveCombat(
      { attack: 6, defense: 100 },
      { hp: 50, attack: 1, defense: 0 }
    );
    expect(result.attackerDamage).toBe(1);
  });

  it('no counter-attack when defender is killed', () => {
    const result = resolveCombat({ attack: 100 }, { hp: 10, attack: 50 });
    expect(result.attackerDamage).toBe(0);
  });

  it('returns loot when defender is killed and has gold', () => {
    const result = resolveCombat(
      { attack: 100 },
      { hp: 10, attack: 0, gold: 25, xp: 50 }
    );
    expect(result.loot).toEqual({ gold: 25, xp: 50 });
  });

  it('returns null loot when defender has no gold property', () => {
    const result = resolveCombat({ attack: 100 }, { hp: 10, attack: 0 });
    expect(result.loot).toBeNull();
  });

  it('returns null loot when defender survives', () => {
    const result = resolveCombat(
      { attack: 6 },
      { hp: 100, attack: 0, gold: 50 }
    );
    expect(result.loot).toBeNull();
  });

  it('handles zero gold on killed defender', () => {
    const result = resolveCombat(
      { attack: 100 },
      { hp: 1, attack: 0, gold: 0, xp: 10 }
    );
    expect(result.loot).toEqual({ gold: 0, xp: 10 });
  });

  it('defaults xp to 0 in loot', () => {
    const result = resolveCombat(
      { attack: 100 },
      { hp: 1, attack: 0, gold: 5 }
    );
    expect(result.loot.xp).toBe(0);
  });
});

describe('collectTreasure', () => {
  it('extracts gold and xp from treasure', () => {
    const result = collectTreasure({ gold: 42, xp: 15 });
    expect(result).toEqual({ gold: 42, xp: 15 });
  });

  it('handles zero values', () => {
    const result = collectTreasure({ gold: 0, xp: 0 });
    expect(result).toEqual({ gold: 0, xp: 0 });
  });
});
