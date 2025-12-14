import { useEditorStore } from "./stores/editorStore";
import type { FileItem } from "./stores/editorStore";
import { WebGPUViewport } from "./components/WebGPUViewport";

function App() {
  const {
    engineRunning,
    setEngineRunning,
    fps,
    frameTime,
    activeTab,
    setActiveTab,
    currentTool,
    setCurrentTool,
    currentBrush,
    setCurrentBrush,
    selectedCell,
    selectedEntity,
    setSelectedEntity,
    expandedFolders,
    toggleFolder,
    logs,
    clearLogs,
    entities,
    files,
    luaCode,
  } = useEditorStore();

  const getCellColor = (char: string) => {
    const colors: Record<string, string> = {
      "#": "text-zinc-400",
      ".": "text-zinc-600",
      "~": "text-cyan-500",
      "*": "text-orange-400",
      "@": "text-emerald-400",
      g: "text-green-500",
      T: "text-red-400",
    };
    return colors[char] || "text-zinc-500";
  };

  const renderFileTree = (items: FileItem[], depth = 0) => {
    return items.map((item, i) => (
      <div key={i}>
        <div
          className={`flex items-center gap-2 py-0.5 px-2 cursor-pointer hover:bg-zinc-800 ${
            item.active ? "bg-zinc-800 text-cyan-400" : "text-zinc-400"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => item.type === "folder" && toggleFolder(item.name)}
        >
          <span className="text-zinc-600 w-4">
            {item.type === "folder"
              ? expandedFolders.includes(item.name)
                ? "▼"
                : "▶"
              : "○"}
          </span>
          <span className={item.type === "folder" ? "text-amber-500" : ""}>
            {item.name}
          </span>
        </div>
        {item.type === "folder" &&
          item.children &&
          expandedFolders.includes(item.name) &&
          renderFileTree(item.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-300 flex flex-col text-sm overflow-hidden">
      {/* Title Bar */}
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 font-bold tracking-wider">
            ◆ ASCII_DUNGEON
          </span>
          <span className="text-zinc-600">v0.1.0</span>
          <span className="text-zinc-700">│</span>
          <span className="text-zinc-500">test_dungeon.lua</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Engine Controls */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded px-1 py-0.5">
            <button
              onClick={() => setEngineRunning(!engineRunning)}
              className={`px-3 py-1 rounded text-xs font-bold tracking-wide transition-colors ${
                engineRunning
                  ? "bg-emerald-600 text-emerald-100"
                  : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
              }`}
            >
              {engineRunning ? "● LIVE" : "○ START"}
            </button>
            <button className="px-3 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-700 transition-colors">
              ⟳ RELOAD
            </button>
            <button className="px-3 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-700 transition-colors">
              ⏸ PAUSE
            </button>
          </div>

          <span className="text-zinc-700">│</span>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">FPS:</span>
            <span className="text-emerald-400 font-bold">{fps}</span>
            <span className="text-zinc-700">│</span>
            <span className="text-zinc-500">{frameTime}ms</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser */}
        <div className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-2 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
            Project
          </div>
          <div className="flex-1 overflow-y-auto text-xs">
            {renderFileTree(files)}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-zinc-800 p-2 space-y-1">
            <button className="w-full text-left px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 rounded flex items-center gap-2">
              <span className="text-cyan-500">+</span> New Map
            </button>
            <button className="w-full text-left px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 rounded flex items-center gap-2">
              <span className="text-cyan-500">+</span> New Sprite
            </button>
            <button className="w-full text-left px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 rounded flex items-center gap-2">
              <span className="text-cyan-500">+</span> New Script
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="h-9 bg-zinc-900 border-b border-zinc-800 flex items-center gap-0 shrink-0">
            {(["map", "code", "sprites", "materials"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs uppercase tracking-wider border-r border-zinc-800 transition-colors ${
                  activeTab === tab
                    ? "bg-zinc-800 text-cyan-400 border-b-2 border-b-cyan-500"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 flex overflow-hidden">
            {activeTab === "map" && (
              <>
                {/* Engine Viewport */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Toolbar */}
                  <div className="h-10 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2 px-3 shrink-0">
                    <div className="flex items-center gap-1 bg-zinc-800 rounded p-0.5">
                      {(["select", "paint", "erase", "fill"] as const).map(
                        (tool) => (
                          <button
                            key={tool}
                            onClick={() => setCurrentTool(tool)}
                            className={`px-2 py-1 rounded text-xs transition-colors ${
                              currentTool === tool
                                ? "bg-cyan-600 text-white"
                                : "text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            {tool === "select" && "◇"}
                            {tool === "paint" && "✎"}
                            {tool === "erase" && "✕"}
                            {tool === "fill" && "◈"}
                          </button>
                        )
                      )}
                    </div>

                    <span className="text-zinc-700">│</span>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-500">Brush:</span>
                      <div className="flex gap-0.5 bg-zinc-800 rounded p-0.5">
                        {["#", ".", "~", "*", "g", "T"].map((char) => (
                          <button
                            key={char}
                            onClick={() => setCurrentBrush(char)}
                            className={`w-6 h-6 rounded text-xs transition-colors ${
                              currentBrush === char
                                ? "bg-zinc-600 ring-1 ring-cyan-500"
                                : "hover:bg-zinc-700"
                            } ${getCellColor(char)}`}
                          >
                            {char}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1" />

                    <span className="text-xs text-zinc-500">
                      {selectedCell.x}, {selectedCell.y}
                    </span>
                  </div>

                  {/* WebGPU Viewport - renders the voxel scene */}
                  <WebGPUViewport className="flex-1" />
                </div>

                {/* Right Panel - Inspector */}
                <div className="w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0 overflow-hidden">
                  {/* Cell Inspector */}
                  <div className="border-b border-zinc-800">
                    <div className="p-2 text-xs text-zinc-500 uppercase tracking-wider bg-zinc-800/50">
                      Cell Properties
                    </div>
                    <div className="p-3 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Position</span>
                        <span className="text-zinc-300">
                          {selectedCell.x}, {selectedCell.y}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Glyph</span>
                        <span className="text-orange-400 text-lg">*</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Height</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="30"
                            className="w-24"
                          />
                          <span className="text-zinc-400 w-8 text-right">
                            0.3
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Roughness</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="20"
                            className="w-24"
                          />
                          <span className="text-zinc-400 w-8 text-right">
                            0.2
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Color</span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-orange-400 border border-zinc-600 cursor-pointer" />
                          <span className="text-zinc-400">#F97316</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Emission</span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-orange-500 border border-zinc-600 cursor-pointer shadow-lg shadow-orange-500/50" />
                          <span className="text-zinc-400">8.0</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                          <input type="checkbox" defaultChecked />
                          Walkable
                        </label>
                        <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                          <input type="checkbox" />
                          Blocks sight
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Entities List */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-2 text-xs text-zinc-500 uppercase tracking-wider bg-zinc-800/50">
                      Entities
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {entities.map((entity) => (
                        <div
                          key={entity.id}
                          onClick={() => setSelectedEntity(entity.id)}
                          className={`px-3 py-2 border-b border-zinc-800/50 cursor-pointer transition-colors ${
                            selectedEntity === entity.id
                              ? "bg-zinc-800"
                              : "hover:bg-zinc-800/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-medium ${
                                entity.type === "Player"
                                  ? "text-emerald-400"
                                  : entity.type === "Enemy"
                                  ? "text-red-400"
                                  : "text-amber-400"
                              }`}
                            >
                              {entity.id}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {entity.type}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-zinc-500 mt-0.5">
                            <span>pos: {entity.pos}</span>
                            <span>hp: {entity.hp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 border-t border-zinc-800">
                      <button className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400 transition-colors">
                        + Add Entity
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "code" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Code Editor Header */}
                <div className="h-8 bg-zinc-800/50 border-b border-zinc-800 flex items-center px-3 text-xs shrink-0">
                  <span className="text-amber-500">sprites/</span>
                  <span className="text-zinc-300">enemies.lua</span>
                  <span className="text-zinc-600 ml-2">— modified</span>
                </div>

                {/* Code Content */}
                <div className="flex-1 overflow-auto bg-zinc-950 p-4">
                  <pre className="text-xs leading-relaxed">
                    {luaCode.split("\n").map((line, i) => (
                      <div key={i} className="flex hover:bg-zinc-900/50">
                        <span className="w-8 text-zinc-600 text-right pr-4 select-none">
                          {i + 1}
                        </span>
                        <code
                          className={
                            line.startsWith("--")
                              ? "text-zinc-500"
                              : line.includes("function")
                              ? "text-violet-400"
                              : line.includes("sprites.")
                              ? "text-cyan-400"
                              : line.includes("return")
                              ? "text-rose-400"
                              : line.includes('"') || line.includes("'")
                              ? "text-amber-300"
                              : "text-zinc-300"
                          }
                        >
                          {line || " "}
                        </code>
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === "sprites" && (
              <div className="flex-1 flex items-center justify-center text-zinc-600">
                <div className="text-center">
                  <div className="text-4xl mb-2">◇</div>
                  <div>Sprite Editor</div>
                  <div className="text-xs text-zinc-700 mt-1">Coming soon</div>
                </div>
              </div>
            )}

            {activeTab === "materials" && (
              <div className="flex-1 flex items-center justify-center text-zinc-600">
                <div className="text-center">
                  <div className="text-4xl mb-2">◈</div>
                  <div>Material Editor</div>
                  <div className="text-xs text-zinc-700 mt-1">Coming soon</div>
                </div>
              </div>
            )}
          </div>

          {/* Console */}
          <div className="h-40 bg-zinc-900 border-t border-zinc-800 flex flex-col shrink-0">
            <div className="h-8 border-b border-zinc-800 flex items-center px-3 gap-4 shrink-0">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                Console
              </span>
              <div className="flex-1" />
              <button
                onClick={clearLogs}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="text-zinc-600 shrink-0">{log.time}</span>
                  <span
                    className={`shrink-0 ${
                      log.type === "info"
                        ? "text-zinc-500"
                        : log.type === "warn"
                        ? "text-amber-500"
                        : log.type === "error"
                        ? "text-red-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {log.type === "info" && "●"}
                    {log.type === "warn" && "⚠"}
                    {log.type === "error" && "✕"}
                    {log.type === "success" && "✓"}
                  </span>
                  <span
                    className={
                      log.type === "warn"
                        ? "text-amber-200"
                        : log.type === "error"
                        ? "text-red-200"
                        : log.type === "success"
                        ? "text-emerald-200"
                        : "text-zinc-400"
                    }
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 mt-2">
                <span className="text-cyan-500">❯</span>
                <input
                  type="text"
                  placeholder="lua command..."
                  className="flex-1 bg-transparent text-zinc-300 outline-none placeholder:text-zinc-700"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-zinc-800 border-t border-zinc-700 flex items-center justify-between px-3 text-xs shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-emerald-400">● WebGPU</span>
          <span className="text-zinc-500">Renderer: Voxel Rasterizer</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-500">Lua: 5.4</span>
          <span className="text-zinc-500">Shadows: Soft</span>
        </div>
      </div>
    </div>
  );
}

export default App;
