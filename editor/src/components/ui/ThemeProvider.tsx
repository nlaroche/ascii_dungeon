// Theme provider that injects CSS variables from state
import { useEffect } from 'react';
import { useTheme } from '../../stores/useEngineState';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  useEffect(() => {
    // Inject theme as CSS variables on :root
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--bg-panel', theme.bgPanel);
    root.style.setProperty('--bg-hover', theme.bgHover);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--text-dim', theme.textDim);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-bg', theme.accentBg);
    root.style.setProperty('--success', theme.success);
    root.style.setProperty('--warning', theme.warning);
    root.style.setProperty('--error', theme.error);
  }, [theme]);

  return <>{children}</>;
}
