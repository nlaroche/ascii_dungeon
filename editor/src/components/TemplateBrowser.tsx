// ═══════════════════════════════════════════════════════════════════════════
// Template Browser - Explore and switch between game templates
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useTheme } from '../stores/useEngineState';
import { AVAILABLE_TEMPLATES, TemplateDefinition, TypeDefinition } from '../lib/templates';

// ─────────────────────────────────────────────────────────────────────────────
// Template Browser Panel
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateBrowserProps {
  currentTemplateId?: string;
  onSelectTemplate: (template: TemplateDefinition) => void;
}

export function TemplateBrowser({ currentTemplateId, onSelectTemplate }: TemplateBrowserProps) {
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'templates' | 'types'>('templates');

  const selectedTemplate = AVAILABLE_TEMPLATES.find(t => t.id === selectedId);
  const currentTemplate = AVAILABLE_TEMPLATES.find(t => t.id === currentTemplateId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: theme.accent }}>◈</span>
          <span className="font-medium" style={{ color: theme.text }}>Templates</span>
        </div>
        <div
          className="flex rounded overflow-hidden text-xs"
          style={{ backgroundColor: theme.bgHover }}
        >
          <button
            onClick={() => setView('templates')}
            className="px-2 py-1 transition-colors"
            style={{
              backgroundColor: view === 'templates' ? theme.accent : 'transparent',
              color: view === 'templates' ? theme.bg : theme.textMuted,
            }}
          >
            Templates
          </button>
          <button
            onClick={() => setView('types')}
            className="px-2 py-1 transition-colors"
            style={{
              backgroundColor: view === 'types' ? theme.accent : 'transparent',
              color: view === 'types' ? theme.bg : theme.textMuted,
            }}
          >
            Types
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'templates' ? (
          <TemplateList
            templates={AVAILABLE_TEMPLATES}
            currentId={currentTemplateId}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onActivate={onSelectTemplate}
          />
        ) : (
          <TypeExplorer template={currentTemplate || AVAILABLE_TEMPLATES[0]} />
        )}
      </div>

      {/* Preview panel for selected template */}
      {view === 'templates' && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          isCurrent={selectedTemplate.id === currentTemplateId}
          onActivate={() => onSelectTemplate(selectedTemplate)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template List
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateListProps {
  templates: TemplateDefinition[];
  currentId?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate: (template: TemplateDefinition) => void;
}

function TemplateList({ templates, currentId, selectedId, onSelect, onActivate }: TemplateListProps) {
  const theme = useTheme();

  return (
    <div className="p-2 space-y-2">
      {templates.map(template => {
        const isCurrent = template.id === currentId;
        const isSelected = template.id === selectedId;

        return (
          <div
            key={template.id}
            onClick={() => onSelect(template.id)}
            onDoubleClick={() => onActivate(template)}
            className="p-3 rounded cursor-pointer transition-all"
            style={{
              backgroundColor: isSelected ? theme.accentBg : theme.bgHover,
              border: `1px solid ${isSelected ? theme.accent : 'transparent'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: theme.text }}>
                    {template.name}
                  </span>
                  {isCurrent && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ backgroundColor: theme.success + '30', color: theme.success }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                  {template.description}
                </div>
              </div>
            </div>

            {/* Type icons */}
            <div className="flex items-center gap-1 mt-2 pl-9">
              {Object.values(template.types).slice(0, 5).map(type => (
                <span
                  key={type.name}
                  className="text-sm"
                  title={type.name}
                  style={{ opacity: 0.7 }}
                >
                  {type.icon}
                </span>
              ))}
              {Object.keys(template.types).length > 5 && (
                <span className="text-xs" style={{ color: theme.textDim }}>
                  +{Object.keys(template.types).length - 5}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Preview
// ─────────────────────────────────────────────────────────────────────────────

interface TemplatePreviewProps {
  template: TemplateDefinition;
  isCurrent: boolean;
  onActivate: () => void;
}

function TemplatePreview({ template, isCurrent, onActivate }: TemplatePreviewProps) {
  const theme = useTheme();

  return (
    <div
      className="p-3 shrink-0"
      style={{ borderTop: `1px solid ${theme.border}` }}
    >
      {/* Render mode info */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>
          Render Mode
        </div>
        <div className="flex items-center gap-2">
          <RenderModeIcon mode={template.render.mode} />
          <span className="text-sm capitalize" style={{ color: theme.text }}>
            {template.render.mode}
          </span>
          <span className="text-xs" style={{ color: theme.textMuted }}>
            {template.render.camera.type}
          </span>
        </div>
      </div>

      {/* Types */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>
          Types ({Object.keys(template.types).length})
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.values(template.types).map(type => (
            <span
              key={type.name}
              className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
              style={{ backgroundColor: type.color + '20', color: type.color }}
            >
              {type.icon} {type.name}
            </span>
          ))}
        </div>
      </div>

      {/* Activate button */}
      <button
        onClick={onActivate}
        disabled={isCurrent}
        className="w-full py-2 rounded text-sm font-medium transition-colors"
        style={{
          backgroundColor: isCurrent ? theme.bgHover : theme.accent,
          color: isCurrent ? theme.textMuted : theme.bg,
          cursor: isCurrent ? 'default' : 'pointer',
        }}
      >
        {isCurrent ? 'Currently Active' : 'Activate Template'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Explorer
// ─────────────────────────────────────────────────────────────────────────────

interface TypeExplorerProps {
  template: TemplateDefinition;
}

function TypeExplorer({ template }: TypeExplorerProps) {
  const theme = useTheme();
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const types = Object.values(template.types);

  return (
    <div className="p-2">
      {/* Template header */}
      <div
        className="px-2 py-1.5 mb-2 rounded text-xs"
        style={{ backgroundColor: theme.bgHover }}
      >
        <span style={{ color: theme.textMuted }}>Template:</span>{' '}
        <span style={{ color: theme.accent }}>{template.icon} {template.name}</span>
      </div>

      {/* Type list */}
      <div className="space-y-1">
        {types.map(type => (
          <TypeCard
            key={type.name}
            type={type}
            expanded={expandedType === type.name}
            onToggle={() => setExpandedType(expandedType === type.name ? null : type.name)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Card
// ─────────────────────────────────────────────────────────────────────────────

interface TypeCardProps {
  type: TypeDefinition;
  expanded: boolean;
  onToggle: () => void;
}

function TypeCard({ type, expanded, onToggle }: TypeCardProps) {
  const theme = useTheme();

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: `1px solid ${theme.border}` }}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors"
        style={{ backgroundColor: theme.bgPanel }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.bgPanel}
      >
        <span
          className="transition-transform"
          style={{
            color: theme.textDim,
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
        >
          ▸
        </span>
        <span style={{ color: type.color }}>{type.icon}</span>
        <span className="font-medium" style={{ color: theme.text }}>{type.name}</span>
        {type.collection && (
          <span
            className="ml-auto text-xs px-1.5 rounded"
            style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
          >
            {type.collection.view || 'list'}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-3 py-2 text-xs space-y-2"
          style={{ backgroundColor: theme.bg, borderTop: `1px solid ${theme.border}` }}
        >
          {type.description && (
            <div style={{ color: theme.textMuted }}>{type.description}</div>
          )}

          {/* Components */}
          <div>
            <div className="uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>
              Components
            </div>
            <div className="space-y-1">
              {Object.values(type.components).map(field => (
                <div key={field.name} className="flex items-center gap-2">
                  <span style={{ color: theme.accent }}>{field.name}</span>
                  <span style={{ color: theme.textDim }}>:</span>
                  <span style={{ color: theme.warning }}>{field.type}</span>
                  {field.options && (
                    <span style={{ color: theme.textMuted }}>
                      [{field.options.join(', ')}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Inspector sections */}
          <div>
            <div className="uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>
              Inspector
            </div>
            <div className="flex flex-wrap gap-1">
              {type.inspector.map(section => (
                <span
                  key={section.section}
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: theme.bgHover, color: theme.textMuted }}
                >
                  {section.section}
                </span>
              ))}
            </div>
          </div>

          {/* Collection info */}
          {type.collection && (
            <div>
              <div className="uppercase tracking-wide mb-1" style={{ color: theme.textDim }}>
                Collection View
              </div>
              <div style={{ color: theme.textMuted }}>
                {type.collection.title} • {type.collection.view || 'list'} view
                {type.collection.groupBy && ` • grouped by ${type.collection.groupBy}`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Render Mode Icon
// ─────────────────────────────────────────────────────────────────────────────

function RenderModeIcon({ mode }: { mode: string }) {
  const icons: Record<string, string> = {
    isometric: '◇',
    table: '▢',
    sidescroll: '▭',
    free3d: '◆',
  };
  return <span className="text-lg">{icons[mode] || '◇'}</span>;
}

export default TemplateBrowser;
