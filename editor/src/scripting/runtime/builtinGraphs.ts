// =============================================================================
// Built-in Behavior Graphs - Pre-defined visual scripting graphs
// =============================================================================

import type { LogicGraph } from './graph'
import { BehaviorGraphRegistry } from '../components/BehaviorComponent'

// -----------------------------------------------------------------------------
// Wander Behavior Graph
// A simple AI that randomly wanders around, waiting between moves
// -----------------------------------------------------------------------------

/**
 * Wander behavior graph
 *
 * Variables:
 * - state: 'idle' | 'waiting' | 'moving'
 * - stateTimer: number (countdown timer)
 * - stepsRemaining: number
 * - dirX: number (-1, 0, or 1)
 * - dirY: number (-1, 0, or 1)
 * - startX, startY: number (initial position)
 *
 * Parameters (set via node variables):
 * - minWaitTime: number (default 1)
 * - maxWaitTime: number (default 3)
 * - minSteps: number (default 1)
 * - maxSteps: number (default 4)
 * - wanderRadius: number (default 10)
 * - moveCooldown: number (default 0.2)
 */
export const WANDER_BEHAVIOR_GRAPH: LogicGraph = {
  graphId: 'builtin:wander',
  version: '1.0.0',
  description: 'Random wandering behavior - waits, picks direction, moves, repeats',
  variables: [
    // State machine
    { name: 'state', type: 'string', scope: 'node', default: 'idle' },
    { name: 'stateTimer', type: 'number', scope: 'node', default: 0 },
    { name: 'stepsRemaining', type: 'number', scope: 'node', default: 0 },
    { name: 'moveTimer', type: 'number', scope: 'node', default: 0 },

    // Current direction
    { name: 'dirX', type: 'number', scope: 'node', default: 0 },
    { name: 'dirY', type: 'number', scope: 'node', default: 0 },

    // Start position (for radius constraint)
    { name: 'startX', type: 'number', scope: 'node', default: 0 },
    { name: 'startY', type: 'number', scope: 'node', default: 0 },

    // Configuration (can be overridden via properties)
    { name: 'minWaitTime', type: 'number', scope: 'node', default: 1 },
    { name: 'maxWaitTime', type: 'number', scope: 'node', default: 3 },
    { name: 'minSteps', type: 'number', scope: 'node', default: 1 },
    { name: 'maxSteps', type: 'number', scope: 'node', default: 4 },
    { name: 'wanderRadius', type: 'number', scope: 'node', default: 10 },
    { name: 'moveCooldown', type: 'number', scope: 'node', default: 0.2 },
  ],
  nodes: [
    // Entry points
    { id: 'init', type: 'signal', signal: 'Init', position: [0, 0] },
    { id: 'update', type: 'signal', signal: 'Update', position: [0, 200] },

    // Init: Store starting position and enter waiting state
    {
      id: 'get-init-pos',
      type: 'action',
      component: 'Entity',
      method: 'get-position',
      inputs: { entityId: { $var: 'self' } },
      position: [200, 0],
    },
    {
      id: 'save-start-x',
      type: 'variable',
      operation: 'set',
      variable: 'startX',
      value: { $expr: 'pos.x' },
      position: [400, 0],
    },
    {
      id: 'save-start-y',
      type: 'variable',
      operation: 'set',
      variable: 'startY',
      value: { $expr: 'pos.y' },
      position: [600, 0],
    },
    {
      id: 'init-state',
      type: 'variable',
      operation: 'set',
      variable: 'state',
      value: 'waiting',
      position: [800, 0],
    },
    {
      id: 'init-timer',
      type: 'action',
      component: 'Math',
      method: 'random-range',
      inputs: {
        min: { $var: 'minWaitTime' },
        max: { $var: 'maxWaitTime' },
      },
      position: [1000, 0],
    },
    {
      id: 'set-init-timer',
      type: 'variable',
      operation: 'set',
      variable: 'stateTimer',
      value: { $var: 'result' },
      position: [1200, 0],
    },

    // Update: Check state and dispatch
    {
      id: 'check-state',
      type: 'branch',
      kind: 'switch',
      value: { $var: 'state' },
      cases: ['waiting', 'moving', 'idle'],
      position: [200, 200],
    },

    // --- Waiting State ---
    {
      id: 'waiting-tick',
      type: 'action',
      component: 'Math',
      method: 'subtract',
      inputs: {
        a: { $var: 'stateTimer' },
        b: { $var: 'deltaTime' },
      },
      position: [400, 150],
    },
    {
      id: 'set-wait-timer',
      type: 'variable',
      operation: 'set',
      variable: 'stateTimer',
      value: { $var: 'result' },
      position: [600, 150],
    },
    {
      id: 'check-wait-done',
      type: 'branch',
      kind: 'if',
      condition: { $expr: 'stateTimer <= 0' },
      position: [800, 150],
    },
    // Transition to moving
    {
      id: 'enter-moving',
      type: 'variable',
      operation: 'set',
      variable: 'state',
      value: 'moving',
      position: [1000, 100],
    },
    {
      id: 'calc-steps',
      type: 'action',
      component: 'Math',
      method: 'random-int',
      inputs: {
        min: { $var: 'minSteps' },
        max: { $var: 'maxSteps' },
      },
      position: [1200, 100],
    },
    {
      id: 'set-steps',
      type: 'variable',
      operation: 'set',
      variable: 'stepsRemaining',
      value: { $var: 'result' },
      position: [1400, 100],
    },
    {
      id: 'choose-dir',
      type: 'action',
      component: 'Array',
      method: 'array-random',
      inputs: {
        array: [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
        ],
      },
      position: [1600, 100],
    },
    {
      id: 'set-dir-x',
      type: 'variable',
      operation: 'set',
      variable: 'dirX',
      value: { $expr: 'result.dx' },
      position: [1800, 100],
    },
    {
      id: 'set-dir-y',
      type: 'variable',
      operation: 'set',
      variable: 'dirY',
      value: { $expr: 'result.dy' },
      position: [2000, 100],
    },
    {
      id: 'reset-move-timer',
      type: 'variable',
      operation: 'set',
      variable: 'moveTimer',
      value: 0,
      position: [2200, 100],
    },

    // --- Moving State ---
    {
      id: 'moving-tick',
      type: 'action',
      component: 'Math',
      method: 'subtract',
      inputs: {
        a: { $var: 'moveTimer' },
        b: { $var: 'deltaTime' },
      },
      position: [400, 300],
    },
    {
      id: 'set-move-timer',
      type: 'variable',
      operation: 'set',
      variable: 'moveTimer',
      value: { $var: 'result' },
      position: [600, 300],
    },
    {
      id: 'check-can-move',
      type: 'branch',
      kind: 'if',
      condition: { $expr: 'moveTimer <= 0 && stepsRemaining > 0' },
      position: [800, 300],
    },
    // Try to move
    {
      id: 'get-current-pos',
      type: 'action',
      component: 'Entity',
      method: 'get-position',
      inputs: { entityId: { $var: 'self' } },
      position: [1000, 280],
    },
    {
      id: 'calc-new-x',
      type: 'action',
      component: 'Math',
      method: 'add',
      inputs: {
        a: { $expr: 'result.x' },
        b: { $var: 'dirX' },
      },
      position: [1200, 280],
    },
    {
      id: 'save-new-x',
      type: 'variable',
      operation: 'set',
      variable: 'newX',
      value: { $var: 'result' },
      position: [1400, 280],
    },
    {
      id: 'calc-new-y',
      type: 'action',
      component: 'Math',
      method: 'add',
      inputs: {
        a: { $expr: 'pos.y' },
        b: { $var: 'dirY' },
      },
      position: [1600, 280],
    },
    {
      id: 'save-new-y',
      type: 'variable',
      operation: 'set',
      variable: 'newY',
      value: { $var: 'result' },
      position: [1800, 280],
    },
    // Check wander radius
    {
      id: 'calc-dist',
      type: 'action',
      component: 'Math',
      method: 'manhattan-distance',
      inputs: {
        x1: { $var: 'newX' },
        y1: { $var: 'newY' },
        x2: { $var: 'startX' },
        y2: { $var: 'startY' },
      },
      position: [2000, 280],
    },
    {
      id: 'check-radius',
      type: 'branch',
      kind: 'if',
      condition: { $expr: 'result <= wanderRadius' },
      position: [2200, 280],
    },
    // Move the entity
    {
      id: 'do-translate',
      type: 'action',
      component: 'Entity',
      method: 'translate',
      inputs: {
        entityId: { $var: 'self' },
        dx: { $var: 'dirX' },
        dy: { $var: 'dirY' },
      },
      position: [2400, 260],
    },
    {
      id: 'dec-steps',
      type: 'action',
      component: 'Math',
      method: 'subtract',
      inputs: {
        a: { $var: 'stepsRemaining' },
        b: 1,
      },
      position: [2600, 260],
    },
    {
      id: 'set-steps-after',
      type: 'variable',
      operation: 'set',
      variable: 'stepsRemaining',
      value: { $var: 'result' },
      position: [2800, 260],
    },
    {
      id: 'reset-cooldown',
      type: 'variable',
      operation: 'set',
      variable: 'moveTimer',
      value: { $var: 'moveCooldown' },
      position: [3000, 260],
    },
    // If out of radius, pick new direction toward start
    {
      id: 'pick-return-dir',
      type: 'action',
      component: 'Math',
      method: 'sign',
      inputs: { value: { $expr: 'startX - newX' } },
      position: [2400, 320],
    },
    {
      id: 'set-return-x',
      type: 'variable',
      operation: 'set',
      variable: 'dirX',
      value: { $var: 'result' },
      position: [2600, 320],
    },
    {
      id: 'pick-return-dir-y',
      type: 'action',
      component: 'Math',
      method: 'sign',
      inputs: { value: { $expr: 'startY - newY' } },
      position: [2800, 320],
    },
    {
      id: 'set-return-y',
      type: 'variable',
      operation: 'set',
      variable: 'dirY',
      value: { $var: 'result' },
      position: [3000, 320],
    },

    // Check if done moving
    {
      id: 'check-steps-done',
      type: 'branch',
      kind: 'if',
      condition: { $expr: 'stepsRemaining <= 0' },
      position: [800, 400],
    },
    // Transition to waiting
    {
      id: 'enter-waiting-after-move',
      type: 'variable',
      operation: 'set',
      variable: 'state',
      value: 'waiting',
      position: [1000, 400],
    },
    {
      id: 'calc-new-wait',
      type: 'action',
      component: 'Math',
      method: 'random-range',
      inputs: {
        min: { $var: 'minWaitTime' },
        max: { $var: 'maxWaitTime' },
      },
      position: [1200, 400],
    },
    {
      id: 'set-new-wait-timer',
      type: 'variable',
      operation: 'set',
      variable: 'stateTimer',
      value: { $var: 'result' },
      position: [1400, 400],
    },

    // --- Idle State ---
    {
      id: 'idle-to-waiting',
      type: 'variable',
      operation: 'set',
      variable: 'state',
      value: 'waiting',
      position: [400, 450],
    },
    {
      id: 'idle-set-timer',
      type: 'action',
      component: 'Math',
      method: 'random-range',
      inputs: {
        min: { $var: 'minWaitTime' },
        max: { $var: 'maxWaitTime' },
      },
      position: [600, 450],
    },
    {
      id: 'idle-save-timer',
      type: 'variable',
      operation: 'set',
      variable: 'stateTimer',
      value: { $var: 'result' },
      position: [800, 450],
    },
  ],
  edges: [
    // Init flow
    { from: 'init', fromPin: 'out', to: 'get-init-pos', toPin: 'in' },
    { from: 'get-init-pos', fromPin: 'out', to: 'save-start-x', toPin: 'in' },
    { from: 'save-start-x', fromPin: 'out', to: 'save-start-y', toPin: 'in' },
    { from: 'save-start-y', fromPin: 'out', to: 'init-state', toPin: 'in' },
    { from: 'init-state', fromPin: 'out', to: 'init-timer', toPin: 'in' },
    { from: 'init-timer', fromPin: 'out', to: 'set-init-timer', toPin: 'in' },

    // Update dispatch
    { from: 'update', fromPin: 'out', to: 'check-state', toPin: 'in' },

    // Waiting state flow
    { from: 'check-state', fromPin: 'waiting', to: 'waiting-tick', toPin: 'in' },
    { from: 'waiting-tick', fromPin: 'out', to: 'set-wait-timer', toPin: 'in' },
    { from: 'set-wait-timer', fromPin: 'out', to: 'check-wait-done', toPin: 'in' },
    { from: 'check-wait-done', fromPin: 'true', to: 'enter-moving', toPin: 'in' },
    { from: 'enter-moving', fromPin: 'out', to: 'calc-steps', toPin: 'in' },
    { from: 'calc-steps', fromPin: 'out', to: 'set-steps', toPin: 'in' },
    { from: 'set-steps', fromPin: 'out', to: 'choose-dir', toPin: 'in' },
    { from: 'choose-dir', fromPin: 'out', to: 'set-dir-x', toPin: 'in' },
    { from: 'set-dir-x', fromPin: 'out', to: 'set-dir-y', toPin: 'in' },
    { from: 'set-dir-y', fromPin: 'out', to: 'reset-move-timer', toPin: 'in' },

    // Moving state flow
    { from: 'check-state', fromPin: 'moving', to: 'moving-tick', toPin: 'in' },
    { from: 'moving-tick', fromPin: 'out', to: 'set-move-timer', toPin: 'in' },
    { from: 'set-move-timer', fromPin: 'out', to: 'check-can-move', toPin: 'in' },
    { from: 'check-can-move', fromPin: 'true', to: 'get-current-pos', toPin: 'in' },
    { from: 'get-current-pos', fromPin: 'out', to: 'calc-new-x', toPin: 'in' },
    { from: 'calc-new-x', fromPin: 'out', to: 'save-new-x', toPin: 'in' },
    { from: 'save-new-x', fromPin: 'out', to: 'calc-new-y', toPin: 'in' },
    { from: 'calc-new-y', fromPin: 'out', to: 'save-new-y', toPin: 'in' },
    { from: 'save-new-y', fromPin: 'out', to: 'calc-dist', toPin: 'in' },
    { from: 'calc-dist', fromPin: 'out', to: 'check-radius', toPin: 'in' },
    { from: 'check-radius', fromPin: 'true', to: 'do-translate', toPin: 'in' },
    { from: 'do-translate', fromPin: 'out', to: 'dec-steps', toPin: 'in' },
    { from: 'dec-steps', fromPin: 'out', to: 'set-steps-after', toPin: 'in' },
    { from: 'set-steps-after', fromPin: 'out', to: 'reset-cooldown', toPin: 'in' },
    { from: 'check-radius', fromPin: 'false', to: 'pick-return-dir', toPin: 'in' },
    { from: 'pick-return-dir', fromPin: 'out', to: 'set-return-x', toPin: 'in' },
    { from: 'set-return-x', fromPin: 'out', to: 'pick-return-dir-y', toPin: 'in' },
    { from: 'pick-return-dir-y', fromPin: 'out', to: 'set-return-y', toPin: 'in' },

    // After movement, check if done
    { from: 'check-can-move', fromPin: 'false', to: 'check-steps-done', toPin: 'in' },
    { from: 'reset-cooldown', fromPin: 'out', to: 'check-steps-done', toPin: 'in' },
    { from: 'check-steps-done', fromPin: 'true', to: 'enter-waiting-after-move', toPin: 'in' },
    { from: 'enter-waiting-after-move', fromPin: 'out', to: 'calc-new-wait', toPin: 'in' },
    { from: 'calc-new-wait', fromPin: 'out', to: 'set-new-wait-timer', toPin: 'in' },

    // Idle state flow
    { from: 'check-state', fromPin: 'idle', to: 'idle-to-waiting', toPin: 'in' },
    { from: 'idle-to-waiting', fromPin: 'out', to: 'idle-set-timer', toPin: 'in' },
    { from: 'idle-set-timer', fromPin: 'out', to: 'idle-save-timer', toPin: 'in' },
  ],
}

// -----------------------------------------------------------------------------
// Register Built-in Graphs
// -----------------------------------------------------------------------------

/**
 * Register all built-in behavior graphs with the registry.
 * Call this during app initialization.
 */
export function registerBuiltinGraphs(): void {
  BehaviorGraphRegistry.register(WANDER_BEHAVIOR_GRAPH)
  console.log('[BuiltinGraphs] Registered wander behavior graph')
}

/**
 * Get a built-in graph by ID
 */
export function getBuiltinGraph(id: string): LogicGraph | undefined {
  switch (id) {
    case 'builtin:wander':
      return WANDER_BEHAVIOR_GRAPH
    default:
      return undefined
  }
}
