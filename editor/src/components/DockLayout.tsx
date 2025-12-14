// Dockable panel layout using rc-dock
// Supports dragging tabs to float, splitting, and re-docking

import { useRef, useCallback, useEffect, ReactNode } from 'react';
import DockLayout, { LayoutData, TabData, TabGroup, PanelData, BoxData } from 'rc-dock';
import { useEngineState } from '../stores/useEngineState';
import '../styles/dock.css';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface DockablePanelProps {
  renderContent: (tabId: string) => ReactNode;
  onLayoutChange?: (layout: LayoutData) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab definitions with icons - includes all template-specific panels
// ═══════════════════════════════════════════════════════════════════════════

const TAB_DEFINITIONS: Record<string, { icon: string; label: string }> = {
  // Core panels
  files: { icon: '○', label: 'Files' },
  entities: { icon: '◉', label: 'Entities' },
  assets: { icon: '◈', label: 'Assets' },
  templates: { icon: '◇', label: 'Templates' },
  scene: { icon: '▦', label: 'Scene' },
  code: { icon: '{ }', label: 'Code' },
  chat: { icon: '◆', label: 'AI Chat' },
  properties: { icon: '⚙', label: 'Properties' },
  console: { icon: '❯', label: 'Console' },

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
                { id: 'files', title: 'Files', group: 'default' },
                { id: 'entities', title: 'Entities', group: 'default' },
                { id: 'templates', title: 'Templates', group: 'default' },
              ],
              activeId: 'files',
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
                { id: 'code', title: 'Code', group: 'default' },
              ],
              activeId: 'scene',
            } as PanelData,
            {
              size: 180,
              tabs: [
                { id: 'console', title: 'Console', group: 'default' },
                { id: 'assets', title: 'Assets', group: 'default' },
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
                { id: 'templates', title: 'Templates', group: 'default' },
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
                { id: 'templates', title: 'Templates', group: 'default' },
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

export function DockableLayout({ renderContent, onLayoutChange }: DockablePanelProps) {
  const dockRef = useRef<DockLayout>(null);
  const currentTemplateId = useEngineState((s) => s.template.currentId);
  const prevTemplateIdRef = useRef<string | null>(currentTemplateId);

  // Tab group configuration
  const groups: Record<string, TabGroup> = {
    default: {
      // Allow tabs to float
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
    const def = TAB_DEFINITIONS[tabId] || { icon: '○', label: tabId };
    return {
      ...tab,
      title: (
        <span className="dock-tab-title">
          <span className="dock-tab-icon">{def.icon}</span>
          <span>{def.label}</span>
        </span>
      ),
      content: (
        <div className="h-full w-full overflow-auto">
          {renderContent(tabId)}
        </div>
      ),
      minWidth: 200,
      minHeight: 100,
    };
  }, [renderContent]);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: LayoutData, _currentTabId?: string, _direction?: string) => {
    onLayoutChange?.(newLayout);
  }, [onLayoutChange]);

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
