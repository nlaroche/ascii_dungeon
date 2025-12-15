// ═══════════════════════════════════════════════════════════════════════════
// Component Browser - Interactive Lua UI component explorer
// Browse components, view docs, write code, and see live previews
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme, useEngineState } from '../stores/useEngineState';
import {
  UI_COMPONENTS,
  UIComponentMeta,
  getCategories,
  getComponentsByCategory,
} from '../lib/lua/ui-components';
import { LUA_TEMPLATES, UIDefinition, runLuaUI } from '../lib/lua/bindings';
import { loadLuaFile, findLuaFiles } from '../lib/lua/loader';
import { saveCustomPanel, PANEL_TEMPLATES } from '../lib/lua/panels';
import { LuaCodeEditor } from './editor/LuaCodeEditor';

// ─────────────────────────────────────────────────────────────────────────────
// Category Icons
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  layout: '▦',
  display: '◈',
  input: '◉',
  feedback: '◍',
  data: '◎',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  layout: 'Containers and structural components',
  display: 'Text, icons, and visual elements',
  input: 'Buttons, inputs, and interactive controls',
  feedback: 'Loading, progress, and status indicators',
  data: 'Lists, trees, and data displays',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component Browser
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentBrowserProps {
  onPanelSaved?: (panelId: string) => void;
}

export function ComponentBrowser({ onPanelSaved }: ComponentBrowserProps) {
  const theme = useTheme();
  const projectRoot = useEngineState((s) => s.project.root);
  const [selectedCategory, setSelectedCategory] = useState<string>('layout');
  const [selectedComponent, setSelectedComponent] = useState<UIComponentMeta | null>(null);
  const [code, setCode] = useState<string>(LUA_TEMPLATES.simplePanel);
  const [uiDefinition, setUiDefinition] = useState<UIDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'browse' | 'playground' | 'files'>('browse');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const categories = useMemo(() => getCategories(), []);

  // Load project Lua files when switching to files view
  useEffect(() => {
    if (view === 'files' && projectRoot) {
      setLoadingFiles(true);
      findLuaFiles(projectRoot, true)
        .then(setProjectFiles)
        .finally(() => setLoadingFiles(false));
    }
  }, [view, projectRoot]);

  // Run Lua code whenever it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const result = runLuaUI(code);
        setUiDefinition(result);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        setUiDefinition(null);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [code]);

  // When selecting a component, show its example code
  const handleSelectComponent = useCallback((component: UIComponentMeta) => {
    setSelectedComponent(component);
    // Wrap the example in a return statement if needed
    const exampleCode = component.example.trim().startsWith('return')
      ? component.example
      : `return ${component.example}`;
    setCode(exampleCode);
  }, []);

  // Load a template
  const handleLoadTemplate = useCallback((templateCode: string) => {
    setCode(templateCode);
    setSelectedComponent(null);
  }, []);

  // Load a file from the project
  const handleLoadFile = useCallback(async (filePath: string) => {
    const result = await loadLuaFile(filePath, false);
    setCode(result.content);
    setSelectedComponent(null);
    setView('playground');
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header with view toggle */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div
          className="flex rounded p-0.5"
          style={{ backgroundColor: theme.bgHover }}
        >
          <button
            onClick={() => setView('browse')}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: view === 'browse' ? theme.accent : 'transparent',
              color: view === 'browse' ? theme.bg : theme.textMuted,
            }}
          >
            Browse
          </button>
          <button
            onClick={() => setView('playground')}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: view === 'playground' ? theme.accent : 'transparent',
              color: view === 'playground' ? theme.bg : theme.textMuted,
            }}
          >
            Playground
          </button>
          <button
            onClick={() => setView('files')}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: view === 'files' ? theme.accent : 'transparent',
              color: view === 'files' ? theme.bg : theme.textMuted,
            }}
          >
            Files
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: theme.textDim }}>
          {Object.keys(UI_COMPONENTS).length} components
        </span>
      </div>

      {view === 'browse' ? (
        <BrowseView
          categories={categories}
          selectedCategory={selectedCategory}
          selectedComponent={selectedComponent}
          onSelectCategory={setSelectedCategory}
          onSelectComponent={handleSelectComponent}
          code={code}
          onCodeChange={setCode}
          uiDefinition={uiDefinition}
          error={error}
        />
      ) : view === 'playground' ? (
        <PlaygroundView
          code={code}
          onCodeChange={setCode}
          uiDefinition={uiDefinition}
          error={error}
          onLoadTemplate={handleLoadTemplate}
          onPanelSaved={onPanelSaved}
        />
      ) : (
        <FilesView
          projectRoot={projectRoot}
          files={projectFiles}
          loading={loadingFiles}
          onLoadFile={handleLoadFile}
          onRefresh={() => {
            if (projectRoot) {
              setLoadingFiles(true);
              findLuaFiles(projectRoot, true)
                .then(setProjectFiles)
                .finally(() => setLoadingFiles(false));
            }
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Browse View - Explore components by category
// ─────────────────────────────────────────────────────────────────────────────

interface BrowseViewProps {
  categories: string[];
  selectedCategory: string;
  selectedComponent: UIComponentMeta | null;
  onSelectCategory: (cat: string) => void;
  onSelectComponent: (comp: UIComponentMeta) => void;
  code: string;
  onCodeChange: (code: string) => void;
  uiDefinition: UIDefinition | null;
  error: string | null;
}

function BrowseView({
  categories,
  selectedCategory,
  selectedComponent,
  onSelectCategory,
  onSelectComponent,
  code,
  onCodeChange,
  uiDefinition: _uiDefinition,
  error: _error,
}: BrowseViewProps) {
  const theme = useTheme();
  const componentsInCategory = useMemo(
    () => getComponentsByCategory(selectedCategory),
    [selectedCategory]
  );

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar - Categories & Components */}
      <div
        className="w-48 flex flex-col shrink-0"
        style={{ borderRight: `1px solid ${theme.border}` }}
      >
        {/* Categories */}
        <div className="p-2 space-y-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className="w-full px-2 py-1.5 rounded text-xs text-left flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: selectedCategory === cat ? theme.bgHover : 'transparent',
                color: selectedCategory === cat ? theme.accent : theme.textMuted,
              }}
            >
              <span>{CATEGORY_ICONS[cat] || '◇'}</span>
              <span className="capitalize">{cat}</span>
              <span
                className="ml-auto text-[10px]"
                style={{ color: theme.textDim }}
              >
                {getComponentsByCategory(cat).length}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: theme.border, margin: '4px 8px' }} />

        {/* Components in category */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {componentsInCategory.map((comp) => (
            <button
              key={comp.name}
              onClick={() => onSelectComponent(comp)}
              className="w-full px-2 py-1.5 rounded text-xs text-left transition-colors"
              style={{
                backgroundColor: selectedComponent?.name === comp.name ? theme.accentBg + '50' : 'transparent',
                color: selectedComponent?.name === comp.name ? theme.accent : theme.text,
              }}
            >
              <div className="font-mono">{comp.name}</div>
              <div
                className="text-[10px] truncate mt-0.5"
                style={{ color: theme.textMuted }}
              >
                {comp.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right side - Details & Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedComponent ? (
          <>
            {/* Component header */}
            <div
              className="px-4 py-3 shrink-0"
              style={{ borderBottom: `1px solid ${theme.border}` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] uppercase"
                  style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
                >
                  {selectedComponent.category}
                </span>
                <span className="font-mono font-medium" style={{ color: theme.accent }}>
                  ui.{selectedComponent.name}
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
                {selectedComponent.description}
              </div>
            </div>

            {/* Props documentation */}
            <div
              className="px-4 py-2 shrink-0 max-h-32 overflow-y-auto"
              style={{ borderBottom: `1px solid ${theme.border}` }}
            >
              <div
                className="text-[10px] uppercase tracking-wider mb-2"
                style={{ color: theme.textDim }}
              >
                Props
              </div>
              <div className="space-y-1">
                {selectedComponent.props.map((prop) => (
                  <div key={prop.name} className="flex items-start gap-2 text-xs">
                    <span className="font-mono" style={{ color: theme.warning }}>
                      {prop.name}
                      {prop.required && <span style={{ color: theme.error }}>*</span>}
                    </span>
                    <span style={{ color: theme.textDim }}>:</span>
                    <span className="font-mono" style={{ color: theme.accent }}>
                      {prop.type}
                    </span>
                    {prop.default !== undefined && (
                      <span style={{ color: theme.textMuted }}>
                        = {JSON.stringify(prop.default)}
                      </span>
                    )}
                    <span className="flex-1 truncate" style={{ color: theme.textMuted }}>
                      — {prop.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code editor & Preview split */}
            <div className="flex-1 min-h-0">
              <LuaCodeEditor
                value={code}
                onChange={onCodeChange}
                showPreview={true}
                previewPosition="right"
              />
            </div>
          </>
        ) : (
          /* No component selected */
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center" style={{ color: theme.textDim }}>
              <div className="text-4xl mb-2">{CATEGORY_ICONS[selectedCategory] || '◇'}</div>
              <div className="font-medium capitalize">{selectedCategory}</div>
              <div className="text-xs mt-1">
                {CATEGORY_DESCRIPTIONS[selectedCategory]}
              </div>
              <div className="text-xs mt-4" style={{ color: theme.textMuted }}>
                Select a component to see details
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Playground View - Free-form Lua editor with preview
// ─────────────────────────────────────────────────────────────────────────────

interface PlaygroundViewProps {
  code: string;
  onCodeChange: (code: string) => void;
  uiDefinition: UIDefinition | null;
  error: string | null;
  onLoadTemplate: (code: string) => void;
  onPanelSaved?: (panelId: string) => void;
}

function PlaygroundView({
  code,
  onCodeChange,
  uiDefinition: _uiDefinition,
  error,
  onLoadTemplate,
  onPanelSaved,
}: PlaygroundViewProps) {
  const theme = useTheme();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [panelName, setPanelName] = useState('');
  const [panelIcon, setPanelIcon] = useState('📝');

  const handleSavePanel = useCallback(() => {
    if (!panelName.trim() || !code.trim()) return;

    const panel = saveCustomPanel({
      name: panelName.trim(),
      icon: panelIcon,
      luaCode: code,
    });

    setShowSaveDialog(false);
    setPanelName('');
    onPanelSaved?.(panel.id);
  }, [panelName, panelIcon, code, onPanelSaved]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Template buttons */}
      <div
        className="px-3 py-2 flex items-center gap-2 shrink-0 flex-wrap"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <span className="text-xs" style={{ color: theme.textDim }}>
          UI:
        </span>
        <button
          onClick={() => onLoadTemplate(LUA_TEMPLATES.simplePanel)}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          Panel
        </button>
        <button
          onClick={() => onLoadTemplate(LUA_TEMPLATES.formExample)}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          Form
        </button>
        <button
          onClick={() => onLoadTemplate(LUA_TEMPLATES.listExample)}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          List
        </button>
        <span className="text-xs ml-2" style={{ color: theme.textDim }}>
          Panels:
        </span>
        {Object.entries(PANEL_TEMPLATES).map(([key, template]) => (
          <button
            key={key}
            onClick={() => onLoadTemplate(template.code)}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
          >
            {template.icon} {template.name}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={!code.trim() || !!error}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{
            backgroundColor: !code.trim() || error ? theme.bgHover : theme.accent,
            color: !code.trim() || error ? theme.textDim : theme.bg,
          }}
        >
          Save as Tab
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div
          className="px-3 py-2 flex items-center gap-2 shrink-0"
          style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
        >
          <span className="text-xs" style={{ color: theme.textMuted }}>Name:</span>
          <input
            type="text"
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            placeholder="My Panel"
            className="px-2 py-1 rounded text-xs outline-none"
            style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
            autoFocus
          />
          <span className="text-xs" style={{ color: theme.textMuted }}>Icon:</span>
          <input
            type="text"
            value={panelIcon}
            onChange={(e) => setPanelIcon(e.target.value)}
            className="px-2 py-1 rounded text-xs outline-none w-12 text-center"
            style={{ backgroundColor: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
          />
          <button
            onClick={handleSavePanel}
            disabled={!panelName.trim()}
            className="px-3 py-1 rounded text-xs"
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            Save
          </button>
          <button
            onClick={() => setShowSaveDialog(false)}
            className="px-2 py-1 rounded text-xs"
            style={{ color: theme.textMuted }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Monaco Editor with Live Preview */}
      <div className="flex-1 min-h-0">
        <LuaCodeEditor
          value={code}
          onChange={onCodeChange}
          showPreview={true}
          previewPosition="right"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Files View - Browse project Lua files
// ─────────────────────────────────────────────────────────────────────────────

interface FilesViewProps {
  projectRoot: string | null;
  files: string[];
  loading: boolean;
  onLoadFile: (path: string) => void;
  onRefresh: () => void;
}

function FilesView({
  projectRoot,
  files,
  loading,
  onLoadFile,
  onRefresh,
}: FilesViewProps) {
  const theme = useTheme();

  if (!projectRoot) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center" style={{ color: theme.textDim }}>
          <div className="text-4xl mb-2">◇</div>
          <div className="font-medium">No Project Open</div>
          <div className="text-xs mt-1">
            Open a project to browse Lua files
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center" style={{ color: theme.textDim }}>
          <div className="text-2xl mb-2 animate-pulse" style={{ color: theme.accent }}>◈</div>
          <div className="text-xs">Scanning for Lua files...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <span className="text-xs" style={{ color: theme.textMuted }}>
          {files.length} Lua files in project
        </span>
        <button
          onClick={onRefresh}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
        >
          Refresh
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="text-center py-8" style={{ color: theme.textDim }}>
            <div className="text-2xl mb-2">◇</div>
            <div className="text-xs">No Lua files found</div>
            <div className="text-[10px] mt-1" style={{ color: theme.textMuted }}>
              Create .lua files in your project to see them here
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((filePath) => {
              // Get relative path from project root
              const relativePath = projectRoot
                ? filePath.replace(projectRoot, '').replace(/^[/\\]/, '')
                : filePath;
              const fileName = filePath.split('/').pop() || filePath;

              return (
                <button
                  key={filePath}
                  onClick={() => onLoadFile(filePath)}
                  className="w-full px-3 py-2 rounded text-xs text-left transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: theme.bgHover,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: theme.warning }}>◈</span>
                    <span className="font-mono" style={{ color: theme.text }}>
                      {fileName}
                    </span>
                  </div>
                  <div
                    className="text-[10px] mt-0.5 ml-5 truncate"
                    style={{ color: theme.textMuted }}
                  >
                    {relativePath}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-3 py-2 text-[10px] shrink-0"
        style={{ borderTop: `1px solid ${theme.border}`, backgroundColor: theme.bgHover }}
      >
        <span style={{ color: theme.textDim }}>
          Click a file to load it into the Playground editor
        </span>
      </div>
    </div>
  );
}

export default ComponentBrowser;
