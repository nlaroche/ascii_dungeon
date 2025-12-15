// ═══════════════════════════════════════════════════════════════════════════
// Custom Panel - Renders a user-defined Lua panel as a dock tab
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../stores/useEngineState';
import { getCustomPanel, CustomPanel } from '../lib/lua/panels';
import { runLuaUI, UIDefinition } from '../lib/lua/bindings';
import { LuaRenderer } from '../lib/lua/LuaRenderer';

interface CustomPanelViewProps {
  panelId: string;
}

export function CustomPanelView({ panelId }: CustomPanelViewProps) {
  const theme = useTheme();
  const [panel, setPanel] = useState<CustomPanel | null>(null);
  const [uiDefinition, setUiDefinition] = useState<UIDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load the panel definition
  useEffect(() => {
    const loadedPanel = getCustomPanel(panelId);
    setPanel(loadedPanel);
  }, [panelId]);

  // Execute Lua code to generate UI
  useEffect(() => {
    if (!panel) return;

    try {
      const result = runLuaUI(panel.luaCode);
      setUiDefinition(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setUiDefinition(null);
    }
  }, [panel, refreshKey]);

  // Allow panels to trigger re-renders (for state changes)
  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Auto-refresh for interactive panels (every 100ms when state changes)
  useEffect(() => {
    const interval = setInterval(handleRefresh, 100);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  if (!panel) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: theme.textDim }}>
        <div className="text-center">
          <div className="text-3xl mb-2">?</div>
          <div>Panel not found</div>
          <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
            ID: {panelId}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: theme.bgPanel }}>
      <LuaRenderer definition={uiDefinition} error={error || undefined} />
    </div>
  );
}

export default CustomPanelView;
