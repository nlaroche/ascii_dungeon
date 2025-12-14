// Data-driven Panel component
// Renders tabs or stack sections based on state.ui.panels configuration

import { ReactNode } from 'react';
import { usePanel, useTheme } from '../../stores/useEngineState';
import type { TabbedPanel, StackPanel, Tab, Section } from '../../stores/engineState';

interface PanelProps {
  panelId: string;
  children?: ReactNode;
  renderTab?: (tabId: string) => ReactNode;
  renderSection?: (sectionId: string) => ReactNode;
  className?: string;
}

export function Panel({ panelId, renderTab, renderSection, className = '' }: PanelProps) {
  const { panel, setActiveTab, toggleSection } = usePanel(panelId);

  if (!panel) return null;

  if (panel.type === 'tabs') {
    return (
      <TabbedPanelView
        panel={panel}
        onTabChange={setActiveTab}
        renderContent={renderTab}
        className={className}
      />
    );
  }

  if (panel.type === 'stack') {
    return (
      <StackPanelView
        panel={panel}
        onToggle={toggleSection}
        renderContent={renderSection}
        className={className}
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabbed Panel
// ─────────────────────────────────────────────────────────────────────────────

interface TabbedPanelViewProps {
  panel: TabbedPanel;
  onTabChange: (tabId: string) => void;
  renderContent?: (tabId: string) => ReactNode;
  className?: string;
}

function TabbedPanelView({ panel, onTabChange, renderContent, className }: TabbedPanelViewProps) {
  const theme = useTheme();

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tab bar */}
      <div
        className="h-9 flex items-center gap-0 shrink-0"
        style={{ backgroundColor: theme.bgPanel, borderBottom: `1px solid ${theme.border}` }}
      >
        {panel.tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={panel.active === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {renderContent?.(panel.active)}
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ tab, isActive, onClick }: TabButtonProps) {
  const theme = useTheme();

  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-xs uppercase tracking-wider transition-colors"
      style={{
        backgroundColor: isActive ? theme.bgHover : 'transparent',
        color: isActive ? theme.accent : theme.textMuted,
        borderRight: `1px solid ${theme.border}`,
        borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
      }}
    >
      <span className="mr-1.5">{tab.icon}</span>
      {tab.label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stack Panel
// ─────────────────────────────────────────────────────────────────────────────

interface StackPanelViewProps {
  panel: StackPanel;
  onToggle: (sectionId: string) => void;
  renderContent?: (sectionId: string) => ReactNode;
  className?: string;
}

function StackPanelView({ panel, onToggle, renderContent, className }: StackPanelViewProps) {
  return (
    <div className={`flex flex-col overflow-y-auto ${className}`}>
      {panel.sections.map((section) => (
        <SectionView
          key={section.id}
          section={section}
          onToggle={() => onToggle(section.id)}
          renderContent={renderContent}
        />
      ))}
    </div>
  );
}

interface SectionViewProps {
  section: Section;
  onToggle: () => void;
  renderContent?: (sectionId: string) => ReactNode;
}

function SectionView({ section, onToggle, renderContent }: SectionViewProps) {
  const theme = useTheme();

  return (
    <div style={{ borderBottom: `1px solid ${theme.border}` }}>
      {/* Section header */}
      <button
        onClick={onToggle}
        className="w-full p-2 text-xs uppercase tracking-wider flex items-center gap-2"
        style={{
          backgroundColor: `${theme.bgHover}80`,
          color: theme.textMuted,
        }}
      >
        <span
          className="transition-transform"
          style={{ transform: section.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
        {section.label}
      </button>

      {/* Section content */}
      {!section.collapsed && (
        <div className="p-3">
          {renderContent?.(section.id)}
        </div>
      )}
    </div>
  );
}
