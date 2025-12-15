// ═══════════════════════════════════════════════════════════════════════════
// ASCII Dungeon Engine - Data-Driven Editor with Dockable Panels
// Everything is state. Everything can be modified. Panels can float.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEngineState, useTheme, useSelection, useEntities, useChat, useTemplate, useUIScale } from './stores/useEngineState';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ThemeProvider } from './components/ui';
import { DockableLayout, DockAPI } from './components/DockLayout';
import { WebGPUViewport } from './components/WebGPUViewport';
import { MenuBar } from './components/MenuBar';
import { TemplateBrowser } from './components/TemplateBrowser';
import { ComponentBrowser } from './components/ComponentBrowser';
import { CustomPanelView } from './components/CustomPanel';
import { NodeEditor } from './components/nodes/NodeEditor';
import { LuaCodeEditor } from './components/editor/LuaCodeEditor';
import { useProject } from './hooks/useProject';
import { FileEntry } from './lib/filesystem';
import { getTemplate, TemplateDefinition } from './lib/templates';

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const theme = useTheme();
  const { scale: uiScale } = useUIScale();
  const undo = useEngineState((s) => s.undo);
  const redo = useEngineState((s) => s.redo);
  const canUndo = useEngineState((s) => s.canUndo);
  const canRedo = useEngineState((s) => s.canRedo);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
      }
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Template management
  const { currentId: currentTemplateId, applyTemplate } = useTemplate();

  // Debug: log template changes
  useEffect(() => {
    console.log('[App] currentTemplateId changed:', currentTemplateId);
  }, [currentTemplateId]);

  const handleSelectTemplate = useCallback((template: TemplateDefinition) => {
    console.log('[App] handleSelectTemplate called:', template.id, template.name);
    applyTemplate(template);
  }, [applyTemplate]);

  // Dock API for adding custom panel tabs
  const [dockApi, setDockApi] = useState<DockAPI | null>(null);

  const handlePanelSaved = useCallback((panelId: string) => {
    console.log('[App] Panel saved:', panelId);
    // Add the new panel as a floating tab
    if (dockApi) {
      dockApi.addTab(panelId);
    }
  }, [dockApi]);

  // Render tab content based on tab ID
  const renderTabContent = useCallback((tabId: string) => {
    switch (tabId) {
      // Core panels
      case 'files':
        return <FileTree />;
      case 'entities':
        return <EntityList />;
      case 'assets':
        return <AssetBrowser />;
      case 'templates':
        return (
          <TemplateBrowser
            currentTemplateId={currentTemplateId || undefined}
            onSelectTemplate={handleSelectTemplate}
          />
        );
      case 'components':
        return <ComponentBrowser onPanelSaved={handlePanelSaved} />;
      case 'node-editor':
        return <NodeEditor />;
      case 'scene':
        return <SceneView />;
      case 'code':
        return <CodeEditor />;
      case 'chat':
        return <AIChat />;
      case 'properties':
        return <PropertiesPanel />;
      case 'console':
        return <ConsolePanel />;

      // Deckbuilder panels
      case 'cards':
        return <TemplatePlaceholder icon="🃏" title="Card Library" description="Browse and manage your card collection" />;
      case 'decks':
        return <TemplatePlaceholder icon="📚" title="Deck Manager" description="Build and organize your decks" />;
      case 'card-designer':
        return <TemplatePlaceholder icon="🎨" title="Card Designer" description="Create and edit card layouts, effects, and artwork" />;
      case 'playtest':
        return <TemplatePlaceholder icon="▶" title="Play Test" description="Test your cards and decks in action" />;

      // Visual Novel panels
      case 'characters':
        return <TemplatePlaceholder icon="👤" title="Characters" description="Manage characters, sprites, and expressions" />;
      case 'scenes':
        return <TemplatePlaceholder icon="🎬" title="Scenes" description="Organize backgrounds and scene settings" />;
      case 'script-editor':
        return <TemplatePlaceholder icon="📝" title="Script Editor" description="Write dialog, choices, and narrative branches" />;
      case 'flowchart':
        return <TemplatePlaceholder icon="🔀" title="Story Flow" description="Visualize and edit your narrative structure" />;
      case 'preview':
        return <TemplatePlaceholder icon="👁" title="Preview" description="Preview your visual novel in action" />;

      default:
        // Check if it's a custom panel
        if (tabId.startsWith('custom-')) {
          return <CustomPanelView panelId={tabId} />;
        }
        return <div className="p-4 text-zinc-500">Unknown tab: {tabId}</div>;
    }
  }, [currentTemplateId, handleSelectTemplate]);

  return (
    <div
      className="h-screen flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace',
      }}
    >
      {/* Menu bar stays at 100% scale - always accessible */}
      <MenuBar
        onOpenPanel={(panelId) => {
          if (dockApi) {
            dockApi.addTab(panelId);
          }
        }}
      />
      {/* Content area wrapper - holds the scaled content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scaled content - uses transform for clean scaling */}
        <div
          className="absolute flex flex-col"
          style={{
            transformOrigin: 'top left',
            transform: `scale(${uiScale})`,
            width: `${100 / uiScale}%`,
            height: `${100 / uiScale}%`,
          }}
        >
          <div className="flex-1 relative">
            <DockableLayout renderContent={renderTabContent} onDockReady={setDockApi} />
          </div>
          <StatusBar />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Placeholder - For panels that aren't implemented yet
// ─────────────────────────────────────────────────────────────────────────────

function TemplatePlaceholder({ icon, title, description }: { icon: string; title: string; description: string }) {
  const theme = useTheme();
  return (
    <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
      <div className="text-center max-w-xs">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="font-bold text-lg mb-2" style={{ color: theme.text }}>{title}</div>
        <div className="text-sm leading-relaxed">{description}</div>
        <div
          className="mt-4 px-3 py-1.5 rounded text-xs inline-block"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          Coming soon
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// File Tree
// ─────────────────────────────────────────────────────────────────────────────

function FileTree() {
  const theme = useTheme();
  const selectedFile = useEngineState((s) => s.project.selectedFile);
  const setPath = useEngineState((s) => s.setPath);

  const {
    hasProject,
    fileTree,
    expandedDirs,
    toggleDirectory,
    openProject,
    createProject,
  } = useProject();

  // Get file icon based on extension
  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return '▸';
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'lua': return '◈';
      case 'json': return '{ }';
      case 'wgsl': return '◇';
      case 'md': return '≡';
      default: return '○';
    }
  };

  // Render a file entry recursively
  const renderEntry = (entry: FileEntry, depth: number = 0) => {
    const isExpanded = expandedDirs.has(entry.path);
    const isSelected = selectedFile === entry.path;
    const paddingLeft = 8 + depth * 12;

    return (
      <div key={entry.path}>
        <div
          onClick={() => {
            if (entry.isDirectory) {
              toggleDirectory(entry.path);
            } else {
              setPath(['project', 'selectedFile'], entry.path, `Select ${entry.name}`);
            }
          }}
          className="py-1 cursor-pointer rounded transition-colors flex items-center gap-1"
          style={{
            paddingLeft,
            backgroundColor: isSelected ? theme.bgHover : 'transparent',
            color: isSelected ? theme.accent : entry.isDirectory ? theme.warning : theme.textMuted,
          }}
        >
          <span
            className="text-xs transition-transform"
            style={{
              transform: entry.isDirectory && isExpanded ? 'rotate(90deg)' : 'none',
              color: theme.textDim,
            }}
          >
            {getFileIcon(entry.name, entry.isDirectory)}
          </span>
          <span className="truncate">{entry.name}</span>
        </div>

        {entry.isDirectory && isExpanded && entry.children && (
          <div>
            {entry.children.map((child) => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // No project open - show welcome screen
  if (!hasProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-3" style={{ color: theme.accent }}>◆</div>
          <div className="font-medium mb-3">No Project Open</div>
          <div className="space-y-2">
            <button
              onClick={createProject}
              className="w-full px-3 py-2 rounded text-xs transition-colors"
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              New Project
            </button>
            <button
              onClick={() => openProject()}
              className="w-full px-3 py-2 rounded text-xs transition-colors"
              style={{ backgroundColor: theme.bgHover, color: theme.text }}
            >
              Open Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs p-1">
      {fileTree.length === 0 ? (
        <div className="p-4 text-center" style={{ color: theme.textDim }}>
          Empty project
        </div>
      ) : (
        fileTree.map((entry) => renderEntry(entry))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity List
// ─────────────────────────────────────────────────────────────────────────────

function EntityList() {
  const theme = useTheme();
  const { entities } = useEntities();
  const { selection, selectEntity } = useSelection();

  const getEntityColor = (type: string) => {
    switch (type) {
      case 'player': return theme.success;
      case 'enemy': return theme.error;
      default: return theme.warning;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {entities.map((entity) => (
        <div
          key={entity.id}
          onClick={() => selectEntity(entity.id)}
          className="px-3 py-2 cursor-pointer transition-colors"
          style={{
            backgroundColor: selection.entities.includes(entity.id) ? theme.bgHover : 'transparent',
            borderBottom: `1px solid ${theme.border}50`,
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: getEntityColor(entity.type) }} className="font-medium">
              {entity.glyph} {entity.name}
            </span>
            <span className="text-xs" style={{ color: theme.textDim }}>
              {entity.type}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
            pos: {entity.position.map((n) => n.toFixed(0)).join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Browser
// ─────────────────────────────────────────────────────────────────────────────

function AssetBrowser() {
  const theme = useTheme();
  return (
    <div className="h-full flex items-center justify-center" style={{ color: theme.textDim }}>
      <div className="text-center">
        <div className="text-4xl mb-2">◈</div>
        <div>Assets</div>
        <div className="text-xs mt-1">Coming soon</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene View
// ─────────────────────────────────────────────────────────────────────────────

function SceneView() {
  const theme = useTheme();
  const tools = useEngineState((s) => s.tools);
  const setPath = useEngineState((s) => s.setPath);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div
        className="h-10 flex items-center gap-2 px-3 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div
          className="flex items-center gap-1 rounded p-0.5"
          style={{ backgroundColor: theme.bgHover }}
        >
          {Object.values(tools.available)
            .filter((t) => ['select', 'paint', 'erase', 'spawn'].includes(t.id))
            .map((tool) => (
              <button
                key={tool.id}
                onClick={() => setPath(['tools', 'active'], tool.id, `Select ${tool.name} tool`)}
                className="px-2 py-1 rounded text-xs transition-colors"
                style={{
                  backgroundColor: tools.active === tool.id ? theme.accent : 'transparent',
                  color: tools.active === tool.id ? theme.bg : theme.textMuted,
                }}
                title={`${tool.name} (${tool.shortcut})`}
              >
                {tool.icon}
              </button>
            ))}
        </div>
      </div>

      {/* WebGPU Viewport */}
      <div className="flex-1 relative min-h-0">
        <WebGPUViewport className="absolute inset-0" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Editor
// ─────────────────────────────────────────────────────────────────────────────

function CodeEditor() {
  const theme = useTheme();
  const selectedFile = useEngineState((s) => s.project.selectedFile);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file when selected
  useEffect(() => {
    if (!selectedFile) {
      setFileContent('');
      return;
    }

    setIsLoading(true);
    setError(null);

    import('./lib/filesystem').then(({ getFileSystem }) => {
      getFileSystem().then(fs => {
        fs.readFile(selectedFile)
          .then(content => {
            setFileContent(content);
            setIsDirty(false);
          })
          .catch(err => {
            setError(`Failed to load file: ${err.message}`);
            setFileContent('');
          })
          .finally(() => setIsLoading(false));
      });
    });
  }, [selectedFile]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const { getFileSystem } = await import('./lib/filesystem');
      const fs = await getFileSystem();
      await fs.writeFile(selectedFile, fileContent);
      setIsDirty(false);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    }
  }, [selectedFile, fileContent]);

  // Handle content change
  const handleChange = useCallback((value: string) => {
    setFileContent(value);
    setIsDirty(true);
  }, []);

  // Determine language from file extension
  const getLanguage = (filename: string | null): string => {
    if (!filename) return 'plaintext';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'lua': return 'lua';
      case 'json': return 'json';
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'xml': return 'xml';
      case 'yaml': case 'yml': return 'yaml';
      default: return 'plaintext';
    }
  };

  const isLuaFile = selectedFile?.endsWith('.lua');
  const fileName = selectedFile?.split('/').pop();
  const dirName = selectedFile?.split('/').slice(-2, -1)[0];

  // If it's a Lua file, use our fancy LuaCodeEditor with preview
  if (selectedFile && isLuaFile) {
    return (
      <div className="h-full flex flex-col">
        {/* File header */}
        <div
          className="h-8 flex items-center justify-between px-3 shrink-0"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: theme.textDim }}>{dirName}/</span>
            <span style={{ color: theme.text }}>{fileName}</span>
            {isDirty && <span style={{ color: theme.warning }}>●</span>}
          </div>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-2 py-0.5 rounded text-xs"
            style={{
              backgroundColor: isDirty ? theme.accent : theme.bgHover,
              color: isDirty ? theme.bg : theme.textDim,
            }}
          >
            Save
          </button>
        </div>

        {/* LuaCodeEditor with smart preview */}
        <div className="flex-1 min-h-0">
          <LuaCodeEditor
            value={fileContent}
            onChange={handleChange}
            showPreview="auto"
            previewPosition="right"
            onRun={handleSave}
          />
        </div>
      </div>
    );
  }

  // For non-Lua files, use basic Monaco
  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div
        className="h-8 flex items-center justify-between px-3 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {selectedFile ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span style={{ color: theme.textDim }}>{dirName}/</span>
              <span style={{ color: theme.text }}>{fileName}</span>
              {isDirty && <span style={{ color: theme.warning }}>●</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: isDirty ? theme.accent : theme.bgHover,
                color: isDirty ? theme.bg : theme.textDim,
              }}
            >
              Save
            </button>
          </>
        ) : (
          <span className="text-xs" style={{ color: theme.textDim }}>No file selected</span>
        )}
      </div>

      {/* Editor content */}
      {!selectedFile ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: theme.textDim }}>
          <div className="text-center">
            <div className="text-4xl mb-2">{'{ }'}</div>
            <div>Select a file to edit</div>
            <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
              Click on a file in the Files panel
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: theme.textDim }}>
          <div className="text-center">
            <div className="text-2xl mb-2 animate-pulse">◈</div>
            <div className="text-xs">Loading...</div>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: theme.error }}>
          <div className="text-center">
            <div className="text-2xl mb-2">!</div>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <MonacoFileEditor
            value={fileContent}
            onChange={handleChange}
            language={getLanguage(selectedFile)}
          />
        </div>
      )}
    </div>
  );
}

// Simple Monaco wrapper for non-Lua files
function MonacoFileEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  language: string;
}) {
  const theme = useTheme();
  const monacoRef = useRef<any>(null);

  const handleMount = useCallback((_editor: any, monaco: any) => {
    monacoRef.current = monaco;

    // Define theme
    monaco.editor.defineTheme('ascii-dungeon-file', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': theme.bg,
        'editor.foreground': theme.text,
        'editor.lineHighlightBackground': theme.bgHover,
        'editor.selectionBackground': theme.accent + '40',
        'editorCursor.foreground': theme.accent,
        'editorLineNumber.foreground': theme.textDim,
      },
    });
    monaco.editor.setTheme('ascii-dungeon-file');
  }, [theme]);

  return (
    <Editor
      language={language}
      value={value}
      onChange={(val) => onChange(val || '')}
      onMount={handleMount}
      theme="ascii-dungeon-file"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        lineNumbers: 'on',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Chat
// ─────────────────────────────────────────────────────────────────────────────

interface ClaudeStreamEvent {
  event_type: 'start' | 'chunk' | 'done' | 'error' | 'progress';
  content: string;
  conversation_id: string;
}


function AIChat() {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);
  const [claudePath, setClaudePath] = useState<string | null>(null);
  const currentMessageIdRef = useRef<string>('');

  // Get project path from Zustand store for sandboxing Claude to project folder
  const projectRoot = useEngineState((s) => s.project.root);
  const hasProject = !!projectRoot && projectRoot !== '';

  const {
    currentConversation,
    conversations,
    isStreaming,
    inputDraft,
    createConversation,
    switchConversation,
    addMessage,
    appendToMessage,
    updateMessage,
    setStreaming,
    setInputDraft,
    branchConversation,
  } = useChat();

  // Use refs for stable callbacks in the event listener
  const addMessageRef = useRef(addMessage);
  const appendToMessageRef = useRef(appendToMessage);
  const updateMessageRef = useRef(updateMessage);
  const setStreamingRef = useRef(setStreaming);

  // Keep refs up to date
  useEffect(() => {
    addMessageRef.current = addMessage;
    appendToMessageRef.current = appendToMessage;
    updateMessageRef.current = updateMessage;
    setStreamingRef.current = setStreaming;
  }, [addMessage, appendToMessage, updateMessage, setStreaming]);

  // Check if Claude is available on mount
  useEffect(() => {
    Promise.all([
      invoke<boolean>('check_claude_available'),
      invoke<string | null>('get_claude_path'),
    ])
      .then(([available, path]) => {
        setClaudeAvailable(available);
        setClaudePath(path);
        console.log('Claude available:', available, 'Path:', path);
      })
      .catch((err) => {
        console.error('Failed to check Claude:', err);
        setClaudeAvailable(false);
      });
  }, []);

  // Track the conversation ID we're waiting for responses on
  const pendingConversationIdRef = useRef<string>('');

  // Listen for streaming events - use refs for stable callbacks
  useEffect(() => {
    console.log('[AIChat] Setting up event listener for claude-stream');

    const unlisten = listen<ClaudeStreamEvent>('claude-stream', (event) => {
      const { event_type, content, conversation_id } = event.payload;

      console.log('[AIChat] Stream event received:', event_type, 'conv:', conversation_id, 'content length:', content.length);

      // Make sure this event is for a conversation we're expecting
      // Use the ref instead of currentConversation to avoid race conditions
      if (pendingConversationIdRef.current && conversation_id !== pendingConversationIdRef.current) {
        console.log('[AIChat] Ignoring event for different conversation. Expected:', pendingConversationIdRef.current, 'Got:', conversation_id);
        return;
      }

      switch (event_type) {
        case 'start':
          console.log('[AIChat] Received start event, creating message...');
          // Create assistant message placeholder using ref
          const msgId = addMessageRef.current('assistant', '', 'streaming');
          currentMessageIdRef.current = msgId;
          console.log('[AIChat] Created message with id:', msgId);
          break;

        case 'chunk':
          console.log('[AIChat] Received chunk, currentMessageId:', currentMessageIdRef.current, 'chunk preview:', content.substring(0, 50));
          // Append content to current message (plain text output)
          if (currentMessageIdRef.current) {
            appendToMessageRef.current(currentMessageIdRef.current, content);
          } else {
            console.warn('[AIChat] Received chunk but no currentMessageId!');
          }
          break;

        case 'done':
          console.log('[AIChat] Received done event');
          // Mark message as complete
          if (currentMessageIdRef.current) {
            updateMessageRef.current(currentMessageIdRef.current, { status: 'complete' });
            console.log('[AIChat] Message marked complete');
          }
          setStreamingRef.current(false);
          currentMessageIdRef.current = '';
          pendingConversationIdRef.current = '';
          // File tree will auto-refresh via file watcher
          break;

        case 'error':
          console.log('[AIChat] Received error event:', content);
          // Mark message as error using refs
          if (currentMessageIdRef.current) {
            updateMessageRef.current(currentMessageIdRef.current, {
              status: 'error',
              error: content,
              content: content || 'Unknown error',
            });
          } else {
            // No message created yet, create one with the error
            addMessageRef.current('assistant', content || 'Unknown error', 'error');
          }
          setStreamingRef.current(false);
          currentMessageIdRef.current = '';
          pendingConversationIdRef.current = '';
          break;

        case 'progress':
          // Progress events from stderr - show what Claude is doing
          console.log('[AIChat] Progress:', content);
          // Don't show progress in chat, it's noisy
          break;
      }
    });

    return () => {
      console.log('[AIChat] Cleaning up event listener');
      unlisten.then((fn) => fn());
    };
  }, []); // Empty deps - listener is stable, uses refs for callbacks

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  // Send message
  const sendMessage = async () => {
    console.log('[AIChat] sendMessage called, inputDraft:', inputDraft, 'isStreaming:', isStreaming);

    if (!inputDraft.trim() || isStreaming) {
      console.log('[AIChat] Blocked - empty input or already streaming');
      return;
    }

    // Create conversation if needed
    let convId = currentConversation?.id;
    if (!convId) {
      convId = createConversation('New Chat');
      console.log('[AIChat] Created new conversation:', convId);
    }

    // Set the pending conversation ID before anything else
    pendingConversationIdRef.current = convId;

    // Add user message
    const userMessage = inputDraft.trim();
    addMessage('user', userMessage);
    setInputDraft('');

    // Start streaming
    setStreaming(true);

    // Safety timeout - reset streaming after 3.5 minutes if nothing happens
    // (slightly longer than the Rust timeout of 3 minutes)
    const timeoutId = setTimeout(() => {
      if (pendingConversationIdRef.current === convId) {
        console.log('[AIChat] Timeout - resetting streaming state');
        addMessage('assistant', 'Request timed out. Claude may not be responding.', 'error');
        setStreaming(false);
        pendingConversationIdRef.current = '';
        currentMessageIdRef.current = '';
      }
    }, 210000);

    console.log('[AIChat] Invoking send_claude_message with:', { message: userMessage, conversationId: convId });

    try {
      const result = await invoke('send_claude_message', {
        message: userMessage,
        conversationId: convId,
        workingDir: projectRoot, // Sandbox Claude to project folder
      });
      console.log('[AIChat] invoke returned:', result);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('[AIChat] Failed to send message:', error);
      clearTimeout(timeoutId);
      // Show error in UI
      addMessage('assistant', `Error: ${error}`, 'error');
      setStreaming(false);
      pendingConversationIdRef.current = '';
    }
  };

  // Open terminal for Claude authentication
  const openClaudeAuth = async () => {
    try {
      await invoke('open_claude_auth');
    } catch (error) {
      console.error('Failed to open auth terminal:', error);
    }
  };

  // Handle input keydown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // No Claude available
  if (claudeAvailable === false) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4" style={{ color: theme.warning }}>⚠</div>
          <div className="font-bold mb-2">Claude Code Not Found</div>
          <div className="text-xs leading-relaxed">
            Install Claude Code CLI to enable AI chat.
            <br />
            <a
              href="https://claude.ai/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="underline mt-2 inline-block"
              style={{ color: theme.accent }}
            >
              Get Claude Code →
            </a>
          </div>
          {claudePath && (
            <div className="mt-4 text-xs" style={{ color: theme.textMuted }}>
              Found at: {claudePath}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (claudeAvailable === null) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-2xl mb-2 animate-pulse" style={{ color: theme.accent }}>◆</div>
          <div className="text-xs">Checking Claude...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Conversation tabs + Auth button */}
      <div
        className="flex items-center gap-1 px-2 py-1 overflow-x-auto shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => switchConversation(conv.id)}
            className="px-2 py-1 rounded text-xs whitespace-nowrap transition-colors"
            style={{
              backgroundColor: conv.id === currentConversation?.id ? theme.bgHover : 'transparent',
              color: conv.id === currentConversation?.id ? theme.accent : theme.textMuted,
            }}
          >
            {conv.title}
          </button>
        ))}
        <button
          onClick={() => createConversation()}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ color: theme.textDim }}
        >
          + New
        </button>
        <div className="flex-1" />
        <button
          onClick={openClaudeAuth}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgHover, color: theme.warning }}
          title="Open terminal to sign in with Claude Max"
        >
          Sign In
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!currentConversation || currentConversation.messages.length === 0 ? (
          isStreaming ? (
            // Show thinking indicator when streaming but no messages yet
            <div className="flex gap-2 text-sm">
              <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs"
                style={{ backgroundColor: theme.bgHover, color: theme.accent }}
              >
                ◆
              </div>
              <div
                className="rounded px-3 py-2 text-xs"
                style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                  <span className="ml-2">Claude is thinking...</span>
                </span>
              </div>
            </div>
          ) : !hasProject ? (
            // No project open - prompt to open one first
            <div className="h-full flex items-center justify-center" style={{ color: theme.textDim }}>
              <div className="text-center">
                <div className="text-4xl mb-2" style={{ color: theme.warning }}>◇</div>
                <div className="font-medium">No Project Open</div>
                <div className="text-xs mt-1 max-w-xs">
                  Open a project first to use Claude. Claude will be sandboxed to that project folder.
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center" style={{ color: theme.textDim }}>
              <div className="text-center">
                <div className="text-4xl mb-2" style={{ color: theme.accent }}>◆</div>
                <div className="font-medium">Claude Code</div>
                <div className="text-xs mt-1 max-w-xs">
                  Ask me to create modules, edit Lua files, build UI components, or modify the engine.
                </div>
                <div className="text-xs mt-2" style={{ color: theme.textMuted }}>
                  Working in: {projectRoot}
                </div>
              </div>
            </div>
          )
        ) : (
          currentConversation.messages.map((msg, idx) => (
            <div key={msg.id} className="group">
              <div
                className="flex gap-2 text-sm"
                style={{
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs"
                  style={{
                    backgroundColor: msg.role === 'user' ? theme.accent : theme.bgHover,
                    color: msg.role === 'user' ? theme.bg : theme.accent,
                  }}
                >
                  {msg.role === 'user' ? '@' : '◆'}
                </div>

                {/* Message content */}
                <div
                  className="flex-1 rounded px-3 py-2 text-xs leading-relaxed"
                  style={{
                    backgroundColor: msg.role === 'user' ? theme.accentBg + '50' : theme.bgHover,
                    color: theme.text,
                    maxWidth: '85%',
                  }}
                >
                  {msg.status === 'streaming' && !msg.content ? (
                    <span className="animate-pulse">●●●</span>
                  ) : (
                    <pre className="whitespace-pre-wrap font-[inherit]">{msg.content}</pre>
                  )}
                  {msg.status === 'error' && (
                    <div className="mt-2">
                      <div className="text-xs" style={{ color: theme.error }}>
                        {msg.error}
                      </div>
                      {(msg.content?.includes('authentication') || msg.content?.includes('timed out')) && (
                        <button
                          onClick={openClaudeAuth}
                          className="mt-2 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          style={{ backgroundColor: theme.accent, color: theme.bg }}
                        >
                          Open Terminal to Authenticate
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Branch button */}
                <button
                  onClick={() => branchConversation(idx)}
                  className="opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity p-1"
                  style={{ color: theme.textMuted }}
                  title="Branch from here"
                >
                  ↗
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-3 shrink-0"
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <div
          className="flex gap-2 rounded p-2"
          style={{ backgroundColor: theme.bgHover }}
        >
          <textarea
            ref={inputRef}
            value={inputDraft}
            onChange={(e) => setInputDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasProject ? "Ask Claude..." : "Open a project first..."}
            disabled={isStreaming || !hasProject}
            className="flex-1 bg-transparent outline-none resize-none text-sm"
            style={{ color: theme.text, minHeight: '20px', maxHeight: '120px' }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !inputDraft.trim() || !hasProject}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: isStreaming || !inputDraft.trim() || !hasProject ? theme.bgHover : theme.accent,
              color: isStreaming || !inputDraft.trim() || !hasProject ? theme.textDim : theme.bg,
            }}
          >
            {isStreaming ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties Panel
// ─────────────────────────────────────────────────────────────────────────────

function PropertiesPanel() {
  const theme = useTheme();
  const { selection } = useSelection();
  const { entities } = useEntities();

  const selectedEntity = entities.find((e) => selection.entities.includes(e.id));

  // No selection state
  if (!selectedEntity) {
    return (
      <div className="h-full flex items-center justify-center p-4" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2">⚙</div>
          <div className="text-xs">Select an object to inspect</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {/* Entity Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
      >
        <span className="text-lg">{selectedEntity.glyph}</span>
        <div>
          <div style={{ color: theme.text }}>{selectedEntity.name}</div>
          <div style={{ color: theme.textDim }}>{selectedEntity.type}</div>
        </div>
      </div>

      {/* Transform */}
      <div className="p-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
          Transform
        </div>
        <div className="space-y-1.5">
          <PropertyRow label="Position" value={selectedEntity.position.map((n) => n.toFixed(1)).join(', ')} />
          <PropertyRow
            label="Color"
            value={
              <div
                className="w-4 h-4 rounded border"
                style={{
                  backgroundColor: `rgb(${selectedEntity.color.map((c) => c * 255).join(',')})`,
                  borderColor: theme.border,
                }}
              />
            }
          />
        </div>
      </div>

      {/* Components */}
      <div className="p-3">
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: theme.textMuted }}>
          Components ({selectedEntity.components.length})
        </div>
        {selectedEntity.components.length === 0 ? (
          <div style={{ color: theme.textDim }}>No components</div>
        ) : (
          <div className="space-y-2">
            {selectedEntity.components.map((comp) => (
              <div
                key={comp}
                className="px-2 py-1.5 rounded"
                style={{ backgroundColor: theme.bgHover }}
              >
                <span style={{ color: theme.accent }}>{comp}</span>
                {selectedEntity.componentData[comp] && (
                  <div className="mt-1 space-y-0.5" style={{ color: theme.textMuted }}>
                    {Object.entries(selectedEntity.componentData[comp]).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span style={{ color: theme.text }}>{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: theme.textMuted }}>{label}</span>
      <span style={{ color: theme.text }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Console Panel
// ─────────────────────────────────────────────────────────────────────────────

function ConsolePanel() {
  const theme = useTheme();
  const logs = useEngineState((s) => s.console.logs);
  const clearLogs = useEngineState((s) => s.clearLogs);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'warn': return theme.warning;
      case 'error': return theme.error;
      case 'success': return theme.success;
      default: return theme.textMuted;
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'warn': return '⚠';
      case 'error': return '✕';
      case 'success': return '✓';
      default: return '●';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-2 text-xs">
        {logs.length === 0 ? (
          <div style={{ color: theme.textDim }}>No logs yet</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span style={{ color: theme.textDim }} className="shrink-0">{log.time}</span>
              <span style={{ color: getLogColor(log.type) }} className="shrink-0">
                {getLogIcon(log.type)}
              </span>
              <span style={{ color: log.type === 'error' ? theme.error : theme.text }}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Command input + Clear */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 shrink-0"
        style={{ borderTop: `1px solid ${theme.border}` }}
      >
        <span style={{ color: theme.accent }}>❯</span>
        <input
          type="text"
          placeholder="lua command..."
          className="flex-1 bg-transparent outline-none text-xs"
          style={{ color: theme.text }}
        />
        <button
          onClick={clearLogs}
          className="text-xs px-2 py-0.5 rounded transition-colors"
          style={{ color: theme.textDim }}
          title="Clear console"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Bar
// ─────────────────────────────────────────────────────────────────────────────

function StatusBar() {
  const theme = useTheme();
  const renderSettings = useEngineState((s) => s.renderSettings);
  const template = useEngineState((s) => s.template);
  const cameraMode = useEngineState((s) => s.camera.mode);
  const undoCount = useEngineState((s) => s.session.undoStack.length);
  const canUndoNow = useEngineState((s) => s.canUndo);

  // Get current template info
  const currentTemplate = getTemplate(template.currentId || '');

  // Get render mode name
  const renderModeName = currentTemplate?.render?.mode || cameraMode;

  return (
    <div
      className="h-6 flex items-center justify-between px-3 text-xs shrink-0"
      style={{
        backgroundColor: theme.bgHover,
        borderTop: `1px solid ${theme.border}`,
      }}
    >
      <div className="flex items-center gap-4">
        <span style={{ color: theme.success }}>● WebGPU</span>
        <span style={{ color: theme.textMuted }}>
          Mode: <span style={{ color: theme.accent }}>{renderModeName}</span>
        </span>
        {template.isCustomized && (
          <span style={{ color: theme.warning }}>● Modified</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span style={{ color: theme.textMuted }}>
          Types: {currentTemplate ? Object.keys(currentTemplate.types).length : 0}
        </span>
        <span style={{ color: theme.textMuted }}>
          Shadows: {renderSettings.shadowsEnabled ? 'On' : 'Off'}
        </span>
        <span style={{ color: theme.textMuted }}>
          Undo: {undoCount} {canUndoNow() ? '(Ctrl+Z)' : ''}
        </span>
      </div>
    </div>
  );
}

export default App;
