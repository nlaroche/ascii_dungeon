// ═══════════════════════════════════════════════════════════════════════════
// Menu Bar Component
// File menu with New, Open, Save, Recent Projects
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme, useTemplate, useEngineState, useUIScale } from '../stores/useEngineState';
import { useProject, RecentProject } from '../hooks/useProject';
import { AVAILABLE_TEMPLATES, getTemplate } from '../lib/templates';
import { ModeSwitch } from './ModeSwitch';

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

export function MenuBar({ openPanels = [], onOpenPanel }: MenuBarProps) {
  const theme = useTheme();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentId: currentTemplateId, applyTemplate, currentName, isCustomized } = useTemplate();
  const { scale: uiScale, setScale: setUIScale } = useUIScale();
  const template = useEngineState((s) => s.template);
  const currentTemplate = getTemplate(template.currentId || '');

  const {
    createProject,
    openProject,
    saveProject,
    hasProject,
    recentProjects,
    clearRecentProjects,
  } = useProject();

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
              createProject();
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
  }, [createProject, openProject, saveProject, hasProject]);

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
      { label: 'New Project', shortcut: 'Ctrl+Shift+N', action: createProject },
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
