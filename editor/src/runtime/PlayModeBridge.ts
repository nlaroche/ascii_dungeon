// ═══════════════════════════════════════════════════════════════════════════
// PlayModeBridge - WebSocket IPC bridge for MCP integration
// Allows external tools (MCP server) to control and monitor play mode
// ═══════════════════════════════════════════════════════════════════════════

import { PlayMode, PlayModeManager, PlayModeState, PlayModeStats, EntityRuntimeState } from '../scripting/runtime/PlayModeManager'
import { GameEventBus, createGameEvent } from '../scripting/runtime/events'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayModeCommand {
  id: string
  type: 'command'
  action: 'start' | 'stop' | 'pause' | 'resume' | 'step'
  params?: {
    apply?: boolean
    count?: number
  }
}

export interface PlayModeQuery {
  id: string
  type: 'query'
  target: 'status' | 'entities' | 'entity' | 'stats' | 'variables' | 'events'
  params?: {
    entityId?: string
    filter?: Record<string, unknown>
    limit?: number
  }
}

export interface InputInjection {
  id: string
  type: 'inject'
  inputType: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove'
  params: {
    key?: string
    button?: number
    x?: number
    y?: number
    modifiers?: {
      shift?: boolean
      ctrl?: boolean
      alt?: boolean
    }
  }
}

export interface BreakpointConfig {
  id?: string
  type: 'event' | 'frame' | 'variable'
  condition?: string
  eventType?: string
  frameNumber?: number
  variableName?: string
}

export interface Breakpoint extends BreakpointConfig {
  id: string
  enabled: boolean
  hitCount: number
}

export type BridgeMessage = PlayModeCommand | PlayModeQuery | InputInjection

export interface BridgeResponse {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

export interface RuntimeStateUpdate {
  type: 'state'
  data: {
    status: string
    frame: number
    fps: number
    elapsedTime: number
    entityCount: number
  }
}

export interface BreakpointHitEvent {
  type: 'breakpointHit'
  id: string
  state: {
    frame: number
    variables: Record<string, unknown>
  }
}

type MessageHandler = (message: BridgeMessage) => Promise<BridgeResponse>

// ─────────────────────────────────────────────────────────────────────────────
// PlayModeBridge
// ─────────────────────────────────────────────────────────────────────────────

export class PlayModeBridge {
  private static instance: PlayModeBridge

  private ws: WebSocket | null = null
  private port: number = 9847
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000

  // Input injection queue
  private inputQueue: InputInjection[] = []

  // Breakpoints
  private breakpoints: Map<string, Breakpoint> = new Map()
  private breakpointCounter: number = 0

  // Event buffer for queries
  private eventBuffer: Array<{ type: string; timestamp: number; data: unknown }> = []
  private maxEventBuffer: number = 100

  // State update interval
  private stateUpdateInterval: number | null = null
  private stateUpdateRate: number = 100 // ms

  static getInstance(): PlayModeBridge {
    if (!PlayModeBridge.instance) {
      PlayModeBridge.instance = new PlayModeBridge()
    }
    return PlayModeBridge.instance
  }

  constructor() {
    // Subscribe to play mode events for event buffer
    this.setupEventCapture()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connection Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start the WebSocket server (browser-side, acts as client to MCP server)
   * Note: In browser context, we can't host a WebSocket server, so we connect as client
   */
  connect(serverUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = serverUrl || `ws://localhost:${this.port}`

      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log('[PlayModeBridge] Connected to MCP server')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.startStateUpdates()
          resolve()
        }

        this.ws.onclose = () => {
          console.log('[PlayModeBridge] Disconnected from MCP server')
          this.isConnected = false
          this.stopStateUpdates()
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[PlayModeBridge] WebSocket error:', error)
          if (!this.isConnected) {
            reject(error)
          }
        }

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data) as BridgeMessage
            const response = await this.handleMessage(message)
            this.send(response)
          } catch (error) {
            console.error('[PlayModeBridge] Failed to handle message:', error)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.stopStateUpdates()
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[PlayModeBridge] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`[PlayModeBridge] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect failed, will try again
      })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private send(data: unknown): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Message Handling
  // ─────────────────────────────────────────────────────────────────────────

  private async handleMessage(message: BridgeMessage): Promise<BridgeResponse> {
    try {
      switch (message.type) {
        case 'command':
          return this.handleCommand(message)
        case 'query':
          return this.handleQuery(message)
        case 'inject':
          return this.handleInputInjection(message)
        default:
          return { id: (message as { id: string }).id, success: false, error: 'Unknown message type' }
      }
    } catch (error) {
      return { id: (message as { id: string }).id, success: false, error: String(error) }
    }
  }

  private async handleCommand(cmd: PlayModeCommand): Promise<BridgeResponse> {
    switch (cmd.action) {
      case 'start':
        await PlayMode.start()
        return { id: cmd.id, success: true, data: { status: 'playing' } }

      case 'stop':
        PlayMode.stop(cmd.params?.apply ?? false)
        return { id: cmd.id, success: true, data: { status: 'stopped' } }

      case 'pause':
        PlayMode.pause()
        return { id: cmd.id, success: true, data: { status: 'paused' } }

      case 'resume':
        PlayMode.resume()
        return { id: cmd.id, success: true, data: { status: 'playing' } }

      case 'step':
        PlayMode.stepFrame(cmd.params?.count ?? 1)
        return { id: cmd.id, success: true, data: { stepped: cmd.params?.count ?? 1 } }

      default:
        return { id: cmd.id, success: false, error: `Unknown action: ${cmd.action}` }
    }
  }

  private handleQuery(query: PlayModeQuery): BridgeResponse {
    switch (query.target) {
      case 'status':
        return {
          id: query.id,
          success: true,
          data: {
            status: PlayMode.getStatus(),
            isRunning: PlayMode.isRunning(),
            frameCount: PlayMode.getFrameCount(),
            elapsedTime: PlayMode.getElapsedTime(),
          },
        }

      case 'stats':
        return { id: query.id, success: true, data: PlayMode.getStats() }

      case 'entities':
        return { id: query.id, success: true, data: PlayMode.getAllEntities() }

      case 'entity':
        if (!query.params?.entityId) {
          return { id: query.id, success: false, error: 'entityId required' }
        }
        const entity = PlayMode.getEntityState(query.params.entityId)
        return { id: query.id, success: entity !== null, data: entity, error: entity ? undefined : 'Entity not found' }

      case 'events':
        const limit = query.params?.limit ?? 20
        return { id: query.id, success: true, data: this.eventBuffer.slice(-limit) }

      case 'variables':
        // TODO: Implement variable query
        return { id: query.id, success: true, data: {} }

      default:
        return { id: query.id, success: false, error: `Unknown query target: ${query.target}` }
    }
  }

  private handleInputInjection(inject: InputInjection): BridgeResponse {
    this.inputQueue.push(inject)

    // Process immediately if playing
    if (PlayMode.isPlaying()) {
      this.processInputQueue()
    }

    return { id: inject.id, success: true }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input Injection
  // ─────────────────────────────────────────────────────────────────────────

  queueInput(input: InputInjection): void {
    this.inputQueue.push(input)
  }

  processInputQueue(): void {
    while (this.inputQueue.length > 0) {
      const input = this.inputQueue.shift()!
      this.dispatchInput(input)
    }
  }

  private dispatchInput(input: InputInjection): void {
    const { inputType, params } = input

    switch (inputType) {
      case 'keydown':
        if (params.key) {
          GameEventBus.emit(createGameEvent({
            type: 'input:key-down',
            source: { type: 'system', id: 'bridge' },
            data: {
              key: params.key,
              code: params.key,
              shift: params.modifiers?.shift ?? false,
              ctrl: params.modifiers?.ctrl ?? false,
              alt: params.modifiers?.alt ?? false,
              meta: false,
            },
          }))
        }
        break

      case 'keyup':
        if (params.key) {
          GameEventBus.emit(createGameEvent({
            type: 'input:key-up',
            source: { type: 'system', id: 'bridge' },
            data: {
              key: params.key,
              code: params.key,
              shift: params.modifiers?.shift ?? false,
              ctrl: params.modifiers?.ctrl ?? false,
              alt: params.modifiers?.alt ?? false,
              meta: false,
            },
          }))
        }
        break

      case 'mousedown':
        GameEventBus.emit(createGameEvent({
          type: 'input:mouse-down',
          source: { type: 'system', id: 'bridge' },
          data: {
            button: params.button ?? 0,
            x: params.x ?? 0,
            y: params.y ?? 0,
            shift: params.modifiers?.shift ?? false,
            ctrl: params.modifiers?.ctrl ?? false,
            alt: params.modifiers?.alt ?? false,
          },
        }))
        break

      case 'mouseup':
        GameEventBus.emit(createGameEvent({
          type: 'input:mouse-up',
          source: { type: 'system', id: 'bridge' },
          data: {
            button: params.button ?? 0,
            x: params.x ?? 0,
            y: params.y ?? 0,
          },
        }))
        break

      case 'mousemove':
        // Mouse move is handled differently - update global variables
        break
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Breakpoints
  // ─────────────────────────────────────────────────────────────────────────

  setBreakpoint(config: BreakpointConfig): string {
    const id = config.id || `bp_${++this.breakpointCounter}`
    const breakpoint: Breakpoint = {
      ...config,
      id,
      enabled: true,
      hitCount: 0,
    }
    this.breakpoints.set(id, breakpoint)
    return id
  }

  removeBreakpoint(id: string): boolean {
    return this.breakpoints.delete(id)
  }

  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values())
  }

  enableBreakpoint(id: string, enabled: boolean): void {
    const bp = this.breakpoints.get(id)
    if (bp) {
      bp.enabled = enabled
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Updates
  // ─────────────────────────────────────────────────────────────────────────

  private startStateUpdates(): void {
    if (this.stateUpdateInterval) return

    this.stateUpdateInterval = window.setInterval(() => {
      if (this.isConnected && PlayMode.isRunning()) {
        const stats = PlayMode.getStats()
        const update: RuntimeStateUpdate = {
          type: 'state',
          data: {
            status: PlayMode.getStatus(),
            frame: PlayMode.getFrameCount(),
            fps: stats.fps,
            elapsedTime: PlayMode.getElapsedTime(),
            entityCount: stats.entityCount,
          },
        }
        this.send(update)
      }
    }, this.stateUpdateRate)
  }

  private stopStateUpdates(): void {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval)
      this.stateUpdateInterval = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Capture
  // ─────────────────────────────────────────────────────────────────────────

  private setupEventCapture(): void {
    // Capture all events for the event buffer
    GameEventBus.on('*', (event) => {
      this.eventBuffer.push({
        type: event.type,
        timestamp: event.timestamp,
        data: event.data,
      })

      // Trim buffer
      if (this.eventBuffer.length > this.maxEventBuffer) {
        this.eventBuffer = this.eventBuffer.slice(-this.maxEventBuffer)
      }

      // Check breakpoints
      this.checkEventBreakpoints(event.type)
    })
  }

  private checkEventBreakpoints(eventType: string): void {
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue
      if (bp.type === 'event' && bp.eventType === eventType) {
        bp.hitCount++
        this.triggerBreakpoint(bp)
      }
    }
  }

  private triggerBreakpoint(bp: Breakpoint): void {
    PlayMode.pause()

    const event: BreakpointHitEvent = {
      type: 'breakpointHit',
      id: bp.id,
      state: {
        frame: PlayMode.getFrameCount(),
        variables: {}, // TODO: Get variables snapshot
      },
    }

    this.send(event)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────────────

  isConnectedToServer(): boolean {
    return this.isConnected
  }

  getPort(): number {
    return this.port
  }

  setPort(port: number): void {
    this.port = port
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Instance
// ─────────────────────────────────────────────────────────────────────────────

export const Bridge = PlayModeBridge.getInstance()
