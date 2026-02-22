// CC-29 Palette — Single source of truth for all colors
// https://lospec.com/palette-list/cc-29
// 29 colors, strict — no hex values outside this file.

export const PALETTE = Object.freeze([
  '#f2f0e5', // cream
  '#b8b5b9', // silver
  '#868188', // gray
  '#646365', // dark gray
  '#45444f', // charcoal
  '#3a3858', // deep indigo
  '#212123', // near-black
  '#352b42', // dark purple
  '#43436a', // navy
  '#4b80ca', // blue
  '#68c2d3', // cyan
  '#a2dcc7', // mint
  '#ede19e', // pale gold
  '#d3a068', // amber
  '#b45252', // rust red
  '#6a536e', // mauve
  '#4b4158', // plum
  '#80493a', // brown
  '#a77b5b', // tan
  '#e5ceb4', // sand
  '#c2d368', // lime
  '#8ab060', // olive
  '#567b79', // teal
  '#4e584a', // dark olive
  '#7b7243', // khaki
  '#b2b47e', // sage
  '#edc8c4', // blush
  '#cf8acb', // pink
  '#5f556a', // slate
]);

// Named palette entries for quick reference
const P = {
  cream:       '#f2f0e5',
  silver:      '#b8b5b9',
  gray:        '#868188',
  darkGray:    '#646365',
  charcoal:    '#45444f',
  deepIndigo:  '#3a3858',
  nearBlack:   '#212123',
  darkPurple:  '#352b42',
  navy:        '#43436a',
  blue:        '#4b80ca',
  cyan:        '#68c2d3',
  mint:        '#a2dcc7',
  paleGold:    '#ede19e',
  amber:       '#d3a068',
  rustRed:     '#b45252',
  mauve:       '#6a536e',
  plum:        '#4b4158',
  brown:       '#80493a',
  tan:         '#a77b5b',
  sand:        '#e5ceb4',
  lime:        '#c2d368',
  olive:       '#8ab060',
  teal:        '#567b79',
  darkOlive:   '#4e584a',
  khaki:       '#7b7243',
  sage:        '#b2b47e',
  blush:       '#edc8c4',
  pink:        '#cf8acb',
  slate:       '#5f556a',
};

export const COLORS = Object.freeze({
  // ── UI Chrome ──
  bg:            P.nearBlack,
  bgCard:        P.deepIndigo,
  bgMuted:       P.darkPurple,
  bgAccent:      P.charcoal,
  border:        P.charcoal,
  borderMuted:   P.deepIndigo,
  borderAccent:  P.slate,
  fg:            P.cream,
  fgMuted:       P.silver,
  fgDim:         P.gray,
  accent:        P.cyan,
  accentGreen:   P.mint,
  accentAmber:   P.amber,
  accentRed:     P.rustRed,

  // ── Game Entities ──
  player:        P.lime,
  goblin:        P.olive,
  skeleton:      P.silver,
  torch:         P.amber,
  treasure:      P.paleGold,

  // ── Dungeon Terrain ──
  wallFg:        P.slate,
  wallBg:        P.deepIndigo,
  floorFg:       P.charcoal,
  floorBg:       P.nearBlack,

  // ── Combat / Effects ──
  damage:        P.rustRed,
  heal:          P.mint,
  flash:         P.cream,
  xpGold:        P.paleGold,
  hpHigh:        P.olive,
  hpMid:         P.amber,
  hpLow:         P.rustRed,
  hpBg:          P.deepIndigo,

  // ── Skill Regions ──
  combat:        P.rustRed,
  defense:       P.blue,
  vitality:      P.mint,
  exploration:   P.cyan,
  fortune:       P.amber,
  arcane:        P.pink,

  // ── Item Records (color ramps per type) ──
  recordBase:    P.darkGray,
  recordLow:     P.gray,
  killMid:       P.rustRed,
  killHigh:      P.blush,
  treasureMid:   P.amber,
  treasureHigh:  P.paleGold,
  exploreMid:    P.blue,
  exploreHigh:   P.cyan,
  surviveMid:    P.navy,
  surviveHigh:   P.blue,

  // ── Resonance ──
  bloodBrothers:   P.rustRed,
  goldenPair:      P.paleGold,
  pathfinders:     P.cyan,
  ironBond:        P.blue,
  warriorSoul:     P.amber,
  treasureHunter:  P.olive,
  berserker:       P.brown,
  paladin:         P.sand,

  // ── Particles ──
  particleDefault: P.cream,
  smoke:           P.gray,

  // ── Shared zero (entity bg — not pure black, keeps CC-29 strict) ──
  black:           P.nearBlack,
});

// ── Helpers ──

/** Parse '#rrggbb' → [r, g, b] */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// Pre-compute RGB for all palette entries
const PALETTE_RGB = PALETTE.map(hexToRgb);

/**
 * Find the nearest CC-29 color to an arbitrary hex value.
 * Uses squared Euclidean distance in RGB space.
 * @param {string} hex  e.g. '#ff4444'
 * @returns {{ hex: string, distance: number }}
 */
export function nearest(hex) {
  const [r, g, b] = hexToRgb(hex);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < PALETTE_RGB.length; i++) {
    const [pr, pg, pb] = PALETTE_RGB[i];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { hex: PALETTE[bestIdx], distance: Math.sqrt(bestDist) };
}
