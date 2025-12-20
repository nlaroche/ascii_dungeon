// src/tools/nodes.ts
// Visual scripting node introspection tools
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EDITOR_PATH = path.resolve(__dirname, '../../../editor/src');
// Cache for parsed nodes
let cachedNodes = null;
/**
 * Parse the types.ts file to extract BUILT_IN_NODES
 * Uses regex-based extraction which is simpler and faster than full AST parsing
 */
async function parseNodesFile() {
    if (cachedNodes)
        return cachedNodes;
    const typesPath = path.join(EDITOR_PATH, 'lib/nodes/types.ts');
    const content = await fs.promises.readFile(typesPath, 'utf-8');
    // Find the BUILT_IN_NODES array
    const arrayMatch = content.match(/export const BUILT_IN_NODES:\s*NodeTypeDefinition\[\]\s*=\s*\[([\s\S]*?)\n\];/);
    if (!arrayMatch) {
        console.error('Could not find BUILT_IN_NODES array');
        return [];
    }
    const arrayContent = arrayMatch[1];
    const nodes = [];
    // Match individual node objects
    const nodeRegex = /\{\s*id:\s*['"]([^'"]+)['"]/g;
    let match;
    // For each node, extract its full definition
    const nodeBlocks = arrayContent.split(/\n  \{/).slice(1).map(b => '{' + b.split(/\n  \},/)[0] + '}');
    for (const block of nodeBlocks) {
        try {
            // Extract fields using regex
            const id = block.match(/id:\s*['"]([^'"]+)['"]/)?.[1];
            const name = block.match(/name:\s*['"]([^'"]+)['"]/)?.[1];
            const category = block.match(/category:\s*['"]([^'"]+)['"]/)?.[1];
            const description = block.match(/description:\s*['"]([^'"]+)['"]/)?.[1];
            const icon = block.match(/icon:\s*['"]([^'"]+)['"]/)?.[1];
            const color = block.match(/color:\s*['"]([^'"]+)['"]/)?.[1];
            if (id && name && category) {
                // Parse inputs and outputs arrays
                const inputs = parsePortsArray(block, 'inputs');
                const outputs = parsePortsArray(block, 'outputs');
                nodes.push({
                    id,
                    name,
                    category,
                    description: description || '',
                    icon: icon || '?',
                    color: color || '#888',
                    inputs,
                    outputs,
                });
            }
        }
        catch (e) {
            // Skip malformed blocks
        }
    }
    cachedNodes = nodes;
    return nodes;
}
/**
 * Parse a ports array (inputs or outputs) from a node block
 */
function parsePortsArray(block, arrayName) {
    const ports = [];
    // Match the array
    const arrayMatch = block.match(new RegExp(`${arrayName}:\\s*\\[([^\\]]+)\\]`));
    if (!arrayMatch)
        return ports;
    const arrayContent = arrayMatch[1];
    // Match individual port objects
    const portRegex = /\{\s*id:\s*['"]([^'"]+)['"][^}]*\}/g;
    let match;
    while ((match = portRegex.exec(arrayContent)) !== null) {
        const portBlock = match[0];
        const id = portBlock.match(/id:\s*['"]([^'"]+)['"]/)?.[1];
        const label = portBlock.match(/label:\s*['"]([^'"]+)['"]/)?.[1];
        const type = portBlock.match(/type:\s*['"]([^'"]+)['"]/)?.[1];
        const required = portBlock.includes('required: true');
        if (id && type) {
            ports.push({ id, label: label || '', type, required });
        }
    }
    return ports;
}
/**
 * List all node types
 */
export async function listNodeTypes() {
    return parseNodesFile();
}
/**
 * Get nodes filtered by category
 */
export async function getNodesByCategory(category) {
    const nodes = await parseNodesFile();
    return nodes.filter(n => n.category === category);
}
/**
 * Search nodes by name or description
 */
export async function searchNodes(query) {
    const lowerQuery = query.toLowerCase();
    const nodes = await parseNodesFile();
    return nodes.filter(n => n.id.toLowerCase().includes(lowerQuery) ||
        n.name.toLowerCase().includes(lowerQuery) ||
        n.description.toLowerCase().includes(lowerQuery));
}
/**
 * Get node by ID
 */
export async function getNodeType(id) {
    const nodes = await parseNodesFile();
    return nodes.find(n => n.id === id) || null;
}
/**
 * Get statistics about node types
 */
export async function getNodeStats() {
    const nodes = await parseNodesFile();
    const stats = {
        total: nodes.length,
        event: 0,
        action: 0,
        condition: 0,
        data: 0,
        flow: 0,
        custom: 0,
    };
    for (const node of nodes) {
        stats[node.category]++;
    }
    return stats;
}
/**
 * Get the pattern for creating new node executors
 */
export function getNodeExecutorPattern() {
    return `// Node Executor Pattern - Follow this for new node types

// 1. Add node type definition in src/lib/nodes/types.ts:
{
  id: 'my-node',
  name: 'My Node',
  category: 'action',  // 'event' | 'action' | 'condition' | 'data' | 'flow'
  description: 'Does something useful',
  icon: '🎯',
  color: '#3b82f6',  // action = blue, event = green, condition = orange, data = purple, flow = pink
  inputs: [
    { id: 'flow', label: '', type: 'flow' },
    { id: 'value', label: 'Value', type: 'number', required: true },
  ],
  outputs: [
    { id: 'flow', label: '', type: 'flow' },
    { id: 'result', label: 'Result', type: 'number' },
  ],
}

// 2. Add executor in src/scripting/runtime/nodeExecutors.ts or GameHooks.ts:
import { registerExecutor, NodeExecutorContext } from './nodeExecutors'
import { ExprValue } from './expressions'

registerExecutor('my-node', (inputs: Record<string, ExprValue>, ctx: NodeExecutorContext) => {
  const value = Number(inputs.value) || 0

  // Do something with the value
  const result = value * 2

  return result  // This becomes the 'result' output
})

// For async operations:
registerExecutor('my-async-node', async (inputs, ctx) => {
  await someAsyncOperation()
  return result
})

// For nodes with multiple outputs, return an object:
registerExecutor('split-node', (inputs, ctx) => {
  return {
    positive: inputs.value > 0,
    negative: inputs.value < 0,
    zero: inputs.value === 0,
  }
})
`;
}
/**
 * Get categories with descriptions
 */
export function getNodeCategories() {
    return [
        { id: 'event', name: 'Events', color: '#22c55e', description: 'Trigger nodes that start execution flows' },
        { id: 'action', name: 'Actions', color: '#3b82f6', description: 'Nodes that do something (modify state, play sounds, etc.)' },
        { id: 'condition', name: 'Conditions', color: '#f59e0b', description: 'Logic and branching nodes' },
        { id: 'data', name: 'Data', color: '#8b5cf6', description: 'Get/transform data without side effects' },
        { id: 'flow', name: 'Flow Control', color: '#ec4899', description: 'Control execution flow (loops, sequences, etc.)' },
        { id: 'custom', name: 'Custom', color: '#6b7280', description: 'User-defined nodes' },
    ];
}
