// Scene management - holds voxel instances and handles animation

import { VoxelInstance, VoxelFlags, INSTANCE_BYTES } from './types'
import { buildGlyph } from './GlyphBuilder'

export class Scene {
  private instances: VoxelInstance[] = []
  private waterInstances: VoxelInstance[] = []
  time: number = 0

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

  // Add an ASCII glyph (extruded letter)
  addGlyph(char: string, x: number, y: number, z: number, color: [number, number, number, number], scale = 1) {
    const glyphVoxels = buildGlyph(char)
    for (const voxel of glyphVoxels) {
      this.addVoxel(
        x + voxel.x * scale * 0.2,
        y + voxel.y * scale * 0.2,
        z + voxel.z * scale * 0.2,
        color,
        scale * 0.18,
        scale * 0.18,
        scale * 0.18
      )
    }
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
  }
}
