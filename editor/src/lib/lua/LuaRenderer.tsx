// ═══════════════════════════════════════════════════════════════════════════
// Lua UI Renderer - Renders Lua UI definitions as React components
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { UIDefinition } from './bindings';
import { useTheme } from '../../stores/useEngineState';

// ─────────────────────────────────────────────────────────────────────────────
// Theme-aware styling helper
// ─────────────────────────────────────────────────────────────────────────────

function useThemedColor(colorName?: string): string | undefined {
  const theme = useTheme();
  if (!colorName) return undefined;

  const colorMap: Record<string, string> = {
    text: theme.text,
    muted: theme.textMuted,
    dim: theme.textDim,
    accent: theme.accent,
    success: theme.success,
    warning: theme.warning,
    error: theme.error,
  };

  return colorMap[colorName] || colorName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Implementations
// ─────────────────────────────────────────────────────────────────────────────

interface LuaComponentProps {
  def: UIDefinition;
}

// Layout Components
function LuaColumn({ def }: LuaComponentProps) {
  const { props, children } = def;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: (props.gap as number) ?? 8,
        padding: (props.padding as number) ?? 0,
        alignItems: (props.align as string) ?? 'stretch',
      }}
    >
      {children?.map((child, i) => (
        <LuaComponent key={i} def={child} />
      ))}
    </div>
  );
}

function LuaRow({ def }: LuaComponentProps) {
  const { props, children } = def;

  const justifyMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: (props.gap as number) ?? 8,
        padding: (props.padding as number) ?? 0,
        alignItems: (props.align as string) ?? 'center',
        justifyContent: justifyMap[(props.justify as string) ?? 'start'] ?? 'flex-start',
      }}
    >
      {children?.map((child, i) => (
        <LuaComponent key={i} def={child} />
      ))}
    </div>
  );
}

function LuaPanel({ def }: LuaComponentProps) {
  const { props, children } = def;
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState((props.collapsed as boolean) ?? false);

  return (
    <div
      style={{
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {props.title ? (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: collapsed ? 'none' : `1px solid ${theme.border}`,
            backgroundColor: theme.bgHover,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: props.collapsible ? 'pointer' : 'default',
          }}
          onClick={() => props.collapsible && setCollapsed(!collapsed)}
        >
          <span style={{ fontWeight: 500, color: theme.text }}>{String(props.title || '')}</span>
          {props.collapsible ? (
            <span style={{ color: theme.textDim }}>{collapsed ? '▸' : '▾'}</span>
          ) : null}
        </div>
      ) : null}
      {!collapsed && (
        <div style={{ padding: (props.padding as number) ?? 12 }}>
          {children?.map((child, i) => (
            <LuaComponent key={i} def={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function LuaSpacer({ def }: LuaComponentProps) {
  const { props } = def;
  if (props.size) {
    return <div style={{ width: props.size as number, height: props.size as number }} />;
  }
  return <div style={{ flex: 1 }} />;
}

function LuaDivider({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const margin = (props.margin as number) ?? 8;

  if (props.vertical) {
    return (
      <div
        style={{
          width: 1,
          backgroundColor: theme.border,
          margin: `0 ${margin}px`,
          alignSelf: 'stretch',
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: 1,
        backgroundColor: theme.border,
        margin: `${margin}px 0`,
      }}
    />
  );
}

function LuaScroll({ def }: LuaComponentProps) {
  const { props, children } = def;

  return (
    <div
      style={{
        height: props.height as string | number ?? '100%',
        overflowY: 'auto',
        overflowX: props.horizontal ? 'auto' : 'hidden',
      }}
    >
      {children?.map((child, i) => (
        <LuaComponent key={i} def={child} />
      ))}
    </div>
  );
}

// Display Components
function LuaText({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const color = useThemedColor(props.color as string);

  const sizeMap: Record<string, number> = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
  };

  return (
    <span
      style={{
        fontSize: sizeMap[(props.size as string) ?? 'md'] ?? 14,
        color: color ?? theme.text,
        fontWeight: props.bold ? 600 : 400,
        fontFamily: props.mono ? 'monospace' : 'inherit',
      }}
    >
      {String(props.value || '')}
    </span>
  );
}

function LuaHeading({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const level = (props.level as number) ?? 2;

  const sizeMap: Record<number, number> = {
    1: 28,
    2: 24,
    3: 20,
    4: 16,
    5: 14,
    6: 12,
  };

  return (
    <div
      style={{
        fontSize: sizeMap[level] ?? 20,
        fontWeight: 600,
        color: theme.text,
        marginBottom: 8,
      }}
    >
      {String(props.value || '')}
    </div>
  );
}

function LuaIcon({ def }: LuaComponentProps) {
  const { props } = def;
  const color = useThemedColor(props.color as string);

  return (
    <span
      style={{
        fontSize: (props.size as number) ?? 16,
        color,
      }}
    >
      {String(props.value || '')}
    </span>
  );
}

function LuaBadge({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();

  const variantColors: Record<string, { bg: string; text: string }> = {
    default: { bg: theme.bgHover, text: theme.textMuted },
    success: { bg: theme.success + '20', text: theme.success },
    warning: { bg: theme.warning + '20', text: theme.warning },
    error: { bg: theme.error + '20', text: theme.error },
  };

  const colors = variantColors[(props.variant as string) ?? 'default'] ?? variantColors.default;

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {String(props.value || '')}
    </span>
  );
}

function LuaCode({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();

  return (
    <pre
      style={{
        padding: 12,
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: 12,
        color: theme.text,
        overflow: 'auto',
        margin: 0,
      }}
    >
      {String(props.value || '')}
    </pre>
  );
}

// Input Components
function LuaButton({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (props.onClick && typeof props.onClick === 'function') {
      (props.onClick as () => void)();
    }
  }, [props.onClick]);

  const isPrimary = props.primary as boolean;

  return (
    <button
      onClick={handleClick}
      disabled={props.disabled as boolean}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        border: isPrimary ? 'none' : `1px solid ${theme.border}`,
        borderRadius: 4,
        backgroundColor: isPrimary
          ? hovered
            ? theme.accent
            : theme.accent + 'dd'
          : hovered
          ? theme.bgHover
          : 'transparent',
        color: isPrimary ? '#000' : theme.text,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {props.icon ? <span>{String(props.icon)}</span> : null}
      {String(props.label || '')}
    </button>
  );
}

function LuaInput({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [value, setValue] = useState((props.value as string) ?? '');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      if (props.onChange && typeof props.onChange === 'function') {
        (props.onChange as (v: string) => void)(e.target.value);
      }
    },
    [props.onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {props.label ? (
        <label style={{ fontSize: 12, color: theme.textMuted }}>{String(props.label)}</label>
      ) : null}
      <input
        type={(props.type as string) ?? 'text'}
        value={value}
        onChange={handleChange}
        placeholder={String(props.placeholder || '')}
        style={{
          padding: '6px 10px',
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          backgroundColor: theme.bg,
          color: theme.text,
          fontSize: 13,
          outline: 'none',
        }}
      />
    </div>
  );
}

function LuaTextarea({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [value, setValue] = useState((props.value as string) ?? '');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      if (props.onChange && typeof props.onChange === 'function') {
        (props.onChange as (v: string) => void)(e.target.value);
      }
    },
    [props.onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {props.label ? (
        <label style={{ fontSize: 12, color: theme.textMuted }}>{String(props.label)}</label>
      ) : null}
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={String(props.placeholder || '')}
        rows={(props.rows as number) ?? 4}
        style={{
          padding: '6px 10px',
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          backgroundColor: theme.bg,
          color: theme.text,
          fontSize: 13,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

function LuaCheckbox({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [checked, setChecked] = useState((props.value as boolean) ?? false);

  const handleChange = useCallback(() => {
    const newValue = !checked;
    setChecked(newValue);
    if (props.onChange && typeof props.onChange === 'function') {
      (props.onChange as (v: boolean) => void)(newValue);
    }
  }, [checked, props.onChange]);

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <div
        onClick={!props.disabled ? handleChange : undefined}
        style={{
          width: 16,
          height: 16,
          border: `1px solid ${checked ? theme.accent : theme.border}`,
          borderRadius: 3,
          backgroundColor: checked ? theme.accent : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          fontSize: 12,
        }}
      >
        {checked && '✓'}
      </div>
      <span style={{ fontSize: 13, color: theme.text }}>{String(props.label || '')}</span>
    </label>
  );
}

function LuaSelect({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [value, setValue] = useState((props.value as string) ?? '');
  const options = (props.options as Array<{ value: string; label: string }>) ?? [];

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setValue(e.target.value);
      if (props.onChange && typeof props.onChange === 'function') {
        (props.onChange as (v: string) => void)(e.target.value);
      }
    },
    [props.onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {props.label ? (
        <label style={{ fontSize: 12, color: theme.textMuted }}>{String(props.label)}</label>
      ) : null}
      <select
        value={value}
        onChange={handleChange}
        style={{
          padding: '6px 10px',
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          backgroundColor: theme.bg,
          color: theme.text,
          fontSize: 13,
          outline: 'none',
        }}
      >
        {props.placeholder ? (
          <option value="" disabled>
            {String(props.placeholder)}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LuaSlider({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const [value, setValue] = useState((props.value as number) ?? 50);
  const min = (props.min as number) ?? 0;
  const max = (props.max as number) ?? 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      setValue(newValue);
      if (props.onChange && typeof props.onChange === 'function') {
        (props.onChange as (v: number) => void)(newValue);
      }
    },
    [props.onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {props.label ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: theme.textMuted }}>{String(props.label)}</label>
          {props.showValue !== false ? (
            <span style={{ fontSize: 12, color: theme.text }}>{value}</span>
          ) : null}
        </div>
      ) : null}
      <input
        type="range"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={(props.step as number) ?? 1}
        style={{ width: '100%' }}
      />
    </div>
  );
}

// Feedback Components
function LuaSpinner({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const size = (props.size as number) ?? 24;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          border: `2px solid ${theme.border}`,
          borderTopColor: theme.accent,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {props.label ? <span style={{ color: theme.textMuted }}>{String(props.label)}</span> : null}
    </div>
  );
}

function LuaProgress({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();
  const value = Math.min(100, Math.max(0, (props.value as number) ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(props.label || props.showPercent !== false) ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {props.label ? (
            <label style={{ fontSize: 12, color: theme.textMuted }}>{String(props.label)}</label>
          ) : null}
          {props.showPercent !== false ? (
            <span style={{ fontSize: 12, color: theme.text }}>{value}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          height: 6,
          backgroundColor: theme.bgHover,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            backgroundColor: theme.accent,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

function LuaEmpty({ def }: LuaComponentProps) {
  const { props } = def;
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        color: theme.textMuted,
      }}
    >
      {props.icon ? <div style={{ fontSize: 32, marginBottom: 8 }}>{String(props.icon)}</div> : null}
      {props.title ? (
        <div style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>
          {String(props.title)}
        </div>
      ) : null}
      {props.description ? (
        <div style={{ fontSize: 12, marginTop: 4 }}>{String(props.description)}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Renderer Component
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_MAP: Record<string, React.FC<LuaComponentProps>> = {
  column: LuaColumn,
  row: LuaRow,
  panel: LuaPanel,
  spacer: LuaSpacer,
  divider: LuaDivider,
  scroll: LuaScroll,
  text: LuaText,
  heading: LuaHeading,
  icon: LuaIcon,
  badge: LuaBadge,
  code: LuaCode,
  button: LuaButton,
  input: LuaInput,
  textarea: LuaTextarea,
  checkbox: LuaCheckbox,
  select: LuaSelect,
  slider: LuaSlider,
  spinner: LuaSpinner,
  progress: LuaProgress,
  empty: LuaEmpty,
};

export function LuaComponent({ def }: { def: UIDefinition }) {
  const Component = COMPONENT_MAP[def.type];

  if (!Component) {
    return (
      <div style={{ color: 'red', fontSize: 12 }}>Unknown component: {def.type}</div>
    );
  }

  return <Component def={def} />;
}

interface LuaRendererProps {
  definition: UIDefinition | null;
  error?: string;
}

export function LuaRenderer({ definition, error }: LuaRendererProps) {
  const theme = useTheme();

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          backgroundColor: theme.error + '20',
          border: `1px solid ${theme.error}`,
          borderRadius: 4,
          color: theme.error,
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        {error}
      </div>
    );
  }

  if (!definition) {
    return (
      <LuaEmpty
        def={{
          __ui_component: true,
          type: 'empty',
          props: {
            icon: '◇',
            title: 'No UI',
            description: 'Run some Lua code to see the result',
          },
        }}
      />
    );
  }

  return <LuaComponent def={definition} />;
}
