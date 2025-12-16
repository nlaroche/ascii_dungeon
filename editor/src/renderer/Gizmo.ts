// Gizmo - Transform manipulation handles for 3D editor

export type GizmoMode = 'select' | 'move' | 'rotate' | 'scale'
export type GizmoAxis = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz' | null

// Colors for each axis (toned down for better visibility)
export const GIZMO_COLORS = {
  x: [0.8, 0.25, 0.25, 1] as [number, number, number, number],    // Red (toned down)
  y: [0.25, 0.7, 0.25, 1] as [number, number, number, number],    // Green (toned down)
  z: [0.3, 0.4, 0.85, 1] as [number, number, number, number],     // Blue (toned down)
  xy: [0.8, 0.8, 0.2, 1] as [number, number, number, number],     // Yellow
  xz: [0.8, 0.2, 0.8, 1] as [number, number, number, number],     // Magenta
  yz: [0.2, 0.8, 0.8, 1] as [number, number, number, number],     // Cyan
  xyz: [0.9, 0.9, 0.9, 1] as [number, number, number, number],    // White (slightly dimmed)
  hover: [1, 0.85, 0.3, 1] as [number, number, number, number],   // Highlight yellow
}

export interface GizmoState {
  mode: GizmoMode
  hoveredAxis: GizmoAxis
  draggingAxis: GizmoAxis
  position: [number, number, number]
  scale: number  // Screen-constant sizing factor
}

export interface GizmoVertex {
  position: [number, number, number]
  color: [number, number, number, number]
}

// Arrow geometry for move gizmo
export interface ArrowGeometry {
  vertices: Float32Array  // Positions + colors interleaved
  indices: Uint16Array
}

export class GizmoGeometry {
  // Create a cone for arrow tip
  private static createCone(
    segments: number,
    radius: number,
    height: number,
    baseY: number
  ): { positions: number[]; indices: number[] } {
    const positions: number[] = []
    const indices: number[] = []

    // Tip vertex
    positions.push(0, baseY + height, 0)
    const tipIndex = 0

    // Base vertices
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      positions.push(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius)
    }

    // Side faces
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      indices.push(tipIndex, i + 1, next + 1)
    }

    // Base center
    const baseCenterIndex = positions.length / 3
    positions.push(0, baseY, 0)

    // Base faces
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      indices.push(baseCenterIndex, next + 1, i + 1)
    }

    return { positions, indices }
  }

  // Create a cylinder for arrow shaft
  private static createCylinder(
    segments: number,
    radius: number,
    height: number,
    baseY: number
  ): { positions: number[]; indices: number[] } {
    const positions: number[] = []
    const indices: number[] = []

    // Bottom ring
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      positions.push(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius)
    }

    // Top ring
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      positions.push(Math.cos(angle) * radius, baseY + height, Math.sin(angle) * radius)
    }

    // Side faces
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      const b0 = i
      const b1 = next
      const t0 = i + segments
      const t1 = next + segments

      indices.push(b0, b1, t1)
      indices.push(b0, t1, t0)
    }

    return { positions, indices }
  }

  // Create move arrow along Y axis (will be rotated for X/Z)
  static createMoveArrow(color: [number, number, number, number]): ArrowGeometry {
    const segments = 8
    const shaftRadius = 0.02
    const shaftLength = 0.8
    const coneRadius = 0.06
    const coneLength = 0.2

    // Create shaft
    const shaft = this.createCylinder(segments, shaftRadius, shaftLength, 0)

    // Create cone tip
    const cone = this.createCone(segments, coneRadius, coneLength, shaftLength)

    // Combine geometries
    const positions = [...shaft.positions, ...cone.positions]
    const shaftVertexCount = shaft.positions.length / 3
    const indices = [
      ...shaft.indices,
      ...cone.indices.map(i => i + shaftVertexCount),
    ]

    // Create interleaved vertex data (position + color)
    const vertexCount = positions.length / 3
    const vertices = new Float32Array(vertexCount * 7) // 3 pos + 4 color

    for (let i = 0; i < vertexCount; i++) {
      vertices[i * 7 + 0] = positions[i * 3 + 0]
      vertices[i * 7 + 1] = positions[i * 3 + 1]
      vertices[i * 7 + 2] = positions[i * 3 + 2]
      vertices[i * 7 + 3] = color[0]
      vertices[i * 7 + 4] = color[1]
      vertices[i * 7 + 5] = color[2]
      vertices[i * 7 + 6] = color[3]
    }

    return {
      vertices,
      indices: new Uint16Array(indices),
    }
  }

  // Create ring for rotation gizmo
  static createRotateRing(
    segments: number,
    radius: number,
    tubeRadius: number,
    color: [number, number, number, number]
  ): ArrowGeometry {
    const positions: number[] = []
    const indices: number[] = []
    const tubeSegments = 6

    for (let i = 0; i < segments; i++) {
      const mainAngle = (i / segments) * Math.PI * 2
      const centerX = Math.cos(mainAngle) * radius
      const centerZ = Math.sin(mainAngle) * radius

      for (let j = 0; j < tubeSegments; j++) {
        const tubeAngle = (j / tubeSegments) * Math.PI * 2
        const px = centerX + Math.cos(mainAngle) * Math.cos(tubeAngle) * tubeRadius
        const py = Math.sin(tubeAngle) * tubeRadius
        const pz = centerZ + Math.sin(mainAngle) * Math.cos(tubeAngle) * tubeRadius

        positions.push(px, py, pz)
      }
    }

    // Create faces
    for (let i = 0; i < segments; i++) {
      const nextI = (i + 1) % segments
      for (let j = 0; j < tubeSegments; j++) {
        const nextJ = (j + 1) % tubeSegments
        const a = i * tubeSegments + j
        const b = i * tubeSegments + nextJ
        const c = nextI * tubeSegments + nextJ
        const d = nextI * tubeSegments + j

        indices.push(a, b, c)
        indices.push(a, c, d)
      }
    }

    // Create vertex data
    const vertexCount = positions.length / 3
    const vertices = new Float32Array(vertexCount * 7)

    for (let i = 0; i < vertexCount; i++) {
      vertices[i * 7 + 0] = positions[i * 3 + 0]
      vertices[i * 7 + 1] = positions[i * 3 + 1]
      vertices[i * 7 + 2] = positions[i * 3 + 2]
      vertices[i * 7 + 3] = color[0]
      vertices[i * 7 + 4] = color[1]
      vertices[i * 7 + 5] = color[2]
      vertices[i * 7 + 6] = color[3]
    }

    return {
      vertices,
      indices: new Uint16Array(indices),
    }
  }

  // Create cube for scale gizmo handles
  static createScaleCube(
    size: number,
    offsetY: number,
    color: [number, number, number, number]
  ): ArrowGeometry {
    const h = size / 2

    // 8 vertices of cube offset along Y
    const positions = [
      -h, offsetY - h, -h,
      h, offsetY - h, -h,
      h, offsetY - h, h,
      -h, offsetY - h, h,
      -h, offsetY + h, -h,
      h, offsetY + h, -h,
      h, offsetY + h, h,
      -h, offsetY + h, h,
    ]

    const indices = [
      0, 2, 1, 0, 3, 2, // bottom
      4, 5, 6, 4, 6, 7, // top
      0, 1, 5, 0, 5, 4, // front
      2, 3, 7, 2, 7, 6, // back
      1, 2, 6, 1, 6, 5, // right
      3, 0, 4, 3, 4, 7, // left
    ]

    const vertexCount = positions.length / 3
    const vertices = new Float32Array(vertexCount * 7)

    for (let i = 0; i < vertexCount; i++) {
      vertices[i * 7 + 0] = positions[i * 3 + 0]
      vertices[i * 7 + 1] = positions[i * 3 + 1]
      vertices[i * 7 + 2] = positions[i * 3 + 2]
      vertices[i * 7 + 3] = color[0]
      vertices[i * 7 + 4] = color[1]
      vertices[i * 7 + 5] = color[2]
      vertices[i * 7 + 6] = color[3]
    }

    return {
      vertices,
      indices: new Uint16Array(indices),
    }
  }

  // Create wireframe box for selection bounds
  static createWireframeBox(): { vertices: Float32Array; indices: Uint16Array } {
    // Two rendering modes exist:
    // 1. Cubes (fallback): CENTERED at node position, spans -0.5 to +0.5
    // 2. Glyphs: BASE at node position, spans 0 to ~1.0
    //
    // To handle both, we use a box that encompasses both cases:
    // From y = -0.55 (below cube bottom) to y = 1.05 (above glyph top)
    const h = 0.58       // Half-width for X/Z (with margin)
    const yBottom = -0.55  // Below centered cube bottom (-0.5) with margin
    const yTop = 1.05      // Above glyph top (1.0) with margin

    const positions = [
      -h, yBottom, -h,      // 0 - bottom corners
       h, yBottom, -h,      // 1
       h, yBottom,  h,      // 2
      -h, yBottom,  h,      // 3
      -h, yTop, -h,         // 4 - top corners
       h, yTop, -h,         // 5
       h, yTop,  h,         // 6
      -h, yTop,  h,         // 7
    ]

    // Lines (12 edges of a cube)
    const indices = [
      0, 1, 1, 2, 2, 3, 3, 0, // bottom face
      4, 5, 5, 6, 6, 7, 7, 4, // top face
      0, 4, 1, 5, 2, 6, 3, 7, // vertical edges
    ]

    const vertices = new Float32Array(positions)
    return {
      vertices,
      indices: new Uint16Array(indices),
    }
  }

  // Create full gizmo geometry for a given mode
  static createGizmoGeometry(mode: GizmoMode, hoveredAxis: GizmoAxis): Map<GizmoAxis, ArrowGeometry> {
    const result = new Map<GizmoAxis, ArrowGeometry>()

    if (mode === 'move') {
      // X axis (red)
      const xColor = hoveredAxis === 'x' ? GIZMO_COLORS.hover : GIZMO_COLORS.x
      const xArrow = this.createMoveArrow(xColor)
      // Rotate to point along X
      this.rotateGeometry(xArrow.vertices, 0, 0, -Math.PI / 2)
      result.set('x', xArrow)

      // Y axis (green)
      const yColor = hoveredAxis === 'y' ? GIZMO_COLORS.hover : GIZMO_COLORS.y
      const yArrow = this.createMoveArrow(yColor)
      // Already points along Y
      result.set('y', yArrow)

      // Z axis (blue)
      const zColor = hoveredAxis === 'z' ? GIZMO_COLORS.hover : GIZMO_COLORS.z
      const zArrow = this.createMoveArrow(zColor)
      // Rotate to point along Z
      this.rotateGeometry(zArrow.vertices, Math.PI / 2, 0, 0)
      result.set('z', zArrow)
    } else if (mode === 'rotate') {
      // X rotation ring (red, rotates around X axis)
      const xColor = hoveredAxis === 'x' ? GIZMO_COLORS.hover : GIZMO_COLORS.x
      const xRing = this.createRotateRing(32, 0.8, 0.02, xColor)
      this.rotateGeometry(xRing.vertices, 0, 0, Math.PI / 2)
      result.set('x', xRing)

      // Y rotation ring (green, rotates around Y axis)
      const yColor = hoveredAxis === 'y' ? GIZMO_COLORS.hover : GIZMO_COLORS.y
      const yRing = this.createRotateRing(32, 0.8, 0.02, yColor)
      result.set('y', yRing)

      // Z rotation ring (blue, rotates around Z axis)
      const zColor = hoveredAxis === 'z' ? GIZMO_COLORS.hover : GIZMO_COLORS.z
      const zRing = this.createRotateRing(32, 0.8, 0.02, zColor)
      this.rotateGeometry(zRing.vertices, Math.PI / 2, 0, 0)
      result.set('z', zRing)
    } else if (mode === 'scale') {
      // X axis with cube
      const xColor = hoveredAxis === 'x' ? GIZMO_COLORS.hover : GIZMO_COLORS.x
      const xScale = this.createScaleHandle(xColor)
      this.rotateGeometry(xScale.vertices, 0, 0, -Math.PI / 2)
      result.set('x', xScale)

      // Y axis with cube
      const yColor = hoveredAxis === 'y' ? GIZMO_COLORS.hover : GIZMO_COLORS.y
      const yScale = this.createScaleHandle(yColor)
      result.set('y', yScale)

      // Z axis with cube
      const zColor = hoveredAxis === 'z' ? GIZMO_COLORS.hover : GIZMO_COLORS.z
      const zScale = this.createScaleHandle(zColor)
      this.rotateGeometry(zScale.vertices, Math.PI / 2, 0, 0)
      result.set('z', zScale)

      // Center cube for uniform scale
      const centerColor = hoveredAxis === 'xyz' ? GIZMO_COLORS.hover : GIZMO_COLORS.xyz
      const centerCube = this.createScaleCube(0.15, 0, centerColor)
      result.set('xyz', centerCube)
    }

    return result
  }

  // Create scale handle (line + cube)
  private static createScaleHandle(color: [number, number, number, number]): ArrowGeometry {
    const shaft = this.createCylinder(6, 0.015, 0.7, 0)
    const cube = this.createScaleCube(0.08, 0.75, color)

    // Merge geometries
    const shaftPositions = shaft.positions
    const cubePositions = Array.from(cube.vertices).filter((_, i) => i % 7 < 3)

    const positions = [...shaftPositions, ...cubePositions]
    const shaftVertexCount = shaftPositions.length / 3
    const cubeIndices = Array.from(cube.indices).map(i => i + shaftVertexCount)
    const indices = [...shaft.indices, ...cubeIndices]

    const vertexCount = positions.length / 3
    const vertices = new Float32Array(vertexCount * 7)

    for (let i = 0; i < vertexCount; i++) {
      vertices[i * 7 + 0] = positions[i * 3 + 0]
      vertices[i * 7 + 1] = positions[i * 3 + 1]
      vertices[i * 7 + 2] = positions[i * 3 + 2]
      vertices[i * 7 + 3] = color[0]
      vertices[i * 7 + 4] = color[1]
      vertices[i * 7 + 5] = color[2]
      vertices[i * 7 + 6] = color[3]
    }

    return {
      vertices,
      indices: new Uint16Array(indices),
    }
  }

  // Rotate geometry vertices by euler angles
  private static rotateGeometry(vertices: Float32Array, rx: number, ry: number, rz: number) {
    const cosX = Math.cos(rx), sinX = Math.sin(rx)
    const cosY = Math.cos(ry), sinY = Math.sin(ry)
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

    for (let i = 0; i < vertices.length / 7; i++) {
      let x = vertices[i * 7 + 0]
      let y = vertices[i * 7 + 1]
      let z = vertices[i * 7 + 2]

      // Rotate around X
      const y1 = y * cosX - z * sinX
      const z1 = y * sinX + z * cosX

      // Rotate around Y
      const x2 = x * cosY + z1 * sinY
      const z2 = -x * sinY + z1 * cosY

      // Rotate around Z
      const x3 = x2 * cosZ - y1 * sinZ
      const y3 = x2 * sinZ + y1 * cosZ

      vertices[i * 7 + 0] = x3
      vertices[i * 7 + 1] = y3
      vertices[i * 7 + 2] = z2
    }
  }
}
