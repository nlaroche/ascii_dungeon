import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface EngineStats {
  fps: number;
  frameTime: number;
  instanceCount: number;
  lightCount: number;
}

export interface CameraState {
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export interface EngineState {
  // Connection state
  connected: boolean;
  engineRunning: boolean;

  // Engine data
  stats: EngineStats | null;
  camera: CameraState | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshCamera: () => Promise<void>;
  setCamera: (camera: Partial<CameraState>) => Promise<void>;
}

let unlistenFrame: UnlistenFn | null = null;
let unlistenEngineStatus: UnlistenFn | null = null;

export const useEngineStore = create<EngineState>((set, get) => ({
  connected: false,
  engineRunning: false,
  stats: null,
  camera: null,

  connect: async () => {
    try {
      // Listen for frame events from engine
      unlistenFrame = await listen<{
        fps: number;
        dt: number;
        frame: number;
      }>("engine:frame", (event) => {
        set({
          stats: {
            fps: event.payload.fps,
            frameTime: event.payload.dt,
            instanceCount: get().stats?.instanceCount ?? 0,
            lightCount: get().stats?.lightCount ?? 0,
          },
        });
      });

      // Listen for engine status changes
      unlistenEngineStatus = await listen<{ running: boolean }>(
        "engine:status",
        (event) => {
          set({ engineRunning: event.payload.running });
        }
      );

      set({ connected: true });
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  },

  disconnect: () => {
    if (unlistenFrame) {
      unlistenFrame();
      unlistenFrame = null;
    }
    if (unlistenEngineStatus) {
      unlistenEngineStatus();
      unlistenEngineStatus = null;
    }
    set({ connected: false });
  },

  startEngine: async () => {
    try {
      console.log("Starting engine...");
      await invoke("start_engine");
      console.log("Engine started successfully");
      set({ engineRunning: true });
    } catch (error) {
      console.error("Failed to start engine:", error);
      alert(`Failed to start engine: ${error}`);
    }
  },

  stopEngine: async () => {
    try {
      await invoke("stop_engine");
      set({ engineRunning: false, stats: null, camera: null });
    } catch (error) {
      console.error("Failed to stop engine:", error);
    }
  },

  refreshStats: async () => {
    try {
      const stats = await invoke<EngineStats>("get_stats");
      set({ stats });
    } catch (error) {
      console.error("Failed to get stats:", error);
    }
  },

  refreshCamera: async () => {
    try {
      const camera = await invoke<CameraState>("get_camera");
      set({ camera });
    } catch (error) {
      console.error("Failed to get camera:", error);
    }
  },

  setCamera: async (camera: Partial<CameraState>) => {
    try {
      await invoke("set_camera", { camera });
      await get().refreshCamera();
    } catch (error) {
      console.error("Failed to set camera:", error);
    }
  },
}));
