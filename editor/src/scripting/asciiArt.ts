// ═══════════════════════════════════════════════════════════════════════════
// ASCII Art Library - Pre-built ASCII art patterns and scenes
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Dungeon Elements
// ─────────────────────────────────────────────────────────────────────────────

export const DUNGEON = {
  room: `
#################
#...............#
#...............#
#...............#
#...............#
#...............#
#...............#
#################`,

  corridor: `
#####
#...#
#...#
#...#
#...#
#####`,

  door: `
###+###
#.....#
#.....#`,

  chest: `
 ┌───┐
 │$$$│
 └───┘`,

  stairs_down: `
 ┌───┐
 │ > │
 └───┘`,

  stairs_up: `
 ┌───┐
 │ < │
 └───┘`,

  torch: `
 )
(#)
 |`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Characters
// ─────────────────────────────────────────────────────────────────────────────

export const CHARACTERS = {
  player: `
 O
/|\\
/ \\`,

  player_simple: '@',

  goblin: `
 ,
/g\\
 "`,

  skeleton: `
 ☠
/+\\
| |`,

  ghost: `
 .--.
( oo )
 '--'`,

  dragon: `
    /\\_/\\
   ( o.o )
    > ^ <
   /|   |\\`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────────────────────────────────────

export const ITEMS = {
  sword: `
  |
──┼──
  |`,

  potion: `
 ┌─┐
 │~│
 └─┘`,

  key: `
o─┐
  │`,

  coin: `
◉`,

  heart: `
♥`,

  star: `
★`,
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Elements
// ─────────────────────────────────────────────────────────────────────────────

export const UI = {
  box: (width: number, height: number, title?: string): string => {
    const lines: string[] = []
    const inner = width - 2

    // Top border
    if (title) {
      const padding = Math.max(0, inner - title.length - 2)
      const left = Math.floor(padding / 2)
      const right = padding - left
      lines.push(`╔${'═'.repeat(left)}[${title}]${'═'.repeat(right)}╗`)
    } else {
      lines.push(`╔${'═'.repeat(inner)}╗`)
    }

    // Middle
    for (let i = 0; i < height - 2; i++) {
      lines.push(`║${' '.repeat(inner)}║`)
    }

    // Bottom
    lines.push(`╚${'═'.repeat(inner)}╝`)

    return lines.join('\n')
  },

  button: (text: string): string => {
    const padding = 2
    const width = text.length + padding * 2
    return `┌${'─'.repeat(width)}┐
│${' '.repeat(padding)}${text}${' '.repeat(padding)}│
└${'─'.repeat(width)}┘`
  },

  progressBar: (percent: number, width: number = 20): string => {
    const filled = Math.round((percent / 100) * (width - 2))
    const empty = width - 2 - filled
    return `[${
      '█'.repeat(filled)}${'░'.repeat(empty)}]`
  },

  healthBar: (current: number, max: number): string => {
    const percent = (current / max) * 100
    return `♥ ${UI.progressBar(percent, 15)} ${current}/${max}`
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Card Game Elements
// ─────────────────────────────────────────────────────────────────────────────

export const CARDS = {
  blank: `
┌─────────┐
│         │
│         │
│         │
│         │
│         │
│         │
└─────────┘`,

  back: `
┌─────────┐
│░░░░░░░░░│
│░░░░░░░░░│
│░░░░░░░░░│
│░░░░░░░░░│
│░░░░░░░░░│
│░░░░░░░░░│
└─────────┘`,

  simple: (suit: string, value: string): string => `
┌─────────┐
│${value.padEnd(2)}       │
│         │
│    ${suit}    │
│         │
│       ${value.padStart(2)}│
└─────────┘`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Scenes
// ─────────────────────────────────────────────────────────────────────────────

export const SCENES = {
  dungeon_room: `
╔═══════════════════════════════════════╗
║                                       ║
║   #################################   ║
║   #.......#.........#.............#   ║
║   #...@...#....g....+......$......#   ║
║   #.......#.........#.............#   ║
║   ####+####....+####.....####+#####   ║
║   #.......#....#....#....#........#   ║
║   #.......+....#....+....#....>...#   ║
║   #.......#....#....#....#........#   ║
║   #################################   ║
║                                       ║
║  HP: [████████░░] 80/100   Gold: 42   ║
╚═══════════════════════════════════════╝`,

  title_screen: `
╔═══════════════════════════════════════════╗
║                                           ║
║     █████╗ ███████╗ ██████╗██╗██╗         ║
║    ██╔══██╗██╔════╝██╔════╝██║██║         ║
║    ███████║███████╗██║     ██║██║         ║
║    ██╔══██║╚════██║██║     ██║██║         ║
║    ██║  ██║███████║╚██████╗██║██║         ║
║    ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝         ║
║                                           ║
║    ██████╗ ██╗   ██╗███╗   ██╗            ║
║    ██╔══██╗██║   ██║████╗  ██║            ║
║    ██║  ██║██║   ██║██╔██╗ ██║            ║
║    ██║  ██║██║   ██║██║╚██╗██║            ║
║    ██████╔╝╚██████╔╝██║ ╚████║            ║
║    ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝            ║
║                                           ║
║          [  START GAME  ]                 ║
║          [   OPTIONS    ]                 ║
║          [    QUIT      ]                 ║
║                                           ║
╚═══════════════════════════════════════════╝`,

  space: `
       .  ★  .           .    ★
   ★        .    ★            .
      .  ★                .
   .     ___          ★
      .-'   '-.  ★          .
  ★  /  .--.  \\      .
    |  /    \\  |   .    ★
    | |  ()  | |      ★
     \\  '--'  /  ★        .
   ★  '-.___.-'     .
         |        ★
        /|\\
       / | \\`,

  cottage: `
            ___
         __/   \\__
        |  [=][=] |
        |   ___   |
        |  | . |  |
    ____|__|___|__|____
       |||     |||
       ~~~     ~~~`,

  landscape: `
                      /\\
           /\\       /  \\    /\\
          /  \\  /\\ /    \\  /  \\
         /    \\/  \\      \\/    \\
    ____/      \\   \\      \\     \\____
        ~~~~~~~~~~~~~~~~~~~~~~~~
          ><>    ><>     ><>`,

  robot: `
       [####]
       |o  o|
       | -- |
      /|    |\\
     / |====| \\
       | || |
       | || |
       [_][_]`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Frames
// ─────────────────────────────────────────────────────────────────────────────

export const ANIMATIONS = {
  spinner: ['|', '/', '-', '\\'],

  loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],

  explosion: [
    '   *   ',
    '  ***  ',
    ' ***** ',
    '*******',
    ' ***** ',
    '  ***  ',
    '   *   ',
  ],

  fire: [
    `  )
 ( )
( ) )
 ( )`,
    ` ( )
( ) )
 ( )
( )`,
    `( ) )
 ( )
( )
 ( )`,
  ],

  wave: [
    '~~~~~',
    '≈~~~~',
    '~~≈~~',
    '~~~~≈',
    '~~~~~',
  ],

  blink: ['★', '☆'],
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Center ASCII art within a given width/height
 */
export function centerArt(art: string, width: number, height: number): string {
  const lines = art.split('\n')
  const artWidth = Math.max(...lines.map(l => l.length))
  const artHeight = lines.length

  const padLeft = Math.floor((width - artWidth) / 2)
  const padTop = Math.floor((height - artHeight) / 2)

  const result: string[] = []

  // Top padding
  for (let i = 0; i < padTop; i++) {
    result.push(' '.repeat(width))
  }

  // Art with left padding
  for (const line of lines) {
    result.push(' '.repeat(padLeft) + line.padEnd(width - padLeft))
  }

  // Bottom padding
  while (result.length < height) {
    result.push(' '.repeat(width))
  }

  return result.join('\n')
}

/**
 * Combine multiple ASCII arts horizontally
 */
export function combineHorizontal(arts: string[], gap: number = 2): string {
  const allLines = arts.map(a => a.split('\n'))
  const maxHeight = Math.max(...allLines.map(l => l.length))

  // Pad all to same height
  const padded = allLines.map(lines => {
    const width = Math.max(...lines.map(l => l.length))
    while (lines.length < maxHeight) {
      lines.push(' '.repeat(width))
    }
    return lines.map(l => l.padEnd(width))
  })

  // Combine
  const result: string[] = []
  for (let i = 0; i < maxHeight; i++) {
    result.push(padded.map(lines => lines[i]).join(' '.repeat(gap)))
  }

  return result.join('\n')
}

/**
 * Add a border around ASCII art
 */
export function addBorder(art: string, style: 'single' | 'double' | 'rounded' = 'single'): string {
  const chars = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  }[style]

  const lines = art.split('\n')
  const width = Math.max(...lines.map(l => l.length))

  const result: string[] = []
  result.push(chars.tl + chars.h.repeat(width + 2) + chars.tr)

  for (const line of lines) {
    result.push(chars.v + ' ' + line.padEnd(width) + ' ' + chars.v)
  }

  result.push(chars.bl + chars.h.repeat(width + 2) + chars.br)

  return result.join('\n')
}
