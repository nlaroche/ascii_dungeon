// ── ASCII UI Drawing Primitives ──
// Pure JS module. Every function takes renderer as first arg, writes via setCell().
// All coordinates are in grid units. Uses CC-29 palette colors.
//
// Two-layer rendering model:
//   Layer 0 (TERRAIN): Background fills using EXPLORED flag + light=0.
//     The shader renders exploredBg directly (exact color, no lighting math).
//   Layer 4 (EFFECTS): Foreground glyphs using VISIBLE flag + light=1.
//     The shader renders glyph fg at full brightness as transparent overlay.

import { COLORS } from './palette.js';
import { LAYERS, CELL_FLAGS } from '../renderer/Renderer.js';

// ── Box-drawing character sets ──
export const BOX_SINGLE = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
export const BOX_DOUBLE = { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' };

// Background layer: TERRAIN with EXPLORED renders bg color exactly
const BG_LAYER = LAYERS.TERRAIN;
const BG_FLAGS = CELL_FLAGS.EXPLORED;

// Foreground layer: EFFECTS with VISIBLE renders glyph at full brightness
const FG_LAYER = LAYERS.EFFECTS;
const FG_FLAGS = CELL_FLAGS.VISIBLE;

// ── Helpers ──

/** Fill a rectangular region on the bg layer with a solid color. */
function fillBg(r, x, y, w, h, bg) {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      r.setCell(x + col, y + row, ' ', bg, bg, 0, BG_FLAGS, 0, 0, 0, BG_LAYER);
    }
  }
}

/** Set a single glyph on the fg layer. */
function setGlyph(r, x, y, char, fg) {
  r.setCell(x, y, char, fg, COLORS.bg, 0, FG_FLAGS, 1.0, 0, 0, FG_LAYER);
}

/**
 * Fill the entire grid with a background color on layer 0.
 * Call this at the start of each UI scene frame before drawing anything.
 * @param {object} r Renderer
 * @param {number} gw Grid width
 * @param {number} gh Grid height
 * @param {string} [bg] Background color
 */
export function fillBackground(r, gw, gh, bg = COLORS.bg) {
  fillBg(r, 0, 0, gw, gh, bg);
}

// ── Text ──

/**
 * Measure text dimensions (handles newlines).
 * @param {string} text
 * @returns {{ width: number, height: number }}
 */
export function measureText(text) {
  const lines = text.split('\n');
  let maxW = 0;
  for (const line of lines) {
    if (line.length > maxW) maxW = line.length;
  }
  return { width: maxW, height: lines.length };
}

/**
 * Draw a string at (x, y).
 * @param {object} r Renderer
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.fg] Foreground color
 * @param {string} [opts.bg] Background color (fills behind text on layer 0)
 * @param {'left'|'center'|'right'} [opts.align='left']
 * @param {number} [opts.maxWidth] Wrap text at this width
 */
export function drawText(r, x, y, text, opts = {}) {
  const {
    fg = COLORS.fg,
    bg = null, // null = don't fill bg (inherit from panel/fillBackground)
    align = 'left',
    maxWidth = 0,
  } = opts;

  let lines = text.split('\n');
  if (maxWidth > 0) {
    const wrapped = [];
    for (const line of lines) {
      if (line.length <= maxWidth) {
        wrapped.push(line);
      } else {
        let remaining = line;
        while (remaining.length > maxWidth) {
          let breakAt = remaining.lastIndexOf(' ', maxWidth);
          if (breakAt <= 0) breakAt = maxWidth;
          wrapped.push(remaining.slice(0, breakAt));
          remaining = remaining.slice(breakAt).trimStart();
        }
        if (remaining.length > 0) wrapped.push(remaining);
      }
    }
    lines = wrapped;
  }

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    let startX = x;
    if (align === 'center') startX = x - Math.floor(line.length / 2);
    else if (align === 'right') startX = x - line.length;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === ' ') {
        // Space: only fill bg if specified
        if (bg) fillBg(r, startX + i, y + row, 1, 1, bg);
      } else {
        if (bg) fillBg(r, startX + i, y + row, 1, 1, bg);
        setGlyph(r, startX + i, y + row, ch, fg);
      }
    }
  }
}

// ── Lines ──

/**
 * Draw a horizontal line.
 */
export function drawHLine(r, x, y, w, opts = {}) {
  const { fg = COLORS.border, bg = null, char = '─' } = opts;
  for (let i = 0; i < w; i++) {
    if (bg) fillBg(r, x + i, y, 1, 1, bg);
    setGlyph(r, x + i, y, char, fg);
  }
}

/**
 * Draw a vertical line.
 */
export function drawVLine(r, x, y, h, opts = {}) {
  const { fg = COLORS.border, bg = null, char = '│' } = opts;
  for (let i = 0; i < h; i++) {
    if (bg) fillBg(r, x, y + i, 1, 1, bg);
    setGlyph(r, x, y + i, char, fg);
  }
}

// ── Box ──

/**
 * Draw a box-drawing border.
 */
export function drawBox(r, x, y, w, h, opts = {}) {
  const {
    fg = COLORS.border,
    bg = null,
    chars = BOX_SINGLE,
  } = opts;

  const setBorder = (bx, by, ch) => {
    if (bg) fillBg(r, bx, by, 1, 1, bg);
    setGlyph(r, bx, by, ch, fg);
  };

  setBorder(x, y, chars.tl);
  setBorder(x + w - 1, y, chars.tr);
  setBorder(x, y + h - 1, chars.bl);
  setBorder(x + w - 1, y + h - 1, chars.br);

  for (let i = 1; i < w - 1; i++) {
    setBorder(x + i, y, chars.h);
    setBorder(x + i, y + h - 1, chars.h);
  }
  for (let j = 1; j < h - 1; j++) {
    setBorder(x, y + j, chars.v);
    setBorder(x + w - 1, y + j, chars.v);
  }
}

// ── Panel ──

/**
 * Draw a panel (box with filled interior and optional title).
 */
export function drawPanel(r, x, y, w, h, opts = {}) {
  const {
    title = '',
    fg = COLORS.fgDim,
    bg = COLORS.bgAccent,
    titleFg = COLORS.accent,
    chars = BOX_SINGLE,
  } = opts;

  // Fill interior on bg layer (exact color)
  fillBg(r, x, y, w, h, bg);

  // Draw border glyphs on fg layer
  drawBox(r, x, y, w, h, { fg, chars });

  // Title
  if (title) {
    const maxLen = w - 4;
    const trimmed = title.length > maxLen ? title.slice(0, maxLen) : title;
    const tx = x + Math.floor((w - trimmed.length) / 2);
    for (let i = 0; i < trimmed.length; i++) {
      setGlyph(r, tx + i, y, trimmed[i], titleFg);
    }
  }
}

// ── Progress Bar ──

/**
 * Draw a progress bar using block characters.
 */
export function drawProgressBar(r, x, y, w, current, max, opts = {}) {
  const {
    fg = COLORS.hpHigh,
    bg = COLORS.bg,
    emptyFg = COLORS.hpBg,
  } = opts;

  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const filled = ratio * w;
  const fullCells = Math.floor(filled);
  const partial = filled - fullCells;

  for (let i = 0; i < w; i++) {
    if (i < fullCells) {
      fillBg(r, x + i, y, 1, 1, fg);
      setGlyph(r, x + i, y, ' ', fg);
    } else if (i === fullCells && partial > 0.3) {
      fillBg(r, x + i, y, 1, 1, bg);
      setGlyph(r, x + i, y, ':', fg);
    } else {
      fillBg(r, x + i, y, 1, 1, bg);
      setGlyph(r, x + i, y, '-', emptyFg);
    }
  }
}

// ── List ──

/**
 * Draw a scrollable list with selection highlight.
 */
export function drawList(r, x, y, w, h, items, opts = {}) {
  const {
    selected = -1,
    scroll = 0,
    fg = COLORS.fg,
    bg = COLORS.bgAccent,
    selectedFg = COLORS.bg,
    selectedBg = COLORS.accent,
  } = opts;

  for (let row = 0; row < h; row++) {
    const idx = scroll + row;
    if (idx >= items.length) break;

    const item = items[idx];
    const isSel = idx === selected;
    const itemFg = isSel ? selectedFg : (item.fg || fg);
    const itemBg = isSel ? selectedBg : bg;

    let label = item.label || '';
    if (isSel) label = '> ' + label;
    if (label.length > w) label = label.slice(0, w);

    // Fill row bg
    fillBg(r, x, y + row, w, 1, itemBg);

    // Draw label glyphs
    for (let col = 0; col < label.length; col++) {
      if (label[col] !== ' ') {
        setGlyph(r, x + col, y + row, label[col], itemFg);
      }
    }
  }
}

// ── Button ──

/**
 * Draw a highlighted button region.
 * @returns {{ x: number, y: number, w: number, h: number }} Hit rect
 */
export function drawButton(r, x, y, label, opts = {}) {
  const {
    focused = false,
    fg = COLORS.fg,
    bg = COLORS.bgAccent,
    focusedFg = COLORS.bg,
    focusedBg = COLORS.accent,
  } = opts;

  const padded = ' ' + label + ' ';
  const w = padded.length;
  const btnFg = focused ? focusedFg : fg;
  const btnBg = focused ? focusedBg : bg;

  fillBg(r, x, y, w, 1, btnBg);
  for (let i = 0; i < w; i++) {
    if (padded[i] !== ' ') {
      setGlyph(r, x + i, y, padded[i], btnFg);
    }
  }

  return { x, y, w, h: 1 };
}

// ── Modal ──

/**
 * Draw a centered modal panel with dimmed background.
 * @returns {{ x: number, y: number }} Top-left of modal interior
 */
export function drawModal(r, gw, gh, w, h, opts = {}) {
  const {
    title = '',
    dimBg = COLORS.bg,
    fg = COLORS.fgDim,
    bg = COLORS.bgAccent,
  } = opts;

  // Dim background on layer 0
  fillBg(r, 0, 0, gw, gh, dimBg);

  const mx = Math.floor((gw - w) / 2);
  const my = Math.floor((gh - h) / 2);

  drawPanel(r, mx, my, w, h, { title, fg, bg });

  return { x: mx + 1, y: my + 1 };
}

// ── Tooltip ──

/**
 * Draw an auto-positioned popup tooltip.
 */
export function drawTooltip(r, x, y, lines, gw, gh, opts = {}) {
  const {
    fg = COLORS.fg,
    bg = COLORS.bgAccent,
    borderFg = COLORS.fgDim,
  } = opts;

  let maxLen = 0;
  for (const line of lines) {
    if (line.length > maxLen) maxLen = line.length;
  }

  const w = maxLen + 2;
  const h = lines.length + 2;

  let tx = x + 1;
  let ty = y + 1;
  if (tx + w > gw) tx = x - w;
  if (ty + h > gh) ty = y - h;
  if (tx < 0) tx = 0;
  if (ty < 0) ty = 0;

  drawPanel(r, tx, ty, w, h, { fg: borderFg, bg });

  for (let i = 0; i < lines.length; i++) {
    drawText(r, tx + 1, ty + 1 + i, lines[i], { fg });
  }
}
