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
    description: 'Triggered when entities collide',
    icon: '💥',
    color: '#22c55e',
    inputs: [],
    outputs: [
      { id: 'flow', label: '', type: 'flow' },
      { id: 'entity-a', label: 'Entity A', type: 'entity' },
      { id: 'entity-b', label: 'Entity B', type: 'entity' },
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
];

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
