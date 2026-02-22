/**
 * TownScreen — Full-grid town hub reusing townScene's rendering.
 * Procedural buildings, walking NPCs, torch lighting, mouse hover/click.
 * Click buildings to open modal overlay (TownModal.svelte rendered by App.svelte).
 * Click dungeon entrance to start a run.
 */

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { drawText } from '../../lib/ui.js';
import { COLORS } from '../../lib/palette.js';
import { drawArena } from '../../workbench/helpers/drawArena.js';
import { GameSession } from '../GameSession.js';
import { refreshVendor } from '../../lib/town.js';

// ── Town Map Builder (same as townScene.js) ──

const VOID = 0, WALL = 1, INTERIOR = 2, GRASS = 3, PATH = 4;

const TILE_COLORS = {
  [GRASS]:    { fg: COLORS.hpHigh, bg: '#4e584a', chars: [',', '.', '`', '\''] },
  [PATH]:     { fg: COLORS.bgAccent, bg: '#80493a', chars: ['.', ' ', '.', ' '] },
  [INTERIOR]: { fg: COLORS.floorFg, bg: COLORS.floorBg, chars: [' '] },
};

function buildTown(W, H) {
  const map = [];
  for (let y = 0; y < H; y++) {
    map[y] = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      map[y][x] = (x === 0 || x === W - 1 || y === 0 || y === H - 1) ? WALL : GRASS;
    }
  }

  const leftCol = 3;
  const rightCol = Math.floor(W * 0.58);
  const bw = Math.min(14, Math.floor(W * 0.18));

  const blds = [
    { x: leftCol, y: 3, w: bw, h: 7, label: 'Vendor', fg: COLORS.accentAmber, icon: '$', action: 'vendor' },
    { x: leftCol, y: 14, w: bw, h: 7, label: 'Inn', fg: COLORS.accentGreen, icon: 'z', action: 'inn' },
    { x: leftCol, y: 25, w: bw, h: 7, label: 'Stash', fg: COLORS.accent, icon: '=', action: 'stash' },
    { x: rightCol, y: 3, w: bw, h: 10, label: 'Guild Hall', fg: COLORS.arcane, icon: '&', action: 'guild' },
    { x: rightCol, y: 18, w: bw, h: 10, label: 'Blacksmith', fg: COLORS.damage, icon: '/', action: 'blacksmith' },
  ];

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
    const doorX = b.x + Math.floor(b.w / 2);
    const doorY = b.y + b.h - 1;
    if (doorY < H) map[doorY][doorX] = INTERIOR;
  }

  // Main road
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

  // Town square
  const sqX = roadCenterX - 4;
  const sqY = Math.floor(H * 0.4);
  const sqW = 9, sqH = 5;
  for (let y = sqY; y < sqY + sqH && y < H - 1; y++) {
    for (let x = sqX; x < sqX + sqW && x < W - 1; x++) {
      if (x > 0) map[y][x] = PATH;
    }
  }

  // Torches
  const torches = [];
  for (const b of blds) {
    torches.push({ x: b.x, y: b.y });
    torches.push({ x: b.x + b.w - 1, y: b.y });
  }
  for (let y = 4; y < H - 3; y += 8) {
    torches.push({ x: roadCenterX - 2, y });
    torches.push({ x: roadCenterX + 2, y });
  }

  // NPCs
  const npcList = [
    { x: roadCenterX, y: 8, char: 'V', fg: COLORS.accentAmber, name: 'Vendor',
      patrolX1: roadCenterX - 3, patrolX2: roadCenterX + 3, speed: 1.2, dir: 1 },
    { x: roadCenterX, y: 18, char: 'I', fg: COLORS.accentGreen, name: 'Innkeeper',
      patrolX1: roadCenterX - 2, patrolX2: roadCenterX + 2, speed: 0.8, dir: -1 },
    { x: roadCenterX - 3, y: sqY + 2, char: 'G', fg: COLORS.fgMuted, name: 'Guard',
      patrolX1: sqX, patrolX2: sqX + sqW - 1, speed: 1.5, dir: 1 },
    { x: roadCenterX + 3, y: sqY + 2, char: 'M', fg: COLORS.accent, name: 'Merchant',
      patrolX1: sqX + 1, patrolX2: sqX + sqW - 2, speed: 0.6, dir: -1 },
    { x: roadCenterX, y: H - 6, char: 'B', fg: COLORS.damage, name: 'Blacksmith',
      patrolX1: roadCenterX - 4, patrolX2: roadCenterX + 4, speed: 1.0, dir: 1 },
  ];

  return { map, buildings: blds, torches, npcs: npcList, roadCenterX };
}

// ── Dungeon entrance region ──
function getDungeonEntrance(W, H, roadCenterX) {
  return { x: roadCenterX - 3, y: 1, w: 7, h: 2 };
}

export const TownScreen = {
  _sceneTime: 0,
  _townMap: null,
  _buildings: null,
  _torches: null,
  _npcs: null,
  _roadCenterX: 0,
  _lastW: 0,
  _lastH: 0,
  _hoveredBuilding: null,
  _openBuilding: null,  // building object for TownModal overlay (set by click, read by App.svelte)
  _message: '',
  _messageTimer: 0,

  enter(ctx) {
    this._sceneTime = 0;
    this._openBuilding = null;
    this._hoveredBuilding = null;
    this._message = '';
    this._messageTimer = 0;
    this._lastW = 0;
    this._lastH = 0;

    // Auto-save on town entry
    if (ctx.session) {
      if (ctx.session.town) {
        const session = {
          ...ctx.session,
          town: refreshVendor(ctx.session.town, ctx.session.player.level, ctx.session.calendar.currentDay),
        };
        ctx.screenManager.setSession(session);
        GameSession.save(session);
      } else {
        GameSession.save(ctx.session);
      }
    }
  },

  exit(_ctx) {
    this._openBuilding = null;
  },

  update(ctx, dt) {
    this._sceneTime += dt;

    if (this._messageTimer > 0) {
      this._messageTimer -= dt;
      if (this._messageTimer <= 0) this._message = '';
    }

    // Animate NPCs
    if (this._npcs) {
      for (const npc of this._npcs) {
        npc.x += npc.dir * npc.speed * dt;
        if (npc.x >= npc.patrolX2) { npc.x = npc.patrolX2; npc.dir = -1; }
        if (npc.x <= npc.patrolX1) { npc.x = npc.patrolX1; npc.dir = 1; }
      }
    }
  },

  handleMouseMove(ctx, gx, gy) {
    if (this._openBuilding) return;
    this._hoveredBuilding = null;
    if (!this._buildings) return;
    for (const b of this._buildings) {
      if (gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h) {
        this._hoveredBuilding = b;
        break;
      }
    }
    // Check dungeon entrance
    const r = ctx.renderer;
    const entrance = getDungeonEntrance(r.gridWidth, r.gridHeight, this._roadCenterX);
    if (gx >= entrance.x && gx < entrance.x + entrance.w && gy >= entrance.y && gy < entrance.y + entrance.h) {
      this._hoveredBuilding = { label: 'Dungeon', action: 'dungeon', fg: COLORS.accentRed,
        x: entrance.x, y: entrance.y, w: entrance.w, h: entrance.h, icon: 'V' };
    }
  },

  handleClick(ctx, gx, gy) {
    if (this._openBuilding) return; // Modal overlay handles its own clicks

    if (this._hoveredBuilding) {
      const action = this._hoveredBuilding.action;
      if (action === 'dungeon') {
        this._startDungeon(ctx);
      } else {
        // Open TownModal overlay (App.svelte reads this)
        this._openBuilding = this._hoveredBuilding;
      }
    }
  },

  handleInput(ctx, key) {
    if (this._openBuilding) {
      if (key === 'Escape') {
        this._openBuilding = null;
      }
      return;
    }
  },

  /** Close the modal overlay (called by App.svelte via onClose) */
  closeModal() {
    this._openBuilding = null;
  },

  _startDungeon(ctx) {
    let session = ctx.session;
    session = GameSession.startRun(session);
    GameSession.save(session);
    ctx.screenManager.setSession(session);
    ctx.screenManager.transition('dungeon');
  },

  render(ctx) {
    const { renderer, session } = ctx;
    const W = renderer.gridWidth;
    const H = renderer.gridHeight;

    // Rebuild town layout if grid dimensions changed
    if (W !== this._lastW || H !== this._lastH) {
      const town = buildTown(W, H);
      this._townMap = town.map;
      this._buildings = town.buildings;
      this._torches = town.torches;
      this._npcs = town.npcs;
      this._roadCenterX = town.roadCenterX;
      this._lastW = W;
      this._lastH = H;
    }

    renderer.clearGrid();
    renderer.cameraOffsetX = 0;
    renderer.cameraOffsetY = 0;

    // Draw arena background with lighting
    drawArena(renderer, W, H, {
      tileAt: (x, y) => this._townMap[y] ? this._townMap[y][x] || 0 : 0,
      torches: this._torches,
      time: this._sceneTime,
      torchIntensity: 1.2,
      ambient: [0.35, 0.32, 0.25],
      showTorchParticles: true,
    });

    // Paint terrain tiles
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const tile = this._townMap[y][x];
        const tileStyle = TILE_COLORS[tile];
        if (!tileStyle) continue;
        const charIdx = ((x * 7 + y * 13) & 0xFFFF) % tileStyle.chars.length;
        const char = tileStyle.chars[charIdx];
        renderer.setCell(x, y, char, tileStyle.fg, tileStyle.bg, 0,
          CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED, 1.0, 0, 0, LAYERS.TERRAIN);
      }
    }

    // Building labels + icons
    for (const b of this._buildings) {
      const labelX = b.x + Math.floor((b.w - b.label.length) / 2);
      drawText(renderer, labelX, b.y, b.label, { fg: b.fg });
      const iconX = b.x + Math.floor(b.w / 2);
      const iconY = b.y + b.h - 2;
      renderer.setCell(iconX, iconY, b.icon, b.fg, COLORS.floorBg, 0,
        CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.OBJECTS);
    }

    // Dungeon entrance
    const entrance = getDungeonEntrance(W, H, this._roadCenterX);
    drawText(renderer, this._roadCenterX, entrance.y, 'DUNGEON', {
      fg: COLORS.accentRed, align: 'center',
    });
    renderer.setCell(this._roadCenterX, entrance.y + 1, 'V', COLORS.accentRed, COLORS.bg, 0,
      CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.OBJECTS);

    // Hover highlight
    if (this._hoveredBuilding && !this._openBuilding) {
      const b = this._hoveredBuilding;
      for (let x = b.x; x < b.x + b.w; x++) {
        renderer.setCell(x, b.y, '-', COLORS.accent, COLORS.bgAccent, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.EFFECTS);
        renderer.setCell(x, b.y + b.h - 1, '-', COLORS.accent, COLORS.bgAccent, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.EFFECTS);
      }
      for (let y = b.y; y < b.y + b.h; y++) {
        renderer.setCell(b.x, y, '|', COLORS.accent, COLORS.bgAccent, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.EFFECTS);
        renderer.setCell(b.x + b.w - 1, y, '|', COLORS.accent, COLORS.bgAccent, 0, CELL_FLAGS.VISIBLE, 1.0, 0, 0, LAYERS.EFFECTS);
      }
    }

    // NPCs
    if (this._npcs) {
      for (const npc of this._npcs) {
        const drawX = Math.round(npc.x);
        const drawY = npc.y;
        if (drawX >= 0 && drawX < W && drawY >= 0 && drawY < H) {
          const bobY = Math.sin(this._sceneTime * 2 + npc.x * 0.5) * 0.08;
          renderer.setCell(drawX, drawY, npc.char, npc.fg, '#4e584a', 0,
            CELL_FLAGS.VISIBLE, 1.0, npc.x - drawX, bobY, LAYERS.OBJECTS);
        }
      }
    }

    // ── Message ──
    if (this._message) {
      drawText(renderer, Math.floor(W / 2), H - 2, this._message, {
        fg: COLORS.accentGreen, align: 'center',
      });
    }

    // ── Footer ──
    drawText(renderer, Math.floor(W / 2), H - 1, 'Click a building to interact', {
      fg: COLORS.fgDim, align: 'center',
    });

    renderer.render();
  },

};
