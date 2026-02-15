// ── Town Scene ──
// Outdoor town hub with grass, dirt paths, buildings, walking NPCs,
// vendor/inn/stash panels, torch lighting, and ambient glow.
// Uses drawArena for lighting, then paints terrain tiles on top.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawPanel, drawList, drawText, drawTooltip, BOX_DOUBLE, drawHLine } from '../../lib/ui.js';
import { drawArena } from '../helpers/drawArena.js';
import { COLORS } from '../../lib/palette.js';

export const gridWidth = 80;
export const gridHeight = 45;

// Tile types
const VOID = 0, WALL = 1, INTERIOR = 2, GRASS = 3, PATH = 4;

// Tile rendering colors
const TILE_COLORS = {
  [GRASS]:    { fg: COLORS.hpHigh, bg: '#4e584a', chars: [',', '.', '`', '\''] },
  [PATH]:     { fg: COLORS.bgAccent, bg: '#80493a', chars: ['.', ' ', '.', ' '] },
  [INTERIOR]: { fg: COLORS.floorFg, bg: COLORS.floorBg, chars: [' '] },
};

let sceneTime = 0;
let townMap = null;
let buildings = null;
let torches = null;
let npcs = null;
let lastW = 0, lastH = 0;

const vendorItems = [
  { label: 'Iron Sword      12g' },
  { label: 'Leather Armor    8g' },
  { label: 'Health Potion    3g' },
  { label: 'Torch Bundle     2g' },
  { label: 'Map Fragment     5g' },
  { label: 'Lucky Charm     15g' },
];

/** Build town layout relative to grid dimensions */
function buildTown(W, H) {
  const map = [];
  for (let y = 0; y < H; y++) {
    map[y] = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      // Outer border = wall, everything else = grass
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
        map[y][x] = WALL;
      } else {
        map[y][x] = GRASS;
      }
    }
  }

  // Building definitions (proportional to grid)
  const leftCol = 3;
  const rightCol = Math.floor(W * 0.58);
  const bw = Math.min(14, Math.floor(W * 0.18));

  const blds = [
    { x: leftCol, y: 3, w: bw, h: 7, label: 'Vendor', fg: COLORS.accentAmber, icon: '$' },
    { x: leftCol, y: 14, w: bw, h: 7, label: 'Inn', fg: COLORS.accentGreen, icon: 'z' },
    { x: leftCol, y: 25, w: bw, h: 7, label: 'Stash', fg: COLORS.accent, icon: '=' },
    { x: rightCol, y: 3, w: bw, h: 10, label: 'Guild Hall', fg: COLORS.arcane, icon: '&' },
    { x: rightCol, y: 18, w: bw, h: 10, label: 'Blacksmith', fg: COLORS.damage, icon: '/' },
  ];

  // Stamp buildings
  for (const b of blds) {
    for (let y = b.y; y < Math.min(b.y + b.h, H); y++) {
      for (let x = b.x; x < Math.min(b.x + b.w, W); x++) {
        if (x === b.x || x === b.x + b.w - 1 || y === b.y || y === b.y + b.h - 1) {
          map[y][x] = WALL;
        } else {
          map[y][x] = INTERIOR;
        }
      }
    }
    // Door
    const doorX = b.x + Math.floor(b.w / 2);
    const doorY = b.y + b.h - 1;
    if (doorY < H) map[doorY][doorX] = INTERIOR;
  }

  // Main road (vertical path through center)
  const roadX1 = leftCol + bw + 2;
  const roadX2 = rightCol - 3;
  const roadCenterX = Math.floor((roadX1 + roadX2) / 2);
  for (let y = 1; y < H - 1; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = roadCenterX + dx;
      if (px > 0 && px < W - 1) map[y][px] = PATH;
    }
  }

  // Cross paths to buildings
  for (const b of blds) {
    const doorY = b.y + b.h - 1;
    const doorX = b.x + Math.floor(b.w / 2);
    const startX = Math.min(doorX, roadCenterX);
    const endX = Math.max(doorX, roadCenterX);
    for (let x = startX; x <= endX; x++) {
      if (doorY < H && x > 0 && x < W - 1 && map[doorY][x] !== WALL) {
        map[doorY][x] = PATH;
      }
    }
  }

  // Town square (open area in center)
  const sqX = roadCenterX - 4;
  const sqY = Math.floor(H * 0.4);
  const sqW = 9, sqH = 5;
  for (let y = sqY; y < sqY + sqH && y < H - 1; y++) {
    for (let x = sqX; x < sqX + sqW && x < W - 1; x++) {
      if (x > 0) map[y][x] = PATH;
    }
  }

  // Torch positions (on buildings + along road)
  const trchs = [];
  for (const b of blds) {
    trchs.push({ x: b.x, y: b.y });
    trchs.push({ x: b.x + b.w - 1, y: b.y });
  }
  // Road torches
  for (let y = 4; y < H - 3; y += 8) {
    trchs.push({ x: roadCenterX - 2, y });
    trchs.push({ x: roadCenterX + 2, y });
  }

  // NPCs with patrol paths
  const npcList = [
    {
      x: roadCenterX, y: 8, char: 'V', fg: COLORS.accentAmber,
      name: 'Vendor', lines: ['Buy or sell?', 'Fine wares!', 'Best prices in town!'],
      patrolX1: roadCenterX - 3, patrolX2: roadCenterX + 3, speed: 1.2, dir: 1,
    },
    {
      x: roadCenterX, y: 18, char: 'I', fg: COLORS.accentGreen,
      name: 'Innkeeper', lines: ['Rest here.', '5 gold/night.', 'Warm beds!'],
      patrolX1: roadCenterX - 2, patrolX2: roadCenterX + 2, speed: 0.8, dir: -1,
    },
    {
      x: roadCenterX - 3, y: sqY + 2, char: 'G', fg: COLORS.fgMuted,
      name: 'Guard', lines: ['Stay safe.', 'Watch out for goblins.'],
      patrolX1: sqX, patrolX2: sqX + sqW - 1, speed: 1.5, dir: 1,
    },
    {
      x: roadCenterX + 3, y: sqY + 2, char: 'M', fg: COLORS.accent,
      name: 'Merchant', lines: ['Rare goods!', 'Just arrived from the capital.'],
      patrolX1: sqX + 1, patrolX2: sqX + sqW - 2, speed: 0.6, dir: -1,
    },
    {
      x: roadCenterX, y: H - 6, char: 'B', fg: COLORS.damage,
      name: 'Blacksmith', lines: ['Need repairs?', 'Finest steel.', 'I can upgrade that.'],
      patrolX1: roadCenterX - 4, patrolX2: roadCenterX + 4, speed: 1.0, dir: 1,
    },
    {
      x: roadCenterX - 1, y: 28, char: 'W', fg: COLORS.arcane,
      name: 'Witch', lines: ['I see your future...', 'Potions for sale.', 'Dark magic...'],
      patrolX1: roadCenterX - 3, patrolX2: roadCenterX + 3, speed: 0.5, dir: -1,
    },
  ];

  return { map, buildings: blds, torches: trchs, npcs: npcList, roadCenterX, sqX, sqY, sqW, sqH };
}

export function onSetup(renderer) {
  sceneTime = 0;
  lastW = 0;
  lastH = 0;
  townMap = null;
}

export function onFrame(renderer, dt) {
  sceneTime += dt;

  const W = renderer.gridWidth;
  const H = renderer.gridHeight;

  // Rebuild town layout if grid dimensions changed
  if (W !== lastW || H !== lastH) {
    const town = buildTown(W, H);
    townMap = town.map;
    buildings = town.buildings;
    torches = town.torches;
    npcs = town.npcs;
    lastW = W;
    lastH = H;
  }

  renderer.clearGrid();
  renderer.cameraOffsetX = 0;
  renderer.cameraOffsetY = 0;

  // drawArena handles lighting — use HIGH ambient for outdoor scene
  drawArena(renderer, W, H, {
    tileAt: (x, y) => {
      const t = townMap[y] ? townMap[y][x] || 0 : 0;
      // drawArena treats 1=wall, >=2=floor
      return t;
    },
    torches,
    time: sceneTime,
    torchIntensity: 1.2,
    ambient: [0.35, 0.32, 0.25], // bright outdoor ambient
    showTorchParticles: true,
  });

  // ── Paint custom terrain tiles over drawArena's floor ──
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const tile = townMap[y][x];
      const tileStyle = TILE_COLORS[tile];
      if (!tileStyle) continue;

      const charIdx = ((x * 7 + y * 13) & 0xFFFF) % tileStyle.chars.length;
      const char = tileStyle.chars[charIdx];
      renderer.setCell(x, y, char, tileStyle.fg, tileStyle.bg, 0,
        CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED, 1.0, 0, 0, LAYERS.TERRAIN);
    }
  }

  // Building labels + icons
  for (const b of buildings) {
    const labelX = b.x + Math.floor((b.w - b.label.length) / 2);
    drawText(renderer, labelX, b.y, b.label, { fg: b.fg });
    // Building icon above door
    const iconX = b.x + Math.floor(b.w / 2);
    const iconY = b.y + b.h - 2;
    renderer.setCell(iconX, iconY, b.icon, b.fg, COLORS.floorBg, 0,
      CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.OBJECTS);
  }

  // ── Animate and draw NPCs ──
  for (const npc of npcs) {
    // Simple patrol: walk back and forth
    npc.x += npc.dir * npc.speed * dt;
    if (npc.x >= npc.patrolX2) { npc.x = npc.patrolX2; npc.dir = -1; }
    if (npc.x <= npc.patrolX1) { npc.x = npc.patrolX1; npc.dir = 1; }

    const drawX = Math.round(npc.x);
    const drawY = npc.y;
    if (drawX >= 0 && drawX < W && drawY >= 0 && drawY < H) {
      const bobY = Math.sin(sceneTime * 2 + npc.x * 0.5) * 0.08;
      renderer.setCell(drawX, drawY, npc.char, npc.fg, '#4e584a', 0,
        CELL_FLAGS.VISIBLE, 1.0, npc.x - drawX, bobY, LAYERS.OBJECTS);
    }
  }

  // ── UI Panels (right side) ──
  const panelX = Math.floor(W * 0.28);
  const panelW = Math.min(24, W - panelX - 2);

  // Vendor panel
  drawPanel(renderer, panelX, 1, panelW, 10, {
    title: ' Vendor ',
    chars: BOX_DOUBLE,
  });
  drawList(renderer, panelX + 1, 2, panelW - 2, 8, vendorItems, {
    selected: Math.floor(sceneTime * 0.5) % vendorItems.length,
  });

  // Inn panel
  drawPanel(renderer, panelX, 12, panelW, 8, {
    title: ' Inn ',
  });
  drawText(renderer, panelX + 2, 13, 'Rest & recover HP', { fg: COLORS.fgMuted });
  drawHLine(renderer, panelX + 1, 15, panelW - 2);
  drawText(renderer, panelX + 2, 16, 'Cost: 5 gold', { fg: COLORS.accentAmber });
  drawText(renderer, panelX + 2, 17, 'HP restored: 100%', { fg: COLORS.accentGreen });
  drawText(renderer, panelX + 2, 18, 'Status: Rested', { fg: COLORS.accent });

  // Stash panel
  drawPanel(renderer, panelX, 21, panelW, 9, {
    title: ' Stash (5/20) ',
  });
  const stashItems = [
    { label: '[S] Iron Sword +1', fg: COLORS.fgMuted },
    { label: '[A] Leather Armor', fg: COLORS.defense },
    { label: '[P] Potion x3', fg: COLORS.heal },
    { label: '[R] Fire Rune', fg: COLORS.damage },
    { label: '[ ] Empty', fg: COLORS.fgDim },
    { label: '[ ] Empty', fg: COLORS.fgDim },
  ];
  for (let i = 0; i < stashItems.length; i++) {
    drawText(renderer, panelX + 2, 22 + i, stashItems[i].label, { fg: stashItems[i].fg });
  }

  // Tooltip for active NPC
  const activeNpc = npcs[Math.floor(sceneTime * 0.3) % npcs.length];
  const lineIdx = Math.floor(sceneTime) % activeNpc.lines.length;
  const ttX = Math.round(activeNpc.x);
  drawTooltip(renderer, ttX, activeNpc.y, [activeNpc.name, activeNpc.lines[lineIdx]], W, H, {
    borderFg: activeNpc.fg,
  });

  renderer.render();
}
