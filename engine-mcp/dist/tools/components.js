// src/tools/components.ts
// Component introspection tools for the ASCII Dungeon engine MCP server
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Path to the editor source (from dist/tools/ -> engine-mcp -> ascii_dungeon -> editor/src)
const EDITOR_PATH = path.resolve(__dirname, '../../../editor/src');
/**
 * Parse a component file to extract metadata
 * This reads the actual TypeScript file and extracts decorator information
 */
async function parseComponentFile(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        // Extract @component decorator info
        const componentMatch = content.match(/@component\(\{([^}]+)\}\)/);
        if (!componentMatch)
            return null;
        const componentOpts = componentMatch[1];
        const name = componentOpts.match(/name:\s*['"]([^'"]+)['"]/)?.[1] || path.basename(filePath, '.ts');
        const icon = componentOpts.match(/icon:\s*['"]([^'"]+)['"]/)?.[1];
        const description = componentOpts.match(/description:\s*['"]([^'"]+)['"]/)?.[1];
        // Extract properties
        const properties = {};
        const propMatches = content.matchAll(/@property\(\{([^}]+)\}\)\s*\n\s*(\w+)/g);
        for (const match of propMatches) {
            const opts = match[1];
            const propName = match[2];
            properties[propName] = {
                type: opts.match(/type:\s*['"]([^'"]+)['"]/)?.[1] || 'any',
                label: opts.match(/label:\s*['"]([^'"]+)['"]/)?.[1],
                group: opts.match(/group:\s*['"]([^'"]+)['"]/)?.[1],
                tooltip: opts.match(/tooltip:\s*['"]([^'"]+)['"]/)?.[1],
            };
        }
        // Extract actions
        const actions = {};
        const actionMatches = content.matchAll(/@action\(\{([^}]+)\}\)\s*\n\s*(\w+)/g);
        for (const match of actionMatches) {
            const opts = match[1];
            const methodName = match[2];
            actions[methodName] = {
                methodName,
                displayName: opts.match(/displayName:\s*['"]([^'"]+)['"]/)?.[1],
                category: opts.match(/category:\s*['"]([^'"]+)['"]/)?.[1],
                description: opts.match(/description:\s*['"]([^'"]+)['"]/)?.[1],
            };
        }
        // Extract signals
        const signals = {};
        const signalMatches = content.matchAll(/@signal\(\{([^}]+)\}\)\s*\n\s*(\w+)/g);
        for (const match of signalMatches) {
            const opts = match[1];
            const propName = match[2];
            signals[propName] = {
                propertyName: propName,
                displayName: opts.match(/displayName:\s*['"]([^'"]+)['"]/)?.[1],
                description: opts.match(/description:\s*['"]([^'"]+)['"]/)?.[1],
            };
        }
        return {
            name,
            icon,
            description,
            properties,
            actions,
            signals,
            filePath,
        };
    }
    catch (e) {
        console.error(`Error parsing ${filePath}:`, e);
        return null;
    }
}
/**
 * List all components in the engine
 */
export async function listComponents() {
    const componentsDir = path.join(EDITOR_PATH, 'scripting/components');
    const files = await fs.promises.readdir(componentsDir);
    const components = [];
    for (const file of files) {
        if (file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== 'index.ts') {
            const info = await parseComponentFile(path.join(componentsDir, file));
            if (info)
                components.push(info);
        }
    }
    return components;
}
/**
 * Get detailed schema for a specific component
 */
export async function getComponentSchema(name) {
    const components = await listComponents();
    return components.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}
/**
 * Search components by name or description
 */
export async function searchComponents(query) {
    const lowerQuery = query.toLowerCase();
    const components = await listComponents();
    return components.filter(c => c.name.toLowerCase().includes(lowerQuery) ||
        c.description?.toLowerCase().includes(lowerQuery) ||
        Object.keys(c.actions).some(a => a.toLowerCase().includes(lowerQuery)));
}
/**
 * Get component creation pattern/template
 */
export function getComponentPattern() {
    return `// Component Template - Follow this pattern for new components

import { Component } from '../Component'
import { component, property, action, signal, lifecycle } from '../decorators'

@component({
  name: 'ComponentName',
  icon: '🎮',
  description: 'Brief description of the component'
})
export class ComponentNameComponent extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties - Exposed to editor inspector
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Property Name',
    group: 'Group Name',
    min: 0,
    max: 100,
    tooltip: 'Description of the property'
  })
  propertyName: number = 50

  // ─────────────────────────────────────────────────────────────────────────
  // Signals - Events that can be connected in visual scripting
  // ─────────────────────────────────────────────────────────────────────────

  @signal({ displayName: 'On Event', description: 'Fired when something happens' })
  onEvent: ((data: unknown) => void) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Actions - Methods callable from visual scripting
  // ─────────────────────────────────────────────────────────────────────────

  @action({ displayName: 'Do Something', category: 'Actions', description: 'Does something' })
  doSomething(): void {
    // Implementation
    this.onEvent?.({ result: 'done' })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    // Called when component is initialized
  }

  @lifecycle('Execute:Update')
  onUpdate(): void {
    // Called every frame (use sparingly)
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    // Cleanup when component is destroyed
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Convenience Object (optional)
// ─────────────────────────────────────────────────────────────────────────────

export const GameComponentName = {
  // Expose commonly used functionality globally
}
`;
}
