// ═══════════════════════════════════════════════════════════════════════════
// Transform Component - Position, rotation, scale in 3D space
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property } from '../decorators'

@component({ name: 'Transform', icon: '✥', description: 'Position, rotation, and scale in 3D space' })
export class TransformComponent extends Component {
  @property({ type: 'vec3', label: 'Position', group: 'Transform' })
  position: [number, number, number] = [0, 0, 0]

  @property({ type: 'vec3', label: 'Rotation', group: 'Transform', tooltip: 'Euler angles in degrees' })
  rotation: [number, number, number] = [0, 0, 0]

  @property({ type: 'vec3', label: 'Scale', group: 'Transform' })
  scale: [number, number, number] = [1, 1, 1]

  /** Get position as array */
  getPosition(): [number, number, number] {
    return [...this.position]
  }

  /** Set position */
  setPosition(x: number, y: number, z: number): void {
    const old = [...this.position]
    this.position = [x, y, z]
    this.onPropertyChanged?.('position', old, this.position)
  }

  /** Translate by offset */
  translate(dx: number, dy: number, dz: number): void {
    this.setPosition(
      this.position[0] + dx,
      this.position[1] + dy,
      this.position[2] + dz
    )
  }

  /** Get rotation as array (degrees) */
  getRotation(): [number, number, number] {
    return [...this.rotation]
  }

  /** Set rotation (degrees) */
  setRotation(x: number, y: number, z: number): void {
    const old = [...this.rotation]
    this.rotation = [x, y, z]
    this.onPropertyChanged?.('rotation', old, this.rotation)
  }

  /** Rotate by offset (degrees) */
  rotate(dx: number, dy: number, dz: number): void {
    this.setRotation(
      this.rotation[0] + dx,
      this.rotation[1] + dy,
      this.rotation[2] + dz
    )
  }

  /** Get scale as array */
  getScale(): [number, number, number] {
    return [...this.scale]
  }

  /** Set scale */
  setScale(x: number, y: number, z: number): void {
    const old = [...this.scale]
    this.scale = [x, y, z]
    this.onPropertyChanged?.('scale', old, this.scale)
  }

  /** Set uniform scale */
  setUniformScale(s: number): void {
    this.setScale(s, s, s)
  }

  /** Calculate forward direction vector */
  getForward(): [number, number, number] {
    const pitch = this.rotation[0] * Math.PI / 180
    const yaw = this.rotation[1] * Math.PI / 180
    return [
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ]
  }

  /** Calculate right direction vector */
  getRight(): [number, number, number] {
    const yaw = this.rotation[1] * Math.PI / 180
    return [Math.cos(yaw), 0, Math.sin(yaw)]
  }

  /** Look at a target position */
  lookAt(target: [number, number, number]): void {
    const dx = target[0] - this.position[0]
    const dy = target[1] - this.position[1]
    const dz = target[2] - this.position[2]

    const yaw = Math.atan2(dx, -dz) * 180 / Math.PI
    const pitch = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz)) * 180 / Math.PI

    this.setRotation(pitch, yaw, 0)
  }
}
