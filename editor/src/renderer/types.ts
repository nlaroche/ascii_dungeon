// Shared types for the renderer

export interface VoxelInstance {
  position: [number, number, number]
  scale: [number, number, number]
  color: [number, number, number, number] // RGBA
  emission: number
  flags: number // bit 0: isWater, bit 1: isTree/foliage, bit 2: isCloud
}

export interface Light {
  position: [number, number, number]
  color: [number, number, number]
  intensity: number
}

export const VoxelFlags = {
  NONE: 0 as number,
  WATER: (1 << 0) as number,
  FOLIAGE: (1 << 1) as number,
  CLOUD: (1 << 2) as number,
}

// Size of instance data in floats (for buffer layout)
// transform (16) + color (4) + emission (1) + flags (1) + padding (2) = 24 floats
export const INSTANCE_FLOATS = 24
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4
