// GizmoInteraction - Hit testing and drag handling for transform gizmos

import type { GizmoMode, GizmoAxis } from './Gizmo'
import type { Ray } from './Raycaster'
import type { Transform } from '../stores/engineState'

export interface DragState {
  axis: GizmoAxis
  startMousePos: [number, number]
  startWorldPos: [number, number, number]
  startTransform: Transform
  accumulatedDelta: [number, number, number]
}

export class GizmoInteraction {
  private dragState: DragState | null = null

  // Hit test gizmo and return which axis (if any) is under the ray
  hitTestGizmo(
    ray: Ray,
    gizmoPos: [number, number, number],
    mode: GizmoMode,
    gizmoScale: number
  ): GizmoAxis {
    if (mode === 'select') return null

    // Scale threshold for hit detection
    const threshold = 0.08 * gizmoScale

    if (mode === 'move' || mode === 'scale') {
      // Test each axis arrow
      const axisLength = 1.0 * gizmoScale

      // X axis
      if (this.rayAxisIntersect(ray, gizmoPos, [1, 0, 0], axisLength, threshold)) {
        return 'x'
      }
      // Y axis
      if (this.rayAxisIntersect(ray, gizmoPos, [0, 1, 0], axisLength, threshold)) {
        return 'y'
      }
      // Z axis
      if (this.rayAxisIntersect(ray, gizmoPos, [0, 0, 1], axisLength, threshold)) {
        return 'z'
      }

      // For scale mode, also check center cube
      if (mode === 'scale') {
        const centerDist = this.pointToRayDistance(ray, gizmoPos)
        if (centerDist < 0.15 * gizmoScale) {
          return 'xyz'
        }
      }
    } else if (mode === 'rotate') {
      // Test each rotation ring
      const ringRadius = 0.8 * gizmoScale
      const ringThreshold = 0.06 * gizmoScale

      // X rotation (ring in YZ plane)
      if (this.rayRingIntersect(ray, gizmoPos, [1, 0, 0], ringRadius, ringThreshold)) {
        return 'x'
      }
      // Y rotation (ring in XZ plane)
      if (this.rayRingIntersect(ray, gizmoPos, [0, 1, 0], ringRadius, ringThreshold)) {
        return 'y'
      }
      // Z rotation (ring in XY plane)
      if (this.rayRingIntersect(ray, gizmoPos, [0, 0, 1], ringRadius, ringThreshold)) {
        return 'z'
      }
    }

    return null
  }

  // Check if ray passes near an axis line
  private rayAxisIntersect(
    ray: Ray,
    origin: [number, number, number],
    axis: [number, number, number],
    length: number,
    threshold: number
  ): boolean {
    // Parametric closest point between ray and axis line
    const axisEnd: [number, number, number] = [
      origin[0] + axis[0] * length,
      origin[1] + axis[1] * length,
      origin[2] + axis[2] * length,
    ]

    const dist = this.segmentToRayDistance(ray, origin, axisEnd)
    return dist < threshold
  }

  // Check if ray passes near a rotation ring
  private rayRingIntersect(
    ray: Ray,
    center: [number, number, number],
    normal: [number, number, number],
    radius: number,
    threshold: number
  ): boolean {
    // Find intersection with ring's plane
    const denom = ray.direction[0] * normal[0] + ray.direction[1] * normal[1] + ray.direction[2] * normal[2]
    if (Math.abs(denom) < 0.0001) return false

    const t = (
      (center[0] - ray.origin[0]) * normal[0] +
      (center[1] - ray.origin[1]) * normal[1] +
      (center[2] - ray.origin[2]) * normal[2]
    ) / denom

    if (t < 0) return false

    // Point on plane
    const point: [number, number, number] = [
      ray.origin[0] + ray.direction[0] * t,
      ray.origin[1] + ray.direction[1] * t,
      ray.origin[2] + ray.direction[2] * t,
    ]

    // Distance from center
    const dx = point[0] - center[0]
    const dy = point[1] - center[1]
    const dz = point[2] - center[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // Check if near the ring
    return Math.abs(dist - radius) < threshold
  }

  // Distance from a point to a ray
  private pointToRayDistance(ray: Ray, point: [number, number, number]): number {
    const dx = point[0] - ray.origin[0]
    const dy = point[1] - ray.origin[1]
    const dz = point[2] - ray.origin[2]

    // Project onto ray direction
    const t = dx * ray.direction[0] + dy * ray.direction[1] + dz * ray.direction[2]

    if (t < 0) {
      // Behind ray origin
      return Math.sqrt(dx * dx + dy * dy + dz * dz)
    }

    // Closest point on ray
    const px = ray.origin[0] + ray.direction[0] * t
    const py = ray.origin[1] + ray.direction[1] * t
    const pz = ray.origin[2] + ray.direction[2] * t

    return Math.sqrt(
      (point[0] - px) ** 2 +
      (point[1] - py) ** 2 +
      (point[2] - pz) ** 2
    )
  }

  // Minimum distance between ray and line segment
  private segmentToRayDistance(
    ray: Ray,
    segStart: [number, number, number],
    segEnd: [number, number, number]
  ): number {
    // Simplified - check a few points along the segment
    let minDist = Infinity
    const steps = 10

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const point: [number, number, number] = [
        segStart[0] + (segEnd[0] - segStart[0]) * t,
        segStart[1] + (segEnd[1] - segStart[1]) * t,
        segStart[2] + (segEnd[2] - segStart[2]) * t,
      ]
      const dist = this.pointToRayDistance(ray, point)
      if (dist < minDist) minDist = dist
    }

    return minDist
  }

  // Begin a drag operation
  beginDrag(
    axis: GizmoAxis,
    mousePos: [number, number],
    worldPos: [number, number, number],
    transform: Transform
  ) {
    this.dragState = {
      axis,
      startMousePos: mousePos,
      startWorldPos: worldPos,
      startTransform: {
        position: [...transform.position] as [number, number, number],
        rotation: [...transform.rotation] as [number, number, number],
        scale: [...transform.scale] as [number, number, number],
      },
      accumulatedDelta: [0, 0, 0],
    }
  }

  // Check if currently dragging
  isDragging(): boolean {
    return this.dragState !== null
  }

  // Get current drag axis
  getDragAxis(): GizmoAxis {
    return this.dragState?.axis ?? null
  }

  // Update drag and return new transform (or null if not dragging)
  updateDrag(
    mode: GizmoMode,
    ray: Ray,
    gizmoPos: [number, number, number],
    snap: { enabled: boolean; gridSize: number; angleSnap: number }
  ): Transform | null {
    if (!this.dragState) return null

    const axis = this.dragState.axis
    if (!axis) return null

    if (mode === 'move') {
      return this.updateMoveDrag(ray, gizmoPos, axis, snap.enabled, snap.gridSize)
    } else if (mode === 'rotate') {
      return this.updateRotateDrag(ray, gizmoPos, axis, snap.enabled, snap.angleSnap)
    } else if (mode === 'scale') {
      return this.updateScaleDrag(ray, gizmoPos, axis, snap.enabled, snap.gridSize)
    }

    return null
  }

  private updateMoveDrag(
    ray: Ray,
    gizmoPos: [number, number, number],
    axis: GizmoAxis,
    snapEnabled: boolean,
    gridSize: number
  ): Transform | null {
    if (!this.dragState) return null

    // Find intersection with constraint plane
    let normal: [number, number, number]
    let constraintDir: [number, number, number]

    switch (axis) {
      case 'x':
        normal = [0, 1, 0]  // Horizontal plane
        constraintDir = [1, 0, 0]
        break
      case 'y':
        normal = [ray.direction[0], 0, ray.direction[2]]  // Vertical plane facing camera
        this.normalize(normal)
        constraintDir = [0, 1, 0]
        break
      case 'z':
        normal = [0, 1, 0]  // Horizontal plane
        constraintDir = [0, 0, 1]
        break
      default:
        return null
    }

    // Intersect ray with plane through gizmo position
    const hitPoint = this.rayPlaneIntersect(ray, gizmoPos, normal)
    if (!hitPoint) return null

    // Project movement onto constraint axis
    const delta: [number, number, number] = [
      (hitPoint[0] - gizmoPos[0]) * constraintDir[0],
      (hitPoint[1] - gizmoPos[1]) * constraintDir[1],
      (hitPoint[2] - gizmoPos[2]) * constraintDir[2],
    ]

    // Calculate new position
    let newPos: [number, number, number] = [
      this.dragState.startTransform.position[0] + delta[0],
      this.dragState.startTransform.position[1] + delta[1],
      this.dragState.startTransform.position[2] + delta[2],
    ]

    // Apply snap
    if (snapEnabled && gridSize > 0) {
      newPos = [
        Math.round(newPos[0] / gridSize) * gridSize,
        Math.round(newPos[1] / gridSize) * gridSize,
        Math.round(newPos[2] / gridSize) * gridSize,
      ]
    }

    return {
      position: newPos,
      rotation: [...this.dragState.startTransform.rotation] as [number, number, number],
      scale: [...this.dragState.startTransform.scale] as [number, number, number],
    }
  }

  private updateRotateDrag(
    ray: Ray,
    gizmoPos: [number, number, number],
    axis: GizmoAxis,
    snapEnabled: boolean,
    angleSnap: number
  ): Transform | null {
    if (!this.dragState) return null

    // Get rotation plane normal
    let normal: [number, number, number]
    let rotAxisIndex: number

    switch (axis) {
      case 'x':
        normal = [1, 0, 0]
        rotAxisIndex = 0
        break
      case 'y':
        normal = [0, 1, 0]
        rotAxisIndex = 1
        break
      case 'z':
        normal = [0, 0, 1]
        rotAxisIndex = 2
        break
      default:
        return null
    }

    // Find intersection with rotation plane
    const hitPoint = this.rayPlaneIntersect(ray, gizmoPos, normal)
    if (!hitPoint) return null

    // Calculate angle from center
    const localHit: [number, number, number] = [
      hitPoint[0] - gizmoPos[0],
      hitPoint[1] - gizmoPos[1],
      hitPoint[2] - gizmoPos[2],
    ]

    let angle: number
    switch (axis) {
      case 'x':
        angle = Math.atan2(localHit[1], localHit[2])
        break
      case 'y':
        angle = Math.atan2(localHit[0], localHit[2])
        break
      case 'z':
        angle = Math.atan2(localHit[1], localHit[0])
        break
      default:
        return null
    }

    // Calculate delta from start
    const startAngle = this.dragState.startTransform.rotation[rotAxisIndex]
    let deltaAngle = angle - startAngle

    // Apply snap
    if (snapEnabled && angleSnap > 0) {
      const snapRad = angleSnap * Math.PI / 180
      deltaAngle = Math.round(deltaAngle / snapRad) * snapRad
    }

    const newRotation: [number, number, number] = [...this.dragState.startTransform.rotation]
    newRotation[rotAxisIndex] = startAngle + deltaAngle

    return {
      position: [...this.dragState.startTransform.position] as [number, number, number],
      rotation: newRotation,
      scale: [...this.dragState.startTransform.scale] as [number, number, number],
    }
  }

  private updateScaleDrag(
    ray: Ray,
    gizmoPos: [number, number, number],
    axis: GizmoAxis,
    snapEnabled: boolean,
    snapSize: number
  ): Transform | null {
    if (!this.dragState) return null

    // Find intersection with constraint plane
    const normal: [number, number, number] = [ray.direction[0], 0, ray.direction[2]]
    this.normalize(normal)

    const hitPoint = this.rayPlaneIntersect(ray, gizmoPos, normal)
    if (!hitPoint) return null

    // Calculate distance from gizmo center
    const dist = Math.sqrt(
      (hitPoint[0] - gizmoPos[0]) ** 2 +
      (hitPoint[1] - gizmoPos[1]) ** 2 +
      (hitPoint[2] - gizmoPos[2]) ** 2
    )

    // Scale factor based on distance
    let scaleFactor = dist / 0.5  // Normalize to starting scale

    // Apply snap
    if (snapEnabled && snapSize > 0) {
      scaleFactor = Math.round(scaleFactor / snapSize) * snapSize
    }

    scaleFactor = Math.max(0.1, scaleFactor)  // Minimum scale

    const newScale: [number, number, number] = [...this.dragState.startTransform.scale]

    switch (axis) {
      case 'x':
        newScale[0] = this.dragState.startTransform.scale[0] * scaleFactor
        break
      case 'y':
        newScale[1] = this.dragState.startTransform.scale[1] * scaleFactor
        break
      case 'z':
        newScale[2] = this.dragState.startTransform.scale[2] * scaleFactor
        break
      case 'xyz':
        newScale[0] = this.dragState.startTransform.scale[0] * scaleFactor
        newScale[1] = this.dragState.startTransform.scale[1] * scaleFactor
        newScale[2] = this.dragState.startTransform.scale[2] * scaleFactor
        break
    }

    return {
      position: [...this.dragState.startTransform.position] as [number, number, number],
      rotation: [...this.dragState.startTransform.rotation] as [number, number, number],
      scale: newScale,
    }
  }

  // End drag operation
  endDrag() {
    this.dragState = null
  }

  // Helper: Intersect ray with plane
  private rayPlaneIntersect(
    ray: Ray,
    planePoint: [number, number, number],
    planeNormal: [number, number, number]
  ): [number, number, number] | null {
    const denom = ray.direction[0] * planeNormal[0] +
                  ray.direction[1] * planeNormal[1] +
                  ray.direction[2] * planeNormal[2]

    if (Math.abs(denom) < 0.0001) return null

    const t = (
      (planePoint[0] - ray.origin[0]) * planeNormal[0] +
      (planePoint[1] - ray.origin[1]) * planeNormal[1] +
      (planePoint[2] - ray.origin[2]) * planeNormal[2]
    ) / denom

    if (t < 0) return null

    return [
      ray.origin[0] + ray.direction[0] * t,
      ray.origin[1] + ray.direction[1] * t,
      ray.origin[2] + ray.direction[2] * t,
    ]
  }

  // Helper: Normalize vector in place
  private normalize(v: [number, number, number]) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if (len > 0) {
      v[0] /= len
      v[1] /= len
      v[2] /= len
    }
  }
}
