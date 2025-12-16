// Free-flying perspective camera for 3D editor

export class Camera {
  position: [number, number, number] = [12, 8, 12]

  // Euler angles
  yaw: number = -Math.PI * 0.75  // Looking toward origin
  pitch: number = -0.4  // Slightly looking down

  // Field of view
  fov: number = 60  // degrees

  // For smooth movement
  private velocity: [number, number, number] = [0, 0, 0]
  private smoothing: number = 15

  // Set starting position looking at a point
  lookAt(targetX: number, targetY: number, targetZ: number) {
    const dx = targetX - this.position[0]
    const dy = targetY - this.position[1]
    const dz = targetZ - this.position[2]

    this.yaw = Math.atan2(dx, dz)
    const dist = Math.sqrt(dx * dx + dz * dz)
    this.pitch = Math.atan2(dy, dist)
  }

  // Update camera with velocity smoothing
  update(deltaTime: number) {
    const t = 1 - Math.exp(-this.smoothing * deltaTime)

    // Apply velocity with damping
    this.position[0] += this.velocity[0] * deltaTime
    this.position[1] += this.velocity[1] * deltaTime
    this.position[2] += this.velocity[2] * deltaTime

    // Dampen velocity
    this.velocity[0] *= (1 - t)
    this.velocity[1] *= (1 - t)
    this.velocity[2] *= (1 - t)
  }

  // Get forward direction vector
  getForward(): [number, number, number] {
    return [
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ]
  }

  // Get right direction vector
  getRight(): [number, number, number] {
    return [
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    ]
  }

  // Move camera (WASD + QE)
  move(forward: number, right: number, up: number) {
    const fwd = this.getForward()
    const rt = this.getRight()

    this.position[0] += fwd[0] * forward + rt[0] * right
    this.position[1] += fwd[1] * forward + up
    this.position[2] += fwd[2] * forward + rt[2] * right
  }

  // Rotate camera (mouse look)
  rotate(deltaYaw: number, deltaPitch: number) {
    this.yaw += deltaYaw
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch + deltaPitch))
  }

  // Stop movement
  stop() {
    this.velocity = [0, 0, 0]
  }

  getViewMatrix(): Float32Array {
    const forward = this.getForward()
    const target: [number, number, number] = [
      this.position[0] + forward[0],
      this.position[1] + forward[1],
      this.position[2] + forward[2],
    ]
    return lookAt(this.position, target, [0, 1, 0])
  }

  getProjectionMatrix(aspect: number): Float32Array {
    const fovRad = this.fov * Math.PI / 180
    const near = 0.1
    const far = 500
    return perspective(fovRad, aspect, near, far)
  }

  // For shadow mapping - light's view projection centered on camera target area
  getLightViewProjection(lightDir: [number, number, number]): Float32Array {
    const forward = this.getForward()
    const targetPos: [number, number, number] = [
      this.position[0] + forward[0] * 10,
      this.position[1] + forward[1] * 10,
      this.position[2] + forward[2] * 10,
    ]

    const lightPos: [number, number, number] = [
      targetPos[0] - lightDir[0] * 30,
      targetPos[1] - lightDir[1] * 30,
      targetPos[2] - lightDir[2] * 30,
    ]

    const lightView = lookAt(lightPos, targetPos, [0, 1, 0])
    const lightProj = orthographic(-30, 30, -30, 30, -100, 100)

    return multiplyMatrices(lightProj, lightView)
  }

  // Get inverse view matrix for ray casting
  getInverseViewMatrix(): Float32Array {
    return invertMatrix4x4(this.getViewMatrix())
  }

  // Get inverse projection matrix for ray casting
  getInverseProjectionMatrix(aspect: number): Float32Array {
    return invertMatrix4x4(this.getProjectionMatrix(aspect))
  }

  // Convert screen position (NDC: -1 to 1) to world ray
  screenToWorldRay(ndcX: number, ndcY: number, aspect: number): { origin: [number, number, number], direction: [number, number, number] } {
    const invProj = this.getInverseProjectionMatrix(aspect)
    const invView = this.getInverseViewMatrix()

    // Near plane point in clip space (z=0 for WebGPU's [0,1] range)
    const nearClip: [number, number, number, number] = [ndcX, ndcY, 0, 1]
    // Far plane point in clip space (z=1)
    const farClip: [number, number, number, number] = [ndcX, ndcY, 1, 1]

    // Transform to view space
    const nearView = multiplyMatrixVector(invProj, nearClip)
    const farView = multiplyMatrixVector(invProj, farClip)

    // Perspective divide
    const nearViewDiv: [number, number, number, number] = [
      nearView[0] / nearView[3],
      nearView[1] / nearView[3],
      nearView[2] / nearView[3],
      1
    ]
    const farViewDiv: [number, number, number, number] = [
      farView[0] / farView[3],
      farView[1] / farView[3],
      farView[2] / farView[3],
      1
    ]

    // Transform to world space
    const nearWorld = multiplyMatrixVector(invView, nearViewDiv)
    const farWorld = multiplyMatrixVector(invView, farViewDiv)

    // Ray direction
    const dir = normalize(subtract(
      [farWorld[0], farWorld[1], farWorld[2]],
      [nearWorld[0], nearWorld[1], nearWorld[2]]
    ))

    return {
      origin: [...this.position],
      direction: dir
    }
  }
}

// Perspective projection matrix
function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2)
  const nf = 1 / (near - far)

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * nf, -1,
    0, 0, near * far * nf, 0,
  ])
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

// Multiply matrix by vector (column-major matrix, column vector)
function multiplyMatrixVector(m: Float32Array, v: [number, number, number, number]): [number, number, number, number] {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ]
}

// 4x4 matrix inversion (column-major)
function invertMatrix4x4(m: Float32Array): Float32Array {
  const inv = new Float32Array(16)

  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
           m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10]
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
           m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10]
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
           m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9]
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
            m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9]

  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
           m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10]
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
           m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10]
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
           m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9]
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
            m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9]

  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
           m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6]
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
           m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6]
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
            m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5]
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
            m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5]

  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
           m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6]
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
           m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6]
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
            m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5]
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
            m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5]

  let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]
  if (det === 0) {
    console.warn('Matrix inversion failed: determinant is 0')
    return new Float32Array(16) // Return identity-ish fallback
  }

  det = 1.0 / det
  for (let i = 0; i < 16; i++) {
    inv[i] *= det
  }

  return inv
}
