// src/tools/docs.ts
// Semantic documentation for AI understanding of engine systems
export const ENGINE_DOCS = {
    'graph-execution': {
        name: 'Visual Scripting Graph Execution',
        overview: `The visual scripting system executes node graphs in response to signals (events).

KEY CONCEPTS:
- Signal nodes (green) are entry points - they fire when events occur
- Flow edges (white lines) determine execution order - left to right, top to bottom
- Data edges (colored lines) pass values between nodes
- Execution is synchronous by default, but some nodes (delay, async) pause flow

EXECUTION ORDER:
1. An event occurs (key press, collision, timer, etc.)
2. All signal nodes listening for that event are collected
3. Signal nodes execute in order of their Y position (top first)
4. Each signal follows its flow edges to connected action nodes
5. Actions execute immediately unless they're async (delay, tween)
6. Data is pulled from connected input nodes on-demand (lazy evaluation)

PARALLEL vs SEQUENCE:
- Sequence node: executes children one after another, waits for each
- Parallel node: starts all children simultaneously, waits for all to complete
- Default flow: each output edge executes sequentially in visual order`,
        coreFiles: [
            'editor/src/scripting/runtime/graph.ts - GraphRuntime, GraphExecutor',
            'editor/src/lib/nodes/types.ts - Node definitions (BUILT_IN_NODES)',
            'editor/src/scripting/runtime/nodeExecutors.ts - Node implementations',
        ],
        concepts: [
            'Signal nodes trigger from events',
            'Flow edges control execution order',
            'Data edges are lazily evaluated',
            'Variables have scope: global, scene, entity, local',
            'Expressions use $expr syntax for inline calculations',
        ],
        executionModel: `
// Simplified execution flow:
function executeNode(node, context) {
  // 1. Collect input values from connected data edges
  const inputs = {};
  for (const port of node.inputs) {
    if (port.edge) {
      inputs[port.id] = evaluateEdge(port.edge, context);
    }
  }

  // 2. Execute the node's action
  const result = nodeExecutors[node.type](inputs, context);

  // 3. Follow flow outputs in order
  for (const flowEdge of node.flowOutputs) {
    executeNode(flowEdge.target, context);
  }

  return result;
}`,
        examples: [
            'On Key Down → Play Sound → Move Entity',
            'On Timer → Branch (health < 0) → Destroy Entity',
            'On Start → Sequence → [Spawn Enemy, Wait 2s, Spawn Enemy]',
        ],
        pitfalls: [
            'Infinite loops: Be careful with On Update → actions that trigger On Update',
            'Race conditions: Parallel nodes accessing same variable',
            'Missing flow: Forgetting to connect flow edges means nodes won\'t execute',
        ],
    },
    'component-lifecycle': {
        name: 'Component Lifecycle',
        overview: `Components are attached to entities and have lifecycle hooks that fire at specific times.

LIFECYCLE ORDER:
1. @lifecycle('Attach') - Component added to entity (constructor done)
2. @lifecycle('Execute:Init') - Scene starts playing / runtime begins
3. @lifecycle('Execute:Update') - Every frame during play mode
4. @lifecycle('Execute:FixedUpdate') - Fixed timestep (physics)
5. @lifecycle('Execute:LateUpdate') - After all updates
6. @lifecycle('Detach') - Component removed or entity destroyed

PROPERTY CHANGES:
- @lifecycle('PropertyChanged') fires when any @property is modified
- Can check which property changed via the event parameter

SIGNALS TO GRAPHS:
- @signal decorated properties are callbacks
- When component calls this.onSignalName?.(data), connected graph nodes fire
- Graph nodes see the signal as an event they can listen to`,
        coreFiles: [
            'editor/src/scripting/Component.ts - Base Component class',
            'editor/src/scripting/decorators.ts - @component, @property, @action, @signal, @lifecycle',
            'editor/src/scripting/runtime/RuntimeManager.ts - Lifecycle dispatch',
        ],
        concepts: [
            'Components extend Component base class',
            'Decorators expose metadata to editor and runtime',
            '@property creates inspector UI automatically',
            '@action methods can be called from visual scripts',
            '@signal properties emit events to visual scripts',
        ],
        executionModel: `
// Component initialization order in a scene:
1. All components constructed (no lifecycle yet)
2. Parent-to-child order: Attach hooks fire
3. Runtime.start() called
4. All Init hooks fire (order: parent-to-child, then component order)
5. Update loop begins

// Each frame:
for (entity of activeEntities) {
  for (component of entity.components) {
    component.onUpdate?.(deltaTime);
  }
}
// Then LateUpdate in same order`,
        commonPatterns: [
            'Cache references in Init, use in Update',
            'Clean up subscriptions in Detach',
            'Use signals to notify graphs of state changes',
            'Use actions for graph-callable methods',
        ],
    },
    'variable-system': {
        name: 'Variable Scoping & Expressions',
        overview: `Variables store data that persists across node executions. They have scopes that control visibility and lifetime.

SCOPES (innermost to outermost):
1. Local - Only within current graph execution (temporary)
2. Entity - Attached to the entity running the behavior (persists with entity)
3. Scene - Shared across all entities in scene (persists with scene)
4. Global - Shared across entire game (persists across scenes)

RESOLUTION ORDER:
When reading a variable, the system checks scopes from inner to outer.
"health" checks: local → entity → scene → global

EXPRESSIONS:
Use $expr{...} syntax for inline calculations:
- $expr{health - 10}
- $expr{position.x + velocity * delta_time}
- $expr{random(0, 100)}

BUILT-IN VARIABLES:
- delta_time - Seconds since last frame
- time - Total elapsed time
- frame - Current frame number`,
        coreFiles: [
            'editor/src/scripting/runtime/variables.ts - VariableStore, scopes',
            'editor/src/scripting/runtime/expressions.ts - Expression evaluation',
        ],
        concepts: [
            'Variables are typed: number, string, boolean, entity, position',
            'Set Variable node writes to specified scope',
            'Get Variable node reads with scope resolution',
            'Expressions can reference variables by name',
        ],
        pitfalls: [
            'Shadowing: Entity variable hides scene variable with same name',
            'Timing: Variables set in parallel may race',
            'Types: Setting wrong type may cause runtime errors',
        ],
    },
    'event-system': {
        name: 'Event System (Triple-Phase)',
        overview: `Events flow through a three-phase bus that allows before/after hooks.

PHASES:
1. Before - Validation, cancellation, pre-processing
2. Execute - Main handlers run (graphs, components)
3. After - Cleanup, side effects, logging

COMMON EVENTS:
- input:keydown, input:keyup, input:mouse
- collision:enter, collision:exit
- timer:tick, timer:complete
- entity:spawn, entity:destroy
- scene:load, scene:unload
- custom:* (user-defined)

EVENT DATA:
Each event carries a payload object with relevant data.
Example: collision:enter → { self, other, point, normal }`,
        coreFiles: [
            'editor/src/scripting/runtime/events.ts - TriplePhaseEventBus',
            'editor/src/scripting/runtime/RuntimeManager.ts - Event dispatch',
        ],
        concepts: [
            'Events bubble through three phases',
            'Handlers can cancel events in Before phase',
            'Graph signal nodes listen in Execute phase',
            'Multiple handlers execute in registration order',
        ],
    },
    'camera-system': {
        name: 'Virtual Camera System',
        overview: `The camera system uses virtual cameras with priority-based blending, inspired by Cinemachine.

CONCEPTS:
- CameraBrain - Singleton that manages which camera is active
- CameraComponent - Virtual camera with priority, follow, look-at settings
- Only highest-priority active camera renders
- Blending occurs when active camera changes

PRIORITY SYSTEM:
- Higher number = higher priority (default: 10)
- When priorities are equal, most recently activated wins
- Blending uses configurable easing curves

FOLLOW BEHAVIORS (Transposer):
- LockToTarget - Snap to target position
- WorldSpace - Offset in world coordinates
- ScreenSpace - Offset in screen coordinates

LOOK-AT BEHAVIORS (Composer):
- HardLookAt - Always center target
- FramingTransposer - Keep target in screen region with dead zones

SHAKE SYSTEM:
- Trauma-based: addTrauma(0.5) adds shake intensity
- Trauma decays over time
- Shake = trauma^exponent * noise`,
        coreFiles: [
            'editor/src/scripting/components/CameraComponent.ts - All camera behaviors',
        ],
        concepts: [
            'Virtual cameras define what to show',
            'Priority determines which camera wins',
            'Blending smoothly transitions between cameras',
            'Transposer handles follow behavior',
            'Composer handles look-at framing',
            'Confiner keeps camera within bounds',
            'Shake adds trauma-based screen shake',
        ],
        commonPatterns: [
            'Player camera: priority 10, follow player, dead zone for responsiveness',
            'Cutscene camera: priority 20 (higher), static position, blend time 1s',
            'Boss reveal: activate high-priority camera, wait, deactivate',
        ],
    },
    'terrain-system': {
        name: 'Terrain & Tilemap System',
        overview: `Terrain uses a grid of prefab IDs that resolve to glyph data at runtime.

DATA FLOW:
1. TerrainComponent stores 2D grid of prefab IDs (numbers)
2. TerrainPrefabRegistry maps ID → glyph data
3. TerrainRenderer queries registry and renders glyphs

PREFAB DATA:
{
  id: number,
  name: string,
  glyph: { char: string, fg: color, bg: color, emission: number },
  animation: { frames: string[], fps: number },
  collider: { solid: boolean, type: 'box' | 'none' }
}

LAYERS:
Terrain supports multiple layers for depth (floor, walls, decorations)`,
        coreFiles: [
            'editor/src/scripting/components/TerrainComponent.ts',
            'editor/src/engine/terrain/TerrainPrefabRegistry.ts',
            'editor/src/engine/terrain/TerrainRenderer.ts',
        ],
        concepts: [
            'Grid cells contain prefab IDs, not raw data',
            'Prefabs are shared/instanced for memory efficiency',
            'Animation frames cycle through character sequence',
            'Collision is per-cell based on prefab settings',
        ],
    },
    'audio-system': {
        name: 'Procedural Audio System (ZzFX)',
        overview: `Audio uses ZzFX for procedural sound generation - no audio files needed.

PRESET SOUNDS:
AudioComponent has 40+ preset sounds organized by category:
- UI: click, hover, confirm, cancel, error, success
- Movement: jump, land, walk, run
- Combat: hit, punch, slash, block, death
- Projectiles: shoot, laser, missile, explosion
- Items: coin, gem, powerup, heal
- Environment: door, switch, splash, wind
- Magic: magic, spell, teleport, charge
- Retro: blip, bloop, beep, boop, zap, warp

CUSTOM SOUNDS:
Use playCustom() with ZzFX parameter array for custom sounds.
registerSound('mySound', [...params]) for reusable custom sounds.

VOLUME CONTROLS:
- masterVolume: Overall multiplier
- sfxVolume: Sound effects
- musicVolume: Music (not yet implemented)
- Variation: Random pitch/volume per play`,
        coreFiles: [
            'editor/src/scripting/components/AudioComponent.ts',
        ],
        concepts: [
            'Procedural audio - no files to load',
            'Presets cover common game sounds',
            'Volume hierarchy: master → category → individual',
            'Signals fire on sound start/end',
        ],
    },
    'runtime-loop': {
        name: 'Game Runtime & Update Loop',
        overview: `The RuntimeManager controls the game loop with fixed timestep physics.

LOOP STRUCTURE:
1. requestAnimationFrame fires
2. Calculate deltaTime since last frame
3. Accumulate time for fixed updates
4. While accumulated > fixedStep:
   - Fire FixedUpdate events
   - Physics step
   - Subtract fixedStep from accumulator
5. Fire Update events with deltaTime
6. Fire LateUpdate events
7. Render frame
8. Queue input events for next frame

TIMING:
- Update: Variable timestep (smooth animations)
- FixedUpdate: Fixed 1/60s steps (physics stability)
- LateUpdate: After all updates (camera follow)

STATES:
- Stopped: Not running
- Playing: Normal execution
- Paused: Time frozen, no updates
- Stepping: Single frame advance (debugging)`,
        coreFiles: [
            'editor/src/scripting/runtime/RuntimeManager.ts',
            'editor/src/scripting/runtime/lifecycle.ts',
        ],
        concepts: [
            'Fixed timestep prevents physics instability',
            'Input is buffered and processed per-frame',
            'Pause freezes time but not rendering',
            'Step mode advances one frame at a time',
        ],
    },
};
/**
 * Get documentation for a specific system
 */
export function getSystemDoc(system) {
    return ENGINE_DOCS[system] || null;
}
/**
 * List all available documentation topics
 */
export function listDocTopics() {
    return Object.entries(ENGINE_DOCS).map(([id, doc]) => ({
        id,
        name: doc.name,
        overview: doc.overview.split('\n')[0], // First line only
    }));
}
/**
 * Search documentation for a term
 */
export function searchDocs(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];
    for (const [id, doc] of Object.entries(ENGINE_DOCS)) {
        const matches = [];
        if (doc.overview.toLowerCase().includes(lowerQuery)) {
            matches.push('overview');
        }
        if (doc.executionModel?.toLowerCase().includes(lowerQuery)) {
            matches.push('execution model');
        }
        for (const concept of doc.concepts) {
            if (concept.toLowerCase().includes(lowerQuery)) {
                matches.push(`concept: ${concept}`);
            }
        }
        for (const pattern of doc.commonPatterns || []) {
            if (pattern.toLowerCase().includes(lowerQuery)) {
                matches.push(`pattern: ${pattern}`);
            }
        }
        if (matches.length > 0) {
            results.push({ topic: id, matches });
        }
    }
    return results;
}
/**
 * Get a quick reference for common tasks
 */
export function getQuickReference(task) {
    const quickRefs = {
        'create-component': `
# Creating a New Component

1. Create file: editor/src/scripting/components/MyComponent.ts
2. Use this template:

\`\`\`typescript
import { Component } from '../Component'
import { component, property, action, signal, lifecycle } from '../decorators'

@component({
  name: 'MyComponent',
  icon: '🎮',
  description: 'What this component does'
})
export class MyComponent extends Component {
  @property({ type: 'number', label: 'Speed', group: 'Movement' })
  speed: number = 5

  @signal({ displayName: 'On Something' })
  onSomething: ((data: unknown) => void) | null = null

  @action({ displayName: 'Do Thing', category: 'Actions' })
  doThing(): void {
    this.onSomething?.({ result: 'done' })
  }

  @lifecycle('Execute:Update')
  onUpdate(): void {
    // Called every frame
  }
}
\`\`\`

3. Export from components/index.ts
`,
        'create-node': `
# Creating a New Visual Scripting Node

1. Add to editor/src/lib/nodes/types.ts in BUILT_IN_NODES:

\`\`\`typescript
{
  id: 'my-action',
  name: 'My Action',
  category: 'action',
  description: 'Does something useful',
  icon: '⚡',
  color: '#3b82f6',
  inputs: [
    { id: 'flow', label: '', type: 'flow' },
    { id: 'value', label: 'Value', type: 'number', required: true },
  ],
  outputs: [
    { id: 'flow', label: '', type: 'flow' },
    { id: 'result', label: 'Result', type: 'number' },
  ],
}
\`\`\`

2. Add executor in nodeExecutors.ts:

\`\`\`typescript
registerExecutor('my-action', (inputs, ctx) => {
  const value = Number(inputs.value) || 0
  return value * 2  // This becomes 'result' output
})
\`\`\`
`,
        'add-camera-shake': `
# Adding Camera Shake

From a component:
\`\`\`typescript
// Get the camera component
const camera = this.entity.getComponent(CameraComponent)
camera?.addTrauma(0.5)  // 0-1, adds to existing trauma
\`\`\`

From visual scripting:
1. Use "Add Camera Trauma" node
2. Connect entity input to camera entity
3. Set trauma amount (0.3 = light, 0.7 = heavy)

Camera shake properties:
- maxOffsetX/Y: Maximum shake distance
- maxRotation: Maximum rotation shake
- frequency: Shake speed
- decayRate: How fast trauma fades
`,
        'spawn-entity': `
# Spawning Entities

From visual scripting:
1. Use "Spawn Entity" node
2. Set prefab ID or entity template
3. Set position (use "Get Position" or vector nodes)
4. Connect output to get spawned entity reference

From component:
\`\`\`typescript
const spawned = this.runtime.spawnEntity({
  prefab: 'enemy',
  position: [x, y, 0],
  components: {
    Health: { maxHealth: 100 }
  }
})
\`\`\`
`,
    };
    return quickRefs[task] || null;
}
/**
 * List available quick references
 */
export function listQuickReferences() {
    return [
        'create-component',
        'create-node',
        'add-camera-shake',
        'spawn-entity',
    ];
}
