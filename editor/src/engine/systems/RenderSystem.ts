// ═══════════════════════════════════════════════════════════════════════════
// Render System - Coordinates rendering and exposes render hooks
// ═══════════════════════════════════════════════════════════════════════════

import { EngineSystem, SystemPriority, type SystemUpdateContext } from '../System'

/**
 * Render System - Orchestrates rendering and provides extension points
 *
 * Hooks:
 * - onPreRender: Called before main render pass
 * - onRender: Called during main render (use sparingly)
 * - onPostRender: Called after main render
 * - onRenderGizmos: Called during gizmo render pass
 * - onRenderOverlay: Called for 2D overlay rendering
 * - onRenderDebug: Called for debug visualization
 */
export class RenderSystem extends EngineSystem {
  static readonly NAME = 'Render'

  private fps: number = 0
  private frameTime: number = 0
  private frameCount: number = 0
  private lastFpsUpdate: number = 0
  private frameTimes: number[] = []

  // Render stats
  private stats = {
    drawCalls: 0,
    triangles: 0,
    instances: 0,
    textureBinds: 0,
  }

  constructor() {
    super(RenderSystem.NAME, SystemPriority.Render)

    // Define hooks
    this.defineHook('onPreRender')
    this.defineHook('onRender')
    this.defineHook('onPostRender')
    this.defineHook('onRenderGizmos')
    this.defineHook('onRenderOverlay')
    this.defineHook('onRenderDebug')
  }

  update(ctx: SystemUpdateContext): void {
    // Update FPS counter
    this.updateFps(ctx.dt)

    // Update engine state with render stats
    if (ctx.frame % 30 === 0) { // Every 30 frames
      ctx.setState(['runtime', 'fps'], Math.round(this.fps), 'FPS update')
      ctx.setState(['runtime', 'frameTime'], this.frameTime, 'Frame time update')
    }

    // Pre-render phase
    this.callHook('onPreRender', ctx)

    // Main render is handled by WebGPURenderer
    // This hook is for any additional custom rendering
    this.callHook('onRender', ctx)

    // Post-render phase
    this.callHook('onPostRender', ctx)
  }

  lateUpdate(ctx: SystemUpdateContext): void {
    // Gizmo rendering
    if (ctx.state.views.scene.showGizmos) {
      this.callHook('onRenderGizmos', ctx)
    }

    // Debug rendering
    this.callHook('onRenderDebug', ctx)

    // 2D overlay rendering
    this.callHook('onRenderOverlay', ctx)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get current FPS */
  getFps(): number {
    return this.fps
  }

  /** Get frame time in milliseconds */
  getFrameTime(): number {
    return this.frameTime
  }

  /** Get render statistics */
  getStats(): Readonly<typeof this.stats> {
    return this.stats
  }

  /** Update render stats (called by renderer) */
  updateStats(stats: Partial<typeof this.stats>): void {
    Object.assign(this.stats, stats)
  }

  /** Reset stats for new frame */
  resetStats(): void {
    this.stats = {
      drawCalls: 0,
      triangles: 0,
      instances: 0,
      textureBinds: 0,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Debug Drawing
  // ─────────────────────────────────────────────────────────────────────────────

  /** Queue a debug line to draw */
  drawLine(
    start: [number, number, number],
    end: [number, number, number],
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    // This would queue the line for the debug pass
    this.callHook('onRenderDebug', { type: 'line', start, end, color })
  }

  /** Queue a debug box to draw */
  drawBox(
    center: [number, number, number],
    size: [number, number, number],
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    this.callHook('onRenderDebug', { type: 'box', center, size, color })
  }

  /** Queue a debug sphere to draw */
  drawSphere(
    center: [number, number, number],
    radius: number,
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    this.callHook('onRenderDebug', { type: 'sphere', center, radius, color })
  }

  /** Queue debug text to draw */
  drawText(
    position: [number, number, number],
    text: string,
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    this.callHook('onRenderDebug', { type: 'text', position, text, color })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private updateFps(dt: number): void {
    this.frameCount++
    this.frameTimes.push(dt * 1000) // Convert to ms

    // Keep only last 60 frame times
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift()
    }

    // Update FPS every 500ms
    const now = Date.now()
    if (now - this.lastFpsUpdate >= 500) {
      this.fps = this.frameCount / ((now - this.lastFpsUpdate) / 1000)
      this.frameCount = 0
      this.lastFpsUpdate = now

      // Calculate average frame time
      this.frameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    }
  }
}
