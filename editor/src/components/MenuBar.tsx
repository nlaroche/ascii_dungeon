// ═══════════════════════════════════════════════════════════════════════════
// Menu Bar Component
// File menu with New, Open, Save, Recent Projects
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme, useTemplate, useEngineState, useUIScale, usePlayMode } from '../stores/useEngineState';
import { useProject, RecentProject } from '../hooks/useProject';
import { AVAILABLE_TEMPLATES, getTemplate } from '../lib/templates';
import { ModeSwitch } from './ModeSwitch';
import { PlayModeToolbarCompact } from './PlayModeToolbar';
import { NewProjectDialog, DemoProject } from './NewProjectDialog';

// UI Scale presets
const UI_SCALE_PRESETS = [
  { label: '75%', value: 0.75 },
  { label: '90%', value: 0.9 },
  { label: '100%', value: 1.0 },
  { label: '110%', value: 1.1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Panel Definitions for View Menu
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_DEFINITIONS: Record<string, { icon: string; label: string; category: string }> = {
  // Core panels
  files: { icon: '○', label: 'Files', category: 'Explorer' },
  entities: { icon: '◉', label: 'Entities', category: 'Explorer' },
  items: { icon: '◇', label: 'Items', category: 'Explorer' },
  triggers: { icon: '▢', label: 'Triggers', category: 'Explorer' },
  lights: { icon: '☀', label: 'Lights', category: 'Explorer' },
  assets: { icon: '◈', label: 'Assets', category: 'Explorer' },
  templates: { icon: '◇', label: 'Templates', category: 'Explorer' },
  components: { icon: '▣', label: 'Components', category: 'Explorer' },
  // Editor panels
  scene: { icon: '▦', label: 'Scene', category: 'Editor' },
  code: { icon: '{ }', label: 'Code', category: 'Editor' },
  'node-editor': { icon: '◎', label: 'Node Editor', category: 'Editor' },
  // Utility panels
  properties: { icon: '⚙', label: 'Properties', category: 'Utility' },
  console: { icon: '❯', label: 'Console', category: 'Utility' },
  chat: { icon: '◆', label: 'AI Chat', category: 'Utility' },
  notes: { icon: '✎', label: 'Notes', category: 'Utility' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Menu Item Types
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Bar
// ─────────────────────────────────────────────────────────────────────────────

interface MenuBarProps {
  openPanels?: string[];
  onOpenPanel?: (panelId: string) => void;
}

// Confirmation dialog for folder overwrite
interface OverwriteConfirmation {
  projectDir: string;
  demoId: string | null;
  demoName: string;
}

export function MenuBar({ openPanels = [], onOpenPanel }: MenuBarProps) {
  const theme = useTheme();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [overwriteConfirmation, setOverwriteConfirmation] = useState<OverwriteConfirmation | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentId: currentTemplateId, applyTemplate, currentName, isCustomized } = useTemplate();
  const { scale: uiScale, setScale: setUIScale } = useUIScale();
  const template = useEngineState((s) => s.template);
  const currentTemplate = getTemplate(template.currentId || '');

  const {
    createProject,
    createProjectFromDemo,
    createProjectInFolder,
    openProject,
    saveProject,
    hasProject,
    recentProjects,
    clearRecentProjects,
  } = useProject();

  // Handle demo selection from dialog
  const handleSelectDemo = useCallback(async (demo: DemoProject) => {
    const result = await createProjectFromDemo(demo.id, demo.name);
    if (result && 'needsConfirmation' in result) {
      // Folder has existing content, show confirmation dialog
      setOverwriteConfirmation({
        projectDir: result.projectDir,
        demoId: result.demoId,
        demoName: result.demoName,
      });
    }
  }, [createProjectFromDemo]);

  // Handle overwrite confirmation
  const handleConfirmOverwrite = useCallback(() => {
    if (overwriteConfirmation) {
      createProjectInFolder(
        overwriteConfirmation.projectDir,
        overwriteConfirmation.demoId,
        overwriteConfirmation.demoName
      );
      setOverwriteConfirmation(null);
    }
  }, [overwriteConfirmation, createProjectInFolder]);

  const handleCancelOverwrite = useCallback(() => {
    setOverwriteConfirmation(null);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            if (e.shiftKey) {
              e.preventDefault();
              setShowNewProjectDialog(true);
            }
            break;
          case 'o':
            e.preventDefault();
            openProject();
            break;
          case 's':
            e.preventDefault();
            if (hasProject) saveProject();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openProject, saveProject, hasProject]);

  // Build recent projects submenu
  const recentSubmenu: MenuItem[] = recentProjects.length > 0
    ? [
        ...recentProjects.map((p: RecentProject) => ({
          label: p.name,
          action: () => openProject(p.path),
        })),
        { separator: true, label: '' },
        { label: 'Clear Recent', action: clearRecentProjects },
      ]
    : [{ label: 'No Recent Projects', disabled: true }];

  // Build templates submenu
  const templatesSubmenu: MenuItem[] = AVAILABLE_TEMPLATES.map((t) => ({
    label: `${t.icon} ${t.name}`,
    action: () => applyTemplate(t),
    disabled: t.id === currentTemplateId,
  }));

  // Build UI Scale submenu
  const uiScaleSubmenu: MenuItem[] = UI_SCALE_PRESETS.map((preset) => ({
    label: preset.label + (Math.abs(uiScale - preset.value) < 0.01 ? ' ✓' : ''),
    action: () => setUIScale(preset.value),
    disabled: Math.abs(uiScale - preset.value) < 0.01,
  }));

  // Build view menu with panels grouped by category
  const buildViewMenu = useCallback((): MenuItem[] => {
    const categories = ['Explorer', 'Editor', 'Utility'];
    const items: MenuItem[] = [];

    // UI Scale at the top
    items.push({ label: 'UI Scale', submenu: uiScaleSubmenu });
    items.push({ separator: true, label: '' });

    for (const category of categories) {
      // Add category header
      const categoryPanels = Object.entries(PANEL_DEFINITIONS)
        .filter(([_, def]) => def.category === category);

      if (categoryPanels.length > 0) {
        if (items.length > 2) { // Account for UI Scale items
          items.push({ separator: true, label: '' });
        }

        for (const [id, def] of categoryPanels) {
          const isOpen = openPanels.includes(id);
          items.push({
            label: `${def.icon} ${def.label}`,
            action: () => onOpenPanel?.(id),
            disabled: isOpen,
          });
        }
      }
    }

    // Add layout section
    items.push({ separator: true, label: '' });
    items.push({ label: 'Reset Layout', disabled: true });
    items.push({ label: 'Save Layout...', disabled: true });

    return items;
  }, [openPanels, onOpenPanel, uiScaleSubmenu]);

  // Menu definitions
  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New Project', shortcut: 'Ctrl+Shift+N', action: () => setShowNewProjectDialog(true) },
      { label: 'Open Project...', shortcut: 'Ctrl+O', action: () => openProject() },
      { label: 'Open Recent', submenu: recentSubmenu },
      { separator: true, label: '' },
      { label: 'Save', shortcut: 'Ctrl+S', action: saveProject, disabled: !hasProject },
      { separator: true, label: '' },
      { label: 'Close Project', action: () => window.location.reload(), disabled: !hasProject },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true },
      { label: 'Redo', shortcut: 'Ctrl+Y', disabled: true },
    ],
    Template: [
      { label: 'Switch Template', submenu: templatesSubmenu },
      { separator: true, label: '' },
      { label: 'Browse Templates...', action: () => {
        // This would open the template browser panel
        // For now, just log
        console.log('Open template browser');
      }},
      { separator: true, label: '' },
      { label: 'Create Template...', disabled: true },
      { label: 'Export Template...', disabled: true },
    ],
    View: buildViewMenu(),
    Help: [
      { label: 'Documentation', disabled: true },
      { label: 'About', disabled: true },
    ],
  };

  return (
    <div
      ref={menuRef}
      className="flex items-center justify-between h-7 text-xs select-none px-1"
      style={{
        backgroundColor: theme.bgPanel,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      {/* Left side - menus */}
      <div className="flex items-center">
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === name ? null : name)}
              onMouseEnter={(e) => {
                if (openMenu) setOpenMenu(name);
                e.currentTarget.style.backgroundColor = '#3f3f46';
                e.currentTarget.style.color = '#e4e4e7';
              }}
              onMouseLeave={(e) => {
                if (openMenu !== name) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.textMuted;
                }
              }}
              className="px-3 py-1 transition-colors rounded-sm"
              style={{
                backgroundColor: openMenu === name ? '#3f3f46' : 'transparent',
                color: openMenu === name ? '#e4e4e7' : theme.textMuted,
              }}
            >
              {name}
            </button>

            {openMenu === name && (
              <MenuDropdown
                items={items}
                onClose={() => setOpenMenu(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Center - Play mode controls */}
      <div className="flex items-center">
        <PlayModeToolbarCompact />
      </div>

      {/* Right side - branding and template */}
      <div className="flex items-center gap-2 pr-2">
        {/* Mode switch */}
        <ModeSwitch />

        <span style={{ color: theme.border }}>│</span>

        {/* Template indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: theme.accent }}>{currentTemplate?.icon || '◇'}</span>
          <span style={{ color: theme.textMuted }}>
            {currentName || 'No Template'}
          </span>
          {isCustomized && (
            <span
              className="px-1 rounded text-[10px]"
              style={{ backgroundColor: theme.warning + '30', color: theme.warning }}
            >
              mod
            </span>
          )}
        </div>

        <span style={{ color: theme.border }}>│</span>

        {/* Branding */}
        <span style={{ color: theme.textMuted }} className="tracking-wide">
          <span style={{ color: theme.accent }}>◆</span> ascii_dungeon
        </span>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
        onSelectDemo={handleSelectDemo}
      />

      {/* Overwrite Confirmation Dialog */}
      {overwriteConfirmation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 1001,
          }}
          onClick={handleCancelOverwrite}
        >
          <div
            style={{
              background: theme.bgPanel,
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              maxWidth: '400px',
              width: '90%',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: theme.text }}>
                Folder Not Empty
              </h3>
            </div>

            <p style={{ margin: '0 0 8px', fontSize: '13px', color: theme.textMuted, lineHeight: 1.5 }}>
              The selected folder already contains files:
            </p>
            <code style={{
              display: 'block',
              padding: '8px 12px',
              background: theme.bg,
              borderRadius: '4px',
              fontSize: '11px',
              color: theme.textDim,
              marginBottom: '16px',
              wordBreak: 'break-all',
            }}>
              {overwriteConfirmation.projectDir}
            </code>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: theme.textMuted, lineHeight: 1.5 }}>
              Creating a new project here will overwrite <code>project.json</code>, <code>scene.json</code>, and the <code>palettes/</code> folder. Other files will be kept.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleCancelOverwrite}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  color: theme.textMuted,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverwrite}
                style={{
                  padding: '8px 20px',
                  background: theme.warning || '#f59e0b',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#000',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Replace & Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface MenuDropdownProps {
  items: MenuItem[];
  onClose: () => void;
}

function MenuDropdown({ items, onClose }: MenuDropdownProps) {
  const theme = useTheme();
  const [hoveredSubmenu, setHoveredSubmenu] = useState<string | null>(null);

  // Brighter hover color for better visibility
  const hoverBg = '#52525b';  // zinc-600
  const menuBg = '#27272a';   // zinc-800 - slightly lighter than panel
  const menuBorder = '#52525b'; // zinc-600

  return (
    <div
      className="absolute left-0 top-full z-50 min-w-48 rounded-md"
      style={{
        backgroundColor: menuBg,
        border: `1px solid ${menuBorder}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)',
        padding: '4px',
      }}
    >
      {items.map((item, idx) =>
        item.separator ? (
          <div
            key={idx}
            className="my-1 mx-2"
            style={{ borderTop: `1px solid ${theme.border}`, height: '1px' }}
          />
        ) : (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => item.submenu && setHoveredSubmenu(item.label)}
            onMouseLeave={() => setHoveredSubmenu(null)}
          >
            <button
              onClick={() => {
                if (item.action && !item.disabled) {
                  item.action();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className="w-full h-7 px-3 text-left flex items-center justify-between transition-colors rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: 'transparent',
                color: item.disabled ? theme.textDim : theme.text,
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.backgroundColor = hoverBg;
                  e.currentTarget.style.color = theme.accent;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = item.disabled ? theme.textDim : theme.text;
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="ml-4 text-[10px]" style={{ color: theme.textDim }}>{item.shortcut}</span>
              )}
              {item.submenu && (
                <span style={{ color: theme.textMuted }}>▸</span>
              )}
            </button>

            {item.submenu && hoveredSubmenu === item.label && (
              <div
                className="absolute left-full top-0 min-w-40 rounded-md"
                style={{
                  backgroundColor: menuBg,
                  border: `1px solid ${menuBorder}`,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)',
                  padding: '4px',
                  marginLeft: '4px',
                }}
              >
                {item.submenu.map((subitem, subidx) =>
                  subitem.separator ? (
                    <div
                      key={subidx}
                      className="my-1 mx-2"
                      style={{ borderTop: `1px solid ${theme.border}`, height: '1px' }}
                    />
                  ) : (
                    <button
                      key={subitem.label}
                      onClick={() => {
                        if (subitem.action && !subitem.disabled) {
                          subitem.action();
                          onClose();
                        }
                      }}
                      disabled={subitem.disabled}
                      className="w-full h-7 px-3 text-left flex items-center transition-colors rounded text-xs whitespace-nowrap"
                      style={{
                        backgroundColor: 'transparent',
                        color: subitem.disabled ? theme.textDim : theme.text,
                        opacity: subitem.disabled ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!subitem.disabled) {
                          e.currentTarget.style.backgroundColor = hoverBg;
                          e.currentTarget.style.color = theme.accent;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = subitem.disabled ? theme.textDim : theme.text;
                      }}
                    >
                      {subitem.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
