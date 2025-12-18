// ═══════════════════════════════════════════════════════════════════════════
// Color Palettes - Predefined color schemes for ASCII rendering
// ═══════════════════════════════════════════════════════════════════════════

export interface ColorPalette {
  name: string
  bg: string                    // Background color
  chars: string[]               // Character colors (darkest to brightest)
  accent?: string               // Optional accent for special chars
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Palettes
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTES: Record<string, ColorPalette> = {
  // Classic terminal looks
  phosphor: {
    name: 'Phosphor Green',
    bg: '#0a0a0a',
    chars: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    accent: '#c4f000',
  },
  amber: {
    name: 'Amber CRT',
    bg: '#1a0a00',
    chars: ['#331a00', '#663300', '#ff9900', '#ffcc00'],
    accent: '#ffee66',
  },
  cyan: {
    name: 'Cyan Terminal',
    bg: '#001015',
    chars: ['#003344', '#006688', '#00aacc', '#00ffff'],
    accent: '#88ffff',
  },

  // Retro systems
  c64: {
    name: 'Commodore 64',
    bg: '#40318d',
    chars: ['#7869c4', '#9b9b9b', '#a59cff', '#ffffff'],
    accent: '#ff7777',
  },
  gameboy: {
    name: 'Game Boy',
    bg: '#0f380f',
    chars: ['#306230', '#8bac0f', '#9bbc0f', '#c4cfa1'],
    accent: '#e0f0c0',
  },
  nes: {
    name: 'NES',
    bg: '#000000',
    chars: ['#4a4a4a', '#8a8a8a', '#c4c4c4', '#ffffff'],
    accent: '#ff6666',
  },

  // Monochrome
  white: {
    name: 'White on Black',
    bg: '#111111',
    chars: ['#333333', '#666666', '#aaaaaa', '#ffffff'],
    accent: '#ffffff',
  },
  blue: {
    name: 'Blue Terminal',
    bg: '#0a0a1a',
    chars: ['#1a1a4a', '#3333aa', '#6666dd', '#aaaaff'],
    accent: '#ffffff',
  },

  // Fantasy/Themed
  dungeon: {
    name: 'Dungeon',
    bg: '#0d0d0d',
    chars: ['#2a1a0a', '#5a4020', '#a08050', '#d4b896'],
    accent: '#ffcc44',
  },
  blood: {
    name: 'Blood Moon',
    bg: '#0a0505',
    chars: ['#3a1515', '#6a2020', '#aa3333', '#dd5555'],
    accent: '#ff8888',
  },
  ice: {
    name: 'Ice Cave',
    bg: '#050a10',
    chars: ['#1a3050', '#3060a0', '#6090d0', '#a0d0ff'],
    accent: '#ffffff',
  },
  forest: {
    name: 'Forest',
    bg: '#050a05',
    chars: ['#1a3a1a', '#2a5a2a', '#4a8a4a', '#7aba7a'],
    accent: '#bbffbb',
  },

  // Neon/Cyberpunk
  neon: {
    name: 'Neon',
    bg: '#05050a',
    chars: ['#300050', '#6000a0', '#a000ff', '#ff00ff'],
    accent: '#00ffff',
  },
  synthwave: {
    name: 'Synthwave',
    bg: '#0a0010',
    chars: ['#2a0040', '#6a0080', '#ff0080', '#ff80c0'],
    accent: '#00ffff',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Character Ramps
// ─────────────────────────────────────────────────────────────────────────────

export const ASCII_RAMPS: Record<string, string> = {
  standard: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  minimal: ' .:+#',
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  dots: ' ⋅∙●⬤',
  lines: ' ─━═╋',
  shade: ' ░▒▓█▀▄',
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Character Sets
// ─────────────────────────────────────────────────────────────────────────────

export const SPECIAL_CHARS = {
  // Dungeon elements
  walls: '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬',
  player: '@',
  enemies: 'gGdDsSkKoO',
  items: '!?*$%&',
  doors: '+',
  stairs: '<>',

  // Box drawing
  boxLight: '┌─┐│└┘',
  boxHeavy: '┏━┓┃┗┛',
  boxDouble: '╔═╗║╚╝',

  // Decorative
  arrows: '←↑→↓↖↗↘↙',
  shapes: '◆◇○●□■△▽',
  stars: '✦✧★☆✶✷',
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

export function getPaletteNames(): string[] {
  return Object.keys(PALETTES)
}

export function getPalette(name: string): ColorPalette {
  return PALETTES[name] || PALETTES.phosphor
}

export function getCharColor(palette: ColorPalette, intensity: number): string {
  const idx = Math.floor(Math.max(0, Math.min(1, intensity)) * (palette.chars.length - 1))
  return palette.chars[idx]
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/** Get color for a specific character based on palette and character "weight" */
export function getCharColorFromRamp(
  char: string,
  palette: ColorPalette,
  ramp: string = ASCII_RAMPS.standard
): string {
  if (char === ' ') return palette.bg

  const weight = ramp.indexOf(char)
  if (weight < 0) {
    // Character not in ramp, use middle color
    return palette.chars[Math.floor(palette.chars.length / 2)]
  }

  const normalized = weight / (ramp.length - 1)
  const idx = Math.floor(normalized * (palette.chars.length - 1))
  return palette.chars[idx]
}

/** Check if character should use accent color */
export function isAccentChar(char: string): boolean {
  return '@$*#!?♦♥♠♣★☆'.includes(char)
}
