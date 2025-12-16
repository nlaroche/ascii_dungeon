// Glyph Mesh Builder - Converts ASCII characters to smooth extruded polygon meshes
// Uses marching squares for contour extraction and ear clipping for triangulation

// Import the font data from GlyphBuilder
import { FONT_5X7 } from './GlyphBuilder'

// ============================================================================
// Types
// ============================================================================

interface Point2D {
  x: number
  y: number
}

interface Contour {
  points: Point2D[]
  isHole: boolean
}

interface Edge {
  p1: Point2D
  p2: Point2D
}

export interface GlyphMesh {
  vertices: Float32Array   // position (3) + normal (3) + color (4) per vertex = 10 floats
  indices: Uint16Array
  vertexCount: number
  indexCount: number
}

// ============================================================================
// Constants
// ============================================================================

const GRID_WIDTH = 5
const GRID_HEIGHT = 7
const EXTRUSION_DEPTH = 0.4  // Depth of the extruded character

// ============================================================================
// Contour Extraction using Marching Squares
// ============================================================================

/**
 * Convert bitmap row array to a 2D grid of filled/empty cells
 */
function bitmapToGrid(bitmap: number[]): boolean[][] {
  const grid: boolean[][] = []

  for (let row = 0; row < GRID_HEIGHT; row++) {
    const rowData: boolean[] = []
    const bits = bitmap[row]
    for (let col = 0; col < GRID_WIDTH; col++) {
      // Bit 4 is leftmost, bit 0 is rightmost
      const filled = ((bits >> (4 - col)) & 1) === 1
      rowData.push(filled)
    }
    grid.push(rowData)
  }

  return grid
}

/**
 * Get cell value with bounds checking (returns false for out-of-bounds)
 */
function getCell(grid: boolean[][], row: number, col: number): boolean {
  if (row < 0 || row >= GRID_HEIGHT || col < 0 || col >= GRID_WIDTH) {
    return false
  }
  return grid[row][col]
}

/**
 * Extract edges using marching squares algorithm
 * Returns a list of edges that form the boundary between filled and empty cells
 */
function extractEdges(grid: boolean[][]): Edge[] {
  const edges: Edge[] = []

  // Process each cell in the grid
  // We iterate one extra row/col to handle boundaries
  for (let row = -1; row < GRID_HEIGHT; row++) {
    for (let col = -1; col < GRID_WIDTH; col++) {
      // Get the 4 corners of this 2x2 cell
      // Note: grid is stored top-to-bottom, but we want y=0 at bottom
      const tl = getCell(grid, row, col)         // top-left
      const tr = getCell(grid, row, col + 1)     // top-right
      const bl = getCell(grid, row + 1, col)     // bottom-left
      const br = getCell(grid, row + 1, col + 1) // bottom-right

      // Create case index (4-bit number)
      const caseIdx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0)

      // Cell corners in world space (y is flipped so 0 is at bottom)
      const x = col
      const y = GRID_HEIGHT - 1 - row  // Flip Y

      // Edge midpoints
      const top: Point2D = { x: x + 0.5, y: y + 1 }
      const right: Point2D = { x: x + 1, y: y + 0.5 }
      const bottom: Point2D = { x: x + 0.5, y: y }
      const left: Point2D = { x: x, y: y + 0.5 }

      // Marching squares cases - generate edges based on corner configuration
      switch (caseIdx) {
        case 0:  // All empty
        case 15: // All filled
          break
        case 1:  // Only BL filled
          edges.push({ p1: left, p2: bottom })
          break
        case 2:  // Only BR filled
          edges.push({ p1: bottom, p2: right })
          break
        case 3:  // BL and BR filled
          edges.push({ p1: left, p2: right })
          break
        case 4:  // Only TR filled
          edges.push({ p1: right, p2: top })
          break
        case 5:  // TR and BL filled (saddle)
          edges.push({ p1: left, p2: top })
          edges.push({ p1: bottom, p2: right })
          break
        case 6:  // TR and BR filled
          edges.push({ p1: bottom, p2: top })
          break
        case 7:  // TR, BR, BL filled
          edges.push({ p1: left, p2: top })
          break
        case 8:  // Only TL filled
          edges.push({ p1: top, p2: left })
          break
        case 9:  // TL and BL filled
          edges.push({ p1: top, p2: bottom })
          break
        case 10: // TL and BR filled (saddle)
          edges.push({ p1: top, p2: right })
          edges.push({ p1: left, p2: bottom })
          break
        case 11: // TL, BL, BR filled
          edges.push({ p1: top, p2: right })
          break
        case 12: // TL and TR filled
          edges.push({ p1: right, p2: left })
          break
        case 13: // TL, TR, BL filled
          edges.push({ p1: right, p2: bottom })
          break
        case 14: // TL, TR, BR filled
          edges.push({ p1: bottom, p2: left })
          break
      }
    }
  }

  return edges
}

/**
 * Connect edges into closed contours
 */
function connectEdges(edges: Edge[]): Contour[] {
  if (edges.length === 0) return []

  const contours: Contour[] = []
  const used = new Set<number>()
  const epsilon = 0.001

  function pointsEqual(a: Point2D, b: Point2D): boolean {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon
  }

  function findConnectedEdge(point: Point2D, excludeIdx: number): number {
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i) || i === excludeIdx) continue
      if (pointsEqual(edges[i].p1, point) || pointsEqual(edges[i].p2, point)) {
        return i
      }
    }
    return -1
  }

  // Build contours by connecting edges
  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (used.has(startIdx)) continue

    const contour: Point2D[] = []
    let currentIdx = startIdx
    let currentPoint = edges[startIdx].p1
    contour.push({ ...currentPoint })

    while (true) {
      used.add(currentIdx)
      const edge = edges[currentIdx]

      // Move to the other end of this edge
      const nextPoint = pointsEqual(edge.p1, currentPoint) ? edge.p2 : edge.p1
      contour.push({ ...nextPoint })
      currentPoint = nextPoint

      // Find next connected edge
      const nextIdx = findConnectedEdge(currentPoint, currentIdx)

      if (nextIdx === -1) {
        // End of chain (shouldn't happen for closed contours)
        break
      }

      if (nextIdx === startIdx) {
        // Closed the loop
        break
      }

      currentIdx = nextIdx
    }

    // Remove duplicate closing point if present
    if (contour.length > 1 && pointsEqual(contour[0], contour[contour.length - 1])) {
      contour.pop()
    }

    if (contour.length >= 3) {
      // Determine if this is a hole by checking winding order
      // Note: Y is flipped in marching squares, so positive area = hole (CW), negative = outer (CCW)
      const isHole = calculateSignedArea(contour) > 0
      contours.push({ points: contour, isHole })
    }
  }

  return contours
}

/**
 * Calculate signed area of a polygon (positive = CCW, negative = CW)
 */
function calculateSignedArea(points: Point2D[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return area / 2
}

/**
 * Smooth a contour using Chaikin's corner-cutting algorithm
 * This creates smoother curves from the jagged marching squares output
 */
function smoothContour(points: Point2D[], iterations: number = 2): Point2D[] {
  if (points.length < 3) return points

  let result = [...points]

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Point2D[] = []
    const n = result.length

    for (let i = 0; i < n; i++) {
      const p0 = result[i]
      const p1 = result[(i + 1) % n]

      // Chaikin's algorithm: create two points at 1/4 and 3/4 along each edge
      smoothed.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      })
      smoothed.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      })
    }

    result = smoothed
  }

  return result
}

/**
 * Extract all contours from a bitmap
 */
function extractContours(bitmap: number[]): Contour[] {
  const grid = bitmapToGrid(bitmap)
  const edges = extractEdges(grid)
  const rawContours = connectEdges(edges)

  // Apply smoothing to all contours
  return rawContours.map(contour => ({
    points: smoothContour(contour.points, 2),
    isHole: contour.isHole,
  }))
}

// ============================================================================
// Triangulation using Ear Clipping
// ============================================================================

/**
 * Bridge holes to outer contour to create a simple polygon
 */
function bridgeHoles(outer: Point2D[], holes: Point2D[][]): Point2D[] {
  if (holes.length === 0) return [...outer]

  let result = [...outer]

  for (const hole of holes) {
    // Find the rightmost point of the hole
    let holeIdx = 0
    for (let i = 1; i < hole.length; i++) {
      if (hole[i].x > hole[holeIdx].x) {
        holeIdx = i
      }
    }
    const holePoint = hole[holeIdx]

    // Find the closest point on the outer contour to the right of holePoint
    let bestOuterIdx = 0
    let bestDist = Infinity

    for (let i = 0; i < result.length; i++) {
      const p = result[i]
      const dist = Math.abs(p.x - holePoint.x) + Math.abs(p.y - holePoint.y)
      if (dist < bestDist) {
        bestDist = dist
        bestOuterIdx = i
      }
    }

    // Insert bridge: outer[bestOuterIdx] -> hole (starting at holeIdx) -> back to outer[bestOuterIdx]
    const bridged: Point2D[] = []

    // Add outer points up to and including bridge point
    for (let i = 0; i <= bestOuterIdx; i++) {
      bridged.push(result[i])
    }

    // Add hole points starting from holeIdx
    for (let i = 0; i < hole.length; i++) {
      const idx = (holeIdx + i) % hole.length
      bridged.push(hole[idx])
    }

    // Add bridge back (duplicate of hole start point and outer bridge point)
    bridged.push(hole[holeIdx])
    bridged.push(result[bestOuterIdx])

    // Add remaining outer points (skip bestOuterIdx as we just added it)
    for (let i = bestOuterIdx + 1; i < result.length; i++) {
      bridged.push(result[i])
    }

    result = bridged
  }

  return result
}

/**
 * Check if point c is to the left of line from a to b
 */
function isLeftOf(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * Check if point p is inside triangle abc
 */
function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const d1 = isLeftOf(a, b, p)
  const d2 = isLeftOf(b, c, p)
  const d3 = isLeftOf(c, a, p)

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)

  return !(hasNeg && hasPos)
}

/**
 * Check if vertex at index i is an ear
 */
function isEar(polygon: Point2D[], i: number): boolean {
  const n = polygon.length
  const prev = (i - 1 + n) % n
  const next = (i + 1) % n

  const a = polygon[prev]
  const b = polygon[i]
  const c = polygon[next]

  // Check if this is a convex vertex (left turn)
  if (isLeftOf(a, b, c) <= 0) {
    return false
  }

  // Check if any other vertex is inside this triangle
  for (let j = 0; j < n; j++) {
    if (j === prev || j === i || j === next) continue
    if (pointInTriangle(polygon[j], a, b, c)) {
      return false
    }
  }

  return true
}

/**
 * Triangulate a simple polygon using ear clipping
 */
function triangulate(polygon: Point2D[]): number[][] {
  const triangles: number[][] = []

  if (polygon.length < 3) return triangles
  if (polygon.length === 3) {
    return [[0, 1, 2]]
  }

  // Create index array
  const indices: number[] = []
  for (let i = 0; i < polygon.length; i++) {
    indices.push(i)
  }

  // Work with a copy of points
  const points = [...polygon]

  let safetyCounter = points.length * 2

  while (points.length > 3 && safetyCounter > 0) {
    safetyCounter--
    let foundEar = false

    for (let i = 0; i < points.length; i++) {
      if (isEar(points, i)) {
        const n = points.length
        const prev = (i - 1 + n) % n
        const next = (i + 1) % n

        triangles.push([indices[prev], indices[i], indices[next]])

        // Remove the ear vertex
        points.splice(i, 1)
        indices.splice(i, 1)
        foundEar = true
        break
      }
    }

    if (!foundEar) {
      // Fallback: couldn't find ear, might be degenerate polygon
      break
    }
  }

  // Add final triangle
  if (points.length === 3) {
    triangles.push([indices[0], indices[1], indices[2]])
  }

  return triangles
}

// ============================================================================
// Mesh Generation
// ============================================================================

/**
 * Build a complete 3D mesh for a character using smooth contour extrusion
 */
function buildGlyphMesh(char: string, depth: number): GlyphMesh | null {
  const bitmap = FONT_5X7[char] || FONT_5X7[char.toUpperCase()]

  if (!bitmap) {
    console.warn(`[GlyphMesh] No bitmap found for '${char}'`)
    return null
  }

  return buildSmoothExtrusionMesh(bitmap, depth)
}

/**
 * Build a smooth extruded mesh from bitmap using contour extraction
 */
function buildSmoothExtrusionMesh(bitmap: number[], depth: number): GlyphMesh | null {
  const vertices: number[] = []
  const indices: number[] = []

  const halfDepth = depth / 2

  // Scale factors
  const scaleX = 1.0 / GRID_WIDTH
  const scaleY = 1.0 / GRID_HEIGHT
  const offsetX = -0.5
  const offsetY = 0

  // Convert bitmap to grid
  const grid: boolean[][] = []
  for (let row = 0; row < GRID_HEIGHT; row++) {
    const rowData: boolean[] = []
    const bits = bitmap[row]
    for (let col = 0; col < GRID_WIDTH; col++) {
      // Bit 4 is leftmost, bit 0 is rightmost
      const filled = ((bits >> (4 - col)) & 1) === 1
      rowData.push(filled)
    }
    grid.push(rowData)
  }

  // Helper to check if cell is filled (with bounds check)
  function isFilled(row: number, col: number): boolean {
    if (row < 0 || row >= GRID_HEIGHT || col < 0 || col >= GRID_WIDTH) return false
    return grid[row][col]
  }

  // Transform grid coords to world coords
  function toWorld(col: number, row: number): [number, number] {
    // Flip Y so row 0 (top of bitmap) is at top of glyph
    const worldX = col * scaleX + offsetX
    const worldY = (GRID_HEIGHT - row) * scaleY + offsetY
    return [worldX, worldY]
  }

  let vertexCount = 0

  // For each filled cell, add front face, back face, and edge faces where needed
  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < GRID_WIDTH; col++) {
      if (!isFilled(row, col)) continue

      // Get the 4 corners of this cell in world space
      const [x0, y1] = toWorld(col, row)      // top-left
      const [x1, _y1] = toWorld(col + 1, row)  // top-right
      const [_x0, y0] = toWorld(col, row + 1)  // bottom-left
      const [_x1, _y0] = toWorld(col + 1, row + 1) // bottom-right

      const baseIdx = vertexCount

      // Front face (+Z) - 4 vertices
      vertices.push(x0, y0, halfDepth, 0, 0, 1)  // bottom-left
      vertices.push(x1, y0, halfDepth, 0, 0, 1)  // bottom-right
      vertices.push(x1, y1, halfDepth, 0, 0, 1)  // top-right
      vertices.push(x0, y1, halfDepth, 0, 0, 1)  // top-left
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3)

      // Back face (-Z) - 4 vertices
      vertices.push(x1, y0, -halfDepth, 0, 0, -1)
      vertices.push(x0, y0, -halfDepth, 0, 0, -1)
      vertices.push(x0, y1, -halfDepth, 0, 0, -1)
      vertices.push(x1, y1, -halfDepth, 0, 0, -1)
      indices.push(baseIdx + 4, baseIdx + 5, baseIdx + 6, baseIdx + 4, baseIdx + 6, baseIdx + 7)

      vertexCount += 8

      // Add edge faces only where there's no adjacent filled cell
      // This creates the extruded outline effect

      // Top edge (if no cell above)
      if (!isFilled(row - 1, col)) {
        const idx = vertexCount
        vertices.push(x0, y1, halfDepth, 0, 1, 0)
        vertices.push(x1, y1, halfDepth, 0, 1, 0)
        vertices.push(x1, y1, -halfDepth, 0, 1, 0)
        vertices.push(x0, y1, -halfDepth, 0, 1, 0)
        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3)
        vertexCount += 4
      }

      // Bottom edge (if no cell below)
      if (!isFilled(row + 1, col)) {
        const idx = vertexCount
        vertices.push(x1, y0, halfDepth, 0, -1, 0)
        vertices.push(x0, y0, halfDepth, 0, -1, 0)
        vertices.push(x0, y0, -halfDepth, 0, -1, 0)
        vertices.push(x1, y0, -halfDepth, 0, -1, 0)
        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3)
        vertexCount += 4
      }

      // Left edge (if no cell to left)
      if (!isFilled(row, col - 1)) {
        const idx = vertexCount
        vertices.push(x0, y0, halfDepth, -1, 0, 0)
        vertices.push(x0, y1, halfDepth, -1, 0, 0)
        vertices.push(x0, y1, -halfDepth, -1, 0, 0)
        vertices.push(x0, y0, -halfDepth, -1, 0, 0)
        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3)
        vertexCount += 4
      }

      // Right edge (if no cell to right)
      if (!isFilled(row, col + 1)) {
        const idx = vertexCount
        vertices.push(x1, y1, halfDepth, 1, 0, 0)
        vertices.push(x1, y0, halfDepth, 1, 0, 0)
        vertices.push(x1, y0, -halfDepth, 1, 0, 0)
        vertices.push(x1, y1, -halfDepth, 1, 0, 0)
        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3)
        vertexCount += 4
      }
    }
  }

  if (vertices.length === 0) return null

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    vertexCount,
    indexCount: indices.length
  }
}

/**
 * Build mesh by extruding each pixel as a small box
 * This gives clean, readable glyphs that match the pixel font aesthetic
 */
function buildPixelExtrusionMesh(bitmap: number[], depth: number): GlyphMesh | null {
  const vertices: number[] = []
  const indices: number[] = []

  const halfDepth = depth / 2

  // Scale to normalize: 5 pixels wide -> 1 unit, 7 pixels tall -> 1.4 units
  const pixelW = 1.0 / GRID_WIDTH
  const pixelH = 1.0 / GRID_HEIGHT
  const offsetX = -0.5  // Center horizontally
  const offsetY = 0     // Base at Y=0

  // Small gap between pixels for cleaner look
  const gap = 0.02
  const pw = pixelW - gap
  const ph = pixelH - gap

  let vertexCount = 0

  // Helper to add a box for one pixel
  function addPixelBox(gridX: number, gridY: number) {
    // Convert grid position to world position
    const x = gridX * pixelW + offsetX + gap / 2
    const y = gridY * pixelH + offsetY + gap / 2

    // 8 corners of the box
    const x0 = x, x1 = x + pw
    const y0 = y, y1 = y + ph
    const z0 = -halfDepth, z1 = halfDepth

    const baseIdx = vertexCount

    // Front face (+Z)
    vertices.push(x0, y0, z1, 0, 0, 1)
    vertices.push(x1, y0, z1, 0, 0, 1)
    vertices.push(x1, y1, z1, 0, 0, 1)
    vertices.push(x0, y1, z1, 0, 0, 1)
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3)

    // Back face (-Z)
    vertices.push(x1, y0, z0, 0, 0, -1)
    vertices.push(x0, y0, z0, 0, 0, -1)
    vertices.push(x0, y1, z0, 0, 0, -1)
    vertices.push(x1, y1, z0, 0, 0, -1)
    indices.push(baseIdx + 4, baseIdx + 5, baseIdx + 6, baseIdx + 4, baseIdx + 6, baseIdx + 7)

    // Top face (+Y)
    vertices.push(x0, y1, z1, 0, 1, 0)
    vertices.push(x1, y1, z1, 0, 1, 0)
    vertices.push(x1, y1, z0, 0, 1, 0)
    vertices.push(x0, y1, z0, 0, 1, 0)
    indices.push(baseIdx + 8, baseIdx + 9, baseIdx + 10, baseIdx + 8, baseIdx + 10, baseIdx + 11)

    // Bottom face (-Y)
    vertices.push(x0, y0, z0, 0, -1, 0)
    vertices.push(x1, y0, z0, 0, -1, 0)
    vertices.push(x1, y0, z1, 0, -1, 0)
    vertices.push(x0, y0, z1, 0, -1, 0)
    indices.push(baseIdx + 12, baseIdx + 13, baseIdx + 14, baseIdx + 12, baseIdx + 14, baseIdx + 15)

    // Right face (+X)
    vertices.push(x1, y0, z1, 1, 0, 0)
    vertices.push(x1, y0, z0, 1, 0, 0)
    vertices.push(x1, y1, z0, 1, 0, 0)
    vertices.push(x1, y1, z1, 1, 0, 0)
    indices.push(baseIdx + 16, baseIdx + 17, baseIdx + 18, baseIdx + 16, baseIdx + 18, baseIdx + 19)

    // Left face (-X)
    vertices.push(x0, y0, z0, -1, 0, 0)
    vertices.push(x0, y0, z1, -1, 0, 0)
    vertices.push(x0, y1, z1, -1, 0, 0)
    vertices.push(x0, y1, z0, -1, 0, 0)
    indices.push(baseIdx + 20, baseIdx + 21, baseIdx + 22, baseIdx + 20, baseIdx + 22, baseIdx + 23)

    vertexCount += 24
  }

  // Iterate through bitmap and add a box for each filled pixel
  for (let row = 0; row < GRID_HEIGHT; row++) {
    const rowBits = bitmap[row]
    for (let col = 0; col < GRID_WIDTH; col++) {
      const bit = (rowBits >> (4 - col)) & 1
      if (bit) {
        // Grid Y is flipped (row 0 is top, but we want Y=0 at bottom)
        const gridY = GRID_HEIGHT - 1 - row
        addPixelBox(col, gridY)
      }
    }
  }

  if (vertices.length === 0) {
    return null
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    vertexCount: vertexCount,
    indexCount: indices.length
  }
}

/**
 * UNUSED - Complex contour-based mesh building (kept for reference)
 * Build a complete 3D mesh for a character using contour extraction
 */
function buildGlyphMeshContour(char: string, depth: number): GlyphMesh | null {
  const bitmap = FONT_5X7[char] || FONT_5X7[char.toUpperCase()]

  if (!bitmap) {
    return null
  }

  const contours = extractContours(bitmap)

  if (contours.length === 0) {
    return null
  }

  // Separate outer contours and holes
  const outerContours = contours.filter(c => !c.isHole)
  const holes = contours.filter(c => c.isHole)

  if (outerContours.length === 0) {
    return null
  }

  // Build vertex and index arrays
  const vertices: number[] = []
  const indices: number[] = []

  const halfDepth = depth / 2

  // Scale factor to normalize the glyph (5x7 grid -> roughly 1x1.4 units)
  // Center horizontally and vertically
  const scaleX = 1.0 / GRID_WIDTH
  const scaleY = 1.0 / GRID_HEIGHT
  const offsetX = -0.5  // Center X
  const offsetY = 0     // Base at Y=0

  // Helper to add a vertex
  function addVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    // Transform to normalized coordinates
    const px = x * scaleX + offsetX
    const py = y * scaleY + offsetY
    const pz = z

    vertices.push(px, py, pz, nx, ny, nz)
  }

  // Process each outer contour (handles characters with multiple disconnected parts like 'i', '!')
  for (const outer of outerContours) {
    // Find holes that belong to this outer contour (contained within it)
    // For simplicity, we associate all holes with the first outer contour
    // A more robust solution would check containment
    const isFirstOuter = outer === outerContours[0]
    const holePoints = isFirstOuter ? holes.map(h => h.points) : []

    // Bridge holes to outer contour
    const simplePolygon = bridgeHoles(outer.points, holePoints)

    // Triangulate
    const triangleIndices = triangulate(simplePolygon)

    // ---- Front face (z = +halfDepth) ----
    const frontBaseVertex = vertices.length / 6

    // Add all polygon vertices for front face
    for (const p of simplePolygon) {
      addVertex(p.x, p.y, halfDepth, 0, 0, 1)
    }

    // Add triangles for front face
    for (const tri of triangleIndices) {
      indices.push(
        frontBaseVertex + tri[0],
        frontBaseVertex + tri[1],
        frontBaseVertex + tri[2]
      )
    }

    // ---- Back face (z = -halfDepth) ----
    const backBaseVertex = vertices.length / 6

    // Add all polygon vertices for back face
    for (const p of simplePolygon) {
      addVertex(p.x, p.y, -halfDepth, 0, 0, -1)
    }

    // Add triangles for back face (reversed winding)
    for (const tri of triangleIndices) {
      indices.push(
        backBaseVertex + tri[0],
        backBaseVertex + tri[2],
        backBaseVertex + tri[1]
      )
    }

    // ---- Side faces (extrusion) ----
    // For each edge of this outer contour and its holes, create a quad
    const allContourPoints: Point2D[][] = [outer.points, ...holePoints]

    for (const contourPoints of allContourPoints) {
      const n = contourPoints.length
      const isOuterContour = contourPoints === outer.points

      for (let i = 0; i < n; i++) {
        const p1 = contourPoints[i]
        const p2 = contourPoints[(i + 1) % n]

        // Calculate normal perpendicular to edge (pointing outward)
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const len = Math.sqrt(dx * dx + dy * dy)

        if (len < 0.001) continue

        // Normal perpendicular to edge (rotate 90 degrees)
        // For CCW winding, this points outward
        const nx = -dy / len
        const ny = dx / len

        // Scale normal by contour direction
        // Outer contours are CCW (normal points out)
        // Holes are CW (normal should point inward, but we want faces outward)
        const normalScale = isOuterContour ? 1 : -1

        const sideBaseVertex = vertices.length / 6

        // Quad vertices (front-left, front-right, back-right, back-left)
        addVertex(p1.x, p1.y, halfDepth, nx * normalScale, ny * normalScale, 0)
        addVertex(p2.x, p2.y, halfDepth, nx * normalScale, ny * normalScale, 0)
        addVertex(p2.x, p2.y, -halfDepth, nx * normalScale, ny * normalScale, 0)
        addVertex(p1.x, p1.y, -halfDepth, nx * normalScale, ny * normalScale, 0)

        // Two triangles for the quad
        indices.push(
          sideBaseVertex + 0,
          sideBaseVertex + 1,
          sideBaseVertex + 2,
          sideBaseVertex + 0,
          sideBaseVertex + 2,
          sideBaseVertex + 3
        )
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    vertexCount: vertices.length / 6,
    indexCount: indices.length
  }
}

// ============================================================================
// Mesh Cache
// ============================================================================

const glyphMeshCache: Map<string, GlyphMesh | null> = new Map()

/**
 * Get or create a glyph mesh (cached)
 */
export function getGlyphMesh(char: string): GlyphMesh | null {
  if (!glyphMeshCache.has(char)) {
    glyphMeshCache.set(char, buildGlyphMesh(char, EXTRUSION_DEPTH))
  }
  return glyphMeshCache.get(char) || null
}

/**
 * Clear the mesh cache (useful for hot reloading)
 */
export function clearGlyphMeshCache(): void {
  glyphMeshCache.clear()
}

/**
 * Get all cached mesh keys (for debugging)
 */
export function getCachedGlyphChars(): string[] {
  return Array.from(glyphMeshCache.keys())
}
