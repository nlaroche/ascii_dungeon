// ═══════════════════════════════════════════════════════════════════════════
// Debug Component - Console logging and debugging utilities
// ═══════════════════════════════════════════════════════════════════════════

import { Component } from '../Component'
import { component, property, select, action, signal, lifecycle } from '../decorators'

/** Log level for filtering messages */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Event emitted when a debug message is logged */
export interface DebugMessageEvent {
  level: LogLevel
  message: string
  timestamp: number
  nodeId?: string
  componentId: string
}

// Global debug event listeners
const debugListeners: Set<(event: DebugMessageEvent) => void> = new Set()

/** Subscribe to debug messages globally */
export function onDebugMessage(callback: (event: DebugMessageEvent) => void): () => void {
  debugListeners.add(callback)
  return () => debugListeners.delete(callback)
}

/** Emit a debug message to all listeners */
function emitDebugMessage(event: DebugMessageEvent): void {
  for (const listener of debugListeners) {
    listener(event)
  }
}

@component({ name: 'Debug', icon: '🔧', description: 'Console logging and debugging utilities' })
export class DebugComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────────────

  @property({ type: 'string', label: 'Tag', group: 'Settings', tooltip: 'Prefix tag for log messages' })
  tag: string = 'Debug'

  @select(['debug', 'info', 'warn', 'error'], { label: 'Min Level', group: 'Settings', tooltip: 'Minimum log level to output' })
  minLevel: LogLevel = 'debug'

  @property({ type: 'boolean', label: 'Include Timestamp', group: 'Format' })
  includeTimestamp: boolean = true

  @property({ type: 'boolean', label: 'Include Node ID', group: 'Format' })
  includeNodeId: boolean = true

  @property({ type: 'color', label: 'Debug Color', group: 'Colors' })
  debugColor: number[] = [0.5, 0.5, 0.5]

  @property({ type: 'color', label: 'Info Color', group: 'Colors' })
  infoColor: number[] = [0.3, 0.7, 1.0]

  @property({ type: 'color', label: 'Warn Color', group: 'Colors' })
  warnColor: number[] = [1.0, 0.8, 0.2]

  @property({ type: 'color', label: 'Error Color', group: 'Colors' })
  errorColor: number[] = [1.0, 0.3, 0.3]

  // ─────────────────────────────────────────────────────────────────────────
  // Signals
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Message', description: 'Fired when any message is logged' })
  onMessage: ((event: DebugMessageEvent) => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private messageCount: number = 0
  private lastMessage: string = ''
  private lastMessageTime: number = 0

  // Log level priority mapping
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Actions (exposed to logic graphs)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Log a debug message (lowest priority)
   */
  @action({ displayName: 'Log Debug', category: 'Logging', description: 'Log a debug-level message to console' })
  logDebug(message: string): void {
    this.log('debug', message)
  }

  /**
   * Log an info message
   */
  @action({ displayName: 'Log Info', category: 'Logging', description: 'Log an info-level message to console' })
  logInfo(message: string): void {
    this.log('info', message)
  }

  /**
   * Log a warning message
   */
  @action({ displayName: 'Log Warn', category: 'Logging', description: 'Log a warning message to console' })
  logWarn(message: string): void {
    this.log('warn', message)
  }

  /**
   * Log an error message
   */
  @action({ displayName: 'Log Error', category: 'Logging', description: 'Log an error message to console' })
  logError(message: string): void {
    this.log('error', message)
  }

  /**
   * Log a message with dynamic level
   */
  @action({ displayName: 'Log', category: 'Logging', description: 'Log a message with specified level' })
  logMessage(level: LogLevel, message: string): void {
    this.log(level, message)
  }

  /**
   * Log the current value of any variable (useful for debugging)
   */
  @action({ displayName: 'Log Value', category: 'Logging', description: 'Log the value of a variable' })
  logValue(name: string, value: unknown): void {
    const formattedValue = this.formatValue(value)
    this.log('debug', `${name} = ${formattedValue}`)
  }

  /**
   * Log multiple values as a table
   */
  @action({ displayName: 'Log Object', category: 'Logging', description: 'Log an object with all its properties' })
  logObject(label: string, obj: Record<string, unknown>): void {
    this.log('info', `${label}:`)
    for (const [key, value] of Object.entries(obj)) {
      console.log(`  ${key}: ${this.formatValue(value)}`)
    }
  }

  /**
   * Assert a condition (logs error if false)
   */
  @action({ displayName: 'Assert', category: 'Testing', outputs: ['passed', 'failed'], description: 'Assert a condition is true' })
  assert(condition: boolean, message: string): 'passed' | 'failed' {
    if (!condition) {
      this.log('error', `Assertion failed: ${message}`)
      return 'failed'
    }
    return 'passed'
  }

  /**
   * Start a performance timer
   */
  @action({ displayName: 'Time Start', category: 'Performance', description: 'Start a named timer' })
  timeStart(label: string): void {
    console.time(`[${this.tag}] ${label}`)
  }

  /**
   * End a performance timer and log the result
   */
  @action({ displayName: 'Time End', category: 'Performance', description: 'End a named timer and log duration' })
  timeEnd(label: string): void {
    console.timeEnd(`[${this.tag}] ${label}`)
  }

  /**
   * Log a stack trace
   */
  @action({ displayName: 'Trace', category: 'Debugging', description: 'Log a stack trace' })
  trace(message?: string): void {
    const prefix = this.formatPrefix('debug')
    console.trace(message ? `${prefix} ${message}` : prefix)
  }

  /**
   * Clear the console
   */
  @action({ displayName: 'Clear Console', category: 'Utility', description: 'Clear the debug console' })
  clearConsole(): void {
    console.clear()
  }

  /**
   * Create a collapsible group in console
   */
  @action({ displayName: 'Group Start', category: 'Grouping', description: 'Start a collapsible console group' })
  groupStart(label: string): void {
    console.group(`[${this.tag}] ${label}`)
  }

  /**
   * End the current group
   */
  @action({ displayName: 'Group End', category: 'Grouping', description: 'End the current console group' })
  groupEnd(): void {
    console.groupEnd()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    this.logDebug(`Debug component initialized on node '${this.node?.id || 'unknown'}'`)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    this.logDebug(`Debug component disposed (${this.messageCount} messages logged)`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Core logging implementation
   */
  private log(level: LogLevel, message: string): void {
    // Check minimum level
    if (DebugComponent.LEVEL_PRIORITY[level] < DebugComponent.LEVEL_PRIORITY[this.minLevel]) {
      return
    }

    const timestamp = Date.now()
    const prefix = this.formatPrefix(level)
    const fullMessage = `${prefix} ${message}`

    // Output to console with appropriate method
    switch (level) {
      case 'debug':
        console.debug(fullMessage)
        break
      case 'info':
        console.info(fullMessage)
        break
      case 'warn':
        console.warn(fullMessage)
        break
      case 'error':
        console.error(fullMessage)
        break
    }

    // Update internal state
    this.messageCount++
    this.lastMessage = message
    this.lastMessageTime = timestamp

    // Create event
    const event: DebugMessageEvent = {
      level,
      message,
      timestamp,
      nodeId: this.node?.id,
      componentId: this.id,
    }

    // Emit to global listeners
    emitDebugMessage(event)

    // Emit signal
    this.onMessage?.(event)
  }

  /**
   * Format the log prefix
   */
  private formatPrefix(level: LogLevel): string {
    const parts: string[] = []

    if (this.includeTimestamp) {
      const date = new Date()
      const time = date.toLocaleTimeString('en-US', { hour12: false })
      const ms = date.getMilliseconds().toString().padStart(3, '0')
      parts.push(`[${time}.${ms}]`)
    }

    parts.push(`[${this.tag}]`)

    if (this.includeNodeId && this.node) {
      parts.push(`[${this.node.id}]`)
    }

    const levelIndicator = this.getLevelIndicator(level)
    parts.push(levelIndicator)

    return parts.join(' ')
  }

  /**
   * Get level indicator symbol
   */
  private getLevelIndicator(level: LogLevel): string {
    switch (level) {
      case 'debug': return '[DBG]'
      case 'info': return '[INF]'
      case 'warn': return '[WRN]'
      case 'error': return '[ERR]'
    }
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'number') return value.toString()
    if (typeof value === 'boolean') return value.toString()
    if (Array.isArray(value)) {
      if (value.length <= 5) {
        return `[${value.map(v => this.formatValue(v)).join(', ')}]`
      }
      return `Array(${value.length})`
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length <= 3) {
        return `{ ${keys.map(k => `${k}: ${this.formatValue((value as Record<string, unknown>)[k])}`).join(', ')} }`
      }
      return `Object(${keys.length} keys)`
    }
    if (typeof value === 'function') return `Function(${value.name || 'anonymous'})`
    return String(value)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Getters
  // ─────────────────────────────────────────────────────────────────────────

  /** Get total messages logged */
  getMessageCount(): number {
    return this.messageCount
  }

  /** Get the last message */
  getLastMessage(): string {
    return this.lastMessage
  }

  /** Get the last message timestamp */
  getLastMessageTime(): number {
    return this.lastMessageTime
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Debug Functions (for convenience)
// ─────────────────────────────────────────────────────────────────────────────

const globalDebug = new DebugComponent()
globalDebug.tag = 'Global'

/** Global debug log function */
export const Debug = {
  log: (message: string) => globalDebug.logDebug(message),
  info: (message: string) => globalDebug.logInfo(message),
  warn: (message: string) => globalDebug.logWarn(message),
  error: (message: string) => globalDebug.logError(message),
  value: (name: string, value: unknown) => globalDebug.logValue(name, value),
  assert: (condition: boolean, message: string) => globalDebug.assert(condition, message),
  time: (label: string) => globalDebug.timeStart(label),
  timeEnd: (label: string) => globalDebug.timeEnd(label),
  trace: (message?: string) => globalDebug.trace(message),
  clear: () => globalDebug.clearConsole(),
  group: (label: string) => globalDebug.groupStart(label),
  groupEnd: () => globalDebug.groupEnd(),
}
