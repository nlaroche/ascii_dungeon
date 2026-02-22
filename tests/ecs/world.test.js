import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld } from '../../src/ecs/World.js';
import { COMPONENTS } from '../../src/ecs/components.js';

describe('World', () => {
  let world;

  beforeEach(() => {
    world = createWorld({ devMode: true });
  });

  describe('entity lifecycle', () => {
    it('should spawn entities with incrementing IDs', () => {
      const a = world.spawn();
      const b = world.spawn();
      expect(a).toBe(1);
      expect(b).toBe(2);
    });

    it('should report alive status', () => {
      const id = world.spawn();
      expect(world.isAlive(id)).toBe(true);
      world.destroy(id);
      expect(world.isAlive(id)).toBe(false);
    });

    it('should track entity count', () => {
      expect(world.entityCount()).toBe(0);
      world.spawn();
      world.spawn();
      expect(world.entityCount()).toBe(2);
    });

    it('should remove all components on destroy', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.addComponent(id, COMPONENTS.HEALTH, { hp: 10, maxHp: 10 });
      world.destroy(id);
      expect(world.getComponent(id, COMPONENTS.POSITION)).toBeUndefined();
      expect(world.getComponent(id, COMPONENTS.HEALTH)).toBeUndefined();
    });
  });

  describe('component CRUD', () => {
    it('should add and get components', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 3, y: 7 });
      const pos = world.getComponent(id, COMPONENTS.POSITION);
      expect(pos).toEqual({ x: 3, y: 7 });
    });

    it('should apply schema defaults', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.RENDERABLE, { char: '@', fg: '#fff' });
      const r = world.getComponent(id, COMPONENTS.RENDERABLE);
      expect(r.bg).toBe('#000000');
      expect(r.depth).toBe(0);
      expect(r.layer).toBe(0);
    });

    it('should check hasComponent', () => {
      const id = world.spawn();
      expect(world.hasComponent(id, COMPONENTS.POSITION)).toBe(false);
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      expect(world.hasComponent(id, COMPONENTS.POSITION)).toBe(true);
    });

    it('should remove components', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.removeComponent(id, COMPONENTS.POSITION);
      expect(world.hasComponent(id, COMPONENTS.POSITION)).toBe(false);
    });

    it('should throw on addComponent to dead entity in devMode', () => {
      const id = world.spawn();
      world.destroy(id);
      expect(() => {
        world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      }).toThrow('does not exist');
    });

    it('should throw on missing required fields in devMode', () => {
      const id = world.spawn();
      expect(() => {
        world.addComponent(id, COMPONENTS.POSITION, { x: 0 });
      }).toThrow('missing required field "y"');
    });

    it('should throw on wrong field type in devMode', () => {
      const id = world.spawn();
      expect(() => {
        world.addComponent(id, COMPONENTS.POSITION, { x: 'bad', y: 0 });
      }).toThrow('expected number');
    });
  });

  describe('queries', () => {
    it('should find entities with all requested components', () => {
      const a = world.spawn();
      world.addComponent(a, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.addComponent(a, COMPONENTS.VELOCITY, { vx: 1, vy: 0 });

      const b = world.spawn();
      world.addComponent(b, COMPONENTS.POSITION, { x: 1, y: 1 });
      // b has no velocity

      const movers = world.query([COMPONENTS.POSITION, COMPONENTS.VELOCITY]);
      expect(movers.size).toBe(1);
      expect(movers.has(a)).toBe(true);
      expect(movers.has(b)).toBe(false);
    });

    it('should return empty set for no matches', () => {
      const result = world.query([COMPONENTS.POSITION]);
      expect(result.size).toBe(0);
    });

    it('should exclude destroyed entities', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.destroy(id);
      expect(world.query([COMPONENTS.POSITION]).size).toBe(0);
    });

    it('should update after component removal', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.addComponent(id, COMPONENTS.VELOCITY, {});
      expect(world.query([COMPONENTS.POSITION, COMPONENTS.VELOCITY]).size).toBe(1);
      world.removeComponent(id, COMPONENTS.VELOCITY);
      expect(world.query([COMPONENTS.POSITION, COMPONENTS.VELOCITY]).size).toBe(0);
    });
  });

  describe('resources', () => {
    it('should set and get resources', () => {
      world.setResource('time', { elapsed: 0 });
      expect(world.getResource('time')).toEqual({ elapsed: 0 });
    });

    it('should report hasResource', () => {
      expect(world.hasResource('rng')).toBe(false);
      world.setResource('rng', Math.random);
      expect(world.hasResource('rng')).toBe(true);
    });

    it('should overwrite resources', () => {
      world.setResource('count', 1);
      world.setResource('count', 2);
      expect(world.getResource('count')).toBe(2);
    });
  });

  describe('systems', () => {
    it('should register and run systems in order', () => {
      const order = [];
      world.addSystem('a', () => order.push('a'));
      world.addSystem('b', () => order.push('b'));
      world.update(0.016);
      expect(order).toEqual(['a', 'b']);
    });

    it('should pass world and dt to systems', () => {
      let receivedWorld, receivedDt;
      world.addSystem('test', (w, dt) => {
        receivedWorld = w;
        receivedDt = dt;
      });
      world.update(0.033);
      expect(receivedWorld).toBe(world);
      expect(receivedDt).toBeCloseTo(0.033);
    });

    it('should report system count', () => {
      expect(world.systemCount()).toBe(0);
      world.addSystem('x', () => {});
      expect(world.systemCount()).toBe(1);
    });
  });

  describe('bulk operations', () => {
    it('should destroy all matching entities', () => {
      const a = world.spawn();
      world.addComponent(a, COMPONENTS.LIFETIME, { remaining: 0, max: 1 });
      const b = world.spawn();
      world.addComponent(b, COMPONENTS.LIFETIME, { remaining: 0, max: 1 });
      const c = world.spawn();
      world.addComponent(c, COMPONENTS.POSITION, { x: 0, y: 0 });

      const count = world.destroyAll([COMPONENTS.LIFETIME]);
      expect(count).toBe(2);
      expect(world.entityCount()).toBe(1);
      expect(world.isAlive(c)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear everything', () => {
      const id = world.spawn();
      world.addComponent(id, COMPONENTS.POSITION, { x: 0, y: 0 });
      world.setResource('test', 42);
      world.addSystem('test', () => {});
      world.reset();
      expect(world.entityCount()).toBe(0);
      expect(world.hasResource('test')).toBe(false);
      expect(world.systemCount()).toBe(0);
    });
  });
});
