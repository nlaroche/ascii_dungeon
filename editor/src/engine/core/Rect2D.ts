// ═══════════════════════════════════════════════════════════════════════════
// Rect2D Component - 2D Position and Size
// ═══════════════════════════════════════════════════════════════════════════

import type { IComponent, IRect2D, ComponentMeta } from './interfaces'

/**
 * Rect2D Component - Defines position and size in 2D space.
 *
 * Unlike Transform (which is 3D), Rect2D is specifically for 2D elements:
 * - x, y: Position in cell coordinates
 * - width, height: Size in cells
 *
 * This is the primary positioning component for 2D editor elements.
 */
export class Rect2D implements IComponent, IRect2D {
  readonly id: string
  readonly type = 'Rect2D'
  enabled = true
  nodeId: string | null = null

  // Position in cell coordinates
  x = 0
  y = 0

  // Size in cells
  width = 1
  height = 1

  constructor(id?: string) {
    this.id = id || `rect2d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  }

  // Convenience methods
  get left(): number { return this.x }
  get top(): number { return this.y }
  get right(): number { return this.x + this.width }
  get bottom(): number { return this.y + this.height }

  get centerX(): number { return this.x + this.width / 2 }
  get centerY(): number { return this.y + this.height / 2 }

  /**
   * Check if a point is inside this rect
   */
  contains(px: number, py: number): boolean {
    return px >= this.x && px < this.right && py >= this.y && py < this.bottom
  }

  /**
   * Check if another rect intersects this one
   */
  intersects(other: IRect2D): boolean {
    return !(
      other.x >= this.right ||
      other.x + other.width <= this.x ||
      other.y >= this.bottom ||
      other.y + other.height <= this.y
    )
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): this {
    this.x = x
    this.y = y
    return this
  }

  /**
   * Set size
   */
  setSize(width: number, height: number): this {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    return this
  }

  /**
   * Set all bounds at once
   */
  setBounds(x: number, y: number, width: number, height: number): this {
    this.x = x
    this.y = y
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    return this
  }

  serialize(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      enabled: this.enabled,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled
    if (typeof data.x === 'number') this.x = data.x
    if (typeof data.y === 'number') this.y = data.y
    if (typeof data.width === 'number') this.width = data.width
    if (typeof data.height === 'number') this.height = data.height
  }

  /**
   * Component metadata for inspector
   */
  static readonly meta: ComponentMeta = {
    name: 'Rect2D',
    icon: '▢',
    description: 'Position and size in 2D space',
    category: 'Core',
    properties: [
      { key: 'x', name: 'X', type: 'number', default: 0 },
      { key: 'y', name: 'Y', type: 'number', default: 0 },
      { key: 'width', name: 'Width', type: 'number', default: 1, min: 1 },
      { key: 'height', name: 'Height', type: 'number', default: 1, min: 1 },
    ],
  }
}
