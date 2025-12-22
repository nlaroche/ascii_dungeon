// ═══════════════════════════════════════════════════════════════════════════
// ASCII Dungeon Engine - Data-Driven Editor with Dockable Panels
// Everything is state. Everything can be modified. Panels can float.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEngineState, useTheme, useChat, useTemplate, useUIScale, useRenderPipeline } from './stores/useEngineState';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ThemeProvider } from './components/ui';
import { DockableLayout, DockAPI } from './components/DockLayout';
import { WebGPUViewport } from './components/WebGPUViewport';
import { MenuBar } from './components/MenuBar';
import { TemplateBrowser } from './components/TemplateBrowser';
import { useProject } from './hooks/useProject';
import { FileEntry } from './lib/filesystem';
import { getTemplate, TemplateDefinition } from './lib/templates';
import { ItemCollection, TypeCollectionPanel } from './components/TypeCollectionPanel';
import { EntitiesPanel, ModeAwarePropertiesPanel } from './components/ModeAwarePanels';
import { RenderPipelinePanel } from './components/render';
import { PalettePanel } from './components/PalettePanel';
import { DragOverlay } from './components/DragOverlay';
import { getFloatingPanelId, isFloatingPanelWindow, isTauri, useFloatingWindows } from './stores/useFloatingWindows';
import { useCodeEditor } from './stores/useCodeEditor';
import { RuntimeInspector } from './components/RuntimeInspector';
import { GameViewPanel } from './components/GameViewPanel';

// Initialize all built-in components (registers them via decorators)
import { initializeComponents } from './scripting';
initializeComponents();

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  // Check if this is a floating panel window
  const floatingPanelId = getFloatingPanelId()

  if (floatingPanelId) {
    // This is a floating panel window - render only the panel content
    return (
      <ThemeProvider>
        <FloatingPanelApp tabId={floatingPanelId} />
      </ThemeProvider>
    )
  }

  // Main application window
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating Panel App - Rendered in child windows
// ─────────────────────────────────────────────────────────────────────────────

function FloatingPanelApp({ tabId }: { tabId: string }) {
  const theme = useTheme()

  // Render content for the specific panel
  const content = useFloatingPanelContent(tabId)

  // Handle re-dock button
  const handleRedock = async () => {
    if (!isTauri()) return
    try {
      // Get current window position
      const [x, y] = await invoke<[number, number, number, number]>('get_floating_window_bounds', { tabId })
      // Request redock at current position
      await invoke('request_redock', { tabId, x, y })
      // Close this window
      await invoke('close_floating_window', { tabId })
    } catch {
      // Redock failed silently
    }
  }

  return (
    <div
      className="h-screen flex flex-col text-sm overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace',
      }}
    >
      {/* Minimal header with redock button */}
      <div
        className="h-7 flex items-center justify-between px-2 shrink-0 select-none"
        style={{ backgroundColor: theme.bgHover, borderBottom: `1px solid ${theme.border}` }}
        data-tauri-drag-region
      >
        <span className="text-xs" style={{ color: theme.textMuted }}>{tabId}</span>
        <button
          onClick={handleRedock}
          className="px-2 py-0.5 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgPanel, color: theme.textMuted }}
          title="Re-dock this panel"
        >
          Dock
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {content}
      </div>
    </div>
  )
}

// Hook to get the content renderer for a floating panel
function useFloatingPanelContent(tabId: string) {
  const { currentId: currentTemplateId } = useTemplate()

  const handleSelectTemplate = useCallback((_template: TemplateDefinition) => {
    // Template selection from floating window - needs to communicate back to main
  }, [])

  // This mirrors the renderTabContent logic from AppContent
  switch (tabId) {
    case 'files':
      return <FileTree />
    case 'entities':
      return <EntitiesPanel />
    case 'items':
      return <ItemCollection />
    case 'triggers':
      return <TypeCollectionPanel typeName="Trigger" />
    case 'lights':
      return <TypeCollectionPanel typeName="Light" />
    case 'assets':
      return <AssetBrowser />
    case 'palette':
      return <PalettePanel />
    case 'templates':
      return (
        <TemplateBrowser
          currentTemplateId={currentTemplateId || undefined}
          onSelectTemplate={handleSelectTemplate}
        />
      )
    case 'components':
      return <TemplatePlaceholder icon="▣" title="Components" description="Browse and manage TypeScript components" />
    case 'scene':
      return <SceneView />
    case 'game':
      return <GameViewPanel />
    case 'code':
      return <CodeEditor />
    case 'chat':
      return <AIChat />
    case 'properties':
      return <ModeAwarePropertiesPanel />
    case 'console':
      return <ConsolePanel />
    case 'render':
      return <RenderPipelinePanel />
    case 'runtime':
      return <RuntimeInspector />
    default:
      return <div className="p-4 text-zinc-500">Unknown panel: {tabId}</div>
  }
}

function AppContent() {
  const theme = useTheme();
  const { scale: uiScale } = useUIScale();
  // Editor mode is handled by mode-aware components that subscribe directly
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

  const handleSelectTemplate = useCallback((template: TemplateDefinition) => {
    applyTemplate(template);
  }, [applyTemplate]);

  // Dock API for adding custom panel tabs
  const [dockApi, setDockApi] = useState<DockAPI | null>(null);


  // Render tab content based on tab ID and editor mode
  const renderTabContent = useCallback((tabId: string) => {
    switch (tabId) {
      // Core panels
      case 'files':
        return <FileTree />;

      case 'entities':
        // Mode-aware: shows NodeTree in Engine mode, EntityCollection in Template mode
        return <EntitiesPanel />;

      case 'items':
        // Template Mode only: show items collection
        return <ItemCollection />;

      case 'triggers':
        // Template Mode only: show triggers collection
        return <TypeCollectionPanel typeName="Trigger" />;

      case 'lights':
        // Template Mode only: show lights collection
        return <TypeCollectionPanel typeName="Light" />;

      case 'assets':
        return <AssetBrowser />;
      case 'palette':
        return <PalettePanel />;
      case 'templates':
        return (
          <TemplateBrowser
            currentTemplateId={currentTemplateId || undefined}
            onSelectTemplate={handleSelectTemplate}
          />
        );
      case 'components':
        return <TemplatePlaceholder icon="▣" title="Components" description="Browse and manage TypeScript components" />;
      case 'scene':
        return <SceneView />;
      case 'game':
        return <GameViewPanel />;
      case 'code':
        return <CodeEditor />;
      case 'chat':
        return <AIChat />;

      case 'properties':
        // Mode-aware: shows full properties in Engine mode, TypeInspector in Template mode
        return <ModeAwarePropertiesPanel />;

      case 'console':
        return <ConsolePanel />;

      case 'render':
        return <RenderPipelinePanel />;

      case 'runtime':
        return <RuntimeInspector />;

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

      {/* Drag overlay - follows cursor when dragging prefabs */}
      <DragOverlay />
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
// File Context Menu
// ─────────────────────────────────────────────────────────────────────────────

interface FileContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry;
  onClose: () => void;
  onOpen: () => void;
  onOpenInVSCode: () => void;
  onRevealInExplorer: () => void;
  onCopyPath: () => void;
  onDelete: () => void;
}

function FileContextMenu({
  x,
  y,
  entry,
  onClose,
  onOpen,
  onOpenInVSCode,
  onRevealInExplorer,
  onCopyPath,
  onDelete,
}: FileContextMenuProps) {
  const theme = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const MenuItem = ({
    label,
    onClick,
    disabled,
    danger,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }) => (
    <button
      onClick={() => {
        if (!disabled) {
          onClick();
          onClose();
        }
      }}
      disabled={disabled}
      className="w-full px-3 py-1.5 text-left text-xs flex justify-between items-center rounded"
      style={{
        color: disabled ? theme.textDim : danger ? theme.error : theme.text,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = theme.bgHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded shadow-lg min-w-[160px]"
      style={{
        left: x,
        top: y,
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
      }}
    >
      {!entry.isDirectory && (
        <>
          <MenuItem label="Open" onClick={onOpen} />
          <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
        </>
      )}
      <MenuItem label="Open in VS Code" onClick={onOpenInVSCode} />
      <MenuItem label="Reveal in File Explorer" onClick={onRevealInExplorer} />
      <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
      <MenuItem label="Copy Path" onClick={onCopyPath} />
      <div className="my-1" style={{ borderTop: `1px solid ${theme.border}` }} />
      <MenuItem label="Delete" onClick={onDelete} danger />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File Tree
// ─────────────────────────────────────────────────────────────────────────────

interface FileContextMenuState {
  x: number;
  y: number;
  entry: FileEntry;
}

function FileTree() {
  const theme = useTheme();
  const selectedFile = useEngineState((s) => s.project.selectedFile);
  const setPath = useEngineState((s) => s.setPath);
  const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(null);

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
      case 'ts': return '◈';
      case 'tsx': return '◈';
      case 'json': return '{ }';
      case 'wgsl': return '◇';
      case 'md': return '≡';
      default: return '○';
    }
  };

  // Open file in code editor
  const openInCodeEditor = useCallback((path: string) => {
    window.dispatchEvent(new CustomEvent('code-editor-open-file', {
      detail: { path }
    }));
  }, []);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleOpenInVSCode = useCallback(async () => {
    if (!contextMenu) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_in_external_editor', { path: contextMenu.entry.path });
    } catch (err) {
      console.error('Failed to open in VS Code:', err);
    }
  }, [contextMenu]);

  const handleRevealInExplorer = useCallback(async () => {
    if (!contextMenu) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reveal_in_file_explorer', { path: contextMenu.entry.path });
    } catch (err) {
      console.error('Failed to reveal in explorer:', err);
    }
  }, [contextMenu]);

  const handleCopyPath = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await navigator.clipboard.writeText(contextMenu.entry.path);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  }, [contextMenu]);

  const handleDelete = useCallback(async () => {
    if (!contextMenu) return;
    const confirmed = window.confirm(`Delete "${contextMenu.entry.name}"?`);
    if (!confirmed) return;
    try {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(contextMenu.entry.path, { recursive: contextMenu.entry.isDirectory });
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }, [contextMenu]);

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
          onDoubleClick={() => {
            if (!entry.isDirectory) {
              openInCodeEditor(entry.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, entry)}
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

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={closeContextMenu}
          onOpen={() => openInCodeEditor(contextMenu.entry.path)}
          onOpenInVSCode={handleOpenInVSCode}
          onRevealInExplorer={handleRevealInExplorer}
          onCopyPath={handleCopyPath}
          onDelete={handleDelete}
        />
      )}
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
  const setPath = useEngineState((s) => s.setPath);

  // 2D editor state
  const tool2D = useEngineState((s) => s.editor2D?.tool || 'pointer');
  const showGrid = useEngineState((s) => s.editor2D?.showGrid ?? true);
  const zoom = useEngineState((s) => s.editor2D?.zoom ?? 100);

  // Post-processing toggle
  const { globalPostProcess, setCRTEnabled } = useRenderPipeline();
  const postProcessEnabled = globalPostProcess.enabled && globalPostProcess.crtEnabled;

  // Force 2D mode on mount
  useEffect(() => {
    setPath(['camera', 'mode'], '2d', 'Initialize 2D mode');
  }, [setPath]);

  // Tool definitions with colors
  const tools = [
    { id: 'pointer', label: 'Pointer', icon: '↖', color: '#4fc3f7' },  // Light blue
    { id: 'select', label: 'Select', icon: '▢', color: '#81c784' },    // Green
    { id: 'draw', label: 'Draw', icon: '✎', color: '#ffb74d' },        // Orange
    { id: 'erase', label: 'Erase', icon: '⌫', color: '#e57373' },      // Red
  ];

  const currentTool = tools.find(t => t.id === tool2D);

  // Get hovered node name from state
  const hoveredNodeId = useEngineState((s) => s.editor2D?.hoveredNode);
  const selectedGlyph = useEngineState((s) => s.editor2D?.selectedGlyph || '@');
  const nodes = useEngineState((s) => s.scene.rootNode?.children || []);

  const findNodeName = (id: string | null): string | null => {
    if (!id) return null;
    const findInNodes = (nodeList: typeof nodes): string | null => {
      for (const node of nodeList) {
        if (node.id === id) return node.name;
        if (node.children) {
          const found = findInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInNodes(nodes);
  };

  const hoveredNodeName = findNodeName(hoveredNodeId || null);

  // Context info based on tool
  const getContextInfo = () => {
    if (tool2D === 'draw') return `Drawing: ${selectedGlyph}`;
    if (tool2D === 'erase') return 'Erasing';
    if (hoveredNodeName) return hoveredNodeName;
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div
        className="h-10 flex items-center gap-2 px-3 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        {/* Tool selector */}
        <div
          className="flex items-center gap-0.5 rounded p-0.5"
          style={{ backgroundColor: theme.bgHover }}
        >
          {tools.map((tool) => {
            const isActive = tool2D === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setPath(['editor2D', 'tool'], tool.id, `Switch to ${tool.label} tool`)}
                className="px-2 py-1 rounded text-sm transition-all"
                style={{
                  backgroundColor: isActive ? `${tool.color}20` : 'transparent',
                  color: isActive ? tool.color : theme.textMuted,
                  border: `1px solid ${isActive ? tool.color : 'transparent'}`,
                  textShadow: isActive ? `0 0 8px ${tool.color}60` : 'none',
                }}
                title={tool.label}
              >
                {tool.icon}
              </button>
            );
          })}
        </div>

        {/* Current tool name and context */}
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: currentTool?.color, fontWeight: 500 }}>
            {currentTool?.label}
          </span>
          {getContextInfo() && (
            <>
              <span style={{ color: theme.textDim }}>·</span>
              <span style={{ color: theme.textMuted }}>{getContextInfo()}</span>
            </>
          )}
        </div>

        <div className="w-px h-5" style={{ backgroundColor: theme.border }} />

        {/* Grid toggle */}
        <button
          onClick={() => setPath(['editor2D', 'showGrid'], !showGrid, showGrid ? 'Hide grid' : 'Show grid')}
          className="px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
          style={{
            backgroundColor: showGrid ? theme.bgHover : 'transparent',
            color: showGrid ? theme.text : theme.textDim,
          }}
          title="Toggle grid visibility"
        >
          <span style={{ fontSize: '10px' }}>▦</span>
          Grid
        </button>

        {/* Post-processing toggle */}
        <button
          onClick={() => setCRTEnabled(!postProcessEnabled)}
          className="px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
          style={{
            backgroundColor: postProcessEnabled ? theme.bgHover : 'transparent',
            color: postProcessEnabled ? theme.text : theme.textDim,
          }}
          title={postProcessEnabled ? 'Disable post-processing effects' : 'Enable post-processing effects'}
        >
          <span style={{ fontSize: '10px' }}>✦</span>
          FX
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPath(['editor2D', 'zoom'], Math.max(25, zoom - 25), 'Zoom out')}
            className="w-6 h-6 rounded text-xs transition-colors flex items-center justify-center"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
            title="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            min="25"
            max="400"
            step="25"
            value={zoom}
            onChange={(e) => setPath(['editor2D', 'zoom'], parseInt(e.target.value), 'Set zoom')}
            className="w-20 h-1 rounded appearance-none cursor-pointer"
            style={{ backgroundColor: theme.border }}
          />
          <button
            onClick={() => setPath(['editor2D', 'zoom'], Math.min(400, zoom + 25), 'Zoom in')}
            className="w-6 h-6 rounded text-xs transition-colors flex items-center justify-center"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setPath(['editor2D', 'zoom'], 100, 'Reset zoom to 100%')}
            className="px-2 py-1 rounded text-xs transition-colors min-w-[45px]"
            style={{
              backgroundColor: zoom === 100 ? theme.accent : theme.bgHover,
              color: zoom === 100 ? theme.bg : theme.textMuted,
            }}
            title="Reset zoom to 100%"
          >
            {zoom}%
          </button>
          <button
            onClick={() => setPath(['editor2D', 'recenterTimestamp'], Date.now(), 'Recenter view')}
            className="px-2 py-1 rounded text-xs transition-colors hover:brightness-125"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
            title="Recenter on content (Home)"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.accent; e.currentTarget.style.color = theme.bg }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.bgHover; e.currentTarget.style.color = theme.textMuted }}
          >
            ⌂
          </button>
        </div>
      </div>

      {/* WebGPU Viewport - 2D only */}
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
  const { tabs, activeTabPath, openFile, closeTab, setActiveTab, updateContent, markSaved, isDirty } = useCodeEditor();
  const activeTab = tabs.find(t => t.path === activeTabPath);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to file open requests (from double-clicking in file tree)
  useEffect(() => {
    const handleOpenFile = async (event: CustomEvent<{ path: string }>) => {
      const { path } = event.detail;

      // Check if already open
      const existingTab = tabs.find(t => t.path === path);
      if (existingTab) {
        setActiveTab(path);
        return;
      }

      // Load the file
      setIsLoading(true);
      setError(null);
      try {
        const { getFileSystem } = await import('./lib/filesystem');
        const fs = await getFileSystem();
        const content = await fs.readFile(path);
        openFile(path, content);
      } catch (err) {
        setError(`Failed to load: ${(err as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('code-editor-open-file', handleOpenFile as EventListener);
    return () => window.removeEventListener('code-editor-open-file', handleOpenFile as EventListener);
  }, [tabs, openFile, setActiveTab]);

  // Save current file
  const handleSave = useCallback(async () => {
    if (!activeTabPath) return;
    const tab = tabs.find(t => t.path === activeTabPath);
    if (!tab) return;

    try {
      const { getFileSystem } = await import('./lib/filesystem');
      const fs = await getFileSystem();
      await fs.writeFile(activeTabPath, tab.content);
      markSaved(activeTabPath);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    }
  }, [activeTabPath, tabs, markSaved]);

  // Handle content change
  const handleChange = useCallback((value: string) => {
    if (activeTabPath) {
      updateContent(activeTabPath, value);
    }
  }, [activeTabPath, updateContent]);

  // Handle tab close (with dirty check)
  const handleCloseTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isDirty(path)) {
      // TODO: Show save prompt
      if (!window.confirm('This file has unsaved changes. Close anyway?')) {
        return;
      }
    }
    closeTab(path);
  }, [closeTab, isDirty]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeTabPath) handleCloseTab(activeTabPath);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCloseTab, activeTabPath]);

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div
          className="flex items-center shrink-0 overflow-x-auto"
          style={{
            backgroundColor: theme.bgPanel,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          {tabs.map(tab => (
            <div
              key={tab.path}
              className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none shrink-0 group"
              style={{
                backgroundColor: tab.path === activeTabPath ? theme.bg : 'transparent',
                borderRight: `1px solid ${theme.border}`,
                color: tab.path === activeTabPath ? theme.text : theme.textDim,
              }}
              onClick={() => setActiveTab(tab.path)}
              title={tab.path}
            >
              <span className="text-xs">{tab.fileName}</span>
              {isDirty(tab.path) && (
                <span className="text-[10px]" style={{ color: theme.warning }}>●</span>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-opacity text-xs"
                onClick={(e) => handleCloseTab(tab.path, e)}
                style={{ color: theme.textMuted }}
              >
                ×
              </button>
            </div>
          ))}
          {/* Save button */}
          {activeTabPath && isDirty(activeTabPath) && (
            <button
              onClick={handleSave}
              className="ml-auto px-2 py-1 mx-2 rounded text-xs shrink-0"
              style={{
                backgroundColor: theme.accent,
                color: theme.bg,
              }}
            >
              Save
            </button>
          )}
        </div>
      )}

      {/* Editor content */}
      {tabs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: theme.textDim }}>
          <div className="text-center">
            <div className="text-4xl mb-2">{'{ }'}</div>
            <div>No files open</div>
            <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
              Double-click a file in the Files panel to open it
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
      ) : activeTab ? (
        <div className="flex-1 min-h-0">
          <MonacoFileEditor
            key={activeTab.path}
            value={activeTab.content}
            onChange={handleChange}
            language={activeTab.language}
          />
        </div>
      ) : null}
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
      })
      .catch(() => {
        setClaudeAvailable(false);
      });
  }, []);

  // Track the conversation ID we're waiting for responses on
  const pendingConversationIdRef = useRef<string>('');

  // Listen for streaming events - use refs for stable callbacks
  useEffect(() => {
    const unlisten = listen<ClaudeStreamEvent>('claude-stream', (event) => {
      const { event_type, content, conversation_id } = event.payload;

      // Make sure this event is for a conversation we're expecting
      // Use the ref instead of currentConversation to avoid race conditions
      if (pendingConversationIdRef.current && conversation_id !== pendingConversationIdRef.current) {
        return;
      }

      switch (event_type) {
        case 'start':
          // Create assistant message placeholder using ref
          const msgId = addMessageRef.current('assistant', '', 'streaming');
          currentMessageIdRef.current = msgId;
          break;

        case 'chunk':
          // Append content to current message (plain text output)
          if (currentMessageIdRef.current) {
            appendToMessageRef.current(currentMessageIdRef.current, content);
          }
          break;

        case 'done':
          // Mark message as complete
          if (currentMessageIdRef.current) {
            updateMessageRef.current(currentMessageIdRef.current, { status: 'complete' });
          }
          setStreamingRef.current(false);
          currentMessageIdRef.current = '';
          pendingConversationIdRef.current = '';
          // File tree will auto-refresh via file watcher
          break;

        case 'error':
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
          // Progress events from stderr - don't show in chat
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []); // Empty deps - listener is stable, uses refs for callbacks

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  // Send message
  const sendMessage = async () => {
    if (!inputDraft.trim() || isStreaming) {
      return;
    }

    // Create conversation if needed
    let convId = currentConversation?.id;
    if (!convId) {
      convId = createConversation('New Chat');
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
        addMessage('assistant', 'Request timed out. Claude may not be responding.', 'error');
        setStreaming(false);
        pendingConversationIdRef.current = '';
        currentMessageIdRef.current = '';
      }
    }, 210000);

    try {
      await invoke('send_claude_message', {
        message: userMessage,
        conversationId: convId,
        workingDir: projectRoot, // Sandbox Claude to project folder
      });
      clearTimeout(timeoutId);
    } catch (error) {
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
    } catch {
      // Auth terminal failed to open
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
