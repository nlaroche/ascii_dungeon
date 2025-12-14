import { useEngineStore } from "../../stores/engineStore";

export function Sidebar() {
  const { engineRunning, startEngine, stopEngine, stats, refreshStats } =
    useEngineStore();

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col">
      {/* Engine Controls */}
      <section className="p-4 border-b border-border">
        <h2 className="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider mb-3">
          Engine
        </h2>

        <div className="space-y-2">
          {!engineRunning ? (
            <button
              onClick={startEngine}
              className="w-full px-4 py-2 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded font-medium transition-colors"
            >
              Start Engine
            </button>
          ) : (
            <button
              onClick={stopEngine}
              className="w-full px-4 py-2 bg-error/20 hover:bg-error/30 text-error border border-error/30 rounded font-medium transition-colors"
            >
              Stop Engine
            </button>
          )}

          <button
            onClick={refreshStats}
            disabled={!engineRunning}
            className="w-full px-4 py-2 bg-elevated hover:bg-border text-text border border-border rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh Stats
          </button>
        </div>
      </section>

      {/* Stats Display */}
      <section className="p-4 border-b border-border">
        <h2 className="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider mb-3">
          Performance
        </h2>

        {stats ? (
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">FPS</span>
              <span className="text-success">{stats.fps.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Frame Time</span>
              <span className="text-text">
                {(stats.frameTime * 1000).toFixed(2)} ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Instances</span>
              <span className="text-text">{stats.instanceCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Lights</span>
              <span className="text-accent">{stats.lightCount}</span>
            </div>
          </div>
        ) : (
          <p className="text-text-muted text-sm italic">Engine not running</p>
        )}
      </section>

      {/* Quick Actions */}
      <section className="p-4 flex-1">
        <h2 className="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider mb-3">
          Actions
        </h2>

        <div className="space-y-2">
          <button
            disabled={!engineRunning}
            className="w-full px-4 py-2 bg-elevated hover:bg-border text-text border border-border rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            Reload Lua Scripts
          </button>
          <button
            disabled={!engineRunning}
            className="w-full px-4 py-2 bg-elevated hover:bg-border text-text border border-border rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            Reset Camera
          </button>
        </div>
      </section>
    </aside>
  );
}
