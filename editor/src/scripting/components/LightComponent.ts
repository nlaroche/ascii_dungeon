// ═══════════════════════════════════════════════════════════════════════════
// Light Component - Point, spot, and directional lights
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select } from '../decorators'

export type LightType = 'point' | 'spot' | 'directional'

@component({ name: 'Light', icon: '☀', description: 'Light source for illuminating the scene' })
export class LightComponent extends Component {
  @select(['point', 'spot', 'directional'], { label: 'Type', group: 'Light' })
  lightType: LightType = 'point'

  @property({ type: 'color', label: 'Color', group: 'Light' })
  color: [number, number, number] = [1, 0.95, 0.8]

  @property({ type: 'number', label: 'Intensity', group: 'Light', min: 0, max: 10, step: 0.1 })
  intensity: number = 1

  @property({ type: 'number', label: 'Radius', group: 'Attenuation', min: 0.1, max: 100, step: 0.5, tooltip: 'Range for point/spot lights' })
  radius: number = 10

  @property({ type: 'number', label: 'Falloff', group: 'Attenuation', min: 0.1, max: 4, step: 0.1, tooltip: 'How quickly light falls off with distance' })
  falloff: number = 2

  @property({ type: 'number', label: 'Inner Angle', group: 'Spot', min: 0, max: 180, step: 1, tooltip: 'Spotlight inner cone angle (degrees)' })
  innerAngle: number = 30

  @property({ type: 'number', label: 'Outer Angle', group: 'Spot', min: 0, max: 180, step: 1, tooltip: 'Spotlight outer cone angle (degrees)' })
  outerAngle: number = 45

  @property({ type: 'boolean', label: 'Cast Shadows', group: 'Shadows' })
  castShadows: boolean = true

  @property({ type: 'number', label: 'Shadow Bias', group: 'Shadows', min: 0, max: 0.1, step: 0.001 })
  shadowBias: number = 0.005

  @property({ type: 'boolean', label: 'Flicker', group: 'Effects' })
  flicker: boolean = false

  @property({ type: 'number', label: 'Flicker Speed', group: 'Effects', min: 0, max: 20, step: 0.5 })
  flickerSpeed: number = 8

  @property({ type: 'number', label: 'Flicker Amount', group: 'Effects', min: 0, max: 1, step: 0.05 })
  flickerAmount: number = 0.15

  // Internal flicker state
  private flickerOffset: number = Math.random() * Math.PI * 2
  private currentFlickerIntensity: number = 1

  /** Get current effective intensity (with flicker applied) */
  getEffectiveIntensity(): number {
    return this.intensity * this.currentFlickerIntensity
  }

  /** Get combined light color (color * intensity) */
  getLightColor(): [number, number, number] {
    const i = this.getEffectiveIntensity()
    return [
      this.color[0] * i,
      this.color[1] * i,
      this.color[2] * i,
    ]
  }

  /** Calculate attenuation at a given distance */
  getAttenuation(distance: number): number {
    if (distance >= this.radius) return 0
    if (this.lightType === 'directional') return 1

    // Smooth falloff
    const normalizedDist = distance / this.radius
    const attenuation = Math.pow(1 - normalizedDist, this.falloff)
    return Math.max(0, attenuation)
  }

  /** Calculate spotlight factor at an angle */
  getSpotFactor(angleFromCenter: number): number {
    if (this.lightType !== 'spot') return 1

    const innerRad = this.innerAngle * Math.PI / 180
    const outerRad = this.outerAngle * Math.PI / 180

    if (angleFromCenter <= innerRad) return 1
    if (angleFromCenter >= outerRad) return 0

    // Smooth falloff between inner and outer cone
    const t = (angleFromCenter - innerRad) / (outerRad - innerRad)
    return 1 - t * t
  }

  onUpdate(dt: number): void {
    if (this.flicker) {
      this.flickerOffset += dt * this.flickerSpeed
      // Perlin-like noise using multiple sine waves
      const noise =
        Math.sin(this.flickerOffset) * 0.5 +
        Math.sin(this.flickerOffset * 2.3) * 0.25 +
        Math.sin(this.flickerOffset * 4.7) * 0.15

      this.currentFlickerIntensity = 1 + noise * this.flickerAmount
    } else {
      this.currentFlickerIntensity = 1
    }
  }
}
