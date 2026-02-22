// ── Dungeon Scene ──
// Extracted from GraphicsLab. Renders a demo dungeon with walking player,
// FOV, lighting, enemies, treasure, dust motes, and camera follow.

import { CELL_FLAGS, LAYERS } from '../../renderer/Renderer.js';
import { createVCam, createController, updateController, getScreenOffset } from '../../lib/camera.js';
import { castFOV } from '../../lib/fov.js';
import { easeOutQuint } from '../../lib/easing.js';
import { drawArena } from '../helpers/drawArena.js';
import { createFadeState, computeAO } from '../helpers/sceneState.js';
import { COLORS } from '../../lib/palette.js';

// ── Dungeon Layout ──
const GRID_W = 80, GRID_H = 45;
const dungeonMap = [];
for (let y = 0; y < GRID_H; y++) {
  dungeonMap[y] = new Uint8Array(GRID_W);
}

const rooms = [
  { x: 2, y: 2, w: 14, h: 10 },
  { x: 28, y: 2, w: 16, h: 10 },
  { x: 2, y: 25, w: 14, h: 12 },
  { x: 28, y: 25, w: 16, h: 12 },
  { x: 16, y: 13, w: 12, h: 8 },
  { x: 52, y: 8, w: 18, h: 14 },
];

for (const room of rooms) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1) {
        dungeonMap[y][x] = 1;
      } else {
        dungeonMap[y][x] = 2;
      }
    }
  }
}

function carveCorridor(x1, y1, x2, y2) {
  let cx = x1, cy = y1;
  while (true) {
    for (let w = 0; w < 2; w++) {
      if (cy + w < GRID_H && cx >= 0 && cx < GRID_W) { dungeonMap[cy + w][cx] = 3; }
    }
    if (cx === x2) break;
    cx += Math.sign(x2 - x1);
  }
  while (true) {
    for (let w = 0; w < 2; w++) {
      if (cx + w < GRID_W && cy >= 0 && cy < GRID_H) { dungeonMap[cy][cx + w] = 3; }
    }
    if (cy === y2) break;
    cy += Math.sign(y2 - cy);
  }
}

carveCorridor(13, 6, 16, 6);
carveCorridor(16, 6, 16, 13);
carveCorridor(28, 6, 25, 6);
carveCorridor(25, 6, 25, 13);
carveCorridor(13, 30, 16, 30);
carveCorridor(16, 20, 16, 30);
carveCorridor(28, 30, 25, 30);
carveCorridor(25, 20, 25, 30);
carveCorridor(43, 6, 52, 6);
carveCorridor(52, 6, 52, 14);
carveCorridor(43, 30, 52, 30);
carveCorridor(52, 20, 52, 30);

// Add walls around corridors
for (let y = 1; y < GRID_H - 1; y++) {
  for (let x = 1; x < GRID_W - 1; x++) {
    if (dungeonMap[y][x] === 3) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < GRID_H && nx >= 0 && nx < GRID_W) {
            if (dungeonMap[ny][nx] === 0) dungeonMap[ny][nx] = 1;
          }
        }
      }
    }
  }
}

const torches = [
  { x: 4, y: 2 }, { x: 10, y: 2 },
  { x: 2, y: 6 }, { x: 13, y: 6 },
  { x: 30, y: 2 }, { x: 38, y: 2 },
  { x: 28, y: 6 }, { x: 41, y: 6 },
  { x: 4, y: 25 }, { x: 10, y: 25 },
  { x: 30, y: 25 }, { x: 38, y: 25 },
  { x: 17, y: 13 }, { x: 24, y: 13 },
  { x: 54, y: 8 }, { x: 62, y: 8 }, { x: 68, y: 8 },
  { x: 52, y: 12 }, { x: 68, y: 12 },
  { x: 54, y: 18 }, { x: 62, y: 18 }, { x: 68, y: 18 },
  { x: 48, y: 6 }, { x: 50, y: 30 },
];

const dustMotes = [];
for (let i = 0; i < 20; i++) {
  dustMotes.push({
    x: Math.random() * GRID_W,
    y: Math.random() * GRID_H,
    char: Math.random() > 0.5 ? '.' : ',',
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.15,
    phase: Math.random() * Math.PI * 2
  });
}

const enemies = [
  { x: 8, y: 5, char: 'G', fg: COLORS.goblin },
  { x: 34, y: 6, char: 'S', fg: COLORS.skeleton },
  { x: 6, y: 30, char: 'S', fg: COLORS.skeleton },
  { x: 35, y: 30, char: 'D', fg: COLORS.arcane },
  { x: 22, y: 16, char: 'R', fg: COLORS.damage },
  { x: 58, y: 12, char: 'O', fg: COLORS.exploration },
  { x: 65, y: 16, char: 'T', fg: COLORS.torch },
];

const treasures = [
  { x: 10, y: 7 }, { x: 36, y: 8 },
  { x: 8, y: 31 }, { x: 34, y: 31 },
  { x: 60, y: 10 }, { x: 64, y: 18 },
];

// Walking path
function linePath(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    let cx = a.x, cy = a.y;
    while (cx !== b.x || cy !== b.y) {
      result.push({ x: cx, y: cy });
      if (cx !== b.x) cx += dx;
      else cy += dy;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

const rawPath = [
  { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 8 }, { x: 5, y: 8 },
  { x: 5, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 14 },
  { x: 25, y: 14 }, { x: 25, y: 6 }, { x: 29, y: 6 },
  { x: 35, y: 5 }, { x: 38, y: 5 }, { x: 38, y: 8 }, { x: 30, y: 8 },
  { x: 42, y: 6 }, { x: 53, y: 6 }, { x: 53, y: 10 },
  { x: 58, y: 10 }, { x: 62, y: 10 }, { x: 62, y: 16 },
  { x: 53, y: 16 }, { x: 53, y: 30 }, { x: 29, y: 30 },
  { x: 35, y: 30 }, { x: 38, y: 30 }, { x: 38, y: 32 }, { x: 30, y: 32 },
  { x: 30, y: 30 }, { x: 26, y: 30 }, { x: 26, y: 19 },
  { x: 17, y: 19 }, { x: 17, y: 30 }, { x: 5, y: 30 },
  { x: 5, y: 32 }, { x: 10, y: 32 }, { x: 10, y: 30 },
  { x: 17, y: 30 }, { x: 17, y: 6 }, { x: 5, y: 6 }, { x: 5, y: 5 },
];

const path = linePath(rawPath).filter(p => dungeonMap[p.y]?.[p.x] >= 2);

const fadeState = createFadeState(GRID_W, GRID_H);
const aoMap = computeAO(GRID_W, GRID_H,
  (x, y) => dungeonMap[y]?.[x] === 1,
  (x, y) => dungeonMap[y]?.[x] >= 2,
);

// ── Scene State ──
const TWEEN_DURATION = 0.25;
let pathIndex = 0;
let tweenStart = 0;
let fromX, fromY, toX, toY;
let camCtrl = null;
let followTarget = null;
let sceneTime = 0;
let lastLightR = null, lastLightG = null, lastLightB = null;

// Exposed config — mutated by GraphicsLab controls
let config = { cellSize: 20, animSpeed: 1.0, visionRadius: 10, showDust: true, torchIntensity: 1.0 };

function getLightIntensity(x, y) {
  if (!lastLightR || x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return 0;
  const idx = y * GRID_W + x;
  return Math.min(lastLightR[idx] + lastLightG[idx] + lastLightB[idx], 1.0);
}

function fillDemoScene(renderer, time, px, py) {
  renderer.clearGrid();

  const isBlocking = (x, y) => dungeonMap[y]?.[x] === 1;
  const cx = Math.floor(px), cy = Math.floor(py);
  const nx = Math.ceil(px), ny = Math.ceil(py);
  const fov1 = castFOV(cx, cy, config.visionRadius, GRID_W, GRID_H, isBlocking);
  const fov2 = (cx !== nx || cy !== ny) ? castFOV(nx, ny, config.visionRadius, GRID_W, GRID_H, isBlocking) : fov1;
  const fovVisible = new Set([...fov1, ...fov2]);

  const { lightR, lightG, lightB } = drawArena(renderer, GRID_W, GRID_H, {
    tileAt: (x, y) => dungeonMap[y][x],
    torches,
    fovVisible,
    aoMap,
    playerLight: { x: px, y: py },
    explored: fadeState.explored,
    fadeState,
    time,
    showDust: config.showDust,
    dustMotes,
    torchIntensity: config.torchIntensity,
  });
  lastLightR = lightR;
  lastLightG = lightG;
  lastLightB = lightB;

  for (const enemy of enemies) {
    const key = (enemy.y << 8) | enemy.x;
    if (!fovVisible.has(key)) continue;
    const eLight = getLightIntensity(enemy.x, enemy.y) + 0.3;
    renderer.setCell(enemy.x, enemy.y, enemy.char, enemy.fg, COLORS.bgMuted, 0, CELL_FLAGS.VISIBLE, Math.min(eLight, 1.0), 0, 0, LAYERS.OBJECTS);
  }

  for (const treasure of treasures) {
    const key = (treasure.y << 8) | treasure.x;
    if (!fovVisible.has(key)) continue;
    renderer.setCell(treasure.x, treasure.y, '$', COLORS.treasure, COLORS.bgMuted, 0.0, CELL_FLAGS.VISIBLE | CELL_FLAGS.HIGHLIGHTED, 1.0, 0, 0, LAYERS.OBJECTS);
  }

  const cellX = Math.floor(px);
  const cellY = Math.floor(py);
  renderer.setCell(cellX, cellY, '@', COLORS.player, COLORS.bgMuted, 0, CELL_FLAGS.VISIBLE, 1.0, px - cellX, py - cellY, LAYERS.PLAYER);
}

// ── Public API ──

export const gridWidth = GRID_W;
export const gridHeight = GRID_H;
export const cellSize = 20;

export function setConfig(cfg) {
  Object.assign(config, cfg);
}

export function getConfig() {
  return config;
}

export function onSetup(renderer) {
  fromX = toX = path[0].x;
  fromY = toY = path[0].y;
  tweenStart = 0;
  sceneTime = 0;
  pathIndex = 0;

  followTarget = { x: path[0].x, y: path[0].y };
  const vcam = createVCam({
    followTarget,
    damping: 6.0,
    deadZoneX: 1.5,
    deadZoneY: 1.0,
  });
  camCtrl = createController(vcam);
}

export function onFrame(renderer, dt) {
  sceneTime += dt * config.animSpeed;

  const effectiveDuration = TWEEN_DURATION / config.animSpeed;
  const tweenElapsed = sceneTime - tweenStart;
  let tweenT = Math.min(tweenElapsed / effectiveDuration, 1.0);

  if (tweenT >= 1.0) {
    fromX = toX;
    fromY = toY;
    pathIndex = (pathIndex + 1) % path.length;
    toX = path[pathIndex].x;
    toY = path[pathIndex].y;
    tweenStart = sceneTime;
    tweenT = 0;
  }

  const easedT = easeOutQuint(tweenT);
  const px = fromX + (toX - fromX) * easedT;
  const py = fromY + (toY - fromY) * easedT;

  followTarget.x = px;
  followTarget.y = py;
  updateController(camCtrl, dt);

  const dpr = window.devicePixelRatio || 1;
  const cssW = renderer.canvas.width / dpr;
  const cssH = renderer.canvas.height / dpr;
  const cam = getScreenOffset(camCtrl, cssW, cssH, config.cellSize, config.cellSize * 1.5);
  renderer.cameraOffsetX = cam.offsetX;
  renderer.cameraOffsetY = cam.offsetY;

  renderer.cellSize = config.cellSize;
  fillDemoScene(renderer, sceneTime, px, py);
  renderer.render();
}
