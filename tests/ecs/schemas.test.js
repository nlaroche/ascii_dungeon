import { describe, it, expect } from 'vitest';
import { validateComponent, applyDefaults, SCHEMAS } from '../../src/ecs/schemas.js';
import { COMPONENTS } from '../../src/ecs/components.js';

describe('schemas', () => {
  describe('validateComponent', () => {
    it('should accept valid position data', () => {
      expect(() => validateComponent(COMPONENTS.POSITION, { x: 5, y: 10 })).not.toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => validateComponent(COMPONENTS.POSITION, { x: 5 }))
        .toThrow('missing required field "y"');
    });

    it('should reject wrong types', () => {
      expect(() => validateComponent(COMPONENTS.POSITION, { x: 'bad', y: 0 }))
        .toThrow('expected number, got string');
    });

    it('should reject values below min', () => {
      expect(() => validateComponent(COMPONENTS.HEALTH, { hp: -1, maxHp: 10 }))
        .toThrow('must be >= 0');
    });

    it('should accept marker components (empty schema)', () => {
      expect(() => validateComponent(COMPONENTS.PLAYER_TAG, {})).not.toThrow();
    });

    it('should throw on unknown component name', () => {
      expect(() => validateComponent('nonexistent', {})).toThrow('Unknown component');
    });

    it('should accept optional fields when omitted', () => {
      expect(() => validateComponent(COMPONENTS.VELOCITY, {})).not.toThrow();
    });

    it('should validate all component schemas exist for COMPONENTS constants', () => {
      for (const name of Object.values(COMPONENTS)) {
        expect(SCHEMAS[name]).toBeDefined();
      }
    });
  });

  describe('applyDefaults', () => {
    it('should fill in default values', () => {
      const result = applyDefaults(COMPONENTS.VELOCITY, {});
      expect(result).toEqual({ vx: 0, vy: 0, gravity: 0 });
    });

    it('should not overwrite provided values', () => {
      const result = applyDefaults(COMPONENTS.VELOCITY, { vx: 5 });
      expect(result.vx).toBe(5);
      expect(result.vy).toBe(0);
    });

    it('should clone array/object defaults', () => {
      const a = applyDefaults(COMPONENTS.INVENTORY, {});
      const b = applyDefaults(COMPONENTS.INVENTORY, {});
      expect(a.items).not.toBe(b.items); // different array instances
    });

    it('should return copy even for unknown component', () => {
      const result = applyDefaults('unknown', { foo: 'bar' });
      expect(result).toEqual({ foo: 'bar' });
    });
  });
});
