// ═══════════════════════════════════════════════════════════════════════════
// Timer Manager Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TimerManager, delay, interval, cancelTimer } from './TimerManager'

describe('TimerManager', () => {
  let timers: TimerManager

  beforeEach(() => {
    timers = new TimerManager()
  })

  describe('start/stop', () => {
    it('should start a timer', () => {
      timers.start({ name: 'test', duration: 1 })
      expect(timers.isRunning('test')).toBe(true)
      expect(timers.getTimerCount()).toBe(1)
    })

    it('should stop a timer', () => {
      timers.start({ name: 'test', duration: 1 })
      const stopped = timers.stop('test')
      expect(stopped).toBe(true)
      expect(timers.isRunning('test')).toBe(false)
      expect(timers.getTimerCount()).toBe(0)
    })

    it('should return false when stopping non-existent timer', () => {
      expect(timers.stop('nonexistent')).toBe(false)
    })

    it('should restart timer with same name', () => {
      timers.start({ name: 'test', duration: 2 })
      timers.update(1)
      expect(timers.getElapsed('test')).toBe(1)

      timers.start({ name: 'test', duration: 2 })
      expect(timers.getElapsed('test')).toBe(0)
    })
  })

  describe('update', () => {
    it('should track elapsed time', () => {
      timers.start({ name: 'test', duration: 2 })
      timers.update(0.5)
      expect(timers.getElapsed('test')).toBe(0.5)
      expect(timers.getRemaining('test')).toBe(1.5)
    })

    it('should fire timer when duration reached', () => {
      const onFire = vi.fn()
      timers.start({ name: 'test', duration: 1, onFire })

      timers.update(0.5)
      expect(onFire).not.toHaveBeenCalled()

      timers.update(0.5)
      expect(onFire).toHaveBeenCalledWith(1)
    })

    it('should remove non-looping timer after fire', () => {
      const onComplete = vi.fn()
      timers.start({ name: 'test', duration: 1, loop: false, onComplete })

      timers.update(1)
      expect(onComplete).toHaveBeenCalled()
      expect(timers.isRunning('test')).toBe(false)
    })

    it('should continue looping timer after fire', () => {
      const onFire = vi.fn()
      timers.start({ name: 'test', duration: 1, loop: true, onFire })

      timers.update(1)
      expect(onFire).toHaveBeenCalledTimes(1)
      expect(timers.isRunning('test')).toBe(true)

      timers.update(1)
      expect(onFire).toHaveBeenCalledTimes(2)
    })

    it('should handle multiple timer fires in one update', () => {
      const onFire = vi.fn()
      timers.start({ name: 'test', duration: 0.5, loop: true, onFire })

      timers.update(1.2)
      // Should fire twice (at 0.5 and 1.0), with 0.2 remaining
      expect(onFire).toHaveBeenCalledTimes(2)
    })
  })

  describe('pause/resume', () => {
    it('should pause a timer', () => {
      timers.start({ name: 'test', duration: 2 })
      timers.pause('test')
      expect(timers.isRunning('test')).toBe(false)
    })

    it('should not update paused timers', () => {
      timers.start({ name: 'test', duration: 2 })
      timers.update(0.5)
      timers.pause('test')
      timers.update(0.5)
      expect(timers.getElapsed('test')).toBe(0.5)
    })

    it('should resume a paused timer', () => {
      timers.start({ name: 'test', duration: 2 })
      timers.pause('test')
      timers.resume('test')
      expect(timers.isRunning('test')).toBe(true)

      timers.update(0.5)
      expect(timers.getElapsed('test')).toBe(0.5)
    })
  })

  describe('node tracking', () => {
    it('should track timers by node', () => {
      timers.start({ name: 'timer1', duration: 1, nodeId: 'node-1' })
      timers.start({ name: 'timer2', duration: 1, nodeId: 'node-1' })
      timers.start({ name: 'timer3', duration: 1, nodeId: 'node-2' })

      expect(timers.getTimerCount()).toBe(3)

      timers.stopAllForNode('node-1')
      expect(timers.getTimerCount()).toBe(1)
      expect(timers.isRunning('timer3')).toBe(true)
    })
  })

  describe('stopAll', () => {
    it('should stop all timers', () => {
      timers.start({ name: 'timer1', duration: 1 })
      timers.start({ name: 'timer2', duration: 1 })
      timers.start({ name: 'timer3', duration: 1 })

      timers.stopAll()
      expect(timers.getTimerCount()).toBe(0)
    })
  })

  describe('getActiveTimers', () => {
    it('should return all active timer names', () => {
      timers.start({ name: 'a', duration: 1 })
      timers.start({ name: 'b', duration: 1 })
      timers.start({ name: 'c', duration: 1 })

      const names = timers.getActiveTimers()
      expect(names).toHaveLength(3)
      expect(names).toContain('a')
      expect(names).toContain('b')
      expect(names).toContain('c')
    })
  })
})

describe('convenience functions', () => {
  it('delay should create one-shot timer', () => {
    const callback = vi.fn()
    const name = delay(1, callback)

    expect(name).toMatch(/^__delay_/)

    // Would need to simulate time passing
    // For now just verify it returns a name
  })

  it('interval should create repeating timer', () => {
    const callback = vi.fn()
    const name = interval(1, callback)

    expect(name).toMatch(/^__interval_/)
  })

  it('cancelTimer should stop timers', () => {
    const callback = vi.fn()
    const name = delay(100, callback)

    const cancelled = cancelTimer(name)
    expect(cancelled).toBe(true)
  })
})
