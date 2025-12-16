// Raycaster - Ray-AABB intersection for voxel picking

export interface Ray {
  origin: [number, number, number]
  direction: [number, number, number]
}

export interface AABB {
  min: [number, number, number]
  max: [number, number, number]
}

export interface PickableInstance {
  nodeId: string
  aabb: AABB
  instanceIndex: number
}

export interface PickResult {
  nodeId: string
  instanceIndex: number
  distance: number
  hitPoint: [number, number, number]
  normal: [number, number, number]
}

export class Raycaster {
  // Ray-AABB slab intersection using the optimized method
  static rayAABB(ray: Ray, aabb: AABB): { hit: boolean; distance: number; normal: [number, number, number] } {
    let tMin = 0
    let tMax = Infinity
    let hitNormal: [number, number, number] = [0, 0, 0]

    for (let axis = 0; axis < 3; axis++) {
      const invD = 1.0 / ray.direction[axis]

      let t0 = (aabb.min[axis] - ray.origin[axis]) * invD
      let t1 = (aabb.max[axis] - ray.origin[axis]) * invD

      // Handle negative direction
      if (invD < 0) {
        const temp = t0
        t0 = t1
        t1 = temp
      }

      // Track which face we hit for normal calculation
      if (t0 > tMin) {
        tMin = t0
        hitNormal = [0, 0, 0]
        hitNormal[axis] = invD < 0 ? 1 : -1
      }

      if (t1 < tMax) {
        tMax = t1
      }

      // No intersection if ranges don't overlap
      if (tMin > tMax) {
        return { hit: false, distance: 0, normal: [0, 0, 0] }
      }
    }

    // Ray starts inside box or behind us
    if (tMin < 0) {
      return { hit: false, distance: 0, normal: [0, 0, 0] }
    }

    return { hit: true, distance: tMin, normal: hitNormal }
  }

  // Compute AABB volume for tie-breaking
  private static getAABBVolume(aabb: AABB): number {
    return (aabb.max[0] - aabb.min[0]) *
           (aabb.max[1] - aabb.min[1]) *
           (aabb.max[2] - aabb.min[2])
  }

  // Pick against all instances, return closest hit
  // When distances are equal, prefer smaller AABBs (more specific objects)
  static pick(ray: Ray, instances: PickableInstance[]): PickResult | null {
    let closest: PickResult | null = null
    let closestVolume = Infinity

    for (const instance of instances) {
      const result = this.rayAABB(ray, instance.aabb)

      if (result.hit) {
        const volume = this.getAABBVolume(instance.aabb)
        // Pick if closer, OR if same distance but smaller volume (more specific)
        const isBetter = !closest ||
          result.distance < closest.distance ||
          (result.distance === closest.distance && volume < closestVolume)

        if (isBetter) {
          const hitPoint: [number, number, number] = [
            ray.origin[0] + ray.direction[0] * result.distance,
            ray.origin[1] + ray.direction[1] * result.distance,
            ray.origin[2] + ray.direction[2] * result.distance,
          ]

          closest = {
            nodeId: instance.nodeId,
            instanceIndex: instance.instanceIndex,
            distance: result.distance,
            hitPoint,
            normal: result.normal,
          }
          closestVolume = volume
        }
      }
    }

    return closest
  }

  // Pick nodes (groups instances by nodeId and returns closest node)
  static pickNode(ray: Ray, instances: PickableInstance[]): string | null {
    const result = this.pick(ray, instances)
    return result ? result.nodeId : null
  }

  // Get all nodes hit by ray (for multi-selection or picking through)
  static pickAll(ray: Ray, instances: PickableInstance[]): PickResult[] {
    const hits: PickResult[] = []

    for (const instance of instances) {
      const result = this.rayAABB(ray, instance.aabb)

      if (result.hit) {
        const hitPoint: [number, number, number] = [
          ray.origin[0] + ray.direction[0] * result.distance,
          ray.origin[1] + ray.direction[1] * result.distance,
          ray.origin[2] + ray.direction[2] * result.distance,
        ]

        hits.push({
          nodeId: instance.nodeId,
          instanceIndex: instance.instanceIndex,
          distance: result.distance,
          hitPoint,
          normal: result.normal,
        })
      }
    }

    // Sort by distance
    hits.sort((a, b) => a.distance - b.distance)

    return hits
  }

  // Check if a point is inside an AABB
  static pointInAABB(point: [number, number, number], aabb: AABB): boolean {
    return (
      point[0] >= aabb.min[0] && point[0] <= aabb.max[0] &&
      point[1] >= aabb.min[1] && point[1] <= aabb.max[1] &&
      point[2] >= aabb.min[2] && point[2] <= aabb.max[2]
    )
  }

  // Compute AABB from position and scale (for voxel instances)
  static computeAABB(position: [number, number, number], scale: [number, number, number]): AABB {
    const halfScale: [number, number, number] = [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5]
    return {
      min: [position[0] - halfScale[0], position[1] - halfScale[1], position[2] - halfScale[2]],
      max: [position[0] + halfScale[0], position[1] + halfScale[1], position[2] + halfScale[2]],
    }
  }

  // Merge multiple AABBs into one (for computing node bounds)
  static mergeAABBs(aabbs: AABB[]): AABB | null {
    if (aabbs.length === 0) return null

    const result: AABB = {
      min: [...aabbs[0].min],
      max: [...aabbs[0].max],
    }

    for (let i = 1; i < aabbs.length; i++) {
      result.min[0] = Math.min(result.min[0], aabbs[i].min[0])
      result.min[1] = Math.min(result.min[1], aabbs[i].min[1])
      result.min[2] = Math.min(result.min[2], aabbs[i].min[2])
      result.max[0] = Math.max(result.max[0], aabbs[i].max[0])
      result.max[1] = Math.max(result.max[1], aabbs[i].max[1])
      result.max[2] = Math.max(result.max[2], aabbs[i].max[2])
    }

    return result
  }

  // Get AABB center
  static getAABBCenter(aabb: AABB): [number, number, number] {
    return [
      (aabb.min[0] + aabb.max[0]) * 0.5,
      (aabb.min[1] + aabb.max[1]) * 0.5,
      (aabb.min[2] + aabb.max[2]) * 0.5,
    ]
  }

  // Get AABB size
  static getAABBSize(aabb: AABB): [number, number, number] {
    return [
      aabb.max[0] - aabb.min[0],
      aabb.max[1] - aabb.min[1],
      aabb.max[2] - aabb.min[2],
    ]
  }
}
