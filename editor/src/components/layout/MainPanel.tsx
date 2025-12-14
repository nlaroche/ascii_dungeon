import { useEngineStore } from "../../stores/engineStore";

export function MainPanel() {
  const { engineRunning, camera, refreshCamera } = useEngineStore();

  return (
    <main className="flex-1 bg-background p-6 overflow-auto">
      {!engineRunning ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface border border-border flex items-center justify-center">
              <svg
                className="w-12 h-12 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-xl text-text mb-2">
              Engine Not Running
            </h2>
            <p className="text-text-muted">
              Click "Start Engine" in the sidebar to begin
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Camera Panel */}
          <section className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-text">Camera</h2>
              <button
                onClick={refreshCamera}
                className="px-3 py-1 text-sm bg-elevated hover:bg-border text-text-muted border border-border rounded transition-colors"
              >
                Refresh
              </button>
            </div>

            {camera ? (
              <div className="grid grid-cols-3 gap-4 font-mono text-sm">
                <div>
                  <label className="block text-text-muted mb-1">
                    Position X
                  </label>
                  <input
                    type="number"
                    value={camera.position[0].toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 bg-elevated border border-border rounded text-text"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">
                    Position Y
                  </label>
                  <input
                    type="number"
                    value={camera.position[1].toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 bg-elevated border border-border rounded text-text"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">
                    Position Z
                  </label>
                  <input
                    type="number"
                    value={camera.position[2].toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 bg-elevated border border-border rounded text-text"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Yaw</label>
                  <input
                    type="number"
                    value={camera.yaw.toFixed(3)}
                    readOnly
                    className="w-full px-3 py-2 bg-elevated border border-border rounded text-text"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Pitch</label>
                  <input
                    type="number"
                    value={camera.pitch.toFixed(3)}
                    readOnly
                    className="w-full px-3 py-2 bg-elevated border border-border rounded text-text"
                  />
                </div>
              </div>
            ) : (
              <p className="text-text-muted italic">
                Click refresh to load camera data
              </p>
            )}
          </section>

          {/* Scene Panel (placeholder) */}
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="font-heading font-semibold text-text mb-4">Scene</h2>
            <p className="text-text-muted italic">
              Scene inspector coming soon...
            </p>
          </section>

          {/* Console Panel (placeholder) */}
          <section className="bg-surface border border-border rounded-lg p-4">
            <h2 className="font-heading font-semibold text-text mb-4">
              Console
            </h2>
            <div className="bg-background border border-border rounded p-3 h-32 overflow-auto font-mono text-sm text-text-muted">
              <p>Ready.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
