// Scene management - holds voxel instances and handles animation

import { VoxelInstance, VoxelFlags, INSTANCE_BYTES } from './types'
import { buildGlyph } from './GlyphBuilder'
import { getGlyphMesh, clearGlyphMeshCache } from './GlyphMeshBuilder'
import type { Node } from '../stores/engineState'
import type { AABB, PickableInstance } from './Raycaster'

export class Scene {
  private instances: VoxelInstance[] = []
  private waterInstances: VoxelInstance[] = []
  time: number = 0

  // Instance-to-node mapping for picking
  private instanceNodeMap: Array<{ nodeId: string; aabb: AABB }> = []

  // Hover state for highlighting
  private hoveredNodeId: string | null = null

  // Glyph mesh data (batched for all glyphs in scene)
  private glyphVertices: number[] = []
  private glyphIndices: number[] = []
  private glyphVertexCount: number = 0

  // Use smooth mesh rendering for glyphs
  private useSmoothGlyphs: boolean = true

  // Add a single voxel cube
  addVoxel(
    x: number, y: number, z: number,
    color: [number, number, number, number],
    scaleX = 1, scaleY = 1, scaleZ = 1,
    emission = 0,
    flags = VoxelFlags.NONE
  ) {
    const instance: VoxelInstance = {
      position: [x, y, z],
      scale: [scaleX, scaleY, scaleZ],
      color,
      emission,
      flags,
    }

    if (flags & VoxelFlags.WATER) {
      this.waterInstances.push(instance)
    } else {
      this.instances.push(instance)
    }
  }

  // Add a flat floor area
  addFloor(
    startX: number, startZ: number,
    width: number, depth: number,
    color: [number, number, number, number],
    y = 0
  ) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        // Slight color variation for grass
        const variation = Math.random() * 0.1 - 0.05
        const variedColor: [number, number, number, number] = [
          Math.min(1, Math.max(0, color[0] + variation)),
          Math.min(1, Math.max(0, color[1] + variation)),
          Math.min(1, Math.max(0, color[2] + variation)),
          color[3],
        ]
        // Ground tiles - 1 unit deep
        this.addVoxel(startX + x, y - 0.5, startZ + z, variedColor, 1, 1.0, 1)
      }
    }
  }

  // Add a wall segment
  addWall(x: number, z: number, height: number, color: [number, number, number, number] = [0.5, 0.4, 0.35, 1]) {
    for (let y = 0; y < height; y++) {
      this.addVoxel(x, y + 0.5, z, color)
    }
  }

  // Add an ASCII glyph (extruded smooth polygon mesh)
  addGlyph(
    char: string,
    x: number, y: number, z: number,
    color: [number, number, number, number],
    scale = 1,
    emission = 0
  ) {
    if (this.useSmoothGlyphs) {
      this.addSmoothGlyph(char, x, y, z, color, scale, emission)
    } else {
      // Fallback to voxel-based rendering
      this.addVoxelGlyph(char, x, y, z, color, scale, emission)
    }
  }

  // Add a smooth polygon mesh glyph
  private addSmoothGlyph(
    char: string,
    x: number, y: number, z: number,
    color: [number, number, number, number],
    scale: number,
    emission: number
  ) {
    const mesh = getGlyphMesh(char)

    if (!mesh) {
      // Fallback to voxel rendering for unsupported characters
      this.addVoxelGlyph(char, x, y, z, color, scale, emission)
      return
    }

    const baseVertex = this.glyphVertexCount

    // Transform mesh vertices to world position
    // Mesh vertices are: position (3) + normal (3) = 6 floats per vertex
    // We output: position (3) + normal (3) + color (4) + emission (1) = 11 floats per vertex
    for (let i = 0; i < mesh.vertices.length; i += 6) {
      // Position (transformed)
      this.glyphVertices.push(
        x + mesh.vertices[i] * scale,      // x
        y + mesh.vertices[i + 1] * scale,  // y
        z + mesh.vertices[i + 2] * scale   // z
      )
      // Normal (unchanged)
      this.glyphVertices.push(
        mesh.vertices[i + 3],
        mesh.vertices[i + 4],
        mesh.vertices[i + 5]
      )
      // Color
      this.glyphVertices.push(color[0], color[1], color[2], color[3])
      // Emission
      this.glyphVertices.push(emission)
    }

    // Add indices with offset
    for (let i = 0; i < mesh.indices.length; i++) {
      this.glyphIndices.push(baseVertex + mesh.indices[i])
    }

    this.glyphVertexCount += mesh.vertexCount
  }

  // Fallback: Add a voxel-based glyph (original implementation)
  private addVoxelGlyph(
    char: string,
    x: number, y: number, z: number,
    color: [number, number, number, number],
    scale: number,
    emission: number
  ) {
    const glyphVoxels = buildGlyph(char)
    for (const voxel of glyphVoxels) {
      this.addVoxel(
        x + voxel.x * scale * 0.2,
        y + voxel.y * scale * 0.2,
        z + voxel.z * scale * 0.2,
        color,
        scale * 0.18,
        scale * 0.18,
        scale * 0.18,
        emission
      )
    }
  }

  // Toggle smooth glyph rendering
  setUseSmoothGlyphs(value: boolean) {
    this.useSmoothGlyphs = value
  }

  getUseSmoothGlyphs(): boolean {
    return this.useSmoothGlyphs
  }

  // Add a simple tree (trunk + foliage)
  addTree(x: number, z: number, trunkHeight = 2) {
    const trunkColor: [number, number, number, number] = [0.4, 0.25, 0.15, 1]
    const leafColor: [number, number, number, number] = [0.2, 0.5, 0.15, 1]

    // Trunk
    for (let y = 0; y < trunkHeight; y++) {
      this.addVoxel(x, y + 0.6, z, trunkColor, 0.3, 1, 0.3)
    }

    // Foliage (simple blocky crown)
    const foliageY = trunkHeight + 0.5
    // Center column
    this.addVoxel(x, foliageY, z, leafColor, 0.8, 0.8, 0.8, 0, VoxelFlags.FOLIAGE)
    this.addVoxel(x, foliageY + 0.7, z, leafColor, 0.6, 0.6, 0.6, 0, VoxelFlags.FOLIAGE)
    // Side branches
    this.addVoxel(x + 0.5, foliageY - 0.2, z, leafColor, 0.5, 0.5, 0.5, 0, VoxelFlags.FOLIAGE)
    this.addVoxel(x - 0.5, foliageY - 0.2, z, leafColor, 0.5, 0.5, 0.5, 0, VoxelFlags.FOLIAGE)
    this.addVoxel(x, foliageY - 0.2, z + 0.5, leafColor, 0.5, 0.5, 0.5, 0, VoxelFlags.FOLIAGE)
    this.addVoxel(x, foliageY - 0.2, z - 0.5, leafColor, 0.5, 0.5, 0.5, 0, VoxelFlags.FOLIAGE)
  }

  // Add a cloud cluster
  addCloud(x: number, y: number, z: number) {
    const cloudColor: [number, number, number, number] = [0.95, 0.95, 0.98, 0.9]

    // Main body
    this.addVoxel(x, y, z, cloudColor, 1.5, 0.6, 1, 0.1, VoxelFlags.CLOUD)
    this.addVoxel(x + 0.8, y - 0.1, z, cloudColor, 1, 0.5, 0.8, 0.1, VoxelFlags.CLOUD)
    this.addVoxel(x - 0.6, y + 0.1, z + 0.2, cloudColor, 0.8, 0.4, 0.7, 0.1, VoxelFlags.CLOUD)
    this.addVoxel(x + 0.3, y + 0.2, z - 0.3, cloudColor, 0.7, 0.4, 0.6, 0.1, VoxelFlags.CLOUD)
  }

  // Add a pond (water surface)
  addPond(x: number, z: number, width: number, depth: number) {
    const waterColor: [number, number, number, number] = [0.2, 0.4, 0.6, 0.7]

    for (let px = 0; px < width; px++) {
      for (let pz = 0; pz < depth; pz++) {
        this.addVoxel(
          x + px, 0.05, z + pz,
          waterColor,
          1, 0.1, 1,
          0,
          VoxelFlags.WATER
        )
      }
    }
  }

  // Update animation state
  update(deltaTime: number) {
    this.time += deltaTime
  }

  // Get total instance count
  getInstanceCount(): number {
    return this.instances.length + this.waterInstances.length
  }

  getNonWaterInstanceCount(): number {
    return this.instances.length
  }

  getWaterInstanceCount(): number {
    return this.waterInstances.length
  }

  // Get packed instance data for GPU buffer
  getInstanceData(): Float32Array {
    const totalCount = this.getInstanceCount()
    const data = new Float32Array(totalCount * (INSTANCE_BYTES / 4))

    let offset = 0

    // Pack non-water instances first
    for (const inst of this.instances) {
      this.packInstance(data, offset, inst)
      offset += INSTANCE_BYTES / 4
    }

    // Then water instances
    for (const inst of this.waterInstances) {
      this.packInstance(data, offset, inst)
      offset += INSTANCE_BYTES / 4
    }

    return data
  }

  // Get glyph mesh vertex data for GPU buffer
  // Layout: position (3) + normal (3) + color (4) + emission (1) = 11 floats per vertex
  getGlyphVertexData(): Float32Array {
    return new Float32Array(this.glyphVertices)
  }

  // Get glyph mesh index data for GPU buffer
  getGlyphIndexData(): Uint32Array {
    return new Uint32Array(this.glyphIndices)
  }

  // Get glyph vertex count
  getGlyphVertexCount(): number {
    return this.glyphVertexCount
  }

  // Get glyph index count
  getGlyphIndexCount(): number {
    return this.glyphIndices.length
  }

  // Check if there are any glyphs to render
  hasGlyphs(): boolean {
    return this.glyphIndices.length > 0
  }

  private packInstance(data: Float32Array, offset: number, inst: VoxelInstance) {
    // Build transform matrix (translation * scale)
    const [px, py, pz] = inst.position
    const [sx, sy, sz] = inst.scale

    // Column-major 4x4 matrix
    data[offset + 0] = sx   // col 0
    data[offset + 1] = 0
    data[offset + 2] = 0
    data[offset + 3] = 0

    data[offset + 4] = 0    // col 1
    data[offset + 5] = sy
    data[offset + 6] = 0
    data[offset + 7] = 0

    data[offset + 8] = 0    // col 2
    data[offset + 9] = 0
    data[offset + 10] = sz
    data[offset + 11] = 0

    data[offset + 12] = px  // col 3 (translation)
    data[offset + 13] = py
    data[offset + 14] = pz
    data[offset + 15] = 1

    // Color
    data[offset + 16] = inst.color[0]
    data[offset + 17] = inst.color[1]
    data[offset + 18] = inst.color[2]
    data[offset + 19] = inst.color[3]

    // Emission and flags
    data[offset + 20] = inst.emission
    // Store flags as float (will be cast to uint in shader)
    data[offset + 21] = inst.flags
    data[offset + 22] = 0 // padding
    data[offset + 23] = 0 // padding
  }

  // Clear all instances
  clear() {
    this.instances = []
    this.waterInstances = []
    this.instanceNodeMap = []
    this.floorGenerated = false
    // Clear glyph mesh data
    this.glyphVertices = []
    this.glyphIndices = []
    this.glyphVertexCount = 0
    // Clear glyph mesh cache to pick up any code changes during development
    clearGlyphMeshCache()
  }

  // Set hovered node for highlight effect
  setHoveredNode(nodeId: string | null) {
    this.hoveredNodeId = nodeId
  }

  // Get hovered node
  getHoveredNode(): string | null {
    return this.hoveredNodeId
  }

  // Get pickable instances for raycasting
  getPickableInstances(): PickableInstance[] {
    return this.instanceNodeMap.map((item, index) => ({
      nodeId: item.nodeId,
      aabb: item.aabb,
      instanceIndex: index,
    }))
  }

  // Get unique node IDs that have pickable instances
  getPickableNodeIds(): string[] {
    const ids = new Set<string>()
    for (const item of this.instanceNodeMap) {
      ids.add(item.nodeId)
    }
    return Array.from(ids)
  }

  // Track an instance for picking
  private trackInstance(nodeId: string, position: [number, number, number], scale: [number, number, number]) {
    const halfScale: [number, number, number] = [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5]
    const aabb: AABB = {
      min: [position[0] - halfScale[0], position[1] - halfScale[1], position[2] - halfScale[2]],
      max: [position[0] + halfScale[0], position[1] + halfScale[1], position[2] + halfScale[2]],
    }
    this.instanceNodeMap.push({ nodeId, aabb })
  }

  // Build scene from Node tree (from engine state)
  buildFromNodes(rootNode: Node, selectedNodes: string[] = []) {
    this.clear()

    // Recursively process all nodes
    const processNode = (node: Node) => {
      // Check for floor generator component (builtin)
      const floorComp = node.components.find(c => c.script === 'builtin:floor_generator')
      if (floorComp && floorComp.enabled) {
        this.generateFloorTiles(node.id, floorComp.properties as FloorConfig)
      }

      // Only render nodes that have both transform and visual properties
      if (node.transform && node.visual && node.visual.visible) {
        const [px, py, pz] = node.transform.position
        const [sx, sy, sz] = node.transform.scale
        const [r, g, b] = node.visual.color
        const opacity = node.visual.opacity

        // Check if node is selected or hovered (for highlight effect)
        const isSelected = selectedNodes.includes(node.id)
        const _isHovered = this.hoveredNodeId === node.id // Used for wireframe box, not emission

        // Emission from visual or 0
        let emission = 0
        if (node.visual.emission && node.visual.emissionPower) {
          emission = node.visual.emissionPower
        }

        // Apply highlight: selection only (wireframe box is used for hover)
        const getHighlightedEmission = (baseEmission: number) => {
          if (isSelected) return Math.max(baseEmission, 0.5)
          return baseEmission
        }

        // If there's a glyph, render it as an extruded ASCII character
        if (node.visual.glyph && node.visual.glyph.length > 0) {
          const char = node.visual.glyph[0]
          const color: [number, number, number, number] = [r, g, b, opacity]
          const glyphScale = Math.min(sx, sy, sz)
          const voxelEmission = getHighlightedEmission(emission)

          // Use the new addGlyph method (smooth mesh or voxel fallback)
          this.addGlyph(char, px, py, pz, color, glyphScale, voxelEmission)

          // Track for picking (single bounding box for the whole glyph)
          // Glyph is roughly 1 unit wide and 1.4 units tall after normalization
          const glyphBounds: [number, number, number] = [glyphScale, glyphScale * 1.4, glyphScale * 0.4]
          this.trackInstance(node.id, [px, py + glyphScale * 0.7, pz], glyphBounds)
        } else {
          // No glyph - render as a simple cube
          const color: [number, number, number, number] = [r, g, b, opacity]
          const voxelEmission = getHighlightedEmission(emission)

          this.addVoxel(px, py, pz, color, sx, sy, sz, voxelEmission, VoxelFlags.NONE)
          this.trackInstance(node.id, [px, py, pz], [sx, sy, sz])
        }
      }

      // Process children recursively
      for (const child of node.children) {
        processNode(child)
      }
    }

    // Start processing from root's children (skip the root itself)
    for (const child of rootNode.children) {
      processNode(child)
    }

    // If no floor node with component exists, add default floor
    const hasFloorNode = this.hasFloorGenerated()
    if (!hasFloorNode) {
      this.generateDefaultFloor()
    }
  }

  // Check if floor has been generated
  private floorGenerated = false

  private hasFloorGenerated(): boolean {
    return this.floorGenerated
  }

  // Generate floor tiles from floor component config
  private generateFloorTiles(nodeId: string, config: FloorConfig) {
    this.floorGenerated = true

    const size = config.size || [21, 21]
    const tileSize = config.tileSize || 1
    const primaryColor = config.primaryColor || [0.15, 0.15, 0.18, 1]
    const secondaryColor = config.secondaryColor || [0.17, 0.17, 0.20, 1]
    const elevation = config.elevation ?? -0.5
    const tileType = config.tileType || 'checkerboard'

    const halfW = Math.floor(size[0] / 2)
    const halfD = Math.floor(size[1] / 2)

    for (let x = -halfW; x <= halfW; x++) {
      for (let z = -halfD; z <= halfD; z++) {
        let color: [number, number, number, number]

        if (tileType === 'checkerboard') {
          const isEven = (x + z) % 2 === 0
          color = isEven ? primaryColor as [number, number, number, number] : secondaryColor as [number, number, number, number]
        } else {
          color = primaryColor as [number, number, number, number]
        }

        this.addVoxel(x * tileSize, elevation, z * tileSize, color, tileSize, 0.1, tileSize, 0, VoxelFlags.NONE)
        // Floor tiles tracked but with lower priority (floor nodeId or special marker)
        this.trackInstance(nodeId, [x * tileSize, elevation, z * tileSize], [tileSize, 0.1, tileSize])
      }
    }
  }

  // Generate default floor (when no floor node exists)
  private generateDefaultFloor() {
    this.floorGenerated = true
    const groundColor: [number, number, number, number] = [0.15, 0.15, 0.18, 1]
    const altColor: [number, number, number, number] = [0.17, 0.17, 0.20, 1]

    for (let x = -10; x <= 10; x++) {
      for (let z = -10; z <= 10; z++) {
        const isEven = (x + z) % 2 === 0
        const color = isEven ? groundColor : altColor
        this.addVoxel(x, -0.5, z, color, 1, 0.1, 1, 0, VoxelFlags.NONE)
        // Don't track default floor for picking (or use special ID)
        // this.trackInstance('__floor__', [x, -0.5, z], [1, 0.1, 1])
      }
    }
  }
}

// Floor component configuration
interface FloorConfig {
  tileType?: 'checkerboard' | 'solid' | 'custom'
  size?: [number, number]
  tileSize?: number
  primaryColor?: [number, number, number, number]
  secondaryColor?: [number, number, number, number]
  elevation?: number
}
