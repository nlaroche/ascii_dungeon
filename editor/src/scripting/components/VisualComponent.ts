// ═══════════════════════════════════════════════════════════════════════════
// Visual Component - Rendering properties for a node
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'

@component({ name: 'Visual', icon: '◉', description: 'Visual appearance and rendering settings' })
export class VisualComponent extends Component {
  @property({ type: 'boolean', label: 'Visible', group: 'Display' })
  visible: boolean = true

  @property({ type: 'string', label: 'Glyph', group: 'Display', tooltip: 'Single character to render' })
  glyph: string = '@'

  @property({ type: 'string', label: 'Sprite', group: 'Display', tooltip: 'Multi-character sprite ID' })
  sprite: string = ''

  @property({ type: 'color', label: 'Color', group: 'Display' })
  color: [number, number, number] = [1, 1, 1]

  @property({ type: 'number', label: 'Opacity', group: 'Display', min: 0, max: 1, step: 0.05 })
  opacity: number = 1

  @property({ type: 'color', label: 'Emission', group: 'Emission' })
  emission: [number, number, number] = [0, 0, 0]

  @property({ type: 'number', label: 'Emission Power', group: 'Emission', min: 0, max: 10, step: 0.1 })
  emissionPower: number = 0

  @property({ type: 'boolean', label: 'Cast Shadows', group: 'Shadows' })
  castShadows: boolean = true

  @property({ type: 'boolean', label: 'Receive Shadows', group: 'Shadows' })
  receiveShadows: boolean = true

  /** Check if this visual is emissive */
  isEmissive(): boolean {
    return this.emissionPower > 0 && (
      this.emission[0] > 0 ||
      this.emission[1] > 0 ||
      this.emission[2] > 0
    )
  }

  /** Get combined emission color (color * power) */
  getEmissionColor(): [number, number, number] {
    return [
      this.emission[0] * this.emissionPower,
      this.emission[1] * this.emissionPower,
      this.emission[2] * this.emissionPower,
    ]
  }

  /** Set color from hex string */
  setColorFromHex(hex: string): void {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    this.color = [r, g, b]
  }

  /** Get color as hex string */
  getColorHex(): string {
    const r = Math.round(this.color[0] * 255).toString(16).padStart(2, '0')
    const g = Math.round(this.color[1] * 255).toString(16).padStart(2, '0')
    const b = Math.round(this.color[2] * 255).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
}
