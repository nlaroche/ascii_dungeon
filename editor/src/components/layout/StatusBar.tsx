import { useEngineStore } from "../../stores/engineStore";

export function StatusBar() {
  const { connected, engineRunning, stats } = useEngineStore();

  return (
    <footer className="h-8 bg-surface border-t border-border flex items-center px-4 text-xs font-mono">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-success" : "bg-error"
          }`}
        />
        <span className="text-text-muted">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="mx-4 w-px h-4 bg-border" />

      {/* Engine status */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            engineRunning ? "bg-success animate-pulse" : "bg-text-muted"
          }`}
        />
        <span className="text-text-muted">
          {engineRunning ? "Engine Running" : "Engine Stopped"}
        </span>
      </div>

      {/* FPS indicator */}
      {stats && (
        <>
          <div className="mx-4 w-px h-4 bg-border" />
          <span className="text-accent">{stats.fps.toFixed(0)} FPS</span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version */}
      <span className="text-text-muted">v0.1.0</span>
    </footer>
  );
}
