// Scene management - holds voxel instances and handles animation

import { VoxelInstance, VoxelFlags, INSTANCE_BYTES } from './types'
import { buildGlyph } from './GlyphBuilder'
import { getGlyphMesh, clearGlyphMeshCache } from './GlyphMeshBuilder'
import type { Node, NormalizedNode, EntityMaps } from '../stores/engineState'
import { useEngineState } from '../stores/useEngineState'
import type { AABB, PickableInstance } from './Raycaster'
import { entitySubscriptions, type EntitiesChangeCallback } from '../stores/subscriptions'

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

  // Entity subscription for automatic scene updates
  private unsubscribeEntities: (() => void) | null = null
  private unsubscribeSelection: (() => void) | null = null
  private cachedEntities: EntityMaps | null = null
  private cachedSelectedNodes: string[] = []
  private needsRebuild: boolean = false
  private onSceneChanged: (() => void) | null = null

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
    scaleX = 1, scaleY = 1, scaleZ = 1,
    rotation: [number, number, number] = [0, 0, 0],
    emission = 0
  ) {
    if (this.useSmoothGlyphs) {
      this.addSmoothGlyph(char, x, y, z, color, scaleX, scaleY, scaleZ, rotation, emission)
    } else {
      // Fallback to voxel-based rendering
      this.addVoxelGlyph(char, x, y, z, color, Math.min(scaleX, scaleY, scaleZ), emission)
    }
  }

  // Build rotation matrix from Euler angles (XYZ order, degrees)
  private buildRotationMatrix(rotation: [number, number, number]): number[] {
    const [rx, ry, rz] = rotation.map(r => (r * Math.PI) / 180)

    const cosX = Math.cos(rx), sinX = Math.sin(rx)
    const cosY = Math.cos(ry), sinY = Math.sin(ry)
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz)

    // Combined rotation matrix (Rz * Ry * Rx) - row-major
    return [
      cosY * cosZ,                        cosY * sinZ,                        -sinY,
      sinX * sinY * cosZ - cosX * sinZ,   sinX * sinY * sinZ + cosX * cosZ,   sinX * cosY,
      cosX * sinY * cosZ + sinX * sinZ,   cosX * sinY * sinZ - sinX * cosZ,   cosX * cosY
    ]
  }

  // Apply rotation matrix to a 3D vector
  private rotateVector(v: [number, number, number], m: number[]): [number, number, number] {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ]
  }

  // Add a smooth polygon mesh glyph with full transform support
  private addSmoothGlyph(
    char: string,
    x: number, y: number, z: number,
    color: [number, number, number, number],
    scaleX: number, scaleY: number, scaleZ: number,
    rotation: [number, number, number],
    emission: number
  ) {
    const mesh = getGlyphMesh(char)

    if (!mesh) {
      // Fallback to voxel rendering for unsupported characters
      this.addVoxelGlyph(char, x, y, z, color, Math.min(scaleX, scaleY, scaleZ), emission)
      return
    }

    const baseVertex = this.glyphVertexCount

    // Build rotation matrix from Euler angles
    const rotMatrix = this.buildRotationMatrix(rotation)

    // Transform mesh vertices to world position
    // Mesh vertices are: position (3) + normal (3) = 6 floats per vertex
    // We output: position (3) + normal (3) + color (4) + emission (1) = 11 floats per vertex
    for (let i = 0; i < mesh.vertices.length; i += 6) {
      // Get local position and apply scale
      const localPos: [number, number, number] = [
        mesh.vertices[i] * scaleX,
        mesh.vertices[i + 1] * scaleY,
        mesh.vertices[i + 2] * scaleZ
      ]

      // Apply rotation to scaled position
      const rotatedPos = this.rotateVector(localPos, rotMatrix)

      // Position (transformed to world)
      this.glyphVertices.push(
        x + rotatedPos[0],
        y + rotatedPos[1],
        z + rotatedPos[2]
      )

      // Get local normal and rotate it (normals only need rotation, not scale)
      const localNormal: [number, number, number] = [
        mesh.vertices[i + 3],
        mesh.vertices[i + 4],
        mesh.vertices[i + 5]
      ]
      const rotatedNormal = this.rotateVector(localNormal, rotMatrix)

      // Normal (rotated)
      this.glyphVertices.push(
        rotatedNormal[0],
        rotatedNormal[1],
        rotatedNormal[2]
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

  /**
   * Create a minimal shadow test scene for debugging.
   * Just a ground plane and a floating cube - nothing else.
   */
  createShadowTestScene() {
    this.clear()
    this.floorGenerated = true

    // Ground plane: single large flat cube at Y=0
    // Gray color so shadows are visible
    const groundColor: [number, number, number, number] = [0.5, 0.5, 0.5, 1.0]
    this.addVoxel(0, -0.25, 0, groundColor, 20, 0.5, 20, 0, VoxelFlags.NONE)

    // Floating cube: red, at Y=3, should cast shadow on ground
    const cubeColor: [number, number, number, number] = [0.8, 0.2, 0.2, 1.0]
    this.addVoxel(0, 3, 0, cubeColor, 2, 2, 2, 0, VoxelFlags.NONE)

    // Second cube offset to the side
    const cube2Color: [number, number, number, number] = [0.2, 0.8, 0.2, 1.0]
    this.addVoxel(5, 2, 3, cube2Color, 1.5, 1.5, 1.5, 0, VoxelFlags.NONE)

    console.log('[ShadowTest] Created minimal scene: ground plane + 2 floating cubes')
    console.log('[ShadowTest] Ground: Y=-0.25, size 20x0.5x20')
    console.log('[ShadowTest] Red cube: Y=3, size 2x2x2')
    console.log('[ShadowTest] Green cube: pos (5, 2, 3), size 1.5')
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
  // Supports full transform inheritance: children are affected by parent transforms
  buildFromNodes(rootNode: Node, selectedNodes: string[] = []) {
    this.clear()

    // World transform type
    type WorldTransform = {
      position: [number, number, number]
      rotation: [number, number, number]  // Euler angles in degrees
      scale: [number, number, number]
    }

    // Compute world transform by combining parent and local transforms
    const computeWorldTransform = (
      parentWorld: WorldTransform,
      localTransform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
    ): WorldTransform => {
      // Scale: multiply component-wise
      const worldScale: [number, number, number] = [
        parentWorld.scale[0] * localTransform.scale[0],
        parentWorld.scale[1] * localTransform.scale[1],
        parentWorld.scale[2] * localTransform.scale[2],
      ]

      // Rotation: add Euler angles (simplified - proper solution would use quaternions)
      const worldRotation: [number, number, number] = [
        parentWorld.rotation[0] + localTransform.rotation[0],
        parentWorld.rotation[1] + localTransform.rotation[1],
        parentWorld.rotation[2] + localTransform.rotation[2],
      ]

      // Position: scale local position by parent scale, then rotate by parent rotation, then add parent position
      // For now, simplified version without rotation (rotation support can be added later)
      const scaledLocalPos: [number, number, number] = [
        localTransform.position[0] * parentWorld.scale[0],
        localTransform.position[1] * parentWorld.scale[1],
        localTransform.position[2] * parentWorld.scale[2],
      ]

      // Apply parent Y rotation to local position (most common use case)
      const parentYRotRad = (parentWorld.rotation[1] * Math.PI) / 180
      const cosY = Math.cos(parentYRotRad)
      const sinY = Math.sin(parentYRotRad)
      const rotatedPos: [number, number, number] = [
        scaledLocalPos[0] * cosY - scaledLocalPos[2] * sinY,
        scaledLocalPos[1],
        scaledLocalPos[0] * sinY + scaledLocalPos[2] * cosY,
      ]

      const worldPosition: [number, number, number] = [
        parentWorld.position[0] + rotatedPos[0],
        parentWorld.position[1] + rotatedPos[1],
        parentWorld.position[2] + rotatedPos[2],
      ]

      return { position: worldPosition, rotation: worldRotation, scale: worldScale }
    }

    // Identity transform for root
    const identityTransform: WorldTransform = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }

    // Recursively process all nodes with inherited transforms
    const processNode = (node: Node, parentWorldTransform: WorldTransform) => {
      // Compute world transform for this node (handle partial transforms)
      const localTransform = {
        position: node.transform?.position || [0, 0, 0] as [number, number, number],
        rotation: node.transform?.rotation || [0, 0, 0] as [number, number, number],
        scale: node.transform?.scale || [1, 1, 1] as [number, number, number],
      }
      const worldTransform = computeWorldTransform(parentWorldTransform, localTransform)

      // Check for floor generator component (builtin)
      const floorComp = node.components.find(c => c.script === 'builtin:floor_generator')
      if (floorComp && floorComp.enabled) {
        this.generateFloorTiles(node.id, floorComp.properties as FloorConfig)
      }

      // Check for tilemap with meta.cells (ASCII grid)
      if (node.type === 'tilemap' && node.meta?.cells) {
        this.renderTilemap(node.id, node.meta as unknown as TilemapMeta, worldTransform)
      }
      // Only render nodes that have both transform and visual properties
      else if (node.transform && node.visual && node.visual.visible) {
        const [px, py, pz] = worldTransform.position
        const [sx, sy, sz] = worldTransform.scale
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
          const voxelEmission = getHighlightedEmission(emission)

          // Use full scale and rotation for glyph rendering
          this.addGlyph(char, px, py, pz, color, sx, sy, sz, worldTransform.rotation, voxelEmission)

          // Track for picking - bounding box needs to account for scale
          // Glyph is roughly 1 unit wide and 1.4 units tall after normalization
          const glyphBounds: [number, number, number] = [sx, sy * 1.4, sz * 0.4]
          this.trackInstance(node.id, [px, py + sy * 0.7, pz], glyphBounds)
        } else {
          // No glyph - render as a simple cube
          const color: [number, number, number, number] = [r, g, b, opacity]
          const voxelEmission = getHighlightedEmission(emission)

          this.addVoxel(px, py, pz, color, sx, sy, sz, voxelEmission, VoxelFlags.NONE)
          this.trackInstance(node.id, [px, py, pz], [sx, sy, sz])
        }
      }

      // Process children recursively with this node's world transform
      for (const child of node.children) {
        processNode(child, worldTransform)
      }
    }

    // Start processing from root's children (skip the root itself)
    for (const child of rootNode.children) {
      processNode(child, identityTransform)
    }

    // No default floor - everything comes from nodes
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
        this.trackInstance(nodeId, [x * tileSize, elevation, z * tileSize], [tileSize, 0.1, tileSize])
      }
    }
  }

  // Generate default floor (when no floor node exists)
  // Just a simple ground plane - no test objects
  private generateDefaultFloor() {
    this.floorGenerated = true
    const groundColor: [number, number, number, number] = [0.12, 0.12, 0.14, 1]
    const altColor: [number, number, number, number] = [0.14, 0.14, 0.16, 1]

    // Darker floor for ASCII dungeon style
    for (let x = -15; x <= 15; x++) {
      for (let z = -15; z <= 15; z++) {
        const isEven = (x + z) % 2 === 0
        const color = isEven ? groundColor : altColor
        this.addVoxel(x, -0.5, z, color, 1, 0.1, 1, 0, VoxelFlags.NONE)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Entity Subscription System
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Connect to the entity subscription system for automatic updates
   * Call this once when the scene is initialized
   */
  connectToStore(onChanged?: () => void) {
    this.onSceneChanged = onChanged || null

    // Do initial build with current entities
    const state = useEngineState.getState()
    const initialEntities: EntityMaps = {
      nodes: state.entities.nodes,
      components: state.entities.components,
      nodeOrder: state.entities.nodeOrder,
    }
    this.cachedEntities = initialEntities
    this.cachedSelectedNodes = state.selection.nodes
    this.needsRebuild = true

    // Subscribe to entity changes
    this.unsubscribeEntities = entitySubscriptions.subscribeToEntities(
      (entities, changedNodeIds, changedComponentIds) => {
        this.cachedEntities = entities
        this.needsRebuild = true

        // Notify that scene needs rebuild
        if (this.onSceneChanged) {
          this.onSceneChanged()
        }
      }
    )

    // Subscribe to selection changes
    this.unsubscribeSelection = entitySubscriptions.subscribeToSelection(
      (nodeIds, _primaryId) => {
        this.cachedSelectedNodes = nodeIds
        this.needsRebuild = true

        if (this.onSceneChanged) {
          this.onSceneChanged()
        }
      }
    )
  }

  /**
   * Disconnect from the entity subscription system
   * Call this when cleaning up the scene
   */
  disconnectFromStore() {
    if (this.unsubscribeEntities) {
      this.unsubscribeEntities()
      this.unsubscribeEntities = null
    }
    if (this.unsubscribeSelection) {
      this.unsubscribeSelection()
      this.unsubscribeSelection = null
    }
    this.cachedEntities = null
    this.cachedSelectedNodes = []
    this.onSceneChanged = null
  }

  /**
   * Check if scene needs rebuild (entities changed)
   */
  needsSceneRebuild(): boolean {
    return this.needsRebuild
  }

  /**
   * Rebuild scene from cached entities (call this from render loop when needsRebuild is true)
   */
  rebuildFromCachedEntities() {
    if (!this.cachedEntities) return

    this.buildFromEntities(this.cachedEntities, this.cachedSelectedNodes)
    this.needsRebuild = false
  }

  /**
   * Build scene directly from normalized entities (O(n) through nodeOrder)
   * More efficient than tree traversal for large scenes
   */
  buildFromEntities(entities: EntityMaps, selectedNodes: string[] = []) {
    this.clear()
    console.log(`[Scene] Building from ${entities.nodeOrder.length} nodes:`, entities.nodeOrder)

    // Process nodes in depth-first order (parents before children)
    // This ensures transforms are computed correctly
    const worldTransforms = new Map<string, {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }>()

    // Compute world transform by combining parent and local transforms
    const computeWorldTransform = (
      node: NormalizedNode,
      parentWorld: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
    ) => {
      // Ensure all transform properties have defaults (handles partial transforms)
      const localTransform = {
        position: node.transform?.position || [0, 0, 0] as [number, number, number],
        rotation: node.transform?.rotation || [0, 0, 0] as [number, number, number],
        scale: node.transform?.scale || [1, 1, 1] as [number, number, number],
      }

      // Scale: multiply component-wise
      const worldScale: [number, number, number] = [
        parentWorld.scale[0] * localTransform.scale[0],
        parentWorld.scale[1] * localTransform.scale[1],
        parentWorld.scale[2] * localTransform.scale[2],
      ]

      // Rotation: add Euler angles (simplified)
      const worldRotation: [number, number, number] = [
        parentWorld.rotation[0] + localTransform.rotation[0],
        parentWorld.rotation[1] + localTransform.rotation[1],
        parentWorld.rotation[2] + localTransform.rotation[2],
      ]

      // Position: apply parent transform
      const scaledLocalPos: [number, number, number] = [
        localTransform.position[0] * parentWorld.scale[0],
        localTransform.position[1] * parentWorld.scale[1],
        localTransform.position[2] * parentWorld.scale[2],
      ]

      // Apply parent Y rotation
      const parentYRotRad = (parentWorld.rotation[1] * Math.PI) / 180
      const cosY = Math.cos(parentYRotRad)
      const sinY = Math.sin(parentYRotRad)
      const rotatedPos: [number, number, number] = [
        scaledLocalPos[0] * cosY - scaledLocalPos[2] * sinY,
        scaledLocalPos[1],
        scaledLocalPos[0] * sinY + scaledLocalPos[2] * cosY,
      ]

      const worldPosition: [number, number, number] = [
        parentWorld.position[0] + rotatedPos[0],
        parentWorld.position[1] + rotatedPos[1],
        parentWorld.position[2] + rotatedPos[2],
      ]

      return { position: worldPosition, rotation: worldRotation, scale: worldScale }
    }

    const identityTransform = {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    }

    // Process nodes in order (depth-first)
    for (const nodeId of entities.nodeOrder) {
      const node = entities.nodes[nodeId]
      if (!node) continue

      // Get parent world transform
      const parentWorld = node.parentId
        ? worldTransforms.get(node.parentId) || identityTransform
        : identityTransform

      // Compute and cache this node's world transform
      const worldTransform = computeWorldTransform(node, parentWorld)
      worldTransforms.set(nodeId, worldTransform)

      // Check for floor generator component
      const components = node.componentIds
        .map(id => entities.components[id])
        .filter(c => c !== undefined)

      const floorComp = components.find(c => c.script === 'builtin:floor_generator')
      if (floorComp && floorComp.enabled) {
        this.generateFloorTiles(nodeId, floorComp.properties as FloorConfig)
      }

      // Check for tilemap with meta.cells (ASCII grid)
      if (node.type === 'tilemap' && node.meta?.cells) {
        console.log(`[Scene] Found tilemap node: ${nodeId}, type=${node.type}, has cells=${!!node.meta?.cells}`)
        this.renderTilemap(nodeId, node.meta as unknown as TilemapMeta, worldTransform)
      } else if (node.type === 'tilemap') {
        console.log(`[Scene] Tilemap node ${nodeId} missing cells:`, node.meta)
      }
      // Render nodes with transform and visual (glyphs, entities)
      else if (node.transform && node.visual && node.visual.visible) {
        const [px, py, pz] = worldTransform.position
        const [sx, sy, sz] = worldTransform.scale
        const [r, g, b] = node.visual.color
        const opacity = node.visual.opacity

        const isSelected = selectedNodes.includes(nodeId)
        let emission = 0
        if (node.visual.emission && node.visual.emissionPower) {
          emission = node.visual.emissionPower
        }

        const getHighlightedEmission = (baseEmission: number) => {
          if (isSelected) return Math.max(baseEmission, 0.5)
          return baseEmission
        }

        if (node.visual.glyph && node.visual.glyph.length > 0) {
          const char = node.visual.glyph[0]
          const color: [number, number, number, number] = [r, g, b, opacity]
          const voxelEmission = getHighlightedEmission(emission)

          // Use full scale and rotation for glyph rendering
          this.addGlyph(char, px, py, pz, color, sx, sy, sz, worldTransform.rotation, voxelEmission)
          const glyphBounds: [number, number, number] = [sx, sy * 1.4, sz * 0.4]
          this.trackInstance(nodeId, [px, py + sy * 0.7, pz], glyphBounds)
        } else {
          const color: [number, number, number, number] = [r, g, b, opacity]
          const voxelEmission = getHighlightedEmission(emission)

          this.addVoxel(px, py, pz, color, sx, sy, sz, voxelEmission, VoxelFlags.NONE)
          this.trackInstance(nodeId, [px, py, pz], [sx, sy, sz])
        }
      }
    }

    // No default floor - everything comes from nodes
  }

  // Render a tilemap node (ASCII grid stored in meta.cells)
  private renderTilemap(
    nodeId: string,
    meta: TilemapMeta,
    worldTransform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
  ) {
    const cells = meta.cells as string
    const palette = meta.palette as Record<string, [number, number, number]> || {}
    const lines = cells.split('\n')

    console.log(`[TileMap] Rendering tilemap '${nodeId}': ${lines.length} rows, ${lines[0]?.length || 0} cols`)

    const [ox, oy, oz] = worldTransform.position
    const [sx, sy, sz] = worldTransform.scale

    // Default colors for common characters
    const defaultColors: Record<string, [number, number, number]> = {
      '#': [0.5, 0.4, 0.35],   // Wall
      '.': [0.3, 0.3, 0.3],    // Floor
      '+': [0.6, 0.5, 0.3],    // Door
      ' ': [0.1, 0.1, 0.1],    // Empty
    }

    // Tilemap glyphs are rotated -90 degrees around X to lie flat on ground
    // This makes them visible from both top-down (2D) and isometric (3D) views
    const tilemapRotation: [number, number, number] = [
      -90 + worldTransform.rotation[0],
      worldTransform.rotation[1],
      worldTransform.rotation[2]
    ]

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row]
      for (let col = 0; col < line.length; col++) {
        const char = line[col]
        if (char === ' ') continue  // Skip empty spaces

        // Get color from palette or defaults
        const color = palette[char] || defaultColors[char] || [0.5, 0.5, 0.5]

        // Calculate world position (x = column, z = row)
        const px = ox + col * sx
        const py = oy
        const pz = oz + row * sz

        // Render glyph lying flat on ground
        this.addGlyph(char, px, py, pz, [...color, 1], sx, sz, sy, tilemapRotation, 0)

        // Track for picking - bounds are now horizontal
        this.trackInstance(nodeId, [px, py, pz], [sx, 0.1, sz])
      }
    }
  }

  /**
   * Check if connected to store
   */
  isConnectedToStore(): boolean {
    return this.unsubscribeEntities !== null
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

// Tilemap node metadata
interface TilemapMeta {
  cells: string  // Multi-line ASCII art string
  palette?: Record<string, [number, number, number]>  // Character → RGB color mapping
}
