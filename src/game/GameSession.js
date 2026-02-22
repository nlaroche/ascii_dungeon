/**
 * GameSession — Centralized data store for cross-screen state + localStorage persistence.
 * Pure JS module, no renderer dependency.
 *
 * @example
 * const session = GameSession.create();
 * GameSession.save(session);
 * const loaded = GameSession.load();
 */

import { createPlayer } from '../lib/player.js';
import { createCalendar, createRun, endRun, getRunSummary, recordRun, restoreStamina } from '../lib/run.js';
import { createTown, refreshVendor } from '../lib/town.js';

const SAVE_KEY = 'ascii_dungeon_save';

export const GameSession = {
  /**
   * Create a fresh session with new player + calendar.
   * @returns {object} Session state
   */
  create() {
    const player = createPlayer();
    const town = refreshVendor(createTown(), player.level, 1);
    return {
      player,
      calendar: createCalendar(),
      town,
      currentRun: null,
      settings: {},
    };
  },

  /**
   * Save session to localStorage.
   * @param {object} session
   */
  save(session) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(session));
    } catch (_) {
      // Storage full or unavailable — silently fail
    }
  },

  /**
   * Load session from localStorage.
   * @returns {object|null} Session or null if missing/corrupt
   */
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Basic shape validation
      if (!parsed || !parsed.player || !parsed.calendar) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  },

  /**
   * Check if a save exists.
   * @returns {boolean}
   */
  hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (_) {
      return false;
    }
  },

  /**
   * Delete saved session.
   */
  deleteSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_) {
      // Silently fail
    }
  },

  /**
   * Start a new dungeon run. Returns updated session with currentRun set.
   * @param {object} session
   * @param {object} [config] Run config overrides
   * @returns {object} Updated session
   */
  startRun(session, config = {}) {
    const run = createRun(session.calendar.currentDay, session.player, config);
    return {
      ...session,
      currentRun: run,
    };
  },

  /**
   * End the current run. Records to calendar, restores stamina, clears currentRun.
   * @param {object} session
   * @param {string} reason - 'death'|'cleared'|'retired'
   * @returns {object} Updated session
   */
  endRun(session, reason) {
    if (!session.currentRun) return session;

    const finishedRun = endRun(session.currentRun, reason);
    const summary = getRunSummary(finishedRun);
    const updatedCalendar = recordRun(session.calendar, summary);
    const restoredPlayer = restoreStamina(session.player, session.player.maxStamina);

    return {
      ...session,
      player: restoredPlayer,
      calendar: updatedCalendar,
      currentRun: null,
    };
  },
};
