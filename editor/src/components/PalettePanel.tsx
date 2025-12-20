// Palette Panel - Color palette for 2D ASCII editor
// Shows predefined color palettes and allows selecting colors for drawing

import { useState } from 'react'
import { useTheme, useEngineState } from '../stores/useEngineState'
import { ToggleButton } from './ui/Scrubber'

// Color palettes - ASCII dungeon style
const PALETTES = {
  'Dungeon': {
    colors: [
      { name: 'Wall', hex: '#4a4a4a', char: '#' },
      { name: 'Floor', hex: '#3a3a3a', char: '.' },
      { name: 'Water', hex: '#2244aa', char: '~' },
      { name: 'Lava', hex: '#ff4400', char: '=' },
      { name: 'Grass', hex: '#228822', char: '"' },
      { name: 'Door', hex: '#8b4513', char: '+' },
      { name: 'Stairs', hex: '#ccaa66', char: '>' },
      { name: 'Chest', hex: '#ffd700', char: '$' },
    ],
  },
  'Characters': {
    colors: [
      { name: 'Player', hex: '#00ff00', char: '@' },
      { name: 'Enemy', hex: '#ff0000', char: 'e' },
      { name: 'NPC', hex: '#00ffff', char: 'N' },
      { name: 'Boss', hex: '#ff00ff', char: 'B' },
      { name: 'Ghost', hex: '#aaaaff', char: 'g' },
      { name: 'Skeleton', hex: '#ffffff', char: 's' },
      { name: 'Orc', hex: '#00aa00', char: 'o' },
      { name: 'Dragon', hex: '#ff6600', char: 'D' },
    ],
  },
  'Items': {
    colors: [
      { name: 'Potion', hex: '#ff00ff', char: '!' },
      { name: 'Scroll', hex: '#ffffaa', char: '?' },
      { name: 'Weapon', hex: '#aaaaaa', char: ')' },
      { name: 'Armor', hex: '#6666ff', char: '[' },
      { name: 'Ring', hex: '#ffaa00', char: '=' },
      { name: 'Wand', hex: '#ffaaff', char: '/' },
      { name: 'Food', hex: '#aa6600', char: '%' },
      { name: 'Gold', hex: '#ffd700', char: '*' },
    ],
  },
  'Grayscale': {
    colors: [
      { name: 'White', hex: '#ffffff', char: ' ' },
      { name: 'Light', hex: '#cccccc', char: '.' },
      { name: 'Silver', hex: '#aaaaaa', char: '-' },
      { name: 'Gray', hex: '#888888', char: '+' },
      { name: 'Dim', hex: '#666666', char: ':' },
      { name: 'Dark', hex: '#444444', char: '#' },
      { name: 'Darker', hex: '#222222', char: '%' },
      { name: 'Black', hex: '#000000', char: '@' },
    ],
  },
}

export function PalettePanel() {
  const theme = useTheme()
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof PALETTES>('Dungeon')
  const currentChar = useEngineState((s) => s.editor2D?.currentChar || '#')
  const setPath = useEngineState((s) => s.setPath)

  const palette = PALETTES[selectedPalette]

  const handleColorSelect = (char: string) => {
    setPath(['editor2D', 'currentChar'], char, `Select character '${char}'`)
  }

  return (
    <div className="h-full flex flex-col p-2 text-xs">
      {/* Palette selector */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: theme.textMuted }}>
          Palette
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.keys(PALETTES).map((name) => (
            <ToggleButton
              key={name}
              active={selectedPalette === name}
              onClick={() => setSelectedPalette(name as keyof typeof PALETTES)}
              size="sm"
            >
              {name}
            </ToggleButton>
          ))}
        </div>
      </div>

      {/* Color grid */}
      <div className="flex-1 overflow-auto">
        <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: theme.textMuted }}>
          Characters
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {palette.colors.map((color) => {
            const isSelected = currentChar === color.char
            return (
              <button
                key={color.char}
                onClick={() => handleColorSelect(color.char)}
                className="flex flex-col items-center p-2 rounded transition-all"
                style={{
                  // Consistent toggle style: outline + alpha fill when selected, depressed when not
                  backgroundColor: isSelected ? theme.accent + '25' : theme.bg,
                  border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                  boxShadow: isSelected ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.15)',
                }}
                title={`${color.name} (${color.char})`}
              >
                {/* Color preview with character */}
                <div
                  className="w-8 h-8 rounded flex items-center justify-center font-mono text-lg font-bold mb-1"
                  style={{
                    backgroundColor: '#1a1a1a',
                    color: color.hex,
                    textShadow: `0 0 4px ${color.hex}`,
                  }}
                >
                  {color.char}
                </div>
                {/* Color swatch */}
                <div
                  className="w-full h-2 rounded"
                  style={{ backgroundColor: color.hex }}
                />
                {/* Label */}
                <div className="mt-1 truncate w-full text-center" style={{ color: isSelected ? theme.text : theme.textDim }}>
                  {color.name}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Current selection */}
      <div
        className="mt-2 pt-2 flex items-center gap-2"
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <span style={{ color: theme.textMuted }}>Current:</span>
        <div
          className="w-8 h-8 rounded flex items-center justify-center font-mono text-xl font-bold"
          style={{
            backgroundColor: '#1a1a1a',
            border: `1px solid ${theme.border}`,
            color: theme.text,
          }}
        >
          {currentChar}
        </div>
        <span style={{ color: theme.textDim }}>
          Press <kbd className="px-1 rounded" style={{ backgroundColor: theme.bgHover }}>D</kbd> to draw
        </span>
      </div>
    </div>
  )
}
