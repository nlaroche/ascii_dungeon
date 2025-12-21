// src/tools/docs.ts
// Semantic documentation for AI understanding of engine systems

export interface SystemDoc {
  name: string;
  overview: string;
  coreFiles: string[];
  concepts: string[];
  executionModel?: string;
  examples?: string[];
  commonPatterns?: string[];
  pitfalls?: string[];
}

export const ENGINE_DOCS: Record<string, SystemDoc> = {
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

  'render-pipeline': {
    name: 'Render Pipeline & Post-Processing',
    overview: `The 2D ASCII rendering pipeline with layered post-processing.

RENDERING FLOW:
1. Terminal2DRenderer renders ASCII grid to intermediate texture
2. Per-camera post-processing applies (from active camera's postProcess property)
3. Global post-processing applies (from renderPipeline.globalPostProcess)
4. Final output to screen

POST-PROCESSING STACKS:
Both camera and global use the same PostProcessStack structure:
{
  enabled: boolean,
  crtEnabled: boolean,
  crtSettings: CRTSettings,
  effects: PostProcessEffect[],
  preset?: string
}

CRT EFFECTS (unified shader pass):
- scanlines: 0-1 - Horizontal scan line effect
- curvature: 0-1 - CRT screen bend distortion
- bloom: 0-1 - Glow around bright areas
- noise: 0-1 - Film grain/static noise
- chromatic: 0-1 - RGB color separation
- flicker: 0-1 - Screen flicker effect
- vignette: 0-1 - Dark edges effect
- pixelate: 0-1 - Low resolution effect
- colorShift: -1 to 1 - Cool to warm color tint

INDIVIDUAL EFFECTS (separate passes):
- bloom: threshold, intensity, radius
- vignette: intensity, smoothness, roundness
- filmGrain: intensity, luminanceInfluence
- chromaticAberration: intensity
- fxaa: quality (low/medium/high)
- sharpen: intensity
- colorGrading: exposure, contrast, saturation, gamma, tonemapping

PRESETS:
Clean, CRT Monitor, Neon Glow, Retro Terminal, Arcade Cabinet, Minimal, Glitchy`,
    coreFiles: [
      'editor/src/renderer/PostProcessPipeline.ts - Unified post-processing',
      'editor/src/renderer/Terminal2DRenderer.ts - ASCII grid rendering',
      'editor/src/renderer/shaders/grid2d.wgsl - Grid cell shader',
      'editor/src/renderer/shaders/asciiPostProcess.wgsl - CRT effects shader',
      'editor/src/stores/engineState.ts - PostProcessStack, CRTSettings types',
      'editor/src/components/render/RenderPipelinePanel.tsx - Post-process UI',
    ],
    concepts: [
      'Terminal2D renders to intermediate texture for post-processing',
      'CRT effects combined in single shader pass for efficiency',
      'Individual effects applied as separate passes via ping-pong buffers',
      'Camera postProcess property for per-camera effects',
      'Global postProcess for scene-wide effects',
      'Presets provide quick configuration',
      'RenderTargetPool manages textures efficiently',
    ],
    executionModel: `
// Render loop flow:
1. terminal2D.renderToTexture() - ASCII grid to intermediate
2. if (camera.postProcess?.enabled)
     postPipeline.executeStack(intermediate, temp, camera.postProcess)
3. if (global.postProcess?.enabled)
     postPipeline.executeStack(current, screen, global.postProcess)
4. else blit directly to screen

// PostProcessPipeline.executeStack():
1. Apply individual effects (bloom, vignette, etc.) in order
2. Apply CRT effects as final pass (if crtEnabled)
3. Uses RenderTargetPool for temporary textures`,
    commonPatterns: [
      'Use CRT preset for retro look: preset: "crt"',
      'Per-camera shake + chromatic: camera.postProcess.crtSettings.chromatic = 0.8',
      'Disable effects for clean look: globalPostProcess.enabled = false',
      'Custom effect: add to effects array with id matching EFFECT_CONFIGS',
    ],
    pitfalls: [
      'Too many effects hurt performance - CRT pass is efficient, individual passes add up',
      'High bloom + chromatic can make text hard to read',
      'Curvature distorts edge pixels - keep under 0.5 for readability',
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

  'behavior-system': {
    name: 'Behavior Graph System',
    overview: `Behavior graphs are visual scripts attached to entities via the Behavior component.

HOW IT WORKS:
1. Entity has a Behavior component with graphId property
2. graphId references a .graph.json file in the project's graphs/ folder
3. When play mode starts, PlayModeManager:
   - Loads all .graph.json files from the project
   - Converts ReactFlow format to LogicGraph format
   - Registers graphs in BehaviorGraphRegistry
   - Finds all entities with Behavior components
   - Creates BehaviorComponent runtime instances
   - Links each behavior to its graph by graphId

GRAPH FILE FORMAT (ReactFlow):
{
  "version": "1.0",
  "id": "wander",                    // Graph ID - matches Behavior.graphId
  "name": "Wander Behavior",
  "nodes": [
    { "id": "1", "type": "custom", "position": {x, y}, "data": { "nodeTypeId": "on-update", "inputs": {} } }
  ],
  "edges": [
    { "id": "e1", "source": "1", "sourceHandle": "flow", "target": "2", "targetHandle": "flow" }
  ],
  "variables": []
}

EXECUTION PER FRAME:
1. RuntimeManager.update() calls behavior.onUpdate(dt)
2. BehaviorComponent.onUpdate() triggers "Update" signal on its graph
3. GraphRuntime finds all signal nodes listening to "Update"
4. Executes connected action nodes following flow edges
5. Data nodes (random, compare) are evaluated lazily when needed

POSITION UPDATES:
- The translate action updates Rect2D component x/y properties
- SceneGridBuilder reads Rect2D.x and Rect2D.y for rendering positions
- NOT node.transform.position (that's for 3D mode)`,
    coreFiles: [
      'editor/src/scripting/components/BehaviorComponent.ts - Runtime behavior execution',
      'editor/src/scripting/runtime/graph.ts - GraphRuntime, GraphExecutor',
      'editor/src/scripting/runtime/serialization.ts - ReactFlow to LogicGraph conversion',
      'editor/src/scripting/runtime/PlayModeManager.ts - Graph loading and behavior init',
      'editor/src/stores/GraphStorage.ts - Graph file I/O',
    ],
    concepts: [
      'Behavior component links entity to graph via graphId',
      'Graphs stored as .graph.json in project/graphs/',
      'ReactFlow format (visual editor) → LogicGraph format (runtime)',
      'BehaviorGraphRegistry caches loaded graphs',
      'Each entity with Behavior gets its own execution context',
      'Variables scoped to: local (per-execution), node (per-entity), scene, global',
    ],
    executionModel: `
// Play mode startup:
1. PlayModeManager.start()
2. loadProjectGraphs() - reads all .graph.json files
3. For each graph: reactFlowToGraph() converts to LogicGraph
4. BehaviorGraphRegistry.register(logicGraph)
5. initializeSceneBehaviors() - finds Behavior components
6. For each behavior:
   - Create BehaviorComponent instance
   - Set graphId from component properties
   - Call onInit() which loads graph from registry
   - Register with RuntimeManager for updates

// Per-frame execution:
RuntimeManager.update(dt)
  → behavior.onUpdate(dt)
    → graphRuntime.triggerSignal('Update', context)
      → execute signal handlers
        → follow flow edges
          → execute action nodes
            → resolve data inputs lazily`,
    commonPatterns: [
      'Wander: on-update → random → compare → branch → translate',
      'Input response: on-key-down → branch (key == "Space") → action',
      'State machine: use variables + branch nodes for states',
      'Spawning: on-event → spawn-entity → set properties',
    ],
    pitfalls: [
      'graphId must match graph file\'s "id" field exactly',
      'Position updates must target Rect2D.x/y, not transform.position',
      'Graphs load at play mode start - changes need restart',
      'Variables with same name in different scopes can shadow each other',
    ],
  },

  'play-mode': {
    name: 'Play Mode & Debugging',
    overview: `Play mode executes the game simulation. Can be controlled and debugged.

STARTING PLAY MODE:
- UI: Click the Play button in the toolbar
- MCP: Use start_play_mode tool
- The editor takes a snapshot of the scene first (for restore on stop)

PLAY MODE STATES:
- Stopped: Not running, editing mode
- Playing: Active simulation, Update signals firing
- Paused: Simulation frozen, can inspect state
- Stepping: Advance frame-by-frame for debugging

WHAT HAPPENS ON START:
1. Scene snapshot saved
2. PlayModeManager.start() called
3. Project graphs loaded from disk
4. Behavior components initialized
5. RuntimeManager.start() begins game loop
6. Init signals fire on all behaviors
7. Update loop begins

DEBUGGING TECHNIQUES:
1. Console logging: Add "print" nodes in graphs
2. Pause + step: Pause and step frame-by-frame
3. Variable inspection: Check runtime variables in panel
4. Entity inspection: View entity state in ComponentInspector
5. Event monitoring: Watch recent events in RuntimeInspector

MCP DEBUGGING:
- get_play_mode_status: Check if playing/paused
- get_play_mode_stats: FPS, entity count, frame number
- get_runtime_entities: List all entities with components
- get_runtime_entity_state: Inspect specific entity
- get_recent_events: See what events fired
- inject_key_press/release: Simulate input
- step_frame: Advance N frames while paused

COMMON ISSUES:
- Graph not loading: Check graphId matches filename
- Entity not moving: Check Rect2D component exists
- Events not firing: Check signal node names match
- Slow performance: Too many entities or complex graphs`,
    coreFiles: [
      'editor/src/scripting/runtime/PlayModeManager.ts - Play mode orchestration',
      'editor/src/scripting/runtime/RuntimeManager.ts - Game loop',
      'editor/src/components/PlayModeToolbar.tsx - UI controls',
      'editor/src/components/RuntimeInspector.tsx - Debug panel',
    ],
    concepts: [
      'Snapshot/restore for clean stop',
      'Graph loading happens at start',
      'RuntimeManager drives the update loop',
      'Behaviors receive Update signal each frame',
    ],
    executionModel: `
// Play mode lifecycle:
[Editor] → Play button clicked
  → useEngineState.startPlayMode()
    → PlayModeManager.start()
      → Save scene snapshot
      → Load project graphs
      → Initialize behaviors
      → RuntimeManager.start()
        → Begin requestAnimationFrame loop
        → Each frame: FixedUpdate → Update → LateUpdate → Render

// Stop:
[Editor] → Stop button clicked
  → useEngineState.stopPlayMode()
    → RuntimeManager.stop()
    → PlayModeManager.stop()
      → Restore scene snapshot (or apply changes)`,
    commonPatterns: [
      'Debug: Add print nodes before problem actions',
      'Slow-mo: Pause → step frame repeatedly',
      'Input test: Use MCP inject_key_tap while paused',
      'State check: Pause → get_runtime_entity_state',
    ],
  },

  'scene-structure': {
    name: 'Scene & Entity Structure',
    overview: `Scenes are hierarchical trees of entities (nodes) with attached components.

SCENE FILE (scene.json):
{
  "rootNode": {
    "id": "root",
    "name": "Root",
    "type": "root",
    "children": [...entities...],
    "components": []
  }
}

ENTITY (NODE) STRUCTURE:
{
  "id": "sheep-1",           // Unique ID
  "name": "Sheep",           // Display name
  "type": "entity",          // Type: root, entity, prefab
  "children": [],            // Child entities (hierarchy)
  "components": [            // Attached components
    {
      "id": "comp-1",
      "script": "Rect2D",    // Component type name
      "enabled": true,
      "properties": {
        "x": 10, "y": 5,     // Component-specific properties
        "width": 1, "height": 1
      }
    },
    {
      "script": "Visual",
      "properties": { "char": "S", "fg": "#ffffff" }
    },
    {
      "script": "Behavior",
      "properties": { "graphId": "wander" }
    }
  ],
  "meta": {
    "visible": true,
    "locked": false,
    "zIndex": 0
  }
}

COMMON COMPONENTS:
- Rect2D: Position (x, y) and size for 2D rendering
- Visual: Character, colors, animation for ASCII display
- Behavior: Links to visual scripting graph
- Camera: Virtual camera settings
- Collider2D: Collision detection
- Audio: Sound effects

POSITION SYSTEM:
- 2D mode uses Rect2D.x and Rect2D.y for position
- SceneGridBuilder reads these for rendering
- Translate action updates Rect2D properties
- NOT node.transform (that's for 3D mode)

HIERARCHY:
- Children inherit parent transformations
- Root → World → Entities structure
- Use hierarchy for logical grouping`,
    coreFiles: [
      'editor/src/stores/engineState.ts - Node, NodeComponent types',
      'editor/src/renderer/SceneGridBuilder.ts - Reads Rect2D for positions',
      'editor/src/components/NodeTree.tsx - Hierarchy UI',
    ],
    concepts: [
      'Entities are nodes in a tree',
      'Components add behaviors and data',
      'Rect2D.x/y is the 2D position source',
      'Visual component defines ASCII appearance',
      'Behavior component runs visual scripts',
    ],
  },

  'debugging-graphs': {
    name: 'Debugging Visual Scripts',
    overview: `Techniques for debugging behavior graphs and visual scripts.

CONSOLE LOGGING:
1. Add "Print" or "Log" nodes in your graph
2. Connect flow to them before problem nodes
3. Check browser DevTools console for output
4. Format: [Graph:entityId] message

VISUAL DEBUGGING:
1. Use the RuntimeInspector panel (View → Runtime Inspector)
2. Shows: FPS, entity count, recent events, variables
3. Expand entities to see component states

STEP DEBUGGING:
1. Pause play mode (Pause button or MCP pause_play_mode)
2. Step frame-by-frame (Step button or MCP step_frame)
3. Watch console for node execution logs
4. Check entity states after each step

BREAKPOINTS (MCP):
1. set_breakpoint type=event eventType=Update - Break on Update
2. set_breakpoint type=frame frameNumber=100 - Break at frame 100
3. set_breakpoint type=variable variableName=health - Break on change

COMMON DEBUG PATTERNS:
1. Entity not moving:
   - Check Behavior component has correct graphId
   - Check graph has on-update signal
   - Check flow edges connect to translate
   - Check Rect2D component exists on entity
   - Add print node before translate to see if it runs

2. Wrong values:
   - Add print nodes to log intermediate values
   - Check data edges are connected
   - Verify input types match (number vs string)

3. Graph not running:
   - Verify graph file exists in graphs/ folder
   - Check console for graph loading errors
   - Verify graphId matches file's "id" field

4. Events not triggering:
   - Check signal name matches exactly (case-sensitive)
   - Verify event is being emitted
   - Check event filters (entity, tag, etc.)

MCP DEBUGGING WORKFLOW:
1. start_play_mode
2. get_play_mode_stats - verify running
3. get_runtime_entities hasComponent=Behavior - list behaviors
4. get_runtime_entity_state entityId=sheep-1 - check state
5. pause_play_mode
6. step_frame count=1 - advance one frame
7. get_runtime_entity_state entityId=sheep-1 - check changes`,
    coreFiles: [
      'editor/src/scripting/runtime/graph.ts - Has debug logging',
      'editor/src/components/RuntimeInspector.tsx - Debug UI',
    ],
    concepts: [
      'Print nodes output to console',
      'Step mode for frame-by-frame debugging',
      'MCP tools for programmatic debugging',
      'RuntimeInspector shows live state',
    ],
  },
};

/**
 * Get documentation for a specific system
 */
export function getSystemDoc(system: string): SystemDoc | null {
  return ENGINE_DOCS[system] || null;
}

/**
 * List all available documentation topics
 */
export function listDocTopics(): Array<{ id: string; name: string; overview: string }> {
  return Object.entries(ENGINE_DOCS).map(([id, doc]) => ({
    id,
    name: doc.name,
    overview: doc.overview.split('\n')[0], // First line only
  }));
}

/**
 * Search documentation for a term
 */
export function searchDocs(query: string): Array<{ topic: string; matches: string[] }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ topic: string; matches: string[] }> = [];

  for (const [id, doc] of Object.entries(ENGINE_DOCS)) {
    const matches: string[] = [];

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
export function getQuickReference(task: string): string | null {
  const quickRefs: Record<string, string> = {
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

    'configure-post-processing': `
# Configuring Post-Processing

## Quick Preset Application
\`\`\`typescript
// In engineState or via setPath
setPath(['renderPipeline', 'globalPostProcess'], {
  enabled: true,
  crtEnabled: true,
  crtSettings: {
    scanlines: 0.6, curvature: 0.4, bloom: 0.3,
    noise: 0.15, chromatic: 0.3, flicker: 0.2, vignette: 0.5,
    pixelate: 0, colorShift: 0
  },
  preset: 'crt',
  effects: []
})
\`\`\`

## Per-Camera Post-Processing
\`\`\`typescript
// In CameraComponent
this.postProcess = {
  enabled: true,
  crtEnabled: true,
  crtSettings: { ...DEFAULT_CRT_SETTINGS, bloom: 0.8, chromatic: 0.5 },
  effects: []
}

// Or via action
camera.setCRTEffect('bloom', 0.8)
camera.enablePostProcess()
\`\`\`

## Available Presets
- clean: No effects
- crt: Classic CRT monitor look
- neon: Bright glowing effects
- retro: Old terminal feel
- arcade: Arcade cabinet style
- minimal: Subtle enhancements
- glitch: Broken display effect

## Individual Effects (in effects array)
\`\`\`typescript
effects: [
  { id: 'bloom', name: 'Bloom', enabled: true, intensity: 0.5 },
  { id: 'vignette', name: 'Vignette', enabled: true, intensity: 0.4 }
]
\`\`\`
`,

    'start-play-mode': `
# Starting and Controlling Play Mode

## From Editor UI
- Click the **Play** button (▶) in the toolbar
- Click **Pause** (⏸) to freeze simulation
- Click **Step** (⏭) to advance one frame while paused
- Click **Stop** (⏹) to end play mode

## From MCP (AI Control)
\`\`\`
# Start play mode
start_play_mode

# Check status
get_play_mode_status
get_play_mode_stats

# Control execution
pause_play_mode
step_frame count=1
resume_play_mode
stop_play_mode
\`\`\`

## What Happens on Start
1. Scene snapshot saved (for restore on stop)
2. All .graph.json files loaded from project/graphs/
3. Behavior components initialized with their graphs
4. RuntimeManager begins update loop
5. Init signals fire, then Update loop begins

## Debugging While Running
\`\`\`
# List entities with behaviors
get_runtime_entities hasComponent=Behavior

# Inspect specific entity
get_runtime_entity_state entityId=sheep-1

# Watch events
get_recent_events limit=10

# Simulate input
inject_key_tap key=Space
\`\`\`
`,

    'debug-behavior-graph': `
# Debugging Behavior Graphs

## 1. Check Graph is Loaded
\`\`\`
# In browser console, look for:
[PlayMode] Loaded graph: wander
[BehaviorComponent] Loaded graph for sheep-1
\`\`\`

## 2. Add Print Nodes
Insert Print/Log nodes in your graph before problem areas:
- on-update → Print("Update fired") → rest of graph
- before translate → Print($expr{dx}) → translate

## 3. Use MCP Step Debugging
\`\`\`
# Start and immediately pause
start_play_mode
pause_play_mode

# Step one frame at a time
step_frame count=1

# Check entity state after each step
get_runtime_entity_state entityId=sheep-1
\`\`\`

## 4. Common Issues

**Entity not moving:**
- Check Behavior component has graphId matching graph's "id" field
- Check entity has Rect2D component (for 2D position)
- Check graph has on-update signal node
- Check flow edges connect signal → action nodes

**Graph not running:**
- Verify .graph.json exists in project/graphs/
- Check browser console for loading errors
- graphId is case-sensitive

**Values wrong:**
- Add Print nodes to log intermediate values
- Check data edges are connected (colored lines)
- Verify input types (number vs string)
`,

    'create-behavior-graph': `
# Creating a Behavior Graph

## 1. Create Graph File
Create \`project/graphs/my-behavior.graph.json\`:
\`\`\`json
{
  "version": "1.0",
  "id": "my-behavior",
  "name": "My Behavior",
  "nodes": [],
  "edges": [],
  "variables": []
}
\`\`\`

## 2. Or Use the Editor
1. Open Node Editor panel
2. Right-click → Add Node → Signals → On Update
3. Add action nodes and connect with flow edges
4. File → Save Graph

## 3. Attach to Entity
Add Behavior component to entity with:
\`\`\`json
{
  "script": "Behavior",
  "properties": {
    "graphId": "my-behavior"
  }
}
\`\`\`

## 4. Common Graph Patterns

**Wander randomly:**
on-update → random(0,100) → compare(<5) → branch → translate(random dx/dy)

**Respond to input:**
on-key-down → branch(key=="Space") → [true] → action

**Timer-based:**
on-update → add to timer variable → compare(timer>2) → [true] → action, reset timer

## 5. Node Types
- **Signals (green)**: Entry points - on-update, on-start, on-key-down
- **Actions (blue)**: Do things - translate, print, emit-signal
- **Data (purple)**: Produce values - random, compare, get-self
- **Flow (gray)**: Control flow - branch, sequence
`,

    'move-entity': `
# Moving Entities

## In Visual Scripts (Behavior Graphs)

Use the **Translate** node:
\`\`\`
on-update → translate(dx, dy)
\`\`\`

Inputs:
- entity: Target entity (use get-self for current entity)
- dx: X movement delta
- dy: Y movement delta

## How It Works Internally
1. Translate node calls executeBuiltinAction('translate', ...)
2. Finds entity by ID in scene tree
3. Finds Rect2D component on entity
4. Updates Rect2D.x and Rect2D.y properties
5. SceneGridBuilder reads Rect2D.x/y for rendering

## IMPORTANT: Rect2D Required!
Entity MUST have a Rect2D component for position:
\`\`\`json
{
  "script": "Rect2D",
  "properties": {
    "x": 10,
    "y": 5,
    "width": 1,
    "height": 1
  }
}
\`\`\`

## From Component Code
\`\`\`typescript
// Get Rect2D and update directly
const rect = this.entity.getComponent(Rect2DComponent)
if (rect) {
  rect.x += dx
  rect.y += dy
}

// Or use state path
const setPath = useEngineState.getState().setPath
setPath([...pathToEntity, 'components', rectIndex, 'properties', 'x'], newX)
\`\`\`

## Absolute Position (move-entity)
Use **Move Entity** node for absolute positioning:
\`\`\`
move-entity(entity, x, y)  // Sets position directly
\`\`\`
`,
  };

  return quickRefs[task] || null;
}

/**
 * List available quick references
 */
export function listQuickReferences(): string[] {
  return [
    'create-component',
    'create-node',
    'add-camera-shake',
    'spawn-entity',
    'configure-post-processing',
    'start-play-mode',
    'debug-behavior-graph',
    'create-behavior-graph',
    'move-entity',
  ];
}
