import { describe, it, expect } from 'vitest';
import {
  RECORD_TYPES, MAX_LEVEL, ITEM_SLOTS,
  createItem, createLegacyItem, addRecordXP, xpToNextLevel,
  getItemDisplayName, getItemColor, getVisualStage, getVisualMark,
  getTotalLevel, getItemTooltip,
  detectResonance, detectEquipmentResonance, getEquipmentStats,
  getRecordDamage, getRecordCrit, getRecordDefense, getRecordDamageReduction,
  getRecordMaxHP, getRecordLifesteal, getRecordStaminaEfficiency,
  getRecordMovementSpeed, getRecordMapReveal, getRecordGoldBonus, getRecordRareChance,
} from '../../src/lib/items.js';

// Deterministic RNG for tests
function seededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('createItem', () => {
  it('creates item with correct structure', () => {
    const item = createItem('weapon', 1, seededRng());
    expect(item.slot).toBe('weapon');
    expect(item.floorCreated).toBe(1);
    expect(item.records.kill).toEqual({ level: 0, xp: 0 });
    expect(item.records.treasure).toEqual({ level: 0, xp: 0 });
    expect(item.records.explore).toEqual({ level: 0, xp: 0 });
    expect(item.records.survive).toEqual({ level: 0, xp: 0 });
    expect(item.primaryRecord).toBeNull();
    expect(item.visualMarks).toEqual([]);
    expect(item.id).toBeTruthy();
    expect(item.name).toBeTruthy();
    expect(item.char).toBeTruthy();
  });

  it('creates items for all slots', () => {
    for (const slot of ['weapon', 'armor', 'amulet']) {
      const item = createItem(slot, 1, seededRng());
      expect(item.slot).toBe(slot);
    }
  });
});

describe('createLegacyItem', () => {
  it('creates item with pre-set record levels', () => {
    const item = createLegacyItem('weapon', 5, { kill: 4 }, seededRng());
    expect(item.records.kill.level).toBe(4);
    expect(item.primaryRecord).toBe('kill');
    expect(item.visualMarks.length).toBe(4);
  });

  it('caps at MAX_LEVEL', () => {
    const item = createLegacyItem('weapon', 5, { kill: 15 }, seededRng());
    expect(item.records.kill.level).toBe(MAX_LEVEL);
    expect(item.visualMarks.length).toBe(MAX_LEVEL);
  });
});

describe('xpToNextLevel', () => {
  it('follows doubling curve', () => {
    expect(xpToNextLevel(0)).toBe(10);
    expect(xpToNextLevel(1)).toBe(20);
    expect(xpToNextLevel(2)).toBe(40);
    expect(xpToNextLevel(3)).toBe(80);
    expect(xpToNextLevel(9)).toBe(5120);
  });

  it('returns Infinity at max level', () => {
    expect(xpToNextLevel(MAX_LEVEL)).toBe(Infinity);
  });
});

describe('addRecordXP', () => {
  it('adds XP without leveling', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 5);
    expect(item.records.kill.xp).toBe(5);
    expect(item.records.kill.level).toBe(0);
  });

  it('levels up when XP threshold reached', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 10); // exactly level 1
    expect(item.records.kill.level).toBe(1);
    expect(item.records.kill.xp).toBe(0);
    expect(item.primaryRecord).toBe('kill');
    expect(item.visualMarks.length).toBe(1);
  });

  it('handles multi-level jumps', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 10 + 20 + 5); // lv1 + lv2 + 5 leftover
    expect(item.records.kill.level).toBe(2);
    expect(item.records.kill.xp).toBe(5);
    expect(item.visualMarks.length).toBe(2);
  });

  it('caps at MAX_LEVEL', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 999999);
    expect(item.records.kill.level).toBe(MAX_LEVEL);
  });

  it('sets primaryRecord to highest', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 30); // lv2
    item = addRecordXP(item, 'explore', 10); // lv1
    expect(item.primaryRecord).toBe('kill');
  });

  it('ignores invalid record type', () => {
    let item = createItem('weapon', 1, seededRng());
    const result = addRecordXP(item, 'invalid', 100);
    expect(result).toBe(item); // unchanged
  });
});

describe('getTotalLevel', () => {
  it('sums all record levels', () => {
    let item = createItem('weapon', 1, seededRng());
    item = addRecordXP(item, 'kill', 10);
    item = addRecordXP(item, 'explore', 30);
    expect(getTotalLevel(item)).toBe(3); // kill lv1 + explore lv2
  });
});

describe('visual stages', () => {
  it('returns correct stage for kill record', () => {
    expect(getVisualStage('kill', 0).prefix).toBe('');
    expect(getVisualStage('kill', 1).prefix).toBe('Sharpened');
    expect(getVisualStage('kill', 3).prefix).toBe('Bloodied');
    expect(getVisualStage('kill', 7).prefix).toBe("Champion's");
    expect(getVisualStage('kill', 10).prefix).toBe('Legendary');
  });

  it('returns visual marks', () => {
    expect(getVisualMark('kill', 1)).toBe('sharpened edge');
    expect(getVisualMark('kill', 10)).toBe('godkiller aura');
    expect(getVisualMark('kill', 0)).toBeNull();
  });

  it('getItemDisplayName adds prefix', () => {
    let item = createItem('weapon', 1, seededRng());
    expect(getItemDisplayName(item)).toBe(item.name); // no prefix when no records
    item = addRecordXP(item, 'kill', 10);
    expect(getItemDisplayName(item)).toMatch(/^Sharpened /);
  });

  it('getItemColor reflects primary record', () => {
    let item = createItem('weapon', 1, seededRng());
    expect(getItemColor(item)).toBe('#888888'); // default
    item = addRecordXP(item, 'kill', 10);
    expect(getItemColor(item)).toBe('#888888'); // kill lv1 color
  });
});

describe('stat modifiers', () => {
  it('getRecordDamage scales with kill level', () => {
    const item = createLegacyItem('weapon', 1, { kill: 1 }, seededRng());
    expect(getRecordDamage(item)).toBe(2);
    const item5 = createLegacyItem('weapon', 1, { kill: 5 }, seededRng());
    expect(getRecordDamage(item5)).toBe(Math.floor(2 * Math.pow(1.8, 4)));
  });

  it('getRecordCrit starts at kill lv5', () => {
    const item4 = createLegacyItem('weapon', 1, { kill: 4 }, seededRng());
    expect(getRecordCrit(item4)).toBe(0);
    const item5 = createLegacyItem('weapon', 1, { kill: 5 }, seededRng());
    expect(getRecordCrit(item5)).toBeCloseTo(0.05);
  });

  it('getRecordDefense scales with survive level', () => {
    const item = createLegacyItem('armor', 1, { survive: 3 }, seededRng());
    expect(getRecordDefense(item)).toBe(Math.floor(2 * Math.pow(1.7, 2)));
  });

  it('getRecordDamageReduction is 5% per survive level', () => {
    const item = createLegacyItem('armor', 1, { survive: 5 }, seededRng());
    expect(getRecordDamageReduction(item)).toBeCloseTo(0.25);
  });

  it('getRecordMaxHP is 5 per survive level', () => {
    const item = createLegacyItem('armor', 1, { survive: 4 }, seededRng());
    expect(getRecordMaxHP(item)).toBe(20);
  });

  it('getRecordLifesteal starts at survive lv3', () => {
    expect(getRecordLifesteal(createLegacyItem('armor', 1, { survive: 2 }, seededRng()))).toBe(0);
    expect(getRecordLifesteal(createLegacyItem('armor', 1, { survive: 3 }, seededRng()))).toBeCloseTo(0.05);
  });

  it('getRecordStaminaEfficiency decreases with explore', () => {
    expect(getRecordStaminaEfficiency(createItem('armor', 1, seededRng()))).toBe(1.0);
    expect(getRecordStaminaEfficiency(createLegacyItem('armor', 1, { explore: 5 }, seededRng()))).toBeCloseTo(0.75);
    expect(getRecordStaminaEfficiency(createLegacyItem('armor', 1, { explore: 10 }, seededRng()))).toBe(0.50);
  });

  it('getRecordMovementSpeed starts at explore lv4', () => {
    expect(getRecordMovementSpeed(createLegacyItem('armor', 1, { explore: 3 }, seededRng()))).toBe(0);
    expect(getRecordMovementSpeed(createLegacyItem('armor', 1, { explore: 5 }, seededRng()))).toBeCloseTo(0.20);
  });

  it('getRecordGoldBonus starts at treasure lv2', () => {
    expect(getRecordGoldBonus(createLegacyItem('amulet', 1, { treasure: 1 }, seededRng()))).toBe(0);
    expect(getRecordGoldBonus(createLegacyItem('amulet', 1, { treasure: 5 }, seededRng()))).toBeCloseTo(0.40);
  });

  it('getRecordRareChance starts at treasure lv5', () => {
    expect(getRecordRareChance(createLegacyItem('amulet', 1, { treasure: 4 }, seededRng()))).toBe(0);
    expect(getRecordRareChance(createLegacyItem('amulet', 1, { treasure: 6 }, seededRng()))).toBeCloseTo(0.10);
  });
});

describe('resonance', () => {
  it('returns null when items have no records', () => {
    const a = createItem('weapon', 1, seededRng());
    const b = createItem('armor', 1, seededRng());
    expect(detectResonance(a, b)).toBeNull();
  });

  it('returns null when primary records below lv3', () => {
    const a = createLegacyItem('weapon', 1, { kill: 2 }, seededRng());
    const b = createLegacyItem('armor', 1, { kill: 2 }, seededRng());
    expect(detectResonance(a, b)).toBeNull();
  });

  it('detects matching resonance (same primary)', () => {
    const a = createLegacyItem('weapon', 1, { kill: 5 }, seededRng(1));
    const b = createLegacyItem('armor', 1, { kill: 5 }, seededRng(2));
    const r = detectResonance(a, b);
    expect(r).not.toBeNull();
    expect(r.type).toBe('blood_brothers');
    expect(r.label).toBe('Blood Brothers');
    expect(r.strength).toBe(25);
  });

  it('detects complementary resonance (kill+survive = warrior soul)', () => {
    const a = createLegacyItem('weapon', 1, { kill: 5 }, seededRng(1));
    const b = createLegacyItem('armor', 1, { survive: 5 }, seededRng(2));
    const r = detectResonance(a, b);
    expect(r).not.toBeNull();
    expect(r.type).toBe('warrior_soul');
  });

  it('detectEquipmentResonance finds all pairs', () => {
    const eq = {
      weapon: createLegacyItem('weapon', 1, { kill: 5 }, seededRng(1)),
      armor: createLegacyItem('armor', 1, { kill: 5 }, seededRng(2)),
      amulet: createLegacyItem('amulet', 1, { kill: 5 }, seededRng(3)),
    };
    const res = detectEquipmentResonance(eq);
    expect(res.length).toBe(3); // 3 pairs from 3 items
    expect(res.every(r => r.type === 'blood_brothers')).toBe(true);
  });
});

describe('getEquipmentStats', () => {
  it('aggregates stats from all equipment', () => {
    const eq = {
      weapon: createLegacyItem('weapon', 1, { kill: 5 }, seededRng(1)),
      armor: createLegacyItem('armor', 1, { survive: 3 }, seededRng(2)),
      amulet: createLegacyItem('amulet', 1, { explore: 2 }, seededRng(3)),
    };
    const { stats } = getEquipmentStats(eq);
    expect(stats.bonusDamage).toBeGreaterThan(0);
    expect(stats.bonusDefense).toBeGreaterThan(0);
    expect(stats.staminaEfficiency).toBeLessThan(1.0);
  });

  it('applies resonance bonuses', () => {
    const eq = {
      weapon: createLegacyItem('weapon', 1, { kill: 5 }, seededRng(1)),
      armor: createLegacyItem('armor', 1, { kill: 5 }, seededRng(2)),
      amulet: null,
    };
    const { stats, resonances } = getEquipmentStats(eq);
    expect(resonances.length).toBe(1);
    expect(resonances[0].type).toBe('blood_brothers');
    // Damage should be amplified by resonance
    expect(stats.bonusDamage).toBeGreaterThan(0);
  });
});

describe('getItemTooltip', () => {
  it('returns array of lines', () => {
    const item = createLegacyItem('weapon', 3, { kill: 3 }, seededRng());
    const lines = getItemTooltip(item);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toMatch(/Bloodied/); // kill lv3 prefix
    expect(lines.some(l => l.includes('RECORDS'))).toBe(true);
    expect(lines.some(l => l.includes('MARKS'))).toBe(true);
  });
});
