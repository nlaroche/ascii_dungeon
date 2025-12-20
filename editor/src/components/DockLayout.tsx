// Dockable panel layout using rc-dock
// Supports dragging tabs to float, splitting, and re-docking
// In Tauri: floating creates native windows
// In Web: uses rc-dock's built-in floating divs

import { useRef, useCallback, useEffect, ReactNode } from 'react';
import DockLayout, { LayoutData, TabData, TabGroup, PanelData, BoxData, DockContext } from 'rc-dock';
import { useEngineState, useEditorMode } from '../stores/useEngineState';
import { useFloatingWindows, isTauri } from '../stores/useFloatingWindows';
import '../styles/dock.css';

// Mode-aware tab title for entities/nodes tab
function EntitiesTabTitle() {
  const { isTemplateMode } = useEditorMode();
  return (
    <span className="dock-tab-title">
      <span className="dock-tab-icon">{isTemplateMode ? '◉' : '○'}</span>
      <span>{isTemplateMode ? 'Entities' : 'Nodes'}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface DockablePanelProps {
  renderContent: (tabId: string) => ReactNode;
  onLayoutChange?: (layout: LayoutData) => void;
  onDockReady?: (api: DockAPI) => void;
}

// API for programmatically manipulating the dock
export interface DockAPI {
  addTab: (tabId: string, targetPanel?: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab definitions with icons - includes all template-specific panels
// ═══════════════════════════════════════════════════════════════════════════

const TAB_DEFINITIONS: Record<string, { icon: string; label: string }> = {
  // Core panels
  files: { icon: '○', label: 'Files' },
  entities: { icon: '◉', label: 'Entities' },
  items: { icon: '◇', label: 'Items' },
  triggers: { icon: '▢', label: 'Triggers' },
  lights: { icon: '☀', label: 'Lights' },
  assets: { icon: '◈', label: 'Assets' },
  palette: { icon: '◐', label: 'Palette' },
  templates: { icon: '◇', label: 'Templates' },
  components: { icon: '▣', label: 'Components' },
  'node-editor': { icon: '◎', label: 'Node Editor' },
  scene: { icon: '▦', label: 'Scene' },
  game: { icon: '▶', label: 'Game' },
  code: { icon: '{ }', label: 'Code' },
  chat: { icon: '◆', label: 'AI Chat' },
  notes: { icon: '✎', label: 'Note taking' },
  properties: { icon: '⚙', label: 'Properties' },
  console: { icon: '❯', label: 'Console' },
  render: { icon: '◐', label: 'Render' },

  // Deckbuilder panels
  cards: { icon: '🃏', label: 'Cards' },
  decks: { icon: '📚', label: 'Decks' },
  'card-designer': { icon: '🎨', label: 'Card Designer' },
  playtest: { icon: '▶', label: 'Play Test' },

  // Visual Novel panels
  characters: { icon: '👤', label: 'Characters' },
  scenes: { icon: '🎬', label: 'Scenes' },
  'script-editor': { icon: '📝', label: 'Script' },
  flowchart: { icon: '🔀', label: 'Flow' },
  preview: { icon: '👁', label: 'Preview' },
};

// ═══════════════════════════════════════════════════════════════════════════
// Template-specific Layouts
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATE_LAYOUTS: Record<string, () => LayoutData> = {
  // Isometric RPG layout
  'isometric-rpg': () => ({
    dockbox: {
      mode: 'horizontal',
      children: [
        // Left sidebar
        {
          mode: 'vertical',
          size: 250,
          children: [
            {
              tabs: [
                { id: 'entities', title: 'Entities', group: 'default' },
                { id: 'files', title: 'Files', group: 'default' },
              ],
              activeId: 'entities',
            } as PanelData,
          ],
        } as BoxData,
        // Main center area
        {
          mode: 'vertical',
          size: 1000,
          children: [
            {
              size: 700,
              tabs: [
                { id: 'scene', title: 'Scene', group: 'default' },
                { id: 'game', title: 'Game', group: 'default' },
                { id: 'code', title: 'Code', group: 'default' },
              ],
              activeId: 'scene',
            } as PanelData,
            {
              size: 180,
              tabs: [
                { id: 'console', title: 'Console', group: 'default' },
              ],
              activeId: 'console',
            } as PanelData,
          ],
        } as BoxData,
        // Right inspector
        {
          mode: 'vertical',
          size: 320,
          children: [
            {
              tabs: [
                { id: 'properties', title: 'Properties', group: 'default' },
                { id: 'render', title: 'Render', group: 'default' },
                { id: 'chat', title: 'AI Chat', group: 'default' },
              ],
              activeId: 'properties',
            } as PanelData,
          ],
        } as BoxData,
      ],
    },
  }),

  // Deckbuilder layout
  'deckbuilder': () => ({
    dockbox: {
      mode: 'horizontal',
      children: [
        // Left sidebar - cards
        {
          mode: 'vertical',
          size: 280,
          children: [
            {
              tabs: [
                { id: 'files', title: 'Files', group: 'default' },
                { id: 'cards', title: 'Cards', group: 'default' },
              ],
              activeId: 'cards',
            } as PanelData,
          ],
        } as BoxData,
        // Main center area - card designer
        {
          mode: 'vertical',
          size: 1000,
          children: [
            {
              size: 700,
              tabs: [
                { id: 'scene', title: 'Table', group: 'default' },
                { id: 'card-designer', title: 'Card Designer', group: 'default' },
              ],
              activeId: 'card-designer',
            } as PanelData,
            {
              size: 200,
              tabs: [
                { id: 'console', title: 'Console', group: 'default' },
                { id: 'playtest', title: 'Play Test', group: 'default' },
              ],
              activeId: 'playtest',
            } as PanelData,
          ],
        } as BoxData,
        // Right - decks and properties
        {
          mode: 'vertical',
          size: 320,
          children: [
            {
              tabs: [
                { id: 'properties', title: 'Properties', group: 'default' },
                { id: 'decks', title: 'Decks', group: 'default' },
                { id: 'chat', title: 'AI Chat', group: 'default' },
              ],
              activeId: 'decks',
            } as PanelData,
          ],
        } as BoxData,
      ],
    },
  }),

  // Visual Novel layout
  'visual-novel': () => ({
    dockbox: {
      mode: 'horizontal',
      children: [
        // Left sidebar - characters and scenes
        {
          mode: 'vertical',
          size: 250,
          children: [
            {
              tabs: [
                { id: 'files', title: 'Files', group: 'default' },
                { id: 'characters', title: 'Characters', group: 'default' },
                { id: 'scenes', title: 'Scenes', group: 'default' },
              ],
              activeId: 'characters',
            } as PanelData,
          ],
        } as BoxData,
        // Main center area - script editor
        {
          mode: 'vertical',
          size: 1000,
          children: [
            {
              size: 700,
              tabs: [
                { id: 'scene', title: 'Preview', group: 'default' },
                { id: 'script-editor', title: 'Script', group: 'default' },
              ],
              activeId: 'script-editor',
            } as PanelData,
            {
              size: 200,
              tabs: [
                { id: 'console', title: 'Console', group: 'default' },
                { id: 'preview', title: 'Quick Preview', group: 'default' },
              ],
              activeId: 'console',
            } as PanelData,
          ],
        } as BoxData,
        // Right - flowchart and properties
        {
          mode: 'vertical',
          size: 350,
          children: [
            {
              tabs: [
                { id: 'properties', title: 'Properties', group: 'default' },
                { id: 'flowchart', title: 'Flow', group: 'default' },
                { id: 'chat', title: 'AI Chat', group: 'default' },
              ],
              activeId: 'flowchart',
            } as PanelData,
          ],
        } as BoxData,
      ],
    },
  }),
};

// Default fallback layout
const createDefaultLayout = (): LayoutData => TEMPLATE_LAYOUTS['isometric-rpg']();

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function DockableLayout({ renderContent, onLayoutChange, onDockReady }: DockablePanelProps) {
  const dockRef = useRef<DockLayout>(null);
  const currentTemplateId = useEngineState((s) => s.template.currentId);
  const prevTemplateIdRef = useRef<string | null>(currentTemplateId);

  // Track cursor position for floating window placement
  const cursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track cursor position during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorPosRef.current = { x: e.screenX, y: e.screenY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Floating windows management (only used in Tauri)
  const { createFloatingWindow, closeFloatingWindow, isFloating, initialize: initFloatingWindows } = useFloatingWindows();

  // Tab definitions - static only (no custom Lua panels)
  const allTabDefs = TAB_DEFINITIONS;

  // Track panels we've already converted to native windows (to avoid re-processing)
  const convertedToNativeRef = useRef<Set<string>>(new Set());

  // Store original panel info for re-docking tabs to their original position
  // Includes sibling tab IDs so we can find the panel even if IDs change
  const originalPositionsRef = useRef<Map<string, { siblingTabIds: string[]; index: number }>>(new Map());

  // Keep track of previous layout to find where tabs came from
  const previousLayoutRef = useRef<LayoutData | null>(null);

  // Helper to find a tab's panel in a layout and return sibling info
  const findTabPanel = useCallback((layout: LayoutData, tabId: string): { siblingTabIds: string[]; tabIndex: number } | null => {
    const searchBox = (box: BoxData | PanelData): { siblingTabIds: string[]; tabIndex: number } | null => {
      if ('tabs' in box && box.tabs) {
        // This is a panel
        const tabIndex = box.tabs.findIndex(t => t.id === tabId);
        if (tabIndex !== -1) {
          // Return all sibling tab IDs (excluding the one being floated)
          const siblingTabIds = box.tabs
            .map(t => t.id as string)
            .filter(id => id !== tabId);
          return { siblingTabIds, tabIndex };
        }
      }
      if ('children' in box && box.children) {
        // This is a box with children
        for (const child of box.children) {
          const result = searchBox(child as BoxData | PanelData);
          if (result) return result;
        }
      }
      return null;
    };

    if (layout.dockbox) {
      return searchBox(layout.dockbox as BoxData);
    }
    return null;
  }, []);

  // Helper to find a panel containing a specific tab ID in current layout
  const findPanelWithTab = useCallback((tabId: string): PanelData | null => {
    if (!dockRef.current) return null;
    const layout = dockRef.current.getLayout();

    const searchBox = (box: BoxData | PanelData): PanelData | null => {
      if ('tabs' in box && box.tabs) {
        if (box.tabs.some(t => t.id === tabId)) {
          return box as PanelData;
        }
      }
      if ('children' in box && box.children) {
        for (const child of box.children) {
          const result = searchBox(child as BoxData | PanelData);
          if (result) return result;
        }
      }
      return null;
    };

    if (layout.dockbox) {
      return searchBox(layout.dockbox as BoxData);
    }
    return null;
  }, []);

  // Initialize floating windows system
  useEffect(() => {
    if (isTauri()) {
      initFloatingWindows();
    }
  }, [initFloatingWindows]);

  // Listen for redock events from floating windows
  useEffect(() => {
    console.log('[DockLayout] Setting up redock event listener');

    const handleRedock = (event: CustomEvent<{ tabId: string }>) => {
      console.log('[DockLayout] *** RECEIVED redock event ***', event.detail);
      const { tabId } = event.detail;
      console.log('[DockLayout] Redock requested for tab:', tabId);

      if (!dockRef.current) return;

      // Clear from converted set so it can float again
      convertedToNativeRef.current.delete(tabId);

      // Get the original position info
      const originalPos = originalPositionsRef.current.get(tabId);

      // Get current layout and add tab back to the right panel
      const currentLayout = dockRef.current.getLayout();

      // Helper to find and modify a panel in the layout tree
      const addTabToPanel = (box: BoxData | PanelData, siblingIds: string[]): boolean => {
        if ('tabs' in box && box.tabs) {
          // Check if this panel contains any of the siblings
          const hasSibling = box.tabs.some(t => siblingIds.includes(t.id as string));
          if (hasSibling) {
            // Add our tab to this panel
            box.tabs.push({
              id: tabId,
              title: tabId,
              group: 'default',
            } as TabData);
            console.log('[DockLayout] Added tab to panel with siblings');
            return true;
          }
        }
        if ('children' in box && box.children) {
          for (const child of box.children) {
            if (addTabToPanel(child as BoxData | PanelData, siblingIds)) {
              return true;
            }
          }
        }
        return false;
      };

      let added = false;
      if (originalPos && originalPos.siblingTabIds.length > 0 && currentLayout.dockbox) {
        added = addTabToPanel(currentLayout.dockbox as BoxData, originalPos.siblingTabIds);
      }

      if (!added) {
        // Fallback: add to first panel in the layout
        const addToFirstPanel = (box: BoxData | PanelData): boolean => {
          if ('tabs' in box && box.tabs) {
            box.tabs.push({
              id: tabId,
              title: tabId,
              group: 'default',
            } as TabData);
            return true;
          }
          if ('children' in box && box.children) {
            for (const child of box.children) {
              if (addToFirstPanel(child as BoxData | PanelData)) {
                return true;
              }
            }
          }
          return false;
        };

        if (currentLayout.dockbox) {
          addToFirstPanel(currentLayout.dockbox as BoxData);
        }
        console.log('[DockLayout] Added tab to first available panel (fallback)');
      }

      // Load the modified layout
      dockRef.current.loadLayout(currentLayout);
      console.log('[DockLayout] Layout updated with re-docked tab');

      // Clean up stored position
      originalPositionsRef.current.delete(tabId);
    };

    window.addEventListener('floating-panel-redock', handleRedock as EventListener);
    return () => window.removeEventListener('floating-panel-redock', handleRedock as EventListener);
  }, []);

  // Create and expose the dock API
  useEffect(() => {
    if (!onDockReady || !dockRef.current) return;

    const api: DockAPI = {
      addTab: (tabId: string) => {
        if (!dockRef.current) return;

        const newTab: TabData = {
          id: tabId,
          title: tabId,
          group: 'default',
          content: <></>, // Content is rendered via loadTab
        };

        // Try to find a panel to add to
        dockRef.current.dockMove(newTab, null, 'float');
      },
    };

    onDockReady(api);
  }, [onDockReady]);

  // Tab group configuration
  const groups: Record<string, TabGroup> = {
    default: {
      // Always allow floating - we intercept in onLayoutChange for Tauri
      floatable: true,
      // Allow tabs to be maximized
      maximizable: true,
      // Animation
      animated: true,
    },
  };

  // Load tab content
  const loadTab = useCallback((tab: TabData): TabData => {
    const tabId = tab.id as string;
    const def = allTabDefs[tabId] || { icon: '○', label: tabId };

    // Use mode-aware title for entities tab
    const title = tabId === 'entities' ? (
      <EntitiesTabTitle />
    ) : (
      <span className="dock-tab-title">
        <span className="dock-tab-icon">{def.icon}</span>
        <span>{def.label}</span>
      </span>
    );

    return {
      ...tab,
      title,
      content: (
        <div className="h-full w-full overflow-auto">
          {renderContent(tabId)}
        </div>
      ),
      closable: true,
      minWidth: 200,
      minHeight: 100,
    };
  }, [renderContent, allTabDefs]);

  // Handle layout changes - detect floating panels and convert to native windows in Tauri
  const handleLayoutChange = useCallback((newLayout: LayoutData, _currentTabId?: string, _direction?: string) => {
    onLayoutChange?.(newLayout);

    // In Tauri mode, convert floating panels to native windows
    if (isTauri() && newLayout.floatbox && dockRef.current) {
      const floatChildren = newLayout.floatbox.children || [];

      for (const floatPanel of floatChildren) {
        // Each float panel has tabs
        const panel = floatPanel as PanelData;
        if (!panel.tabs || panel.tabs.length === 0) continue;

        // Get the first tab's ID (we convert one tab at a time)
        const tab = panel.tabs[0];
        const tabId = tab.id as string;

        // Skip if already converted to native
        if (convertedToNativeRef.current.has(tabId)) continue;
        if (isFloating(tabId)) continue;

        // Before converting, find and store where this tab came from in the previous layout
        if (previousLayoutRef.current) {
          const originalPos = findTabPanel(previousLayoutRef.current, tabId);
          if (originalPos) {
            originalPositionsRef.current.set(tabId, {
              siblingTabIds: originalPos.siblingTabIds,
              index: originalPos.tabIndex
            });
            console.log('[DockLayout] Stored original position for', tabId, '- siblings:', originalPos.siblingTabIds, 'index:', originalPos.tabIndex);
          }
        }

        // Mark as converted to prevent re-processing
        convertedToNativeRef.current.add(tabId);

        // Use cursor position for window placement (offset to center the window)
        const windowWidth = (panel as any).w || 500;
        const windowHeight = (panel as any).h || 400;
        const x = cursorPosRef.current.x - windowWidth / 2;
        const y = cursorPosRef.current.y - 20; // Slight offset so title bar is near cursor

        // Get the tab definition for title
        const def = allTabDefs[tabId] || { icon: '○', label: tabId };

        console.log('[DockLayout] Converting floating panel to native window:', tabId, 'at cursor:', cursorPosRef.current);

        // Create native window at cursor position
        createFloatingWindow(tabId, def.label, Math.round(x), Math.round(y), windowWidth, windowHeight).then(() => {
          // Remove ONLY the floating panel for this tab, don't touch anything else
          if (dockRef.current) {
            const currentLayout = dockRef.current.getLayout();
            if (currentLayout.floatbox && currentLayout.floatbox.children) {
              // Find and remove only the panel containing this specific tab
              const newFloatChildren = currentLayout.floatbox.children.filter((child: any) => {
                const childPanel = child as PanelData;
                if (!childPanel.tabs) return true;
                // Keep panels that don't have this tab
                return !childPanel.tabs.some(t => t.id === tabId);
              });

              // Only update floatbox, preserve everything else
              if (newFloatChildren.length !== currentLayout.floatbox.children.length) {
                const updatedLayout: LayoutData = {
                  ...currentLayout,
                  floatbox: newFloatChildren.length > 0 ? {
                    ...currentLayout.floatbox,
                    children: newFloatChildren,
                  } : undefined,
                };
                dockRef.current.loadLayout(updatedLayout);
              }
            }
          }
        });
      }
    }

    // Store current layout for next comparison
    previousLayoutRef.current = newLayout;
  }, [onLayoutChange, createFloatingWindow, isFloating, allTabDefs, findTabPanel]);

  // Switch layout when template changes
  useEffect(() => {
    if (currentTemplateId && currentTemplateId !== prevTemplateIdRef.current && dockRef.current) {
      console.log('[DockLayout] Template changed to:', currentTemplateId);
      const layoutFn = TEMPLATE_LAYOUTS[currentTemplateId];
      if (layoutFn) {
        const newLayout = layoutFn();
        dockRef.current.loadLayout(newLayout);
        console.log('[DockLayout] Layout updated for template:', currentTemplateId);
      }
      prevTemplateIdRef.current = currentTemplateId;
    }
  }, [currentTemplateId]);

  // Get initial layout based on current template
  const getInitialLayout = useCallback(() => {
    const layoutFn = TEMPLATE_LAYOUTS[currentTemplateId || 'isometric-rpg'];
    return layoutFn ? layoutFn() : createDefaultLayout();
  }, [currentTemplateId]);

  return (
    <DockLayout
      ref={dockRef}
      defaultLayout={getInitialLayout()}
      groups={groups}
      loadTab={loadTab}
      onLayoutChange={handleLayoutChange}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
}
