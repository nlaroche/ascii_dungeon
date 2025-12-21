// ═══════════════════════════════════════════════════════════════════════════
// Node Graph Types - Define node types for visual programming
// ═══════════════════════════════════════════════════════════════════════════

export type NodeCategory = 'event' | 'action' | 'condition' | 'data' | 'flow' | 'custom';

export interface NodePortDefinition {
  id: string;
  label: string;
  type: 'flow' | 'string' | 'number' | 'boolean' | 'any' | 'entity' | 'position';
  required?: boolean;
}

export interface NodeTypeDefinition {
  id: string;
  name: string;
  category: NodeCategory;
  description: string;
  icon: string;
  color: string;
  inputs: NodePortDefinition[];
  outputs: NodePortDefinition[];
  // Lua code to execute when this node runs
  luaCode?: string;
  // For custom nodes defined by users
  isCustom?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Node Types
// ─────────────────────────────────────────────────────────────────────────────

export const BUILT_IN_NODES: NodeTypeDefinition[] = [
  // Event nodes - trigger flows
  {
    id: 'on-start',
    name: 'On Start',
    category: 'event',
    description: 'Triggered when the game starts',
    icon: '▶',
    color: '#22c55e',
    inputs: [],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'on-update',
    name: 'On Update',
    category: 'event',
    description: 'Triggered every frame',
    icon: '↻',
    color: '#22c55e',
    inputs: [],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'dt', label: 'Delta Time', type: 'number' },
    ],
  },
  {
    id: 'on-key',
    name: 'On Key Press',
    category: 'event',
    description: 'Triggered when a key is pressed',
    icon: '⌨',
    color: '#22c55e',
    inputs: [{ id: 'key', label: 'Key', type: 'string', required: true }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'on-collision',
    name: 'On Collision',
    category: 'event',
    description: 'Triggered when colliding with a solid collider',
    icon: '💥',
    color: '#22c55e',
    inputs: [
      { id: 'layer', label: 'Filter Layer', type: 'string' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'other', label: 'Other Entity', type: 'entity' },
      { id: 'layer', label: 'Layer', type: 'string' },
    ],
  },
  {
    id: 'on-trigger-enter',
    name: 'On Trigger Enter',
    category: 'event',
    description: 'Triggered when an entity enters a trigger zone',
    icon: '➡',
    color: '#22c55e',
    inputs: [
      { id: 'layer', label: 'Filter Layer', type: 'string' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'other', label: 'Other Entity', type: 'entity' },
      { id: 'layer', label: 'Layer', type: 'string' },
    ],
  },
  {
    id: 'on-trigger-exit',
    name: 'On Trigger Exit',
    category: 'event',
    description: 'Triggered when an entity exits a trigger zone',
    icon: '⬅',
    color: '#22c55e',
    inputs: [
      { id: 'layer', label: 'Filter Layer', type: 'string' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'other', label: 'Other Entity', type: 'entity' },
      { id: 'layer', label: 'Layer', type: 'string' },
    ],
  },
  {
    id: 'on-trigger-stay',
    name: 'On Trigger Stay',
    category: 'event',
    description: 'Triggered every frame while in a trigger zone',
    icon: '⏺',
    color: '#22c55e',
    inputs: [
      { id: 'layer', label: 'Filter Layer', type: 'string' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'other', label: 'Other Entity', type: 'entity' },
      { id: 'dt', label: 'Delta Time', type: 'number' },
    ],
  },
  {
    id: 'on-trigger',
    name: 'Custom Trigger',
    category: 'event',
    description: 'Triggered by a custom event name',
    icon: '⚡',
    color: '#22c55e',
    inputs: [{ id: 'name', label: 'Event Name', type: 'string', required: true }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'data', label: 'Event Data', type: 'any' },
    ],
  },

  // Action nodes - do things
  {
    id: 'print',
    name: 'Print',
    category: 'action',
    description: 'Print a message to console',
    icon: '📝',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'message', label: 'Message', type: 'string', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
    luaCode: 'print(inputs.message)',
  },
  {
    id: 'set-variable',
    name: 'Set Variable',
    category: 'action',
    description: 'Set a global variable',
    icon: '=',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'value', label: 'Value', type: 'any', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
    luaCode: 'state.set(inputs.name, inputs.value)',
  },
  {
    id: 'spawn-entity',
    name: 'Spawn Entity',
    category: 'action',
    description: 'Create a new entity',
    icon: '+',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'type', label: 'Type', type: 'string', required: true },
      { id: 'position', label: 'Position', type: 'position' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
    ],
  },
  {
    id: 'destroy-entity',
    name: 'Destroy Entity',
    category: 'action',
    description: 'Remove an entity',
    icon: '✕',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'move-entity',
    name: 'Move Entity',
    category: 'action',
    description: 'Move an entity to a position',
    icon: '→',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity', required: true },
      { id: 'position', label: 'Position', type: 'position', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'play-sound',
    name: 'Play Sound',
    category: 'action',
    description: 'Play an audio file',
    icon: '🔊',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'sound', label: 'Sound', type: 'string', required: true },
      { id: 'volume', label: 'Volume', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'emit-event',
    name: 'Emit Event',
    category: 'action',
    description: 'Emit a custom event',
    icon: '📡',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Event Name', type: 'string', required: true },
      { id: 'data', label: 'Data', type: 'any' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'delay',
    name: 'Delay',
    category: 'action',
    description: 'Wait for a duration',
    icon: '⏱',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'seconds', label: 'Seconds', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // Condition nodes - branch logic
  {
    id: 'branch',
    name: 'Branch',
    category: 'condition',
    description: 'Branch based on a condition',
    icon: '◇',
    color: '#f59e0b',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'condition', label: 'Condition', type: 'boolean', required: true },
    ],
    outputs: [
      { id: 'true', label: 'True', type: 'flow' },
      { id: 'false', label: 'False', type: 'flow' },
    ],
  },
  {
    id: 'compare',
    name: 'Compare',
    category: 'condition',
    description: 'Compare two values',
    icon: '≟',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'any', required: true },
      { id: 'b', label: 'B', type: 'any', required: true },
    ],
    outputs: [
      { id: 'equal', label: '=', type: 'boolean' },
      { id: 'greater', label: '>', type: 'boolean' },
      { id: 'less', label: '<', type: 'boolean' },
    ],
  },
  {
    id: 'and',
    name: 'And',
    category: 'condition',
    description: 'Logical AND',
    icon: '∧',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'boolean', required: true },
      { id: 'b', label: 'B', type: 'boolean', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'or',
    name: 'Or',
    category: 'condition',
    description: 'Logical OR',
    icon: '∨',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'boolean', required: true },
      { id: 'b', label: 'B', type: 'boolean', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'not',
    name: 'Not',
    category: 'condition',
    description: 'Logical NOT',
    icon: '¬',
    color: '#f59e0b',
    inputs: [{ id: 'value', label: 'Value', type: 'boolean', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },

  // Data nodes - get/transform data
  {
    id: 'get-variable',
    name: 'Get Variable',
    category: 'data',
    description: 'Get a global variable',
    icon: '$',
    color: '#8b5cf6',
    inputs: [{ id: 'name', label: 'Name', type: 'string', required: true }],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
    luaCode: 'return state.get(inputs.name)',
  },
  {
    id: 'number',
    name: 'Number',
    category: 'data',
    description: 'A constant number',
    icon: '#',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'value', label: '', type: 'number' }],
  },
  {
    id: 'string',
    name: 'String',
    category: 'data',
    description: 'A constant string',
    icon: '"',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'string', required: true }],
    outputs: [{ id: 'value', label: '', type: 'string' }],
  },
  {
    id: 'math',
    name: 'Math',
    category: 'data',
    description: 'Basic math operations',
    icon: '±',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [
      { id: 'add', label: '+', type: 'number' },
      { id: 'sub', label: '-', type: 'number' },
      { id: 'mul', label: '×', type: 'number' },
      { id: 'div', label: '÷', type: 'number' },
    ],
  },
  {
    id: 'random',
    name: 'Random',
    category: 'data',
    description: 'Generate random number',
    icon: '🎲',
    color: '#8b5cf6',
    inputs: [
      { id: 'min', label: 'Min', type: 'number' },
      { id: 'max', label: 'Max', type: 'number' },
    ],
    outputs: [{ id: 'value', label: 'Value', type: 'number' }],
  },
  {
    id: 'position',
    name: 'Position',
    category: 'data',
    description: 'Create a position',
    icon: '📍',
    color: '#8b5cf6',
    inputs: [
      { id: 'x', label: 'X', type: 'number', required: true },
      { id: 'y', label: 'Y', type: 'number', required: true },
      { id: 'z', label: 'Z', type: 'number' },
    ],
    outputs: [{ id: 'position', label: 'Position', type: 'position' }],
  },
  {
    id: 'get-entity-property',
    name: 'Get Property',
    category: 'data',
    description: 'Get a property from an entity',
    icon: '.',
    color: '#8b5cf6',
    inputs: [
      { id: 'entity', label: 'Entity', type: 'entity', required: true },
      { id: 'property', label: 'Property', type: 'string', required: true },
    ],
    outputs: [{ id: 'value', label: 'Value', type: 'any' }],
  },

  // Flow control
  {
    id: 'sequence',
    name: 'Sequence',
    category: 'flow',
    description: 'Execute outputs in order',
    icon: '⋮',
    color: '#ec4899',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [
      { id: 'out-1', label: '1', type: 'flow' },
      { id: 'out-2', label: '2', type: 'flow' },
      { id: 'out-3', label: '3', type: 'flow' },
    ],
  },
  {
    id: 'for-loop',
    name: 'For Loop',
    category: 'flow',
    description: 'Loop a number of times',
    icon: '↺',
    color: '#ec4899',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'count', label: 'Count', type: 'number', required: true },
    ],
    outputs: [
      { id: 'loop', label: 'Loop', type: 'flow' },
      { id: 'index', label: 'Index', type: 'number' },
      { id: 'done', label: 'Done', type: 'flow' },
    ],
  },
  {
    id: 'while-loop',
    name: 'While Loop',
    category: 'flow',
    description: 'Loop while condition is true',
    icon: '⟳',
    color: '#ec4899',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'condition', label: 'Condition', type: 'boolean', required: true },
    ],
    outputs: [
      { id: 'loop', label: 'Loop', type: 'flow' },
      { id: 'done', label: 'Done', type: 'flow' },
    ],
  },
  {
    id: 'parallel',
    name: 'Parallel',
    category: 'flow',
    description: 'Execute all outputs simultaneously',
    icon: '⫾',
    color: '#ec4899',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [
      { id: 'out-1', label: '1', type: 'flow' },
      { id: 'out-2', label: '2', type: 'flow' },
      { id: 'out-3', label: '3', type: 'flow' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // State Machine nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fsm-on-enter',
    name: 'On State Enter',
    category: 'event',
    description: 'Triggered when entering a state',
    icon: '→',
    color: '#22c55e',
    inputs: [{ id: 'state', label: 'State', type: 'string', required: true }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'previous', label: 'Previous State', type: 'string' },
    ],
  },
  {
    id: 'fsm-on-exit',
    name: 'On State Exit',
    category: 'event',
    description: 'Triggered when exiting a state',
    icon: '←',
    color: '#22c55e',
    inputs: [{ id: 'state', label: 'State', type: 'string', required: true }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'next', label: 'Next State', type: 'string' },
    ],
  },
  {
    id: 'fsm-transition',
    name: 'Transition To',
    category: 'action',
    description: 'Transition to a state',
    icon: '⇒',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'state', label: 'Target State', type: 'string', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'fsm-trigger',
    name: 'Trigger Event',
    category: 'action',
    description: 'Trigger a state machine event',
    icon: '⚡',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'event', label: 'Event', type: 'string', required: true },
    ],
    outputs: [
      { id: 'success', label: 'Success', type: 'flow' },
      { id: 'failed', label: 'Failed', type: 'flow' },
    ],
  },
  {
    id: 'fsm-get-state',
    name: 'Get Current State',
    category: 'data',
    description: 'Get the current state name',
    icon: '?',
    color: '#8b5cf6',
    inputs: [],
    outputs: [{ id: 'state', label: 'State', type: 'string' }],
  },
  {
    id: 'fsm-is-state',
    name: 'Is In State',
    category: 'condition',
    description: 'Check if in a specific state',
    icon: '≡',
    color: '#f59e0b',
    inputs: [{ id: 'state', label: 'State', type: 'string', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Animation nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'play-animation',
    name: 'Play Animation',
    category: 'action',
    description: 'Play an animation on an entity',
    icon: '▶',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'name', label: 'Animation', type: 'string', required: true },
      { id: 'loop', label: 'Loop', type: 'boolean' },
      { id: 'speed', label: 'Speed', type: 'number' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'finished', label: 'On Finished', type: 'flow' },
    ],
  },
  {
    id: 'stop-animation',
    name: 'Stop Animation',
    category: 'action',
    description: 'Stop current animation',
    icon: '■',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'set-animation-frame',
    name: 'Set Frame',
    category: 'action',
    description: 'Set animation to specific frame',
    icon: '⊡',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'frame', label: 'Frame', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'on-animation-end',
    name: 'On Animation End',
    category: 'event',
    description: 'Triggered when animation finishes',
    icon: '⏹',
    color: '#22c55e',
    inputs: [{ id: 'name', label: 'Animation', type: 'string' }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
    ],
  },
  {
    id: 'tween',
    name: 'Tween',
    category: 'action',
    description: 'Animate a value over time',
    icon: '~',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'property', label: 'Property', type: 'string', required: true },
      { id: 'target', label: 'Target', type: 'number', required: true },
      { id: 'duration', label: 'Duration', type: 'number', required: true },
      { id: 'easing', label: 'Easing', type: 'string' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'finished', label: 'On Finished', type: 'flow' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Sound nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'play-sound-full',
    name: 'Play Sound (Full)',
    category: 'action',
    description: 'Play a sound with full options',
    icon: '🔊',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'sound', label: 'Sound', type: 'string', required: true },
      { id: 'volume', label: 'Volume', type: 'number' },
      { id: 'pitch', label: 'Pitch', type: 'number' },
      { id: 'loop', label: 'Loop', type: 'boolean' },
      { id: 'spatial', label: 'Position', type: 'position' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'handle', label: 'Handle', type: 'any' },
    ],
  },
  {
    id: 'stop-sound',
    name: 'Stop Sound',
    category: 'action',
    description: 'Stop a playing sound',
    icon: '🔇',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'handle', label: 'Handle', type: 'any', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'set-volume',
    name: 'Set Volume',
    category: 'action',
    description: 'Set sound volume',
    icon: '🔉',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'handle', label: 'Handle', type: 'any', required: true },
      { id: 'volume', label: 'Volume', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'play-music',
    name: 'Play Music',
    category: 'action',
    description: 'Play background music',
    icon: '🎵',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'track', label: 'Track', type: 'string', required: true },
      { id: 'fade', label: 'Fade Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'stop-music',
    name: 'Stop Music',
    category: 'action',
    description: 'Stop background music',
    icon: '⏹',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'fade', label: 'Fade Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Camera nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'camera-shake',
    name: 'Camera Shake',
    category: 'action',
    description: 'Shake the camera',
    icon: '📳',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'intensity', label: 'Intensity', type: 'number' },
      { id: 'duration', label: 'Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-flash',
    name: 'Camera Flash',
    category: 'action',
    description: 'Flash the screen',
    icon: '💥',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'duration', label: 'Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-follow',
    name: 'Camera Follow',
    category: 'action',
    description: 'Make camera follow an entity',
    icon: '👁',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'target', label: 'Target', type: 'entity', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-move-to',
    name: 'Camera Move To',
    category: 'action',
    description: 'Move camera to a position',
    icon: '🎯',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'position', label: 'Position', type: 'position', required: true },
      { id: 'duration', label: 'Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-switch-to',
    name: 'Switch Camera',
    category: 'action',
    description: 'Switch to a specific virtual camera',
    icon: '🎬',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'camera', label: 'Camera Node', type: 'entity', required: true },
      { id: 'immediate', label: 'Immediate', type: 'boolean' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-set-priority',
    name: 'Set Camera Priority',
    category: 'action',
    description: 'Set the priority of a virtual camera',
    icon: '📊',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'camera', label: 'Camera Node', type: 'entity', required: true },
      { id: 'priority', label: 'Priority', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-set-zoom',
    name: 'Set Camera Zoom',
    category: 'action',
    description: 'Set the zoom level of the live camera',
    icon: '🔍',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'zoom', label: 'Zoom', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-set-rotation',
    name: 'Set Camera Rotation',
    category: 'action',
    description: 'Set the rotation of the live camera',
    icon: '🔄',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'rotation', label: 'Rotation (deg)', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-add-trauma',
    name: 'Add Camera Trauma',
    category: 'action',
    description: 'Add trauma for camera shake effect',
    icon: '〰',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'amount', label: 'Amount (0-1)', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-set-bounds',
    name: 'Set Camera Bounds',
    category: 'action',
    description: 'Set the confiner bounds for the live camera',
    icon: '⬚',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'minX', label: 'Min X', type: 'number', required: true },
      { id: 'minY', label: 'Min Y', type: 'number', required: true },
      { id: 'maxX', label: 'Max X', type: 'number', required: true },
      { id: 'maxY', label: 'Max Y', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-letterbox-show',
    name: 'Show Letterbox',
    category: 'action',
    description: 'Show cinematic letterbox bars',
    icon: '▬',
    color: '#3b82f6',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-letterbox-hide',
    name: 'Hide Letterbox',
    category: 'action',
    description: 'Hide cinematic letterbox bars',
    icon: '▭',
    color: '#3b82f6',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'camera-get-position',
    name: 'Get Camera Position',
    category: 'data',
    description: 'Get the current camera position',
    icon: '📷',
    color: '#8b5cf6',
    inputs: [],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
    ],
  },
  {
    id: 'camera-get-zoom',
    name: 'Get Camera Zoom',
    category: 'data',
    description: 'Get the current camera zoom level',
    icon: '🔎',
    color: '#8b5cf6',
    inputs: [],
    outputs: [{ id: 'zoom', label: 'Zoom', type: 'number' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Particle nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'spawn-particles',
    name: 'Spawn Particles',
    category: 'action',
    description: 'Spawn a particle effect',
    icon: '✨',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'effect', label: 'Effect', type: 'string', required: true },
      { id: 'position', label: 'Position', type: 'position', required: true },
      { id: 'duration', label: 'Duration', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Event nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'emit-event',
    name: 'Emit Event',
    category: 'action',
    description: 'Emit a custom game event',
    icon: '📡',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'event', label: 'Event Name', type: 'string', required: true },
      { id: 'data', label: 'Data', type: 'any' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Debug/Utility nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'debug-log',
    name: 'Debug Log',
    category: 'action',
    description: 'Log a message to debug console',
    icon: '🐛',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'message', label: 'Message', type: 'string', required: true },
      { id: 'level', label: 'Level', type: 'string' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'debug-value',
    name: 'Log Value',
    category: 'action',
    description: 'Log a named value',
    icon: '📊',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'value', label: 'Value', type: 'any', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'debug-breakpoint',
    name: 'Breakpoint',
    category: 'flow',
    description: 'Pause execution in debug mode',
    icon: '⏸',
    color: '#ec4899',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Signal/Event nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'on-signal',
    name: 'On Signal',
    category: 'event',
    description: 'Listen for a component signal',
    icon: '📡',
    color: '#22c55e',
    inputs: [
      { id: 'component', label: 'Component', type: 'string', required: true },
      { id: 'signal', label: 'Signal', type: 'string', required: true },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'data', label: 'Data', type: 'any' },
    ],
  },
  {
    id: 'call-action',
    name: 'Call Action',
    category: 'action',
    description: 'Call a component action',
    icon: '⚙',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'component', label: 'Component', type: 'string', required: true },
      { id: 'action', label: 'Action', type: 'string', required: true },
      { id: 'params', label: 'Params', type: 'any' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'result', label: 'Result', type: 'any' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Input nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'on-key-down',
    name: 'On Key Down',
    category: 'event',
    description: 'Triggered when a key is pressed',
    icon: '⌨',
    color: '#22c55e',
    inputs: [{ id: 'key', label: 'Key Code', type: 'string', required: true }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'shift', label: 'Shift', type: 'boolean' },
      { id: 'ctrl', label: 'Ctrl', type: 'boolean' },
      { id: 'alt', label: 'Alt', type: 'boolean' },
    ],
  },
  {
    id: 'on-key-up',
    name: 'On Key Up',
    category: 'event',
    description: 'Triggered when a key is released',
    icon: '⌨',
    color: '#22c55e',
    inputs: [{ id: 'key', label: 'Key Code', type: 'string', required: true }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'is-key-down',
    name: 'Is Key Down',
    category: 'condition',
    description: 'Check if a key is currently held',
    icon: '⌨',
    color: '#f59e0b',
    inputs: [{ id: 'key', label: 'Key Code', type: 'string', required: true }],
    outputs: [{ id: 'result', label: 'Is Down', type: 'boolean' }],
  },
  {
    id: 'on-mouse-down',
    name: 'On Mouse Down',
    category: 'event',
    description: 'Triggered when mouse button is pressed',
    icon: '🖱',
    color: '#22c55e',
    inputs: [{ id: 'button', label: 'Button (0-2)', type: 'number' }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
    ],
  },
  {
    id: 'on-mouse-up',
    name: 'On Mouse Up',
    category: 'event',
    description: 'Triggered when mouse button is released',
    icon: '🖱',
    color: '#22c55e',
    inputs: [{ id: 'button', label: 'Button (0-2)', type: 'number' }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
    ],
  },
  {
    id: 'get-mouse-position',
    name: 'Get Mouse Position',
    category: 'data',
    description: 'Get current mouse position',
    icon: '🖱',
    color: '#8b5cf6',
    inputs: [],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
    ],
  },
  {
    id: 'is-mouse-down',
    name: 'Is Mouse Down',
    category: 'condition',
    description: 'Check if a mouse button is held',
    icon: '🖱',
    color: '#f59e0b',
    inputs: [{ id: 'button', label: 'Button (0-2)', type: 'number' }],
    outputs: [{ id: 'result', label: 'Is Down', type: 'boolean' }],
  },
  {
    id: 'get-input-axis',
    name: 'Get Input Axis',
    category: 'data',
    description: 'Get virtual axis input (-1 to 1)',
    icon: '⊕',
    color: '#8b5cf6',
    inputs: [{ id: 'axis', label: 'Axis', type: 'string', required: true }],
    outputs: [{ id: 'value', label: 'Value', type: 'number' }],
  },
  {
    id: 'get-movement-vector',
    name: 'Get Movement',
    category: 'data',
    description: 'Get WASD/Arrow movement as vector',
    icon: '↔',
    color: '#8b5cf6',
    inputs: [],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
      { id: 'normalized', label: 'Normalized', type: 'position' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Timer nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'timer-start',
    name: 'Start Timer',
    category: 'action',
    description: 'Start a named timer',
    icon: '⏱',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'duration', label: 'Duration', type: 'number', required: true },
      { id: 'loop', label: 'Loop', type: 'boolean' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'timer-stop',
    name: 'Stop Timer',
    category: 'action',
    description: 'Stop a named timer',
    icon: '⏹',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Name', type: 'string', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'on-timer',
    name: 'On Timer',
    category: 'event',
    description: 'Triggered when timer fires',
    icon: '⏰',
    color: '#22c55e',
    inputs: [{ id: 'name', label: 'Name', type: 'string', required: true }],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'elapsed', label: 'Elapsed', type: 'number' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Entity nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'get-self',
    name: 'Get Self',
    category: 'data',
    description: 'Get reference to this entity',
    icon: '◉',
    color: '#8b5cf6',
    inputs: [],
    outputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
  },
  {
    id: 'get-parent',
    name: 'Get Parent',
    category: 'data',
    description: 'Get parent entity',
    icon: '↑',
    color: '#8b5cf6',
    inputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
    outputs: [{ id: 'parent', label: 'Parent', type: 'entity' }],
  },
  {
    id: 'get-children',
    name: 'Get Children',
    category: 'data',
    description: 'Get all child entities',
    icon: '↓',
    color: '#8b5cf6',
    inputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
    outputs: [{ id: 'children', label: 'Children', type: 'any' }],
  },
  {
    id: 'find-entity',
    name: 'Find Entity',
    category: 'data',
    description: 'Find entity by name or tag',
    icon: '🔍',
    color: '#8b5cf6',
    inputs: [
      { id: 'name', label: 'Name', type: 'string' },
      { id: 'tag', label: 'Tag', type: 'string' },
    ],
    outputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
  },
  {
    id: 'find-entities',
    name: 'Find All',
    category: 'data',
    description: 'Find all entities matching criteria',
    icon: '🔍',
    color: '#8b5cf6',
    inputs: [
      { id: 'tag', label: 'Tag', type: 'string' },
      { id: 'layer', label: 'Layer', type: 'string' },
    ],
    outputs: [{ id: 'entities', label: 'Entities', type: 'any' }],
  },
  {
    id: 'get-component',
    name: 'Get Component',
    category: 'data',
    description: 'Get a component from an entity',
    icon: '⚙',
    color: '#8b5cf6',
    inputs: [
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'type', label: 'Type', type: 'string', required: true },
    ],
    outputs: [{ id: 'component', label: 'Component', type: 'any' }],
  },
  {
    id: 'has-component',
    name: 'Has Component',
    category: 'condition',
    description: 'Check if entity has a component',
    icon: '?',
    color: '#f59e0b',
    inputs: [
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'type', label: 'Type', type: 'string', required: true },
    ],
    outputs: [{ id: 'result', label: 'Has', type: 'boolean' }],
  },
  {
    id: 'set-enabled',
    name: 'Set Enabled',
    category: 'action',
    description: 'Enable or disable an entity',
    icon: '◐',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'enabled', label: 'Enabled', type: 'boolean', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'is-enabled',
    name: 'Is Enabled',
    category: 'condition',
    description: 'Check if entity is enabled',
    icon: '?',
    color: '#f59e0b',
    inputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
    outputs: [{ id: 'result', label: 'Enabled', type: 'boolean' }],
  },
  {
    id: 'set-position',
    name: 'Set Position',
    category: 'action',
    description: 'Set entity position',
    icon: '📍',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'x', label: 'X', type: 'number', required: true },
      { id: 'y', label: 'Y', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'get-position',
    name: 'Get Position',
    category: 'data',
    description: 'Get entity position',
    icon: '📍',
    color: '#8b5cf6',
    inputs: [{ id: 'entity', label: 'Entity', type: 'entity' }],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
      { id: 'position', label: 'Position', type: 'position' },
    ],
  },
  {
    id: 'translate',
    name: 'Translate',
    category: 'action',
    description: 'Move entity by offset',
    icon: '→',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
      { id: 'dx', label: 'ΔX', type: 'number', required: true },
      { id: 'dy', label: 'ΔY', type: 'number', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'distance',
    name: 'Distance',
    category: 'data',
    description: 'Distance between two entities or positions',
    icon: '↔',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'entity' },
      { id: 'b', label: 'B', type: 'entity' },
    ],
    outputs: [{ id: 'distance', label: 'Distance', type: 'number' }],
  },
  {
    id: 'direction',
    name: 'Direction',
    category: 'data',
    description: 'Direction from A to B',
    icon: '→',
    color: '#8b5cf6',
    inputs: [
      { id: 'from', label: 'From', type: 'entity' },
      { id: 'to', label: 'To', type: 'entity' },
    ],
    outputs: [
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
      { id: 'angle', label: 'Angle', type: 'number' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Scene nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'load-scene',
    name: 'Load Scene',
    category: 'action',
    description: 'Load a scene by name',
    icon: '📂',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Scene Name', type: 'string', required: true },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'reload-scene',
    name: 'Reload Scene',
    category: 'action',
    description: 'Reload the current scene',
    icon: '↻',
    color: '#3b82f6',
    inputs: [{ id: 'flow', label: '', type: 'flow' }],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'get-scene-name',
    name: 'Get Scene Name',
    category: 'data',
    description: 'Get the current scene name',
    icon: '📄',
    color: '#8b5cf6',
    inputs: [],
    outputs: [{ id: 'name', label: 'Name', type: 'string' }],
  },
  {
    id: 'on-scene-loaded',
    name: 'On Scene Loaded',
    category: 'event',
    description: 'Triggered when a scene finishes loading',
    icon: '📂',
    color: '#22c55e',
    inputs: [],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'name', label: 'Scene Name', type: 'string' },
    ],
  },
  {
    id: 'instantiate',
    name: 'Instantiate',
    category: 'action',
    description: 'Instantiate a prefab',
    icon: '+',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'prefab', label: 'Prefab', type: 'string', required: true },
      { id: 'x', label: 'X', type: 'number' },
      { id: 'y', label: 'Y', type: 'number' },
      { id: 'parent', label: 'Parent', type: 'entity' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity' },
    ],
  },
  {
    id: 'destroy',
    name: 'Destroy',
    category: 'action',
    description: 'Destroy an entity',
    icon: '✕',
    color: '#3b82f6',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity', label: 'Entity', type: 'entity', required: true },
      { id: 'delay', label: 'Delay', type: 'number' },
    ],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },
  {
    id: 'on-destroy',
    name: 'On Destroy',
    category: 'event',
    description: 'Triggered before entity is destroyed',
    icon: '✕',
    color: '#22c55e',
    inputs: [],
    outputs: [{ id: 'flow', label: '', type: 'flow' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Math utility nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'clamp',
    name: 'Clamp',
    category: 'data',
    description: 'Clamp a value between min and max',
    icon: '⌇',
    color: '#8b5cf6',
    inputs: [
      { id: 'value', label: 'Value', type: 'number', required: true },
      { id: 'min', label: 'Min', type: 'number', required: true },
      { id: 'max', label: 'Max', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'lerp',
    name: 'Lerp',
    category: 'data',
    description: 'Linear interpolation between two values',
    icon: '~',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
      { id: 't', label: 'T', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'abs',
    name: 'Absolute',
    category: 'data',
    description: 'Absolute value',
    icon: '|x|',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'sign',
    name: 'Sign',
    category: 'data',
    description: 'Sign of a number (-1, 0, or 1)',
    icon: '±',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'floor',
    name: 'Floor',
    category: 'data',
    description: 'Round down to integer',
    icon: '⌊⌋',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'ceil',
    name: 'Ceiling',
    category: 'data',
    description: 'Round up to integer',
    icon: '⌈⌉',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'round',
    name: 'Round',
    category: 'data',
    description: 'Round to nearest integer',
    icon: '≈',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'min',
    name: 'Min',
    category: 'data',
    description: 'Minimum of two values',
    icon: '↓',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'max',
    name: 'Max',
    category: 'data',
    description: 'Maximum of two values',
    icon: '↑',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'sin',
    name: 'Sin',
    category: 'data',
    description: 'Sine function',
    icon: '∿',
    color: '#8b5cf6',
    inputs: [{ id: 'angle', label: 'Angle', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'cos',
    name: 'Cos',
    category: 'data',
    description: 'Cosine function',
    icon: '∿',
    color: '#8b5cf6',
    inputs: [{ id: 'angle', label: 'Angle', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'atan2',
    name: 'Atan2',
    category: 'data',
    description: 'Angle from X and Y',
    icon: '∠',
    color: '#8b5cf6',
    inputs: [
      { id: 'y', label: 'Y', type: 'number', required: true },
      { id: 'x', label: 'X', type: 'number', required: true },
    ],
    outputs: [{ id: 'angle', label: 'Angle', type: 'number' }],
  },
  {
    id: 'sqrt',
    name: 'Sqrt',
    category: 'data',
    description: 'Square root',
    icon: '√',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'number', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'pow',
    name: 'Power',
    category: 'data',
    description: 'Raise to power',
    icon: 'x²',
    color: '#8b5cf6',
    inputs: [
      { id: 'base', label: 'Base', type: 'number', required: true },
      { id: 'exp', label: 'Exponent', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },
  {
    id: 'modulo',
    name: 'Modulo',
    category: 'data',
    description: 'Remainder of division',
    icon: '%',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Vector math nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'vec2-add',
    name: 'Add Vectors',
    category: 'data',
    description: 'Add two 2D vectors',
    icon: '+',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'position', required: true },
      { id: 'b', label: 'B', type: 'position', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'position' }],
  },
  {
    id: 'vec2-sub',
    name: 'Subtract Vectors',
    category: 'data',
    description: 'Subtract two 2D vectors',
    icon: '-',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'position', required: true },
      { id: 'b', label: 'B', type: 'position', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'position' }],
  },
  {
    id: 'vec2-scale',
    name: 'Scale Vector',
    category: 'data',
    description: 'Multiply vector by scalar',
    icon: '×',
    color: '#8b5cf6',
    inputs: [
      { id: 'vec', label: 'Vector', type: 'position', required: true },
      { id: 'scale', label: 'Scale', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'position' }],
  },
  {
    id: 'vec2-normalize',
    name: 'Normalize',
    category: 'data',
    description: 'Normalize vector to length 1',
    icon: '→',
    color: '#8b5cf6',
    inputs: [{ id: 'vec', label: 'Vector', type: 'position', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'position' }],
  },
  {
    id: 'vec2-length',
    name: 'Vector Length',
    category: 'data',
    description: 'Get length of vector',
    icon: '|v|',
    color: '#8b5cf6',
    inputs: [{ id: 'vec', label: 'Vector', type: 'position', required: true }],
    outputs: [{ id: 'length', label: 'Length', type: 'number' }],
  },
  {
    id: 'vec2-dot',
    name: 'Dot Product',
    category: 'data',
    description: 'Dot product of two vectors',
    icon: '·',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'position', required: true },
      { id: 'b', label: 'B', type: 'position', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // String nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'concat',
    name: 'Concatenate',
    category: 'data',
    description: 'Join two strings',
    icon: '+',
    color: '#8b5cf6',
    inputs: [
      { id: 'a', label: 'A', type: 'string', required: true },
      { id: 'b', label: 'B', type: 'string', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'string' }],
  },
  {
    id: 'format',
    name: 'Format',
    category: 'data',
    description: 'Format string with values',
    icon: '$',
    color: '#8b5cf6',
    inputs: [
      { id: 'template', label: 'Template', type: 'string', required: true },
      { id: 'values', label: 'Values', type: 'any' },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'string' }],
  },
  {
    id: 'to-string',
    name: 'To String',
    category: 'data',
    description: 'Convert value to string',
    icon: '"',
    color: '#8b5cf6',
    inputs: [{ id: 'value', label: 'Value', type: 'any', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'string' }],
  },
  {
    id: 'parse-number',
    name: 'Parse Number',
    category: 'data',
    description: 'Convert string to number',
    icon: '#',
    color: '#8b5cf6',
    inputs: [{ id: 'string', label: 'String', type: 'string', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'number' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Comparison nodes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'equals',
    name: 'Equals',
    category: 'condition',
    description: 'Check if two values are equal',
    icon: '=',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'any', required: true },
      { id: 'b', label: 'B', type: 'any', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'greater-than',
    name: 'Greater Than',
    category: 'condition',
    description: 'Check if A > B',
    icon: '>',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'less-than',
    name: 'Less Than',
    category: 'condition',
    description: 'Check if A < B',
    icon: '<',
    color: '#f59e0b',
    inputs: [
      { id: 'a', label: 'A', type: 'number', required: true },
      { id: 'b', label: 'B', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'in-range',
    name: 'In Range',
    category: 'condition',
    description: 'Check if value is between min and max',
    icon: '⌇',
    color: '#f59e0b',
    inputs: [
      { id: 'value', label: 'Value', type: 'number', required: true },
      { id: 'min', label: 'Min', type: 'number', required: true },
      { id: 'max', label: 'Max', type: 'number', required: true },
    ],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },
  {
    id: 'is-null',
    name: 'Is Null',
    category: 'condition',
    description: 'Check if value is null or undefined',
    icon: '∅',
    color: '#f59e0b',
    inputs: [{ id: 'value', label: 'Value', type: 'any', required: true }],
    outputs: [{ id: 'result', label: 'Result', type: 'boolean' }],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Script Node - Custom TypeScript code with flexible signals/inputs/outputs
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'script',
    name: 'Script',
    category: 'custom',
    description: 'Custom TypeScript code block with configurable inputs, outputs, and signal handlers',
    icon: '{ }',
    color: '#6366f1',
    inputs: [
      { id: 'flow', label: '', type: 'flow' },
    ],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
    ],
    // Script nodes have additional properties stored in node.data:
    // - code: string (the TypeScript code)
    // - customInputs: NodePortDefinition[] (user-defined inputs)
    // - customOutputs: NodePortDefinition[] (user-defined outputs)
    // - listenSignals: string[] (signals this script listens to)
    // - emitSignals: string[] (signals this script can emit)
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Script Node Extended Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface ScriptNodeData {
  nodeTypeId: 'script';
  code: string;
  customInputs: NodePortDefinition[];
  customOutputs: NodePortDefinition[];
  listenSignals: string[];
  emitSignals: string[];
}

export function createDefaultScriptData(): ScriptNodeData {
  return {
    nodeTypeId: 'script',
    code: `// Custom script node
// Available in scope:
//   inputs: Record<string, any> - resolved input values
//   ctx: GraphExecutionContext - execution context
//   self: string - entity ID this behavior is attached to
//   emit(signal: string, data?: any) - emit a custom signal
//   Scene, Events, Timers - built-in APIs

// Example: Move entity when a custom signal is received
// if (inputs.trigger) {
//   Scene.translate(self, inputs.dx ?? 1, inputs.dy ?? 0);
//   emit('moved', { entity: self });
// }

return inputs;
`,
    customInputs: [],
    customOutputs: [],
    listenSignals: [],
    emitSignals: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Registry
// ─────────────────────────────────────────────────────────────────────────────

const nodeRegistry = new Map<string, NodeTypeDefinition>();

// Initialize with built-in nodes
BUILT_IN_NODES.forEach((node) => nodeRegistry.set(node.id, node));

export function getNodeType(id: string): NodeTypeDefinition | undefined {
  return nodeRegistry.get(id);
}

export function getAllNodeTypes(): NodeTypeDefinition[] {
  return Array.from(nodeRegistry.values());
}

export function getNodesByCategory(category: NodeCategory): NodeTypeDefinition[] {
  return getAllNodeTypes().filter((n) => n.category === category);
}

export function registerNodeType(node: NodeTypeDefinition): void {
  nodeRegistry.set(node.id, { ...node, isCustom: true });
}

export function unregisterNodeType(id: string): boolean {
  const node = nodeRegistry.get(id);
  if (node?.isCustom) {
    nodeRegistry.delete(id);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Type Colors
// ─────────────────────────────────────────────────────────────────────────────

export const PORT_COLORS: Record<string, string> = {
  flow: '#ffffff',
  string: '#22c55e',
  number: '#3b82f6',
  boolean: '#f59e0b',
  any: '#8b5cf6',
  entity: '#ec4899',
  position: '#06b6d4',
};
