// ── Intro Scene ──
// Title screen with torch-lit arena, title text, and menu buttons.
// Uses drawArena for proper torch lighting system.
// Adapts to dynamic grid dimensions from renderer.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawText, drawButton, drawPanel, drawHLine } from '../../lib/ui.js';
import { createTypewriter, updateTypewriter, createPulse, updatePulse } from '../../lib/ui-anim.js';
import { COLORS } from '../../lib/palette.js';
import { drawArena } from '../helpers/drawArena.js';

export const gridWidth = 80;
export const gridHeight = 45;

const SUBTITLE = 'A Roguelike Adventure';

const menuItems = [
  { label: '  New Run  ', fg: COLORS.accentGreen },
  { label: ' Continue  ', fg: COLORS.accent },
  { label: ' Settings  ', fg: COLORS.fgMuted },
];

let sceneTime = 0;
let subtitleTypewriter = null;
let menuPulse = null;
let selectedMenu = 0;

export function onSetup(renderer) {
  sceneTime = 0;
  subtitleTypewriter = createTypewriter(SUBTITLE, 20);
  menuPulse = createPulse(1.2, 1);
  selectedMenu = 0;
}

export function onFrame(renderer, dt) {
  sceneTime += dt;

  // Read actual grid dimensions from the renderer
  const W = renderer.gridWidth;
  const H = renderer.gridHeight;

  renderer.clearGrid();
  renderer.cameraOffsetX = 0;
  renderer.cameraOffsetY = 0;

  // Build torch positions relative to grid dimensions
  const torches = buildTorches(W, H);

  // Use drawArena for proper torch lighting (arena mode = no tileAt)
  drawArena(renderer, W, H, {
    torches,
    time: sceneTime,
    torchIntensity: 0.6,
    showTorchParticles: true,
  });

  const centerX = Math.floor(W / 2);
  const centerY = Math.floor(H / 2);

  // ── Title ──
  const titleY = Math.floor(H * 0.18);
  drawText(renderer, centerX, titleY, 'ASCII DUNGEON', {
    fg: COLORS.accent, align: 'center',
  });

  // Decorative lines around title
  drawHLine(renderer, centerX - 12, titleY - 1, 24, { fg: COLORS.borderAccent, char: '=' });
  drawHLine(renderer, centerX - 12, titleY + 1, 24, { fg: COLORS.borderAccent, char: '=' });

  // ── Subtitle ──
  if (sceneTime > 0.5) {
    const subResult = updateTypewriter(subtitleTypewriter, dt);
    drawText(renderer, centerX, titleY + 3, subResult.visibleText, {
      fg: COLORS.fgMuted, align: 'center',
    });
  }

  // ── Menu ──
  if (sceneTime > 1.5) {
    const pulseResult = updatePulse(menuPulse, dt);
    selectedMenu = Math.floor(sceneTime * 0.4) % menuItems.length;

    const menuY = titleY + 7;
    const menuX = centerX - 9;

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      const isSel = i === selectedMenu;
      drawButton(renderer, menuX + 2, menuY + i * 2, item.label, {
        focused: isSel,
        fg: item.fg,
        focusedFg: COLORS.bg,
        focusedBg: item.fg,
      });

      if (isSel) {
        const arrowAlpha = 0.6 + pulseResult.value * 0.4;
        renderer.setCell(menuX, menuY + i * 2, '>', COLORS.accent, COLORS.bg, 0, CELL_FLAGS.VISIBLE, arrowAlpha, 0, 0, LAYERS.EFFECTS);
      }
    }
  }

  // ── Footer ──
  drawText(renderer, centerX, H - 3, 'v0.1 - WebGPU ASCII Engine', {
    fg: COLORS.fgDim, align: 'center',
  });

  renderer.render();
}

/** Build torch positions relative to grid size */
function buildTorches(W, H) {
  const mx = Math.floor(W * 0.15);  // margin from edge
  const rx = W - mx - 1;
  return [
    { x: mx, y: 4 }, { x: rx, y: 4 },
    { x: mx, y: Math.floor(H * 0.4) }, { x: rx, y: Math.floor(H * 0.4) },
    { x: mx, y: Math.floor(H * 0.7) }, { x: rx, y: Math.floor(H * 0.7) },
    { x: Math.floor(W * 0.3), y: 4 }, { x: Math.floor(W * 0.6), y: 4 },
  ];
}
