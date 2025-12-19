// ═══════════════════════════════════════════════════════════════════════════
// Debug Component Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DebugComponent, Debug, onDebugMessage, type DebugMessageEvent } from './DebugComponent'
import { getComponentMetadata } from '../decorators'

describe('DebugComponent', () => {
  let debugComponent: DebugComponent
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    time: ReturnType<typeof vi.spyOn>
    timeEnd: ReturnType<typeof vi.spyOn>
    trace: ReturnType<typeof vi.spyOn>
    clear: ReturnType<typeof vi.spyOn>
    group: ReturnType<typeof vi.spyOn>
    groupEnd: ReturnType<typeof vi.spyOn>
    log: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    debugComponent = new DebugComponent()
    debugComponent.tag = 'Test'
    debugComponent.includeTimestamp = false
    debugComponent.includeNodeId = false

    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      time: vi.spyOn(console, 'time').mockImplementation(() => {}),
      timeEnd: vi.spyOn(console, 'timeEnd').mockImplementation(() => {}),
      trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
      clear: vi.spyOn(console, 'clear').mockImplementation(() => {}),
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('metadata', () => {
    it('should be registered as a component', () => {
      const metadata = getComponentMetadata(DebugComponent)
      expect(metadata).toBeDefined()
      expect(metadata!.name).toBe('Debug')
      expect(metadata!.icon).toBeDefined()
    })

    it('should have properties registered', () => {
      const metadata = getComponentMetadata(DebugComponent)!
      expect(metadata.properties.has('tag')).toBe(true)
      expect(metadata.properties.has('minLevel')).toBe(true)
      expect(metadata.properties.has('includeTimestamp')).toBe(true)
      expect(metadata.properties.has('includeNodeId')).toBe(true)
    })

    it('should have actions registered', () => {
      const metadata = getComponentMetadata(DebugComponent)!
      expect(metadata.actions.has('logDebug')).toBe(true)
      expect(metadata.actions.has('logInfo')).toBe(true)
      expect(metadata.actions.has('logWarn')).toBe(true)
      expect(metadata.actions.has('logError')).toBe(true)
      expect(metadata.actions.has('logMessage')).toBe(true)
      expect(metadata.actions.has('logValue')).toBe(true)
      expect(metadata.actions.has('assert')).toBe(true)
      expect(metadata.actions.has('timeStart')).toBe(true)
      expect(metadata.actions.has('timeEnd')).toBe(true)
    })

    it('should have signals registered', () => {
      const metadata = getComponentMetadata(DebugComponent)!
      expect(metadata.signals.has('onMessage')).toBe(true)
    })

    it('should have lifecycle handlers registered', () => {
      const metadata = getComponentMetadata(DebugComponent)!
      expect(metadata.lifecycleHandlers.has('onInit')).toBe(true)
      expect(metadata.lifecycleHandlers.has('onDispose')).toBe(true)
    })

    it('should have action with outputs for assert', () => {
      const metadata = getComponentMetadata(DebugComponent)!
      const assertAction = metadata.actions.get('assert')!
      expect(assertAction.outputs).toEqual(['passed', 'failed'])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Logging Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('logging actions', () => {
    it('should log debug message', () => {
      debugComponent.logDebug('test debug message')
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('test debug message'))
    })

    it('should log info message', () => {
      debugComponent.logInfo('test info message')
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('test info message'))
    })

    it('should log warn message', () => {
      debugComponent.logWarn('test warning message')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('test warning message'))
    })

    it('should log error message', () => {
      debugComponent.logError('test error message')
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('test error message'))
    })

    it('should log with tag prefix', () => {
      debugComponent.tag = 'MyTag'
      debugComponent.logInfo('message')
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[MyTag]'))
    })

    it('should include level indicator', () => {
      debugComponent.logDebug('message')
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('[DBG]'))

      debugComponent.logInfo('message')
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[INF]'))

      debugComponent.logWarn('message')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WRN]'))

      debugComponent.logError('message')
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERR]'))
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Min Level Filtering
  // ─────────────────────────────────────────────────────────────────────────

  describe('min level filtering', () => {
    it('should filter out debug messages when minLevel is info', () => {
      debugComponent.minLevel = 'info'
      debugComponent.logDebug('should be filtered')
      expect(consoleSpy.debug).not.toHaveBeenCalled()
    })

    it('should allow info messages when minLevel is info', () => {
      debugComponent.minLevel = 'info'
      debugComponent.logInfo('should appear')
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('should allow error messages when minLevel is error', () => {
      debugComponent.minLevel = 'error'
      debugComponent.logError('should appear')
      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('should filter out warn when minLevel is error', () => {
      debugComponent.minLevel = 'error'
      debugComponent.logWarn('should be filtered')
      expect(consoleSpy.warn).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Value Logging
  // ─────────────────────────────────────────────────────────────────────────

  describe('value logging', () => {
    it('should log string value', () => {
      debugComponent.logValue('name', 'test')
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('name = "test"'))
    })

    it('should log number value', () => {
      debugComponent.logValue('count', 42)
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('count = 42'))
    })

    it('should log boolean value', () => {
      debugComponent.logValue('enabled', true)
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('enabled = true'))
    })

    it('should log null value', () => {
      debugComponent.logValue('data', null)
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('data = null'))
    })

    it('should log undefined value', () => {
      debugComponent.logValue('data', undefined)
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('data = undefined'))
    })

    it('should log array value', () => {
      debugComponent.logValue('arr', [1, 2, 3])
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('arr = [1, 2, 3]'))
    })

    it('should log object value', () => {
      debugComponent.logValue('obj', { x: 1, y: 2 })
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('x: 1'))
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('y: 2'))
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Assert Action
  // ─────────────────────────────────────────────────────────────────────────

  describe('assert', () => {
    it('should return passed for true condition', () => {
      const result = debugComponent.assert(true, 'test')
      expect(result).toBe('passed')
      expect(consoleSpy.error).not.toHaveBeenCalled()
    })

    it('should return failed and log error for false condition', () => {
      const result = debugComponent.assert(false, 'condition failed')
      expect(result).toBe('failed')
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Assertion failed: condition failed'))
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Timer Actions
  // ─────────────────────────────────────────────────────────────────────────

  describe('timers', () => {
    it('should call console.time with label', () => {
      debugComponent.timeStart('myTimer')
      expect(consoleSpy.time).toHaveBeenCalledWith('[Test] myTimer')
    })

    it('should call console.timeEnd with label', () => {
      debugComponent.timeEnd('myTimer')
      expect(consoleSpy.timeEnd).toHaveBeenCalledWith('[Test] myTimer')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Other Actions
  // ─────────────────────────────────────────────────────────────────────────

  describe('other actions', () => {
    it('should call console.trace', () => {
      debugComponent.trace('trace message')
      expect(consoleSpy.trace).toHaveBeenCalledWith(expect.stringContaining('trace message'))
    })

    it('should call console.clear', () => {
      debugComponent.clearConsole()
      expect(consoleSpy.clear).toHaveBeenCalled()
    })

    it('should call console.group', () => {
      debugComponent.groupStart('My Group')
      expect(consoleSpy.group).toHaveBeenCalledWith('[Test] My Group')
    })

    it('should call console.groupEnd', () => {
      debugComponent.groupEnd()
      expect(consoleSpy.groupEnd).toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Message Count and State
  // ─────────────────────────────────────────────────────────────────────────

  describe('state tracking', () => {
    it('should track message count', () => {
      expect(debugComponent.getMessageCount()).toBe(0)
      debugComponent.logInfo('one')
      debugComponent.logInfo('two')
      debugComponent.logInfo('three')
      expect(debugComponent.getMessageCount()).toBe(3)
    })

    it('should track last message', () => {
      debugComponent.logInfo('first message')
      debugComponent.logInfo('second message')
      expect(debugComponent.getLastMessage()).toBe('second message')
    })

    it('should track last message time', () => {
      const before = Date.now()
      debugComponent.logInfo('message')
      const after = Date.now()
      expect(debugComponent.getLastMessageTime()).toBeGreaterThanOrEqual(before)
      expect(debugComponent.getLastMessageTime()).toBeLessThanOrEqual(after)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Signal/Event Emission
  // ─────────────────────────────────────────────────────────────────────────

  describe('signals', () => {
    it('should emit onMessage signal', () => {
      const handler = vi.fn()
      debugComponent.onMessage = handler

      debugComponent.logInfo('test message')

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        level: 'info',
        message: 'test message',
        componentId: debugComponent.id,
      }))
    })

    it('should emit to global listeners', () => {
      const handler = vi.fn()
      const unsubscribe = onDebugMessage(handler)

      debugComponent.logInfo('global test')

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        level: 'info',
        message: 'global test',
      }))

      unsubscribe()
    })

    it('should unsubscribe from global listeners', () => {
      const handler = vi.fn()
      const unsubscribe = onDebugMessage(handler)
      unsubscribe()

      debugComponent.logInfo('should not trigger')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Global Debug Functions
  // ─────────────────────────────────────────────────────────────────────────

  describe('Global Debug functions', () => {
    it('should have all debug methods', () => {
      expect(typeof Debug.log).toBe('function')
      expect(typeof Debug.info).toBe('function')
      expect(typeof Debug.warn).toBe('function')
      expect(typeof Debug.error).toBe('function')
      expect(typeof Debug.value).toBe('function')
      expect(typeof Debug.assert).toBe('function')
      expect(typeof Debug.time).toBe('function')
      expect(typeof Debug.timeEnd).toBe('function')
      expect(typeof Debug.trace).toBe('function')
      expect(typeof Debug.clear).toBe('function')
      expect(typeof Debug.group).toBe('function')
      expect(typeof Debug.groupEnd).toBe('function')
    })

    it('should log using global debug', () => {
      Debug.info('global info message')
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('global info message'))
    })
  })
})
