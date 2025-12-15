# ASCII Dungeon Design System

A comprehensive guide to the visual language of ASCII Dungeon. Use this document to ensure consistent styling across all prototypes, mockups, and implementations.

---

## Typography

### Font Stack
```css
font-family: ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Consolas", monospace;
```

### Font Sizes
| Use Case | Size | Class |
|----------|------|-------|
| Body / Default | 12px | `text-xs` |
| Small / Labels | 11px | `text-[11px]` |
| Tiny / Badges | 10px | `text-[10px]` |
| Panel Headers | 12px | `text-xs font-medium` |
| Large Icons | 14px | `text-sm` |
| Hero Icons | 20px+ | `text-xl` |

### Font Weights
| Weight | Use Case |
|--------|----------|
| `400` (normal) | Body text, labels |
| `500` (medium) | Panel headers, active items |
| `700` (bold) | Emphasis, status indicators |

### Letter Spacing
| Style | Value | Use Case |
|-------|-------|----------|
| Normal | `0` | Body text |
| Wide | `0.05em` | Menu items, tabs |
| Wider | `0.1em` | Branding |

---

## Color Palette

### Core Colors (Zinc Scale)
| Name | Hex | RGB | Use Case |
|------|-----|-----|----------|
| **bg** | `#09090b` | `9, 9, 11` | App background, deepest layer |
| **bgPanel** | `#18181b` | `24, 24, 27` | Panel backgrounds, cards |
| **bgHover** | `#27272a` | `39, 39, 42` | Hover states, subtle highlights |
| **border** | `#27272a` | `39, 39, 42` | Dividers, panel borders |
| **text** | `#d4d4d8` | `212, 212, 216` | Primary text |
| **textMuted** | `#a1a1aa` | `161, 161, 170` | Secondary text, labels |
| **textDim** | `#71717a` | `113, 113, 122` | Disabled, placeholder |

### Accent Colors
| Name | Hex | RGB | Use Case |
|------|-----|-----|----------|
| **accent** | `#22d3ee` | `34, 211, 238` | Primary accent (Cyan 400) |
| **accentBg** | `#164e63` | `22, 78, 99` | Accent backgrounds (Cyan 900) |

### Semantic Colors
| Name | Hex | RGB | Use Case |
|------|-----|-----|----------|
| **success** | `#34d399` | `52, 211, 153` | Success states (Emerald 400) |
| **warning** | `#fbbf24` | `251, 191, 36` | Warnings (Amber 400) |
| **error** | `#f87171` | `248, 113, 113` | Errors (Red 400) |

### Menu/Dropdown Colors
| Name | Hex | Use Case |
|------|-----|----------|
| **menuBg** | `#27272a` | Dropdown backgrounds |
| **menuBorder** | `#52525b` | Dropdown borders |
| **menuHover** | `#52525b` | Menu item hover |

---

## Color Usage

### Backgrounds
```
┌─────────────────────────────────────────────────────────┐
│ App Background: #09090b                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Panel Background: #18181b                         │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ Hover/Active State: #27272a                 │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Text Hierarchy
```
Primary Text (#d4d4d8)     - Main content, headings
Secondary Text (#a1a1aa)   - Labels, descriptions
Dimmed Text (#71717a)      - Disabled, hints
Accent Text (#22d3ee)      - Links, active states
```

### Interactive States
| State | Background | Text | Border |
|-------|------------|------|--------|
| Default | transparent | `#a1a1aa` | none |
| Hover | `#3f3f46` | `#e4e4e7` | none |
| Active/Selected | `#27272a` | `#22d3ee` | `#22d3ee` |
| Disabled | transparent | `#71717a` | none |

---

## Spacing

### Base Unit
`4px` - All spacing should be multiples of 4px.

### Common Spacings
| Name | Value | Tailwind |
|------|-------|----------|
| xs | 4px | `p-1`, `gap-1` |
| sm | 8px | `p-2`, `gap-2` |
| md | 12px | `p-3`, `gap-3` |
| lg | 16px | `p-4`, `gap-4` |
| xl | 24px | `p-6`, `gap-6` |

### Component Spacing
| Component | Padding |
|-----------|---------|
| Menu Item | `10px 14px` (py-2.5 px-3.5) |
| Tab | `6px 16px` (py-1.5 px-4) |
| Button (sm) | `4px 12px` (py-1 px-3) |
| Panel Header | `8px 12px` (py-2 px-3) |
| Section | `16px` (p-4) |

---

## Borders & Dividers

### Border Radius
| Use Case | Value | Tailwind |
|----------|-------|----------|
| None (sharp) | `0px` | `rounded-none` |
| Subtle | `2px` | `rounded-sm` |
| Default | `4px` | `rounded` |
| Medium | `6px` | `rounded-md` |

### Border Widths
| Use Case | Value |
|----------|-------|
| Dividers | `1px` |
| Active indicator | `2px` |
| Focus ring | `2px` |

### Divider Styles
```css
/* Horizontal divider */
border-top: 1px solid #27272a;

/* Vertical separator (text) */
color: #27272a;
content: "│";

/* Panel border */
border: 1px solid #27272a;
```

---

## Shadows

### Elevation Levels
```css
/* Dropdown / Popup menus */
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.6),
  0 2px 8px rgba(0, 0, 0, 0.4);

/* Floating panels */
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);

/* Subtle lift */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
```

### Inner Highlights
```css
/* Subtle top highlight for popups */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
```

---

## Icons & Symbols

### ASCII Decorators
| Symbol | Unicode | Use Case |
|--------|---------|----------|
| ◆ | U+25C6 | Branding, filled diamond |
| ◇ | U+25C7 | Empty diamond, default |
| ◉ | U+25C9 | Entities, filled circle |
| ○ | U+25CB | Files, empty circle |
| ◈ | U+25C8 | Assets, diamond in square |
| ▦ | U+25A6 | Scene, grid |
| ▸ | U+25B8 | Expand arrow |
| ▾ | U+25BE | Collapse arrow |
| ✕ | U+2715 | Close, delete |
| ✚ | U+271A | Add, create |
| ✎ | U+270E | Edit, paint |
| ⚙ | U+2699 | Settings |
| ❯ | U+276F | Console prompt |
| │ | U+2502 | Vertical separator |
| ═ | U+2550 | Section divider |

### Emoji Icons (Templates)
| Emoji | Use Case |
|-------|----------|
| 🗡 | Isometric RPG |
| 🃏 | Deckbuilder |
| 📖 | Visual Novel |
| 👤 | Characters/NPCs |
| 🎬 | Scenes |
| 📝 | Script/Text |
| 🔀 | Flow/Branching |
| 🎨 | Designer/Editor |
| ▶ | Play/Preview |
| 📚 | Collections |

---

## Component Patterns

### Panel Header
```
┌─────────────────────────────────────┐
│ ○ PANEL TITLE                       │  <- #a1a1aa, uppercase, tracking-wide
├─────────────────────────────────────┤  <- 1px border #27272a
│                                     │
│  Content area                       │  <- #18181b background
│                                     │
└─────────────────────────────────────┘
```

### Tab Bar
```
┌──────────┬──────────┬──────────┐
│  ○ TAB   │  ◉ TAB   │  ◈ TAB   │  <- 11px uppercase
├──────────┴──────────┴──────────┤
│ ════════                       │  <- 2px accent underline on active
```

### Menu Dropdown
```
┌────────────────────────┐  <- #27272a bg, #52525b border
│                        │     6px padding, rounded-md
│  Menu Item       ⌘K    │  <- 10px 14px padding each item
│  Menu Item       ⌘S    │     rounded corners on items
│  ──────────────────    │  <- 1px divider with margin
│  Submenu Item    ▸     │
│                        │
└────────────────────────┘
     ↑
  box-shadow: 0 8px 32px rgba(0,0,0,0.6)
```

### Button States
```css
/* Default */
background: transparent;
color: #a1a1aa;

/* Hover */
background: #3f3f46;
color: #e4e4e7;

/* Active/Pressed */
background: #27272a;
color: #22d3ee;

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

### Input Fields
```css
background: #09090b;
border: 1px solid #27272a;
color: #d4d4d8;
padding: 6px 10px;
border-radius: 4px;

/* Focus */
border-color: #22d3ee;
outline: none;

/* Placeholder */
color: #71717a;
```

---

## Animation & Transitions

### Timing
| Type | Duration | Easing |
|------|----------|--------|
| Hover | `150ms` | `ease` |
| Color change | `150ms` | `ease` |
| Panel expand | `200ms` | `ease-out` |
| Dropdown open | `100ms` | `ease-out` |

### Common Transitions
```css
/* Interactive elements */
transition: all 0.15s ease;

/* Color only */
transition: color 0.15s ease, background-color 0.15s ease;

/* Transform */
transition: transform 0.2s ease-out;
```

---

## Layout Guidelines

### Header/MenuBar
- Height: `28px` (h-7)
- Single row with menus left, info right
- Subtle bottom border

### Panel Tabs
- Tab height: ~32px
- Uppercase labels
- Icon + text format
- 2px accent underline for active

### Content Areas
- Full height flex containers
- Overflow scroll where needed
- Consistent padding (typically 8-16px)

### Status Bar
- Height: `24px` (h-6)
- Muted text
- Subtle top border

---

## CSS Variables Reference

```css
:root {
  /* Backgrounds */
  --color-bg: #09090b;
  --color-bg-panel: #18181b;
  --color-bg-hover: #27272a;

  /* Text */
  --color-text: #d4d4d8;
  --color-text-muted: #a1a1aa;
  --color-text-dim: #71717a;

  /* Accent */
  --color-accent: #22d3ee;
  --color-accent-bg: #164e63;

  /* Semantic */
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-error: #f87171;

  /* Borders */
  --color-border: #27272a;
  --color-border-light: #3f3f46;

  /* Menu */
  --color-menu-bg: #27272a;
  --color-menu-border: #52525b;
  --color-menu-hover: #52525b;

  /* Typography */
  --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace;
  --font-size-xs: 12px;
  --font-size-sm: 11px;
  --font-size-tiny: 10px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* Borders */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
}
```

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════╗
║  ASCII DUNGEON THEME - QUICK REFERENCE                    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  BACKGROUNDS          TEXT             ACCENT             ║
║  ─────────────        ─────────────    ─────────────      ║
║  #09090b (app)        #d4d4d8 (main)   #22d3ee (cyan)     ║
║  #18181b (panel)      #a1a1aa (muted)  #164e63 (bg)       ║
║  #27272a (hover)      #71717a (dim)                       ║
║                                                           ║
║  SEMANTIC             MENU             FONT               ║
║  ─────────────        ─────────────    ─────────────      ║
║  #34d399 (success)    #27272a (bg)     ui-monospace       ║
║  #fbbf24 (warning)    #52525b (border) 12px base          ║
║  #f87171 (error)      #52525b (hover)  11px small         ║
║                                                           ║
║  ICONS: ◆ ◇ ◉ ○ ◈ ▦ ▸ ✕ ✚ ⚙ ❯ │                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

*Use this design system to maintain visual consistency across all ASCII Dungeon interfaces.*

**◆ ASCII_DUNGEON** - *Terminal aesthetic, modern technology.*
