/**
 * RunCompleteScreen — End-of-run summary reusing completionScene's rendering.
 * Torch-lit background, grade slide-in, XP bar animation, loot list fade.
 * Wires real run data from the session's calendar history.
 */

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawModal, drawText, drawProgressBar, drawHLine } from '../../lib/ui.js';
import { createFade, updateFade, createSlide, updateSlide } from '../../lib/ui-anim.js';
import { COLORS } from '../../lib/palette.js';
import { clamp } from '../../lib/easing.js';
import { drawArena } from '../../workbench/helpers/drawArena.js';

const GRADE_COLORS = {
  S: COLORS.treasure, A: COLORS.accentGreen, B: COLORS.accent,
  C: COLORS.fgMuted, D: COLORS.accentAmber, F: COLORS.damage,
};

export const RunCompleteScreen = {
  _sceneTime: 0,
  _gradeSlide: null,
  _xpFade: null,
  _runData: null,
  _torches: null,
  _ready: false,

  enter(ctx) {
    this._sceneTime = 0;
    this._ready = false;

    const { renderer, session } = ctx;
    const W = renderer.gridWidth;
    const H = renderer.gridHeight;
    const centerY = Math.floor(H / 2);

    // Get run summary from last calendar history entry
    const calendar = session.calendar;
    const history = calendar.history;
    const lastRun = history.length > 0 ? history[history.length - 1] : null;

    // Build run data for display
    this._runData = lastRun ? {
      grade: this._estimateGrade(lastRun),
      floor: lastRun.floorsCleared,
      kills: lastRun.enemiesKilled,
      gold: lastRun.totalGold,
      xpEarned: lastRun.totalXp,
      xpBefore: Math.max(0, session.player.xp - lastRun.totalXp),
      xpMax: session.player.xpToNext,
      time: this._formatDuration(lastRun.duration),
      outcome: lastRun.outcome || 'unknown',
      loot: [], // TODO: wire real loot items when available
    } : {
      grade: 'F', floor: 0, kills: 0, gold: 0, xpEarned: 0,
      xpBefore: 0, xpMax: 100, time: '0:00', outcome: 'unknown', loot: [],
    };

    // Animations
    this._gradeSlide = createSlide(0.8, Math.floor(W / 2), -3, Math.floor(W / 2), centerY - 8);
    this._xpFade = createFade(1.0, 0, 1);

    // Torches
    this._torches = [
      { x: 4, y: 4 }, { x: W - 5, y: 4 },
      { x: 4, y: H - 6 }, { x: W - 5, y: H - 6 },
    ];
  },

  exit(_ctx) {
    this._gradeSlide = null;
    this._xpFade = null;
    this._runData = null;
  },

  update(_ctx, dt) {
    this._sceneTime += dt;
    if (this._sceneTime > 2.0) this._ready = true;
  },

  handleInput(ctx, key) {
    if (key === 'Enter' || key === ' ') {
      if (this._ready) {
        ctx.screenManager.transition('town');
      } else {
        // Skip animations
        this._sceneTime = 10;
        this._ready = true;
      }
    }
  },

  render(ctx) {
    const { renderer } = ctx;
    const W = renderer.gridWidth;
    const H = renderer.gridHeight;
    const dt = 0.016;

    renderer.clearGrid();
    renderer.cameraOffsetX = 0;
    renderer.cameraOffsetY = 0;

    // Torch-lit arena background
    drawArena(renderer, W, H, {
      torches: this._torches,
      time: this._sceneTime,
      torchIntensity: 0.3,
      showTorchParticles: false,
    });

    const runData = this._runData;
    if (!runData) { renderer.render(); return; }

    // Modal
    const mw = Math.min(42, W - 8);
    const mh = Math.min(28, H - 4);
    const modal = drawModal(renderer, W, H, mw, mh, {
      title: 'Run Complete',
      fg: COLORS.fgDim,
    });
    const mx = modal.x, my = modal.y;
    const centerX = Math.floor(W / 2);
    const innerW = mw - 4;

    // Outcome text
    const outcomeText = runData.outcome === 'death' ? 'You Died!'
      : runData.outcome === 'cleared' ? 'Dungeon Cleared!'
      : runData.outcome === 'retired' ? 'Stamina Depleted!'
      : 'Run Complete';
    const outcomeColor = runData.outcome === 'cleared' ? COLORS.accentGreen
      : runData.outcome === 'death' ? COLORS.accentRed
      : COLORS.accentAmber;

    drawText(renderer, centerX, my + 1, outcomeText, { fg: outcomeColor, align: 'center' });

    // Grade letter (slides in)
    const gradeResult = updateSlide(this._gradeSlide, dt);
    const gradeColor = GRADE_COLORS[runData.grade] || COLORS.fg;
    const gy = Math.max(my + 2, Math.floor(gradeResult.y));

    drawText(renderer, centerX, gy, runData.grade, { fg: gradeColor, align: 'center' });
    drawText(renderer, centerX, gy + 1, 'GRADE', { fg: COLORS.fgDim, align: 'center' });

    // Stats
    const statsY = my + 5;
    drawText(renderer, mx + 2, statsY, `Floor: ${runData.floor}`, { fg: COLORS.fg });
    drawText(renderer, mx + 2, statsY + 1, `Kills: ${runData.kills}`, { fg: COLORS.damage });
    drawText(renderer, mx + innerW - 10, statsY, `Gold: ${runData.gold}`, { fg: COLORS.treasure });
    drawText(renderer, mx + innerW - 10, statsY + 1, `Time: ${runData.time}`, { fg: COLORS.fgMuted });

    // XP Bar
    const xpResult = updateFade(this._xpFade, dt);
    const xpY = statsY + 3;
    drawHLine(renderer, mx, xpY, innerW + 2);
    drawText(renderer, mx + 2, xpY + 1, 'Experience', { fg: COLORS.xpGold });

    const currentXp = runData.xpBefore + runData.xpEarned * clamp(xpResult.alpha, 0, 1);
    drawProgressBar(renderer, mx + 2, xpY + 2, innerW, currentXp, runData.xpMax, {
      fg: COLORS.xpGold,
    });
    drawText(renderer, mx + 2, xpY + 3, `${Math.floor(currentXp)}/${runData.xpMax} XP`, {
      fg: COLORS.fgMuted,
    });

    // Continue prompt
    const promptY = my + mh - 3;
    if (this._ready && Math.sin(this._sceneTime * 3) > 0) {
      drawText(renderer, centerX, promptY, 'Press Enter to continue', {
        fg: COLORS.fgDim, align: 'center',
      });
    } else if (!this._ready) {
      drawText(renderer, centerX, promptY, 'Press Enter to skip...', {
        fg: COLORS.fgDim, align: 'center',
      });
    }

    renderer.render();
  },

  _estimateGrade(summary) {
    const { floorsCleared, enemiesKilled, totalGold } = summary;
    const score = Math.min(floorsCleared * 10, 40) +
      Math.min(enemiesKilled * 3, 30) +
      Math.min(totalGold * 0.3, 30);
    if (score >= 90) return 'S';
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 45) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  },

  _formatDuration(ms) {
    if (!ms) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  },
};
