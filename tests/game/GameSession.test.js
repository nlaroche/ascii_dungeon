import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSession } from '../../src/game/GameSession.js';

// Minimal localStorage mock for node environment
const store = {};
const mockLocalStorage = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, val) => { store[key] = val; }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};
globalThis.localStorage = mockLocalStorage;

describe('GameSession', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('returns fresh session with player, calendar, null run', () => {
      const s = GameSession.create();
      expect(s.player).toBeDefined();
      expect(s.player.hp).toBe(100);
      expect(s.player.stamina).toBe(20);
      expect(s.calendar).toBeDefined();
      expect(s.calendar.currentDay).toBe(1);
      expect(s.currentRun).toBeNull();
      expect(s.settings).toEqual({});
    });
  });

  describe('save / load', () => {
    it('round-trips session through localStorage', () => {
      const s = GameSession.create();
      s.player.gold = 42;
      GameSession.save(s);
      const loaded = GameSession.load();
      expect(loaded.player.gold).toBe(42);
      expect(loaded.calendar.currentDay).toBe(1);
    });

    it('load returns null when no save exists', () => {
      expect(GameSession.load()).toBeNull();
    });

    it('load returns null for corrupt JSON', () => {
      store['ascii_dungeon_save'] = '{broken json!!!';
      expect(GameSession.load()).toBeNull();
    });

    it('load returns null for valid JSON but missing player', () => {
      store['ascii_dungeon_save'] = JSON.stringify({ foo: 1 });
      expect(GameSession.load()).toBeNull();
    });
  });

  describe('hasSave / deleteSave', () => {
    it('hasSave is false initially', () => {
      expect(GameSession.hasSave()).toBe(false);
    });

    it('hasSave is true after save', () => {
      GameSession.save(GameSession.create());
      expect(GameSession.hasSave()).toBe(true);
    });

    it('deleteSave removes the save', () => {
      GameSession.save(GameSession.create());
      GameSession.deleteSave();
      expect(GameSession.hasSave()).toBe(false);
      expect(GameSession.load()).toBeNull();
    });
  });

  describe('startRun', () => {
    it('creates a run on the session', () => {
      const s = GameSession.create();
      const s2 = GameSession.startRun(s);
      expect(s2.currentRun).toBeDefined();
      expect(s2.currentRun.day).toBe(1);
      expect(s2.currentRun.floor).toBe(1);
      expect(s2.currentRun.phase).toBe('dungeon');
    });

    it('does not mutate original session', () => {
      const s = GameSession.create();
      GameSession.startRun(s);
      expect(s.currentRun).toBeNull();
    });
  });

  describe('endRun', () => {
    it('ends run and advances calendar', () => {
      let s = GameSession.create();
      s = GameSession.startRun(s);
      const s2 = GameSession.endRun(s, 'death');
      expect(s2.currentRun).toBeNull();
      expect(s2.calendar.currentDay).toBe(2);
      expect(s2.calendar.runsCompleted).toBe(1);
    });

    it('restores stamina after run', () => {
      let s = GameSession.create();
      s.player.stamina = 3; // depleted
      s = GameSession.startRun(s);
      const s2 = GameSession.endRun(s, 'cleared');
      expect(s2.player.stamina).toBe(s2.player.maxStamina);
    });

    it('returns session unchanged if no current run', () => {
      const s = GameSession.create();
      const s2 = GameSession.endRun(s, 'death');
      expect(s2).toBe(s);
    });
  });
});
