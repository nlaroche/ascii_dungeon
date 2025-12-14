// Isometric camera for voxel rendering

export class Camera {
  position: [number, number, number] = [10, 10, 10]
  target: [number, number, number] = [5, 0, 5]
  zoom: number = 10

  // Current orbit state
  private yaw: number = Math.PI / 4
  private pitch: number = Math.atan(1 / Math.sqrt(2))
  private distance: number = 10

  // Target values for smooth interpolation
  private targetYaw: number = Math.PI / 4
  private targetPitch: number = Math.atan(1 / Math.sqrt(2))
  private targetDistance: number = 10

  // Smoothing factor (higher = snappier)
  private smoothing: number = 25

  // Set up classic isometric view
  setIsometric(centerX: number = 5, centerZ: number = 5, height: number = 0) {
    this.target = [centerX, height, centerZ]
    this.distance = this.zoom
    this.targetDistance = this.zoom
    this.yaw = Math.PI / 4
    this.targetYaw = Math.PI / 4
    this.pitch = Math.atan(1 / Math.sqrt(2))
    this.targetPitch = this.pitch
    this.updatePosition()
  }

  // Update camera each frame with smooth interpolation
  update(deltaTime: number) {
    const t = 1 - Math.exp(-this.smoothing * deltaTime)

    // Lerp towards target values
    this.yaw = this.lerp(this.yaw, this.targetYaw, t)
    this.pitch = this.lerp(this.pitch, this.targetPitch, t)
    this.distance = this.lerp(this.distance, this.targetDistance, t)
    this.zoom = this.distance

    this.updatePosition()
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  // Update camera position from orbit parameters
  private updatePosition() {
    this.position = [
      this.target[0] + this.distance * Math.cos(this.yaw) * Math.cos(this.pitch),
      this.target[1] + this.distance * Math.sin(this.pitch),
      this.target[2] + this.distance * Math.sin(this.yaw) * Math.cos(this.pitch),
    ]
  }

  // Strafe camera left/right (A/D keys)
  strafe(amount: number) {
    // Move along the camera's right vector
    const right: [number, number, number] = [
      Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    ]
    this.target[0] += right[0] * amount
    this.target[2] += right[2] * amount
    this.updatePosition()
  }

  // Orbit camera (mouse drag)
  orbit(deltaYaw: number, deltaPitch: number) {
    this.targetYaw += deltaYaw
    this.targetPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.targetPitch + deltaPitch))
  }

  // Zoom camera (W/S keys or scroll wheel)
  zoomBy(delta: number) {
    this.targetDistance = Math.max(2, Math.min(50, this.targetDistance + delta))
  }

  // Stop all camera movement immediately
  stop() {
    this.targetYaw = this.yaw
    this.targetPitch = this.pitch
    this.targetDistance = this.distance
  }

  getViewMatrix(): Float32Array {
    return lookAt(this.position, this.target, [0, 1, 0])
  }

  getProjectionMatrix(aspect: number): Float32Array {
    // Orthographic projection for true isometric
    const size = this.zoom
    const left = -size * aspect
    const right = size * aspect
    const bottom = -size
    const top = size
    const near = 0.1
    const far = 100

    return orthographic(left, right, bottom, top, near, far)
  }

  // For shadow mapping - light's view projection
  getLightViewProjection(lightDir: [number, number, number]): Float32Array {
    const lightPos: [number, number, number] = [
      this.target[0] - lightDir[0] * 20,
      this.target[1] - lightDir[1] * 20,
      this.target[2] - lightDir[2] * 20,
    ]

    const lightView = lookAt(lightPos, this.target, [0, 1, 0])
    const lightProj = orthographic(-15, 15, -15, 15, 0.1, 50)

    return multiplyMatrices(lightProj, lightView)
  }
}

// Matrix math utilities (column-major for WebGPU)

function lookAt(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number]
): Float32Array {
  const zAxis = normalize(subtract(eye, target))
  const xAxis = normalize(cross(up, zAxis))
  const yAxis = cross(zAxis, xAxis)

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ])
}

function orthographic(
  left: number, right: number,
  bottom: number, top: number,
  near: number, far: number
): Float32Array {
  const lr = 1 / (left - right)
  const bt = 1 / (bottom - top)
  // WebGPU uses z range [0, 1] instead of OpenGL's [-1, 1]
  const nf = 1 / (near - far)

  return new Float32Array([
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, nf, 0,  // WebGPU: 1/(near-far) instead of 2/(near-far)
    (left + right) * lr, (top + bottom) * bt, near * nf, 1,  // WebGPU: near/(near-far) instead of (far+near)/(near-far)
  ])
}

function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] =
        a[0 * 4 + j] * b[i * 4 + 0] +
        a[1 * 4 + j] * b[i * 4 + 1] +
        a[2 * 4 + j] * b[i * 4 + 2] +
        a[3 * 4 + j] * b[i * 4 + 3]
    }
  }
  return result
}

function subtract(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  if (len === 0) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}
