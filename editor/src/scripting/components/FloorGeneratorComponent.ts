// ═══════════════════════════════════════════════════════════════════════════
// Floor Generator Component - Procedural floor tile generation
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type TilePattern = 'checkerboard' | 'solid' | 'stripes' | 'diagonal' | 'random'

@component({ name: 'FloorGenerator', icon: '▦', description: 'Generates floor tiles procedurally' })
export class FloorGeneratorComponent extends Component {
  @select(['checkerboard', 'solid', 'stripes', 'diagonal', 'random'], { label: 'Pattern', group: 'Generation' })
  tileType: TilePattern = 'checkerboard'

  @property({ type: 'vec2', label: 'Size', group: 'Generation', tooltip: 'Width and height in tiles' })
  size: [number, number] = [21, 21]

  @property({ type: 'number', label: 'Tile Size', group: 'Generation', min: 0.25, max: 4, step: 0.25 })
  tileSize: number = 1

  @property({ type: 'color', label: 'Primary Color', group: 'Colors' })
  primaryColor: [number, number, number] = [0.15, 0.15, 0.18]

  @property({ type: 'color', label: 'Secondary Color', group: 'Colors' })
  secondaryColor: [number, number, number] = [0.12, 0.12, 0.14]

  @property({ type: 'number', label: 'Color Variation', group: 'Colors', min: 0, max: 0.2, step: 0.01, tooltip: 'Random color variation per tile' })
  colorVariation: number = 0.02

  @property({ type: 'number', label: 'Elevation', group: 'Position', tooltip: 'Y position of the floor' })
  elevation: number = 0

  @property({ type: 'boolean', label: 'Center Origin', group: 'Position', tooltip: 'Center the floor at origin' })
  centerOrigin: boolean = true

  /** Generate tile data for rendering */
  generateTiles(): Array<{
    x: number
    z: number
    color: [number, number, number, number]
  }> {
    const tiles: Array<{
      x: number
      z: number
      color: [number, number, number, number]
    }> = []

    const halfW = this.centerOrigin ? Math.floor(this.size[0] / 2) : 0
    const halfH = this.centerOrigin ? Math.floor(this.size[1] / 2) : 0

    for (let x = 0; x < this.size[0]; x++) {
      for (let z = 0; z < this.size[1]; z++) {
        const useSecondary = this.shouldUseSecondary(x, z)
        const baseColor = useSecondary ? this.secondaryColor : this.primaryColor

        // Add variation
        const variation = (Math.random() - 0.5) * 2 * this.colorVariation
        const color: [number, number, number, number] = [
          Math.max(0, Math.min(1, baseColor[0] + variation)),
          Math.max(0, Math.min(1, baseColor[1] + variation)),
          Math.max(0, Math.min(1, baseColor[2] + variation)),
          1,
        ]

        tiles.push({
          x: (x - halfW) * this.tileSize,
          z: (z - halfH) * this.tileSize,
          color,
        })
      }
    }

    return tiles
  }

  /** Determine if a tile should use secondary color based on pattern */
  private shouldUseSecondary(x: number, z: number): boolean {
    switch (this.tileType) {
      case 'checkerboard':
        return (x + z) % 2 === 0

      case 'solid':
        return false

      case 'stripes':
        return x % 2 === 0

      case 'diagonal':
        return (x + z) % 3 === 0

      case 'random':
        // Use seeded random based on position for consistency
        const seed = x * 1000 + z
        return this.seededRandom(seed) > 0.5

      default:
        return false
    }
  }

  /** Simple seeded random for consistent results */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }

  /** Get total tile count */
  getTileCount(): number {
    return this.size[0] * this.size[1]
  }

  /** Get bounds of the floor */
  getBounds(): { min: [number, number, number]; max: [number, number, number] } {
    const halfW = this.centerOrigin ? Math.floor(this.size[0] / 2) * this.tileSize : 0
    const halfH = this.centerOrigin ? Math.floor(this.size[1] / 2) * this.tileSize : 0

    return {
      min: [-halfW, this.elevation, -halfH],
      max: [
        this.size[0] * this.tileSize - halfW,
        this.elevation,
        this.size[1] * this.tileSize - halfH,
      ],
    }
  }
}
