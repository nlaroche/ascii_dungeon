// ── Completion Scene ──
// Run summary with grade letter, XP bar animating up, and loot list fading in.
// Uses drawArena for ambient torch lighting.
// Adapts to dynamic grid dimensions from renderer.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawModal, drawText, drawProgressBar, drawHLine } from '../../lib/ui.js';
import { createFade, updateFade, createSlide, updateSlide } from '../../lib/ui-anim.js';
import { COLORS } from '../../lib/palette.js';
import { clamp } from '../../lib/easing.js';
import { drawArena } from '../helpers/drawArena.js';

export const gridWidth = 80;
export const gridHeight = 45;

const runData = {
  grade: 'A',
  floor: 5,
  kills: 23,
  gold: 187,
  xpEarned: 340,
  xpBefore: 160,
  xpMax: 500,
  time: '12:34',
  loot: [
    { name: 'Iron Sword +1', fg: COLORS.fgMuted },
    { name: 'Fire Rune', fg: COLORS.damage },
    { name: 'Lucky Charm', fg: COLORS.fortune },
    { name: 'Health Potion x3', fg: COLORS.heal },
  ],
};

const GRADE_COLORS = {
  S: COLORS.treasure, A: COLORS.accentGreen, B: COLORS.accent,
  C: COLORS.fgMuted, D: COLORS.accentAmber, F: COLORS.damage,
};

let sceneTime = 0;
let gradeSlide = null;
let xpFade = null;
let lootFades = [];

export function onSetup(renderer) {
  sceneTime = 0;
  const W = renderer.gridWidth;
  const H = renderer.gridHeight;
  const centerY = Math.floor(H / 2);
  gradeSlide = createSlide(0.8, Math.floor(W / 2), -3, Math.floor(W / 2), centerY - 8);
  xpFade = createFade(1.0, 0, 1);
  lootFades = runData.loot.map((_, i) => createFade(0.5 + i * 0.2, 0, 1));
}

export function onFrame(renderer, dt) {
  sceneTime += dt;

  const W = renderer.gridWidth;
  const H = renderer.gridHeight;

  renderer.clearGrid();
  renderer.cameraOffsetX = 0;
  renderer.cameraOffsetY = 0;

  // Torch-lit arena background
  const completionTorches = [
    { x: 4, y: 4 }, { x: W - 5, y: 4 },
    { x: 4, y: H - 6 }, { x: W - 5, y: H - 6 },
  ];

  drawArena(renderer, W, H, {
    torches: completionTorches,
    time: sceneTime,
    torchIntensity: 0.3,
    showTorchParticles: false,
  });

  // Modal - sized relative to grid
  const mw = Math.min(42, W - 8);
  const mh = Math.min(28, H - 4);
  const modal = drawModal(renderer, W, H, mw, mh, {
    title: 'Run Complete',
    fg: COLORS.fgDim,
  });
  const mx = modal.x, my = modal.y;
  const centerX = Math.floor(W / 2);
  const innerW = mw - 4;

  // Grade letter
  const gradeResult = updateSlide(gradeSlide, dt);
  const gradeColor = GRADE_COLORS[runData.grade] || COLORS.fg;
  const gy = Math.max(my + 1, Math.floor(gradeResult.y));

  drawText(renderer, centerX, gy, runData.grade, { fg: gradeColor, align: 'center' });
  drawText(renderer, centerX, gy + 1, 'GRADE', { fg: COLORS.fgDim, align: 'center' });

  // Stats
  const statsY = my + 4;
  drawText(renderer, mx + 2, statsY, `Floor: ${runData.floor}`, { fg: COLORS.fg });
  drawText(renderer, mx + 2, statsY + 1, `Kills: ${runData.kills}`, { fg: COLORS.damage });
  drawText(renderer, mx + innerW - 10, statsY, `Gold: ${runData.gold}`, { fg: COLORS.treasure });
  drawText(renderer, mx + innerW - 10, statsY + 1, `Time: ${runData.time}`, { fg: COLORS.fgMuted });

  // XP Bar
  const xpResult = updateFade(xpFade, dt);
  const xpY = statsY + 3;
  drawHLine(renderer, mx, xpY, innerW);
  drawText(renderer, mx + 2, xpY + 1, 'Experience', { fg: COLORS.xpGold });

  const currentXp = runData.xpBefore + runData.xpEarned * clamp(xpResult.alpha, 0, 1);
  drawProgressBar(renderer, mx + 2, xpY + 2, innerW, currentXp, runData.xpMax, {
    fg: COLORS.xpGold,
  });
  drawText(renderer, mx + 2, xpY + 3, `${Math.floor(currentXp)}/${runData.xpMax} XP`, {
    fg: COLORS.fgMuted,
  });

  // Loot
  const lootY = xpY + 5;
  drawHLine(renderer, mx, lootY, innerW);
  drawText(renderer, mx + 2, lootY + 1, 'Loot Found', { fg: COLORS.accent });

  for (let i = 0; i < runData.loot.length; i++) {
    const fadeResult = updateFade(lootFades[i], dt);
    if (fadeResult.alpha < 0.05) continue;
    const item = runData.loot[i];
    drawText(renderer, mx + 4, lootY + 2 + i, `- ${item.name}`, { fg: item.fg });
  }

  // Continue prompt
  const promptY = my + mh - 3;
  if (Math.sin(sceneTime * 3) > 0) {
    drawText(renderer, centerX, promptY, 'Press any key to continue', {
      fg: COLORS.fgDim, align: 'center',
    });
  }

  renderer.render();
}
