#!/usr/bin/env node
// src/index.ts
// ASCII Dungeon Engine MCP Server
// Provides introspection, pattern extraction, and consistency checking for the engine

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as componentTools from './tools/components.js';
import * as nodeTools from './tools/nodes.js';
import * as typeTools from './tools/types.js';
import * as depTools from './tools/dependencies.js';
import * as patternTools from './tools/patterns.js';
import * as consistencyTools from './tools/consistency.js';
import * as runtimeTools from './tools/runtime.js';
import * as docsTools from './tools/docs.js';
import * as playModeTools from './tools/playMode.js';

// Cache for dependency graph (expensive to compute)
let cachedGraph: depTools.DependencyGraph | null = null;

const server = new Server(
  {
    name: 'ascii-dungeon-engine',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'engine://docs/overview',
        name: 'Engine Overview',
        mimeType: 'text/markdown',
        description: 'Overview of the ASCII Dungeon engine architecture',
      },
      {
        uri: 'engine://docs/components',
        name: 'Component System',
        mimeType: 'text/markdown',
        description: 'Guide to creating and using engine components',
      },
      {
        uri: 'engine://docs/visual-scripting',
        name: 'Visual Scripting',
        mimeType: 'text/markdown',
        description: 'Guide to creating visual scripting nodes',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const docs: Record<string, string> = {
    'engine://docs/overview': `# ASCII Dungeon Engine

A 2D roguelike engine built with TypeScript and WebGPU, featuring:
- ECS-inspired component system with decorators
- Visual scripting for game logic
- Terminal-style 2D rendering
- Virtual camera system with blending

## Architecture
- **editor/src/scripting/components/** - Engine components (Transform, Visual, Camera, etc.)
- **editor/src/lib/nodes/** - Visual scripting node definitions
- **editor/src/renderer/** - WebGPU rendering system
- **editor/src/stores/** - Zustand state management

## Key Patterns
- Components use @component, @property, @action, @signal decorators
- Visual scripting nodes defined in BUILT_IN_NODES array
- Heavy use of TypeScript for type safety
`,
    'engine://docs/components': componentTools.getComponentPattern(),
    'engine://docs/visual-scripting': nodeTools.getNodeExecutorPattern(),
  };

  const text = docs[request.params.uri];
  if (text) {
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'text/markdown',
        text,
      }],
    };
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Component tools
      { name: 'list_components', description: 'List all engine components with properties, actions, and signals', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_component_schema', description: 'Get detailed schema for a specific component', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Component name' } }, required: ['name'] } },
      { name: 'search_components', description: 'Search components by name, description, or action names', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'get_component_pattern', description: 'Get the template for creating new engine components', inputSchema: { type: 'object', properties: {} } },

      // Node tools
      { name: 'list_node_types', description: 'List all visual scripting node types', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_nodes_by_category', description: 'Filter nodes by category', inputSchema: { type: 'object', properties: { category: { type: 'string', enum: ['event', 'action', 'condition', 'data', 'flow', 'custom'] } }, required: ['category'] } },
      { name: 'search_nodes', description: 'Search visual scripting nodes', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'get_node_type', description: 'Get specific node type details', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'get_node_stats', description: 'Get statistics about node types', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_node_executor_pattern', description: 'Get pattern for creating node executors', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_node_categories', description: 'Get all node categories with descriptions', inputSchema: { type: 'object', properties: {} } },

      // Type tools
      { name: 'extract_interfaces', description: 'Extract interface definitions from a TypeScript file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
      { name: 'extract_types', description: 'Extract type aliases from a TypeScript file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
      { name: 'extract_exports', description: 'Extract exported symbols from a TypeScript file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
      { name: 'get_type_usages', description: 'Find where a type is used across the codebase', inputSchema: { type: 'object', properties: { typeName: { type: 'string' }, basePath: { type: 'string' } }, required: ['typeName'] } },

      // Dependency tools
      { name: 'build_dependency_graph', description: 'Build full dependency graph (cached)', inputSchema: { type: 'object', properties: { basePath: { type: 'string' }, refresh: { type: 'boolean' } } } },
      { name: 'get_file_dependencies', description: 'Get files imported by a file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
      { name: 'get_file_dependents', description: 'Get files that import a file', inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } },
      { name: 'find_circular_dependencies', description: 'Detect circular dependencies', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'find_entry_points', description: 'Find entry point files', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'find_core_modules', description: 'Find heavily imported files', inputSchema: { type: 'object', properties: { basePath: { type: 'string' }, threshold: { type: 'number' } } } },
      { name: 'get_dependency_stats', description: 'Get dependency graph statistics', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },

      // Pattern tools
      { name: 'extract_naming_conventions', description: 'Get naming patterns', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'extract_decorator_patterns', description: 'Get decorator usage patterns', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'extract_file_organization', description: 'Get file organization info', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'extract_code_patterns', description: 'Get common code patterns', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'get_pattern_summary', description: 'Get full pattern summary', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },

      // Consistency tools
      { name: 'check_component_consistency', description: 'Check component rules', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'check_naming_consistency', description: 'Check naming conventions', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'check_import_consistency', description: 'Check import organization', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'check_decorator_consistency', description: 'Check decorator usage', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },
      { name: 'run_all_checks', description: 'Run all consistency checks', inputSchema: { type: 'object', properties: { basePath: { type: 'string' } } } },

      // Runtime & debugging tools
      { name: 'build_project', description: 'Build the editor project', inputSchema: { type: 'object', properties: {} } },
      { name: 'type_check', description: 'Run TypeScript type checking', inputSchema: { type: 'object', properties: {} } },
      { name: 'run_tests', description: 'Run tests', inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: 'Test pattern to match' } } } },
      { name: 'start_dev_server', description: 'Start the development server', inputSchema: { type: 'object', properties: {} } },
      { name: 'stop_dev_server', description: 'Stop the development server', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_logs', description: 'Get recent logs from running processes', inputSchema: { type: 'object', properties: { level: { type: 'string', enum: ['info', 'warn', 'error', 'debug'] }, source: { type: 'string' }, limit: { type: 'number' } } } },
      { name: 'clear_logs', description: 'Clear the log buffer', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_running_processes', description: 'List running background processes', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_recently_modified_files', description: 'Find recently modified source files', inputSchema: { type: 'object', properties: { extension: { type: 'string' }, since: { type: 'number', description: 'Minutes ago' } } } },
      { name: 'analyze_code', description: 'Type-check a TypeScript code snippet', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
      { name: 'get_project_status', description: 'Get overall project status', inputSchema: { type: 'object', properties: {} } },
      { name: 'find_error_patterns', description: 'Search for error patterns, TODOs, FIXMEs in code', inputSchema: { type: 'object', properties: {} } },
      { name: 'read_log_file', description: 'Read a log file', inputSchema: { type: 'object', properties: { logPath: { type: 'string' }, lines: { type: 'number' } }, required: ['logPath'] } },

      // Semantic documentation tools
      { name: 'list_doc_topics', description: 'List all engine documentation topics (graph execution, components, cameras, etc.)', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_system_doc', description: 'Get detailed documentation for a system (graph-execution, component-lifecycle, camera-system, etc.)', inputSchema: { type: 'object', properties: { system: { type: 'string', description: 'System ID: graph-execution, component-lifecycle, variable-system, event-system, camera-system, terrain-system, audio-system, runtime-loop' } }, required: ['system'] } },
      { name: 'search_docs', description: 'Search documentation for a term', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'get_quick_reference', description: 'Get quick reference for common tasks', inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Task: create-component, create-node, add-camera-shake, spawn-entity' } }, required: ['task'] } },
      { name: 'list_quick_references', description: 'List available quick reference guides', inputSchema: { type: 'object', properties: {} } },

      // Play mode control tools
      { name: 'start_play_mode', description: 'Start play mode execution - begins scene simulation', inputSchema: { type: 'object', properties: {} } },
      { name: 'stop_play_mode', description: 'Stop play mode execution', inputSchema: { type: 'object', properties: { apply: { type: 'boolean', description: 'If true, keep runtime changes instead of restoring snapshot' } } } },
      { name: 'pause_play_mode', description: 'Pause play mode execution', inputSchema: { type: 'object', properties: {} } },
      { name: 'resume_play_mode', description: 'Resume play mode execution', inputSchema: { type: 'object', properties: {} } },
      { name: 'step_frame', description: 'Step forward by N frames (while paused)', inputSchema: { type: 'object', properties: { count: { type: 'number', description: 'Number of frames to step', default: 1 } } } },

      // Play mode query tools
      { name: 'get_play_mode_status', description: 'Get current play mode status', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_play_mode_stats', description: 'Get performance statistics (FPS, entity count, etc.)', inputSchema: { type: 'object', properties: {} } },
      { name: 'get_runtime_entities', description: 'Get all entities in the running scene', inputSchema: { type: 'object', properties: { hasComponent: { type: 'string', description: 'Filter by component type' } } } },
      { name: 'get_runtime_entity_state', description: 'Get state of a specific entity', inputSchema: { type: 'object', properties: { entityId: { type: 'string' } }, required: ['entityId'] } },
      { name: 'get_recent_events', description: 'Get recent game events', inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 20 } } } },
      { name: 'get_runtime_variables', description: 'Get variable values', inputSchema: { type: 'object', properties: { scope: { type: 'string', enum: ['global', 'scene'] } } } },

      // Input injection tools
      { name: 'inject_key_press', description: 'Inject a key press event', inputSchema: { type: 'object', properties: { key: { type: 'string' }, shift: { type: 'boolean' }, ctrl: { type: 'boolean' }, alt: { type: 'boolean' } }, required: ['key'] } },
      { name: 'inject_key_release', description: 'Inject a key release event', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
      { name: 'inject_key_tap', description: 'Inject a full key tap (press + release)', inputSchema: { type: 'object', properties: { key: { type: 'string' }, holdMs: { type: 'number', default: 50 } }, required: ['key'] } },
      { name: 'inject_mouse_click', description: 'Inject a mouse click', inputSchema: { type: 'object', properties: { button: { type: 'number', default: 0 }, x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },

      // Debugging tools
      { name: 'set_breakpoint', description: 'Set a breakpoint', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['event', 'frame', 'variable'] }, eventType: { type: 'string' }, frameNumber: { type: 'number' }, variableName: { type: 'string' } }, required: ['type'] } },
      { name: 'remove_breakpoint', description: 'Remove a breakpoint', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'get_breakpoints', description: 'Get all breakpoints', inputSchema: { type: 'object', properties: {} } },
      { name: 'connect_to_editor', description: 'Connect to the editor play mode bridge', inputSchema: { type: 'object', properties: {} } },
      { name: 'is_connected_to_editor', description: 'Check if connected to editor', inputSchema: { type: 'object', properties: {} } },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // Component tools
      case 'list_components':
        result = await componentTools.listComponents();
        break;
      case 'get_component_schema':
        result = await componentTools.getComponentSchema(args?.name as string);
        break;
      case 'search_components':
        result = await componentTools.searchComponents(args?.query as string);
        break;
      case 'get_component_pattern':
        result = componentTools.getComponentPattern();
        break;

      // Node tools
      case 'list_node_types':
        result = await nodeTools.listNodeTypes();
        break;
      case 'get_nodes_by_category':
        result = await nodeTools.getNodesByCategory(args?.category as 'event' | 'action' | 'condition' | 'data' | 'flow' | 'custom');
        break;
      case 'search_nodes':
        result = await nodeTools.searchNodes(args?.query as string);
        break;
      case 'get_node_type':
        result = await nodeTools.getNodeType(args?.id as string);
        break;
      case 'get_node_stats':
        result = await nodeTools.getNodeStats();
        break;
      case 'get_node_executor_pattern':
        result = nodeTools.getNodeExecutorPattern();
        break;
      case 'get_node_categories':
        result = nodeTools.getNodeCategories();
        break;

      // Type tools
      case 'extract_interfaces':
        result = typeTools.extractInterfaces(args?.filePath as string);
        break;
      case 'extract_types':
        result = typeTools.extractTypes(args?.filePath as string);
        break;
      case 'extract_exports':
        result = typeTools.extractExports(args?.filePath as string);
        break;
      case 'get_type_usages':
        result = typeTools.getTypeUsages(
          args?.typeName as string,
          (args?.basePath as string) || depTools.DEFAULT_BASE_PATH
        );
        break;

      // Dependency tools
      case 'build_dependency_graph':
        if (args?.refresh || !cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph((args?.basePath as string) || undefined);
        }
        result = depTools.getDependencyStats(cachedGraph);
        break;
      case 'get_file_dependencies':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph();
        }
        result = depTools.getFileDependencies(args?.filePath as string, cachedGraph);
        break;
      case 'get_file_dependents':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph();
        }
        result = depTools.getFileDependents(args?.filePath as string, cachedGraph);
        break;
      case 'find_circular_dependencies':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph((args?.basePath as string) || undefined);
        }
        result = depTools.findCircularDependencies(cachedGraph);
        break;
      case 'find_entry_points':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph((args?.basePath as string) || undefined);
        }
        result = depTools.findEntryPoints(cachedGraph);
        break;
      case 'find_core_modules':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph((args?.basePath as string) || undefined);
        }
        result = depTools.findCoreModules(cachedGraph, (args?.threshold as number) || 5);
        break;
      case 'get_dependency_stats':
        if (!cachedGraph) {
          cachedGraph = await depTools.buildDependencyGraph((args?.basePath as string) || undefined);
        }
        result = depTools.getDependencyStats(cachedGraph);
        break;

      // Pattern tools
      case 'extract_naming_conventions':
        result = await patternTools.extractNamingConventions((args?.basePath as string) || undefined);
        break;
      case 'extract_decorator_patterns':
        result = await patternTools.extractDecoratorPatterns((args?.basePath as string) || undefined);
        break;
      case 'extract_file_organization':
        result = await patternTools.extractFileOrganization((args?.basePath as string) || undefined);
        break;
      case 'extract_code_patterns':
        result = await patternTools.extractCodePatterns((args?.basePath as string) || undefined);
        break;
      case 'get_pattern_summary':
        result = await patternTools.getPatternSummary((args?.basePath as string) || undefined);
        break;

      // Consistency tools
      case 'check_component_consistency':
        result = await consistencyTools.checkComponentConsistency((args?.basePath as string) || undefined);
        break;
      case 'check_naming_consistency':
        result = await consistencyTools.checkNamingConsistency((args?.basePath as string) || undefined);
        break;
      case 'check_import_consistency':
        result = await consistencyTools.checkImportConsistency((args?.basePath as string) || undefined);
        break;
      case 'check_decorator_consistency':
        result = await consistencyTools.checkDecoratorConsistency((args?.basePath as string) || undefined);
        break;
      case 'run_all_checks':
        result = await consistencyTools.runAllChecks((args?.basePath as string) || undefined);
        break;

      // Runtime & debugging tools
      case 'build_project':
        result = await runtimeTools.buildProject();
        break;
      case 'type_check':
        result = await runtimeTools.typeCheck();
        break;
      case 'run_tests':
        result = await runtimeTools.runTests(args?.pattern as string | undefined);
        break;
      case 'start_dev_server':
        result = await runtimeTools.startDevServer();
        break;
      case 'stop_dev_server':
        result = runtimeTools.stopDevServer();
        break;
      case 'get_logs':
        result = runtimeTools.getLogs({
          level: args?.level as 'info' | 'warn' | 'error' | 'debug' | undefined,
          source: args?.source as string | undefined,
          limit: args?.limit as number | undefined,
        });
        break;
      case 'clear_logs':
        result = runtimeTools.clearLogs();
        break;
      case 'get_running_processes':
        result = runtimeTools.getRunningProcesses();
        break;
      case 'get_recently_modified_files':
        result = await runtimeTools.getRecentlyModifiedFiles({
          extension: args?.extension as string | undefined,
          since: args?.since as number | undefined,
        });
        break;
      case 'analyze_code':
        result = await runtimeTools.analyzeCode(args?.code as string);
        break;
      case 'get_project_status':
        result = await runtimeTools.getProjectStatus();
        break;
      case 'find_error_patterns':
        result = await runtimeTools.findErrorPatterns();
        break;
      case 'read_log_file':
        result = await runtimeTools.readLogFile(args?.logPath as string, args?.lines as number | undefined);
        break;

      // Semantic documentation tools
      case 'list_doc_topics':
        result = docsTools.listDocTopics();
        break;
      case 'get_system_doc':
        result = docsTools.getSystemDoc(args?.system as string);
        break;
      case 'search_docs':
        result = docsTools.searchDocs(args?.query as string);
        break;
      case 'get_quick_reference':
        result = docsTools.getQuickReference(args?.task as string);
        break;
      case 'list_quick_references':
        result = docsTools.listQuickReferences();
        break;

      // Play mode control tools
      case 'start_play_mode':
        result = await playModeTools.startPlayMode();
        break;
      case 'stop_play_mode':
        result = await playModeTools.stopPlayMode(args?.apply as boolean | undefined);
        break;
      case 'pause_play_mode':
        result = await playModeTools.pausePlayMode();
        break;
      case 'resume_play_mode':
        result = await playModeTools.resumePlayMode();
        break;
      case 'step_frame':
        result = await playModeTools.stepFrame(args?.count as number | undefined);
        break;

      // Play mode query tools
      case 'get_play_mode_status':
        result = await playModeTools.getPlayModeStatus();
        break;
      case 'get_play_mode_stats':
        result = await playModeTools.getPlayModeStats();
        break;
      case 'get_runtime_entities':
        result = await playModeTools.getEntities(
          args?.hasComponent ? { hasComponent: args.hasComponent as string } : undefined
        );
        break;
      case 'get_runtime_entity_state':
        result = await playModeTools.getEntityState(args?.entityId as string);
        break;
      case 'get_recent_events':
        result = await playModeTools.getRecentEvents(args?.limit as number | undefined);
        break;
      case 'get_runtime_variables':
        result = await playModeTools.getVariables(args?.scope as 'global' | 'scene' | undefined);
        break;

      // Input injection tools
      case 'inject_key_press':
        result = await playModeTools.injectKeyPress(args?.key as string, {
          shift: args?.shift as boolean | undefined,
          ctrl: args?.ctrl as boolean | undefined,
          alt: args?.alt as boolean | undefined,
        });
        break;
      case 'inject_key_release':
        result = await playModeTools.injectKeyRelease(args?.key as string);
        break;
      case 'inject_key_tap':
        result = await playModeTools.injectKeyTap(args?.key as string, args?.holdMs as number | undefined);
        break;
      case 'inject_mouse_click':
        result = await playModeTools.injectMouseClick(
          args?.button as number || 0,
          args?.x as number,
          args?.y as number
        );
        break;

      // Debugging tools
      case 'set_breakpoint':
        result = await playModeTools.setBreakpoint({
          type: args?.type as 'event' | 'frame' | 'variable',
          eventType: args?.eventType as string | undefined,
          frameNumber: args?.frameNumber as number | undefined,
          variableName: args?.variableName as string | undefined,
        });
        break;
      case 'remove_breakpoint':
        result = await playModeTools.removeBreakpoint(args?.id as string);
        break;
      case 'get_breakpoints':
        result = await playModeTools.getBreakpoints();
        break;
      case 'connect_to_editor':
        result = await playModeTools.connectToEditor();
        break;
      case 'is_connected_to_editor':
        result = playModeTools.isConnectedToEditor();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ASCII Dungeon Engine MCP server running on stdio');
}

main().catch(console.error);
