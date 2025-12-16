// ═══════════════════════════════════════════════════════════════════════════
// Render Target Pool - Manages reusable render textures for post-processing
// ═══════════════════════════════════════════════════════════════════════════

export interface RenderTarget {
  texture: GPUTexture
  view: GPUTextureView
  width: number
  height: number
  format: GPUTextureFormat
}

interface PooledTarget extends RenderTarget {
  inUse: boolean
  lastUsedFrame: number
}

export class RenderTargetPool {
  private device: GPUDevice
  private targets: Map<string, PooledTarget[]> = new Map()
  private currentFrame = 0
  private maxUnusedFrames = 60 // Destroy targets unused for 60 frames

  constructor(device: GPUDevice) {
    this.device = device
  }

  private getKey(width: number, height: number, format: GPUTextureFormat): string {
    return `${width}x${height}_${format}`
  }

  /**
   * Acquire a render target from the pool.
   * Returns a pooled target if available, creates a new one otherwise.
   */
  acquire(width: number, height: number, format: GPUTextureFormat): RenderTarget {
    const key = this.getKey(width, height, format)
    let pool = this.targets.get(key)

    if (!pool) {
      pool = []
      this.targets.set(key, pool)
    }

    // Find an available target
    for (const target of pool) {
      if (!target.inUse) {
        target.inUse = true
        target.lastUsedFrame = this.currentFrame
        return target
      }
    }

    // Create new target
    const texture = this.device.createTexture({
      size: [width, height],
      format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    })

    const newTarget: PooledTarget = {
      texture,
      view: texture.createView(),
      width,
      height,
      format,
      inUse: true,
      lastUsedFrame: this.currentFrame,
    }

    pool.push(newTarget)
    return newTarget
  }

  /**
   * Release a render target back to the pool.
   */
  release(target: RenderTarget): void {
    for (const [, pool] of this.targets) {
      for (const pooled of pool) {
        if (pooled.texture === target.texture) {
          pooled.inUse = false
          return
        }
      }
    }
  }

  /**
   * Call at the start of each frame to track frame numbers
   * and clean up unused targets.
   */
  beginFrame(): void {
    this.currentFrame++

    // Clean up old unused targets
    for (const [key, pool] of this.targets) {
      const toRemove: number[] = []

      for (let i = 0; i < pool.length; i++) {
        const target = pool[i]
        if (
          !target.inUse &&
          this.currentFrame - target.lastUsedFrame > this.maxUnusedFrames
        ) {
          target.texture.destroy()
          toRemove.push(i)
        }
      }

      // Remove destroyed targets from pool (reverse order to maintain indices)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        pool.splice(toRemove[i], 1)
      }

      // Remove empty pools
      if (pool.length === 0) {
        this.targets.delete(key)
      }
    }
  }

  /**
   * Destroy all pooled targets.
   */
  destroy(): void {
    for (const [, pool] of this.targets) {
      for (const target of pool) {
        target.texture.destroy()
      }
    }
    this.targets.clear()
  }

  /**
   * Get pool statistics for debugging.
   */
  getStats(): { totalTargets: number; inUse: number; poolKeys: string[] } {
    let totalTargets = 0
    let inUse = 0

    for (const [, pool] of this.targets) {
      totalTargets += pool.length
      inUse += pool.filter((t) => t.inUse).length
    }

    return {
      totalTargets,
      inUse,
      poolKeys: Array.from(this.targets.keys()),
    }
  }
}
