import { create } from "zustand";

export interface LogEntry {
  type: "info" | "warn" | "error" | "success";
  time: string;
  msg: string;
}

export interface Entity {
  id: string;
  type: string;
  pos: string;
  hp: string;
}

export interface FileItem {
  name: string;
  type: "file" | "folder";
  active?: boolean;
  children?: FileItem[];
}

export interface EditorState {
  // Engine state
  engineRunning: boolean;
  fps: number;
  frameTime: number;

  // Editor state
  activeTab: "map" | "code" | "sprites" | "materials";
  currentTool: "select" | "paint" | "erase" | "fill";
  currentBrush: string;
  selectedCell: { x: number; y: number };
  selectedEntity: string | null;
  expandedFolders: string[];

  // Data
  logs: LogEntry[];
  entities: Entity[];
  files: FileItem[];
  mapData: string;
  luaCode: string;

  // Actions
  setEngineRunning: (running: boolean) => void;
  setActiveTab: (tab: EditorState["activeTab"]) => void;
  setCurrentTool: (tool: EditorState["currentTool"]) => void;
  setCurrentBrush: (brush: string) => void;
  setSelectedCell: (cell: { x: number; y: number }) => void;
  setSelectedEntity: (id: string | null) => void;
  toggleFolder: (name: string) => void;
  addLog: (entry: Omit<LogEntry, "time">) => void;
  clearLogs: () => void;
}

const DEFAULT_MAP = `####################
#..................#
#..###..........#..#
#..#*#..........#..#
#..###..........#..#
#.........g........#
#..................#
#.....~~~~~~.......#
#.....~~~~~~.......#
#.....~~~~~~.......#
#..................#
#..........T.......#
#...@..............#
#..................#
####################`;

const DEFAULT_LUA = `-- sprites/enemies.lua

sprites.goblin = sprite {
    id = "goblin",
    art = {
        "  ^  ",
        " (g) ",
        " /|\\\\ ",
        " / \\\\ ",
    },
    materials = {
        ["^"] = { color = DARK_GREEN },
        ["g"] = {
            color = GREEN,
            emission = {0.2, 0.4, 0.1},
            emission_power = 0.5
        },
    },
}

function goblin_ai(self, combat)
    if self.hp < self.max_hp * 0.3 then
        if math.random() < 0.3 then
            return { action = "flee" }
        end
    end
    return { action = "attack", target = combat.player }
end`;

const DEFAULT_FILES: FileItem[] = [
  { name: "main.lua", type: "file" },
  {
    name: "game/",
    type: "folder",
    children: [
      { name: "state.lua", type: "file" },
      { name: "combat.lua", type: "file" },
      { name: "entity.lua", type: "file" },
    ],
  },
  {
    name: "view/",
    type: "folder",
    children: [
      { name: "first_person.lua", type: "file", active: true },
      { name: "isometric.lua", type: "file" },
    ],
  },
  {
    name: "sprites/",
    type: "folder",
    children: [
      { name: "enemies.lua", type: "file" },
      { name: "player.lua", type: "file" },
    ],
  },
  {
    name: "maps/",
    type: "folder",
    children: [{ name: "test_dungeon.lua", type: "file" }],
  },
];

const DEFAULT_ENTITIES: Entity[] = [
  { id: "player", type: "Player", pos: "4, 12", hp: "100/100" },
  { id: "goblin_1", type: "Enemy", pos: "10, 5", hp: "25/25" },
  { id: "troll_1", type: "Enemy", pos: "11, 11", hp: "80/80" },
  { id: "torch_1", type: "Light", pos: "4, 3", hp: "-" },
  { id: "torch_2", type: "Light", pos: "15, 7", hp: "-" },
];

const DEFAULT_LOGS: LogEntry[] = [
  { type: "info", time: "12:04:32", msg: "Engine started" },
  { type: "info", time: "12:04:32", msg: "Vulkan RT initialized (RTX 3070 Ti)" },
  { type: "info", time: "12:04:33", msg: "Loaded 24 sprites" },
  { type: "info", time: "12:04:33", msg: "Loaded map: test_dungeon" },
  { type: "warn", time: "12:04:33", msg: 'Entity "torch_3" has no shadow caster' },
  { type: "info", time: "12:04:34", msg: "Lua hot reload: sprites/enemies.lua" },
  { type: "success", time: "12:04:34", msg: "Frame time: 8.2ms (122 FPS)" },
];

export const useEditorStore = create<EditorState>((set) => ({
  // Engine state
  engineRunning: true,
  fps: 122,
  frameTime: 8.2,

  // Editor state
  activeTab: "map",
  currentTool: "select",
  currentBrush: "#",
  selectedCell: { x: 4, y: 3 },
  selectedEntity: "goblin_1",
  expandedFolders: ["game/", "view/", "sprites/"],

  // Data
  logs: DEFAULT_LOGS,
  entities: DEFAULT_ENTITIES,
  files: DEFAULT_FILES,
  mapData: DEFAULT_MAP,
  luaCode: DEFAULT_LUA,

  // Actions
  setEngineRunning: (running) => set({ engineRunning: running }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCurrentBrush: (brush) => set({ currentBrush: brush }),
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  setSelectedEntity: (id) => set({ selectedEntity: id }),
  toggleFolder: (name) =>
    set((state) => ({
      expandedFolders: state.expandedFolders.includes(name)
        ? state.expandedFolders.filter((f) => f !== name)
        : [...state.expandedFolders, name],
    })),
  addLog: (entry) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          ...entry,
          time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
}));
