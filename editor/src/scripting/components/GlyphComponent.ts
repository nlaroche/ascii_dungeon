// ═══════════════════════════════════════════════════════════════════════════
// Glyph Component - Single character display with colors
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, color } from '../decorators'

/**
 * GlyphComponent - Single character with foreground/background colors.
 *
 * Use this for simple single-character entities like items, NPCs, etc.
 * For multi-character ASCII art, use GlyphImage instead.
 */
@component({
  name: 'Glyph',
  icon: 'A',
  description: 'Single character with colors'
})
export class GlyphComponent extends Component {
  @property({
    type: 'string',
    label: 'Character',
    group: 'Display',
    tooltip: 'The character to display'
  })
  char: string = '@'

  @color({ label: 'Foreground', group: 'Colors' })
  fg: [number, number, number] = [1, 1, 1]

  @color({ label: 'Background', group: 'Colors' })
  bg: [number, number, number] = [0, 0, 0]

  @property({
    type: 'number',
    label: 'Emission',
    group: 'Lighting',
    min: 0,
    max: 10,
    step: 0.1,
    tooltip: 'Light emission intensity (0 = no light)'
  })
  emission: number = 0

  @color({ label: 'Emission Color', group: 'Lighting' })
  emissionColor: [number, number, number] = [1, 1, 1]

  @property({
    type: 'number',
    label: 'Z-Index',
    group: 'Rendering',
    tooltip: 'Draw order (higher = on top)'
  })
  zIndex: number = 0

  @property({
    type: 'boolean',
    label: 'Visible',
    group: 'Rendering'
  })
  visible: boolean = true

  /**
   * Get the character to display.
   */
  getChar(): string {
    return this.char || ' '
  }

  /**
   * Get foreground color as RGB tuple.
   */
  getFg(): [number, number, number] {
    return this.fg
  }

  /**
   * Get background color as RGB tuple.
   */
  getBg(): [number, number, number] {
    return this.bg
  }

  /**
   * Check if this glyph emits light.
   */
  isEmissive(): boolean {
    return this.emission > 0
  }

  /**
   * Get light properties if emissive.
   */
  getLight(): { intensity: number; color: [number, number, number] } | null {
    if (!this.isEmissive()) return null
    return {
      intensity: this.emission,
      color: this.emissionColor
    }
  }
}
