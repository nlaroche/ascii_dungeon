// ── Character Scene ──
// Character sheet with stat bars, equipment slots, inventory grid, and tooltips.
// Uses drawArena for ambient torch lighting.
// Adapts to dynamic grid dimensions from renderer.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawPanel, drawText, drawProgressBar, drawBox, drawTooltip, drawHLine, BOX_DOUBLE } from '../../lib/ui.js';
import { COLORS } from '../../lib/palette.js';
import { drawArena } from '../helpers/drawArena.js';

export const gridWidth = 80;
export const gridHeight = 45;

const stats = {
  name: 'Adventurer',
  level: 7,
  hp: 85, maxHp: 120,
  mp: 30, maxMp: 50,
  xp: 340, maxXp: 500,
  attack: 18, defense: 12, speed: 14,
};

const equipment = [
  { slot: 'Weapon', name: 'Iron Sword', char: '/', fg: COLORS.fgMuted },
  { slot: 'Armor', name: 'Chain Mail', char: '[', fg: COLORS.defense },
  { slot: 'Shield', name: 'Buckler', char: ')', fg: COLORS.defense },
  { slot: 'Ring', name: 'Ring of Luck', char: '=', fg: COLORS.fortune },
  { slot: 'Amulet', name: 'Fire Amulet', char: '"', fg: COLORS.damage },
  { slot: 'Boots', name: 'Swift Boots', char: '%', fg: COLORS.exploration },
];

const inventory = [
  { char: '!', fg: COLORS.heal, name: 'Health Potion', desc: 'Restore 50 HP' },
  { char: '!', fg: COLORS.accent, name: 'Mana Potion', desc: 'Restore 25 MP' },
  { char: '?', fg: COLORS.treasure, name: 'Scroll of Fire', desc: 'Deal 30 fire dmg' },
  { char: '*', fg: COLORS.torch, name: 'Torch', desc: 'Light radius +3' },
  { char: '$', fg: COLORS.treasure, name: 'Gold Coin x42', desc: '42 gold pieces' },
  { char: '&', fg: COLORS.arcane, name: 'Rune Stone', desc: 'Unknown power' },
  { char: '%', fg: COLORS.hpHigh, name: 'Bread', desc: 'Restore 10 HP' },
  { char: '/', fg: COLORS.fgDim, name: 'Rusty Dagger', desc: '+5 Attack' },
  null, null, null, null,
  null, null, null, null,
];

let sceneTime = 0;

export function onSetup(renderer) {
  sceneTime = 0;
}

export function onFrame(renderer, dt) {
  sceneTime += dt;

  const W = renderer.gridWidth;
  const H = renderer.gridHeight;

  renderer.clearGrid();
  renderer.cameraOffsetX = 0;
  renderer.cameraOffsetY = 0;

  // Ambient torches in corners, relative to grid size
  const charTorches = [
    { x: 4, y: 4 }, { x: W - 5, y: 4 },
    { x: 4, y: H - 6 }, { x: W - 5, y: H - 6 },
  ];

  // Torch-lit arena background
  drawArena(renderer, W, H, {
    torches: charTorches,
    time: sceneTime,
    torchIntensity: 0.3,
    showTorchParticles: false,
  });

  // Layout: 3 panels across the top, inventory below
  const margin = 2;
  const gap = 2;
  const usableW = W - margin * 2;

  // Panel widths: character (30%), equipment (35%), stats (25%)
  const charPanelW = Math.floor(usableW * 0.30);
  const equipPanelW = Math.floor(usableW * 0.35);
  const statsPanelW = usableW - charPanelW - equipPanelW - gap * 2;

  const panelH = Math.min(18, Math.floor(H * 0.45));
  const x1 = margin;
  const x2 = x1 + charPanelW + gap;
  const x3 = x2 + equipPanelW + gap;

  // ── Character Panel (left) ──
  drawPanel(renderer, x1, 2, charPanelW, panelH, { title: stats.name, fg: COLORS.borderAccent, chars: BOX_DOUBLE });

  // Player @ glyph
  const playerPulse = Math.sin(sceneTime * 2) * 0.15 + 0.85;
  const playerX = x1 + Math.floor(charPanelW / 2);
  renderer.setCell(playerX, 4, '@', COLORS.player, COLORS.bg, 0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, playerPulse, 0, 0, LAYERS.OBJECTS, 2.0, 2.0);

  drawText(renderer, x1 + 2, 7, `Level ${stats.level}`, { fg: COLORS.accent });

  // Stat bars
  const barW = charPanelW - 8;
  drawText(renderer, x1 + 2, 9, 'HP', { fg: COLORS.hpHigh });
  drawProgressBar(renderer, x1 + 5, 9, barW, stats.hp, stats.maxHp, { fg: COLORS.hpHigh });
  drawText(renderer, x1 + charPanelW - 4, 9, `${stats.hp}`, { fg: COLORS.fgMuted });

  drawText(renderer, x1 + 2, 11, 'MP', { fg: COLORS.accent });
  drawProgressBar(renderer, x1 + 5, 11, barW, stats.mp, stats.maxMp, { fg: COLORS.accent });
  drawText(renderer, x1 + charPanelW - 4, 11, `${stats.mp}`, { fg: COLORS.fgMuted });

  drawText(renderer, x1 + 2, 13, 'XP', { fg: COLORS.xpGold });
  drawProgressBar(renderer, x1 + 5, 13, barW, stats.xp, stats.maxXp, { fg: COLORS.xpGold });

  drawHLine(renderer, x1 + 1, 15, charPanelW - 2);
  drawText(renderer, x1 + 2, 16, `ATK ${stats.attack}`, { fg: COLORS.damage });
  drawText(renderer, x1 + Math.floor(charPanelW / 2), 16, `DEF ${stats.defense}`, { fg: COLORS.defense });

  // ── Equipment Panel (middle) ──
  drawPanel(renderer, x2, 2, equipPanelW, panelH, { title: 'Equipment', fg: COLORS.fgDim });

  for (let i = 0; i < equipment.length; i++) {
    const eq = equipment[i];
    const ey = 4 + i * 2;
    if (ey >= 2 + panelH - 1) break;
    renderer.setCell(x2 + 1, ey, eq.char, eq.fg, COLORS.bg, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.OBJECTS);
    drawText(renderer, x2 + 3, ey, eq.name, { fg: COLORS.fg });
  }

  // ── Stats Summary (right) ──
  drawPanel(renderer, x3, 2, statsPanelW, panelH, { title: 'Stats', fg: COLORS.fgDim });

  const summaryLines = [
    { label: 'DPS', value: '12.4', fg: COLORS.damage },
    { label: 'Armor', value: '24', fg: COLORS.defense },
    { label: 'Dodge', value: '8%', fg: COLORS.exploration },
    { label: 'Crit', value: '15%', fg: COLORS.fortune },
    { label: 'Gold', value: '42', fg: COLORS.treasure },
  ];

  for (let i = 0; i < summaryLines.length; i++) {
    const s = summaryLines[i];
    const sy = 4 + i * 2;
    if (sy >= 2 + panelH - 1) break;
    drawText(renderer, x3 + 2, sy, s.label, { fg: COLORS.fgDim });
    drawText(renderer, x3 + statsPanelW - 6, sy, s.value, { fg: s.fg });
  }

  // ── Inventory Grid ──
  const invY = 2 + panelH + 1;
  const invH = H - invY - 2;
  const invPanelW = W - margin * 2;
  drawPanel(renderer, margin, invY, invPanelW, invH, { title: 'Inventory', fg: COLORS.fgDim });

  const invCols = 8;
  const invStartX = margin + 2;
  const invStartY = invY + 2;
  const cellW = Math.max(5, Math.floor((invPanelW - 4) / invCols));
  const cellH = 3;

  for (let i = 0; i < inventory.length; i++) {
    const col = i % invCols;
    const row = Math.floor(i / invCols);
    const cx = invStartX + col * cellW;
    const cy = invStartY + row * (cellH + 1);
    if (cy + cellH > invY + invH) break;
    drawBox(renderer, cx, cy, cellW, cellH, { fg: COLORS.borderMuted });
    const item = inventory[i];
    if (item) {
      renderer.setCell(cx + Math.floor(cellW / 2), cy + 1, item.char, item.fg, COLORS.bg, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.OBJECTS);
    }
  }

  // Tooltip cycling
  const hoveredIdx = Math.floor(sceneTime * 0.7) % inventory.length;
  const hoveredItem = inventory[hoveredIdx];
  if (hoveredItem) {
    const col = hoveredIdx % invCols;
    const row = Math.floor(hoveredIdx / invCols);
    const tx = invStartX + col * cellW + cellW;
    const ty = invStartY + row * (cellH + 1);
    drawTooltip(renderer, tx, ty, [hoveredItem.name, hoveredItem.desc], W, H, {
      borderFg: hoveredItem.fg,
    });
  }

  renderer.render();
}
