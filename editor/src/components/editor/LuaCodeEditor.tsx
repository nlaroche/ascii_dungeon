// ═══════════════════════════════════════════════════════════════════════════
// Lua Code Editor - Monaco-based editor with autocomplete and smart preview
// Auto-detects UI components and shows live preview only when relevant
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type { editor, languages, IDisposable, Position } from 'monaco-editor';
import { useTheme } from '../../stores/useEngineState';
import { UI_COMPONENTS, UIComponentMeta } from '../../lib/lua/ui-components';
import { runLuaUI, UIDefinition } from '../../lib/lua/bindings';
import { LuaRenderer } from '../../lib/lua/LuaRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ScriptType = 'ui' | 'logic' | 'mixed' | 'empty';

interface LuaCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onRun?: (code: string) => void;
  showPreview?: boolean | 'auto'; // 'auto' = smart detection
  previewPosition?: 'right' | 'bottom';
  height?: string | number;
  readOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Script Analysis - Detect what kind of Lua script this is
// ─────────────────────────────────────────────────────────────────────────────

interface ScriptAnalysis {
  type: ScriptType;
  hasUI: boolean;
  hasRequire: boolean;
  hasGameFunctions: boolean; // init, update, draw
  returnsUI: boolean;
  uiComponentCount: number;
}

function analyzeScript(code: string): ScriptAnalysis {
  const trimmed = code.trim();

  if (!trimmed) {
    return { type: 'empty', hasUI: false, hasRequire: false, hasGameFunctions: false, returnsUI: false, uiComponentCount: 0 };
  }

  // Check for UI patterns
  const uiPatterns = /\bui\.\w+\s*\(/g;
  const uiMatches = code.match(uiPatterns) || [];
  const hasUI = uiMatches.length > 0;
  const uiComponentCount = uiMatches.length;

  // Check if script returns UI (likely a UI-only script)
  const returnsUI = /return\s+ui\.\w+/.test(code);

  // Check for require statements (external dependencies)
  const hasRequire = /\brequire\s*\(/.test(code);

  // Check for common game lifecycle functions
  const hasGameFunctions = /\bfunction\s+(init|update|draw)\s*\(/.test(code);

  // Determine script type
  let type: ScriptType = 'logic';

  if (hasUI && !hasRequire && !hasGameFunctions && returnsUI) {
    type = 'ui'; // Pure UI script
  } else if (hasUI && (hasRequire || hasGameFunctions)) {
    type = 'mixed'; // Has both UI and logic
  } else if (!hasUI) {
    type = 'logic'; // No UI components
  } else {
    type = 'ui'; // Has UI, probably UI-focused
  }

  return { type, hasUI, hasRequire, hasGameFunctions, returnsUI, uiComponentCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Definition
// ─────────────────────────────────────────────────────────────────────────────

function createAsciiDungeonTheme(theme: ReturnType<typeof useTheme>): editor.IStandaloneThemeData {
  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: theme.text.replace('#', ''), background: theme.bg.replace('#', '') },
      { token: 'comment', foreground: theme.textDim.replace('#', ''), fontStyle: 'italic' },
      { token: 'keyword', foreground: theme.accent.replace('#', ''), fontStyle: 'bold' },
      { token: 'string', foreground: '22c55e' }, // green
      { token: 'number', foreground: '3b82f6' }, // blue
      { token: 'operator', foreground: theme.textMuted.replace('#', '') },
      { token: 'identifier', foreground: theme.text.replace('#', '') },
      { token: 'type', foreground: 'f59e0b' }, // orange
      { token: 'function', foreground: '8b5cf6' }, // purple
      { token: 'variable', foreground: 'ec4899' }, // pink
      { token: 'constant', foreground: '06b6d4' }, // cyan
      // Lua specific
      { token: 'keyword.lua', foreground: theme.accent.replace('#', ''), fontStyle: 'bold' },
      { token: 'string.lua', foreground: '22c55e' },
      { token: 'number.lua', foreground: '3b82f6' },
      { token: 'delimiter.lua', foreground: theme.textMuted.replace('#', '') },
    ],
    colors: {
      'editor.background': theme.bg,
      'editor.foreground': theme.text,
      'editor.lineHighlightBackground': theme.bgHover,
      'editor.selectionBackground': theme.accent + '40',
      'editor.inactiveSelectionBackground': theme.accent + '20',
      'editorCursor.foreground': theme.accent,
      'editorLineNumber.foreground': theme.textDim,
      'editorLineNumber.activeForeground': theme.textMuted,
      'editorIndentGuide.background': theme.border,
      'editorIndentGuide.activeBackground': theme.textDim,
      'editorWidget.background': theme.bgPanel,
      'editorWidget.border': theme.border,
      'editorSuggestWidget.background': theme.bgPanel,
      'editorSuggestWidget.border': theme.border,
      'editorSuggestWidget.foreground': theme.text,
      'editorSuggestWidget.selectedBackground': theme.bgHover,
      'editorSuggestWidget.highlightForeground': theme.accent,
      'editorHoverWidget.background': theme.bgPanel,
      'editorHoverWidget.border': theme.border,
      'list.hoverBackground': theme.bgHover,
      'list.activeSelectionBackground': theme.accent + '30',
      'scrollbarSlider.background': theme.border + '80',
      'scrollbarSlider.hoverBackground': theme.textDim + '80',
      'scrollbarSlider.activeBackground': theme.textMuted + '80',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete Definitions
// ─────────────────────────────────────────────────────────────────────────────

function generateUICompletions(monaco: Monaco): languages.CompletionItem[] {
  const completions: languages.CompletionItem[] = [];

  // Add all UI components
  Object.entries(UI_COMPONENTS).forEach(([name, meta]) => {
    const component = meta as UIComponentMeta;

    // Build snippet with all props
    const requiredProps = component.props.filter(p => p.required);
    const optionalProps = component.props.filter(p => !p.required);

    let snippet = `${name}({`;
    let snippetIndex = 1;

    requiredProps.forEach((prop, i) => {
      const comma = i < requiredProps.length - 1 || optionalProps.length > 0 ? ',' : '';
      if (prop.type === 'string') {
        snippet += ` ${prop.name} = "\${${snippetIndex}:${prop.default || ''}}"${comma}`;
      } else {
        snippet += ` ${prop.name} = \${${snippetIndex}:${prop.default || ''}}${comma}`;
      }
      snippetIndex++;
    });

    snippet += ' }';

    // For container components, add children
    if (['column', 'row', 'panel', 'scroll', 'grid'].includes(name)) {
      snippet += `, {\n\t\${${snippetIndex}:-- children}\n}`;
    }

    snippet += ')';

    completions.push({
      label: `ui.${name}`,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: {
        value: `**${component.name}**\n\n${component.description}\n\n**Props:**\n${component.props.map(p => `- \`${p.name}\`: ${p.type}${p.required ? ' (required)' : ''} - ${p.description}`).join('\n')}`,
      },
      detail: component.description,
      range: undefined as any,
    });
  });

  return completions;
}

function generateNodeCompletions(monaco: Monaco): languages.CompletionItem[] {
  const completions: languages.CompletionItem[] = [];

  // nodes.define
  completions.push({
    label: 'nodes.define',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: `define({
\tid = "\${1:my-node}",
\tname = "\${2:My Node}",
\tcategory = "\${3|event,action,condition,data,flow,custom|}",
\ticon = "\${4:★}",
\tcolor = "\${5:#8b5cf6}",
\tinputs = {
\t\t{ id = "flow", label = "", type = "flow" },
\t\t{ id = "\${6:input}", label = "\${7:Input}", type = "\${8|any,string,number,boolean,flow,entity,position|}" }
\t},
\toutputs = {
\t\t{ id = "flow", label = "", type = "flow" }
\t}
})`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Define a custom node type for the node editor',
    detail: 'Define custom node',
    range: undefined as any,
  });

  // nodes.list
  completions.push({
    label: 'nodes.list',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: 'list()',
    documentation: 'Get all available node types',
    detail: 'List all nodes',
    range: undefined as any,
  });

  // nodes.byCategory
  completions.push({
    label: 'nodes.byCategory',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: 'byCategory("${1|event,action,condition,data,flow,custom|}")',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Get nodes by category',
    detail: 'Filter nodes by category',
    range: undefined as any,
  });

  return completions;
}

function generateGraphCompletions(monaco: Monaco): languages.CompletionItem[] {
  return [
    {
      label: 'graph.create',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'create("${1:My Graph}")',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a new node graph',
      detail: 'Create graph',
      range: undefined as any,
    },
    {
      label: 'graph.addNode',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'addNode("${1:node-type}", ${2:x}, ${3:y}, { ${4:data} })',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a node to the active graph',
      detail: 'Add node',
      range: undefined as any,
    },
    {
      label: 'graph.connect',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'connect(${1:sourceId}, "${2:sourceHandle}", ${3:targetId}, "${4:targetHandle}")',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Connect two nodes',
      detail: 'Connect nodes',
      range: undefined as any,
    },
    {
      label: 'graph.setActive',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'setActive(${1:graphId})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Set the active graph',
      detail: 'Set active graph',
      range: undefined as any,
    },
    {
      label: 'graph.getNodes',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'getNodes()',
      documentation: 'Get all nodes in the active graph',
      detail: 'Get nodes',
      range: undefined as any,
    },
    {
      label: 'graph.getEdges',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'getEdges()',
      documentation: 'Get all edges in the active graph',
      detail: 'Get edges',
      range: undefined as any,
    },
  ];
}

function generateStateCompletions(monaco: Monaco): languages.CompletionItem[] {
  return [
    {
      label: 'state.get',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'get("${1:key}")',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Get a value from state storage',
      detail: 'Get state value',
      range: undefined as any,
    },
    {
      label: 'state.set',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'set("${1:key}", ${2:value})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Set a value in state storage',
      detail: 'Set state value',
      range: undefined as any,
    },
    {
      label: 'state.getAll',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'getAll()',
      documentation: 'Get all state values',
      detail: 'Get all state',
      range: undefined as any,
    },
  ];
}

function generateUtilCompletions(monaco: Monaco): languages.CompletionItem[] {
  return [
    {
      label: 'util.deepcopy',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'deepcopy(${1:table})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a deep copy of a table',
      detail: 'Deep copy table',
      range: undefined as any,
    },
    {
      label: 'util.merge',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'merge(${1:table1}, ${2:table2})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Merge multiple tables',
      detail: 'Merge tables',
      range: undefined as any,
    },
    {
      label: 'util.format',
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: 'format("${1:template}", ${2:args})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Format a string with placeholders',
      detail: 'Format string',
      range: undefined as any,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lua Code Editor Component
// ─────────────────────────────────────────────────────────────────────────────

export function LuaCodeEditor({
  value,
  onChange,
  onRun,
  showPreview = 'auto',
  previewPosition = 'right',
  height = '100%',
  readOnly = false,
}: LuaCodeEditorProps) {
  const theme = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  const [uiDefinition, setUiDefinition] = useState<UIDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [previewOverride, setPreviewOverride] = useState<boolean | null>(null); // Manual override

  // Analyze the script to determine its type
  const analysis = useMemo(() => analyzeScript(value), [value]);

  // Determine if we should show the preview
  const shouldShowPreview = useMemo(() => {
    // If user manually toggled, respect that
    if (previewOverride !== null) return previewOverride;

    // If explicitly set to true/false, use that
    if (showPreview === true) return true;
    if (showPreview === false) return false;

    // Auto mode: show preview only for UI scripts or mixed scripts with UI
    return analysis.type === 'ui' || (analysis.type === 'mixed' && analysis.returnsUI);
  }, [showPreview, previewOverride, analysis]);

  // Run Lua code to generate preview (only for UI-capable scripts)
  useEffect(() => {
    if (!shouldShowPreview || analysis.type === 'logic') {
      setUiDefinition(null);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        const result = runLuaUI(value);
        setUiDefinition(result);
        setError(null);
      } catch (e) {
        const errorMsg = (e as Error).message;
        // Don't show errors for scripts that aren't meant to be previewed
        if (analysis.hasRequire || analysis.hasGameFunctions) {
          setError(null); // Suppress errors for logic scripts
          setUiDefinition(null);
        } else {
          setError(errorMsg);
          setUiDefinition(null);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, shouldShowPreview, analysis]);

  // Reset manual override when script type changes significantly
  useEffect(() => {
    setPreviewOverride(null);
  }, [analysis.type]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define and apply theme
    monaco.editor.defineTheme('ascii-dungeon', createAsciiDungeonTheme(theme));
    monaco.editor.setTheme('ascii-dungeon');

    // Register Lua completion provider
    const completionProvider = monaco.languages.registerCompletionItemProvider('lua', {
      triggerCharacters: ['.', ':'],
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const suggestions: languages.CompletionItem[] = [];

        // Check what module we're completing for
        if (textUntilPosition.endsWith('ui.')) {
          suggestions.push(...generateUICompletions(monaco));
        } else if (textUntilPosition.endsWith('nodes.')) {
          suggestions.push(...generateNodeCompletions(monaco));
        } else if (textUntilPosition.endsWith('graph.')) {
          suggestions.push(...generateGraphCompletions(monaco));
        } else if (textUntilPosition.endsWith('state.')) {
          suggestions.push(...generateStateCompletions(monaco));
        } else if (textUntilPosition.endsWith('util.')) {
          suggestions.push(...generateUtilCompletions(monaco));
        } else {
          // Global completions
          suggestions.push(
            {
              label: 'ui',
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: 'ui.',
              documentation: 'UI component module - create visual components',
              detail: 'UI Module',
              range: undefined as any,
            },
            {
              label: 'nodes',
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: 'nodes.',
              documentation: 'Node types module - define custom node types',
              detail: 'Nodes Module',
              range: undefined as any,
            },
            {
              label: 'graph',
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: 'graph.',
              documentation: 'Graph manipulation module - create and modify node graphs',
              detail: 'Graph Module',
              range: undefined as any,
            },
            {
              label: 'state',
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: 'state.',
              documentation: 'State storage module - persist data',
              detail: 'State Module',
              range: undefined as any,
            },
            {
              label: 'util',
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: 'util.',
              documentation: 'Utility functions module',
              detail: 'Util Module',
              range: undefined as any,
            },
            {
              label: 'print',
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'print(${1:message})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Print a message to the console',
              detail: 'Print function',
              range: undefined as any,
            },
            {
              label: 'return',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'return ',
              documentation: 'Return a value',
              detail: 'Return statement',
              range: undefined as any,
            },
            {
              label: 'local',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'local ${1:name} = ${2:value}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Declare a local variable',
              detail: 'Local variable',
              range: undefined as any,
            },
            {
              label: 'function',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'function ${1:name}(${2:args})\n\t${3:-- body}\nend',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Define a function',
              detail: 'Function definition',
              range: undefined as any,
            },
            {
              label: 'if',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'if ${1:condition} then\n\t${2:-- body}\nend',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'If statement',
              detail: 'If statement',
              range: undefined as any,
            },
            {
              label: 'for',
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'for ${1:i} = ${2:1}, ${3:10} do\n\t${4:-- body}\nend',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'For loop',
              detail: 'For loop',
              range: undefined as any,
            },
          );
        }

        return { suggestions };
      },
    });

    disposablesRef.current.push(completionProvider);

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun?.(editor.getValue());
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Prevent browser save dialog
    });

    setIsEditorReady(true);
  }, [theme, onRun]);

  // Update theme when it changes
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      monacoRef.current.editor.defineTheme('ascii-dungeon', createAsciiDungeonTheme(theme));
      monacoRef.current.editor.setTheme('ascii-dungeon');
    }
  }, [theme, isEditorReady]);

  // Cleanup
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const isHorizontal = previewPosition === 'right';

  // Script type badges
  const scriptTypeBadge = useMemo(() => {
    switch (analysis.type) {
      case 'ui':
        return { label: 'UI', color: theme.accent, icon: '◈' };
      case 'logic':
        return { label: 'Logic', color: theme.warning, icon: '⚙' };
      case 'mixed':
        return { label: 'Mixed', color: '#8b5cf6', icon: '◐' };
      default:
        return null;
    }
  }, [analysis.type, theme]);

  return (
    <div
      className={`h-full flex ${isHorizontal ? 'flex-row' : 'flex-col'}`}
      style={{ height }}
    >
      {/* Editor */}
      <div className={`${shouldShowPreview ? (isHorizontal ? 'w-1/2' : 'h-1/2') : 'w-full h-full'} flex flex-col`}>
        {/* Editor header */}
        <div
          className="px-3 py-1.5 flex items-center justify-between shrink-0"
          style={{
            backgroundColor: theme.bgHover,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.textDim }}>
              Lua
            </span>
            {/* Script type badge */}
            {scriptTypeBadge && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ backgroundColor: scriptTypeBadge.color + '20', color: scriptTypeBadge.color }}
              >
                <span>{scriptTypeBadge.icon}</span>
                {scriptTypeBadge.label}
              </span>
            )}
            {/* Status indicators */}
            {shouldShowPreview && error && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.error + '20', color: theme.error }}>
                Error
              </span>
            )}
            {shouldShowPreview && !error && uiDefinition && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.success + '20', color: theme.success }}>
                Valid
              </span>
            )}
            {/* Component count for UI scripts */}
            {analysis.uiComponentCount > 0 && (
              <span className="text-[10px]" style={{ color: theme.textDim }}>
                {analysis.uiComponentCount} component{analysis.uiComponentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Preview toggle button */}
            {(analysis.hasUI || showPreview === true) && (
              <button
                onClick={() => setPreviewOverride(prev => prev === null ? !shouldShowPreview : !prev)}
                className="text-[10px] px-2 py-0.5 rounded transition-colors"
                style={{
                  backgroundColor: shouldShowPreview ? theme.accent + '20' : 'transparent',
                  color: shouldShowPreview ? theme.accent : theme.textDim,
                  border: `1px solid ${shouldShowPreview ? theme.accent + '40' : theme.border}`,
                }}
                title={shouldShowPreview ? 'Hide preview' : 'Show preview'}
              >
                {shouldShowPreview ? '◧ Preview' : '◨ Preview'}
              </button>
            )}
            <span className="text-[10px]" style={{ color: theme.textDim }}>
              Ctrl+Enter
            </span>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1">
          <Editor
            language="lua"
            value={value}
            onChange={(val) => onChange?.(val || '')}
            onMount={handleEditorMount}
            theme="ascii-dungeon"
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontLigatures: true,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              folding: true,
              foldingHighlight: true,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              renderWhitespace: 'selection',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              padding: { top: 8, bottom: 8 },
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showFunctions: true,
                showVariables: true,
                showModules: true,
                preview: true,
                filterGraceful: true,
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
              parameterHints: { enabled: true },
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
            }}
          />
        </div>
      </div>

      {/* Preview */}
      {shouldShowPreview && (
        <div
          className={`${isHorizontal ? 'w-1/2' : 'h-1/2'} flex flex-col`}
          style={{
            borderLeft: isHorizontal ? `1px solid ${theme.border}` : undefined,
            borderTop: !isHorizontal ? `1px solid ${theme.border}` : undefined,
          }}
        >
          {/* Preview header */}
          <div
            className="px-3 py-1.5 shrink-0 flex items-center justify-between"
            style={{
              backgroundColor: theme.bgHover,
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <span className="text-[10px] uppercase tracking-wider" style={{ color: theme.textDim }}>
              Live Preview
            </span>
            {analysis.type === 'mixed' && (
              <span className="text-[10px]" style={{ color: theme.textMuted }}>
                Showing UI output only
              </span>
            )}
          </div>

          {/* Preview content */}
          <div
            className="flex-1 overflow-auto p-4"
            style={{ backgroundColor: theme.bgPanel }}
          >
            {analysis.hasRequire && !uiDefinition && !error ? (
              // Show info message for scripts with require that can't be previewed
              <div className="h-full flex items-center justify-center">
                <div className="text-center" style={{ color: theme.textMuted }}>
                  <div className="text-2xl mb-2">📦</div>
                  <div className="text-xs font-medium">Module Dependencies</div>
                  <div className="text-[10px] mt-1 max-w-48" style={{ color: theme.textDim }}>
                    This script uses <code className="px-1 rounded" style={{ backgroundColor: theme.bgHover }}>require()</code> which needs runtime execution
                  </div>
                </div>
              </div>
            ) : (
              <LuaRenderer definition={uiDefinition} error={error || undefined} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LuaCodeEditor;
