import { describe, it, expect, beforeEach } from 'vitest';
import { createEventBus } from '../../src/ecs/EventBus.js';
import { EVENTS, EVENT_SCHEMAS } from '../../src/ecs/events.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = createEventBus({ devMode: true, payloadSchemas: EVENT_SCHEMAS });
  });

  describe('emit and drain', () => {
    it('should emit and drain events', () => {
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      const events = bus.drain(EVENTS.COMBAT_HIT);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ attacker: 1, defender: 2, damage: 5 });
    });

    it('should drain clears the queue', () => {
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      bus.drain(EVENTS.COMBAT_HIT);
      const second = bus.drain(EVENTS.COMBAT_HIT);
      expect(second).toHaveLength(0);
    });

    it('should accumulate multiple events of same type', () => {
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 3 });
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 3, damage: 7 });
      const events = bus.drain(EVENTS.COMBAT_HIT);
      expect(events).toHaveLength(2);
    });

    it('should return empty array for unqueued type', () => {
      expect(bus.drain(EVENTS.COMBAT_KILL)).toEqual([]);
    });
  });

  describe('peek', () => {
    it('should peek without draining', () => {
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      expect(bus.peek(EVENTS.COMBAT_HIT)).toHaveLength(1);
      expect(bus.peek(EVENTS.COMBAT_HIT)).toHaveLength(1); // still there
    });
  });

  describe('on/off listeners', () => {
    it('should notify listeners on emit', () => {
      const received = [];
      bus.on(EVENTS.COMBAT_KILL, (evt) => received.push(evt));
      bus.emit(EVENTS.COMBAT_KILL, { attacker: 1, defender: 2 });
      expect(received).toHaveLength(1);
      expect(received[0].attacker).toBe(1);
    });

    it('should unsubscribe with off', () => {
      const received = [];
      const fn = (evt) => received.push(evt);
      bus.on(EVENTS.COMBAT_KILL, fn);
      bus.off(EVENTS.COMBAT_KILL, fn);
      bus.emit(EVENTS.COMBAT_KILL, { attacker: 1, defender: 2 });
      expect(received).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all queues', () => {
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      bus.emit(EVENTS.COMBAT_KILL, { attacker: 1, defender: 2 });
      bus.clearAll();
      expect(bus.drain(EVENTS.COMBAT_HIT)).toHaveLength(0);
      expect(bus.drain(EVENTS.COMBAT_KILL)).toHaveLength(0);
    });
  });

  describe('devMode validation', () => {
    it('should throw on empty event type', () => {
      expect(() => bus.emit('', {})).toThrow('invalid event type');
    });

    it('should throw on missing required payload field', () => {
      expect(() => bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2 }))
        .toThrow('missing required field "damage"');
    });

    it('should throw on wrong payload field type', () => {
      expect(() => bus.emit(EVENTS.COMBAT_HIT, { attacker: 'bad', defender: 2, damage: 5 }))
        .toThrow('expected number');
    });

    it('should allow events with no schema (unknown events)', () => {
      expect(() => bus.emit('custom:event', { anything: true })).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should clear queues and listeners', () => {
      const received = [];
      bus.on(EVENTS.COMBAT_HIT, (e) => received.push(e));
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      bus.reset();
      expect(bus.drain(EVENTS.COMBAT_HIT)).toHaveLength(0);
      // Listener should be gone
      bus.emit(EVENTS.COMBAT_HIT, { attacker: 1, defender: 2, damage: 5 });
      expect(received).toHaveLength(1); // only the pre-reset one
    });
  });
});
