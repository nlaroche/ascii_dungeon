// ═══════════════════════════════════════════════════════════════════════════
// useEngineState - Zustand store with data-driven state management
// Features: setPath for any state update, diff-based history, undo/redo
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  EngineState,
  INITIAL_ENGINE_STATE,
  Diff,
  HistoryEntry,
  LogEntry,
  ChatMessage,
  Conversation,
} from './engineState';
import type { TemplateDefinition } from '../lib/templates';

// ─────────────────────────────────────────────────────────────────────────────
// Path Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatePath = (string | number)[];

// ─────────────────────────────────────────────────────────────────────────────
// Store Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineStateStore extends EngineState {
  // Core state update - THE key function
  setPath: <T>(
    path: StatePath,
    value: T,
    description?: string,
    source?: 'user' | 'ai' | 'script'
  ) => void;

  // Batch updates (multiple changes as single history entry)
  batchUpdate: (
    updates: Array<{ path: StatePath; value: unknown }>,
    description: string,
    source?: 'user' | 'ai' | 'script'
  ) => void;

  // Get value at path
  getPath: <T>(path: StatePath) => T | undefined;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Console
  log: (type: LogEntry['type'], msg: string) => void;
  clearLogs: () => void;

  // Runtime updates (no history)
  updateRuntime: (updates: Partial<EngineState['runtime']>) => void;

  // Reset
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a value from state at the given path
 */
function getValueAtPath(obj: unknown, path: StatePath): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/**
 * Set a value in state at the given path, returning new state
 * Uses immutable updates - creates new objects along the path
 */
function setValueAtPath<T>(obj: T, path: StatePath, value: unknown): T {
  if (path.length === 0) return value as T;

  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  const [key, ...rest] = path;

  if (rest.length === 0) {
    (result as Record<string | number, unknown>)[key] = value;
  } else {
    (result as Record<string | number, unknown>)[key] = setValueAtPath(
      (result as Record<string | number, unknown>)[key],
      rest,
      value
    );
  }

  return result as T;
}

/**
 * Deep clone for storing old/new values in diffs
 */
function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Create a diff entry for a single path change
 */
function createDiff(
  path: StatePath,
  oldValue: unknown,
  newValue: unknown
): Diff {
  return {
    type: 'set',
    path: [...path],
    oldValue: deepClone(oldValue),
    newValue: deepClone(newValue),
  };
}

/**
 * Apply a diff entry to state (forward or reverse)
 */
function applyDiff(state: EngineState, diff: Diff, reverse: boolean): EngineState {
  const value = reverse ? diff.oldValue : diff.newValue;
  return setValueAtPath(state, diff.path, value);
}

/**
 * Apply multiple diffs to state
 */
function applyDiffs(state: EngineState, diffs: Diff[], reverse: boolean): EngineState {
  const orderedDiffs = reverse ? [...diffs].reverse() : diffs;
  let result = state;
  for (const diff of orderedDiffs) {
    result = applyDiff(result, diff, reverse);
  }
  return result;
}

/**
 * Get current time as HH:MM:SS string
 */
function getTimeString(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// Zustand Store
// ─────────────────────────────────────────────────────────────────────────────

export const useEngineState = create<EngineStateStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...INITIAL_ENGINE_STATE,

    // ═══════════════════════════════════════════════════════════════════════
    // setPath - THE key function for updating any part of state
    // ═══════════════════════════════════════════════════════════════════════
    setPath: <T>(
      path: StatePath,
      value: T,
      description?: string,
      source: 'user' | 'ai' | 'script' = 'user'
    ) => {
      set((state) => {
        const oldValue = getValueAtPath(state, path);

        // No change? Skip
        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
          return state;
        }

        // Create diff
        const diff = createDiff(path, oldValue, value);
        const historyEntry: HistoryEntry = {
          timestamp: Date.now(),
          description: description || `Set ${path.join('.')}`,
          source,
          diff: [diff],
        };

        // Apply change
        let newState = setValueAtPath(state, path, value);

        // Update metadata
        newState = setValueAtPath(newState, ['_lastModified'], Date.now());

        // Update history
        newState = setValueAtPath(
          newState,
          ['session', 'history'],
          [...state.session.history, historyEntry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, historyEntry]
        );
        // Clear redo stack on new change
        newState = setValueAtPath(newState, ['session', 'redoStack'], []);
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // batchUpdate - Multiple changes as single history entry
    // ═══════════════════════════════════════════════════════════════════════
    batchUpdate: (
      updates: Array<{ path: StatePath; value: unknown }>,
      description: string,
      source: 'user' | 'ai' | 'script' = 'user'
    ) => {
      set((state) => {
        const diffs: Diff[] = [];
        let newState = state;

        for (const { path, value } of updates) {
          const oldValue = getValueAtPath(newState, path);
          if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            diffs.push(createDiff(path, oldValue, value));
            newState = setValueAtPath(newState, path, value);
          }
        }

        // No changes? Skip
        if (diffs.length === 0) return state;

        const historyEntry: HistoryEntry = {
          timestamp: Date.now(),
          description,
          source,
          diff: diffs,
        };

        // Update metadata
        newState = setValueAtPath(newState, ['_lastModified'], Date.now());

        // Update history
        newState = setValueAtPath(
          newState,
          ['session', 'history'],
          [...state.session.history, historyEntry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, historyEntry]
        );
        newState = setValueAtPath(newState, ['session', 'redoStack'], []);
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // getPath - Read value at any path
    // ═══════════════════════════════════════════════════════════════════════
    getPath: <T>(path: StatePath): T | undefined => {
      return getValueAtPath(get(), path) as T | undefined;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Undo
    // ═══════════════════════════════════════════════════════════════════════
    undo: () => {
      set((state) => {
        if (state.session.undoStack.length === 0) return state;

        const entry = state.session.undoStack[state.session.undoStack.length - 1];
        let newState = applyDiffs(state, entry.diff, true);

        // Update stacks
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          state.session.undoStack.slice(0, -1)
        );
        newState = setValueAtPath(
          newState,
          ['session', 'redoStack'],
          [...state.session.redoStack, entry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex - 1
        );

        return newState;
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Redo
    // ═══════════════════════════════════════════════════════════════════════
    redo: () => {
      set((state) => {
        if (state.session.redoStack.length === 0) return state;

        const entry = state.session.redoStack[state.session.redoStack.length - 1];
        let newState = applyDiffs(state, entry.diff, false);

        // Update stacks
        newState = setValueAtPath(
          newState,
          ['session', 'redoStack'],
          state.session.redoStack.slice(0, -1)
        );
        newState = setValueAtPath(
          newState,
          ['session', 'undoStack'],
          [...state.session.undoStack, entry]
        );
        newState = setValueAtPath(
          newState,
          ['session', 'historyIndex'],
          state.session.historyIndex + 1
        );

        return newState;
      });
    },

    canUndo: () => get().session.undoStack.length > 0,
    canRedo: () => get().session.redoStack.length > 0,

    // ═══════════════════════════════════════════════════════════════════════
    // Console logging
    // ═══════════════════════════════════════════════════════════════════════
    log: (type: LogEntry['type'], msg: string) => {
      set((state) => ({
        ...state,
        console: {
          ...state.console,
          logs: [
            ...state.console.logs,
            { type, msg, time: getTimeString() },
          ],
        },
      }));
    },

    clearLogs: () => {
      set((state) => ({
        ...state,
        console: { ...state.console, logs: [] },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Runtime updates (no history tracking)
    // ═══════════════════════════════════════════════════════════════════════
    updateRuntime: (updates: Partial<EngineState['runtime']>) => {
      set((state) => ({
        ...state,
        runtime: { ...state.runtime, ...updates },
      }));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Reset to initial state
    // ═══════════════════════════════════════════════════════════════════════
    reset: () => {
      set({ ...INITIAL_ENGINE_STATE, session: { ...INITIAL_ENGINE_STATE.session, startTime: Date.now() } });
    },
  }))
);

// ─────────────────────────────────────────────────────────────────────────────
// Convenience hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get theme colors
 */
export function useTheme() {
  return useEngineState((state) => state.ui.theme);
}

/**
 * Hook for UI scale
 */
export function useUIScale() {
  const scale = useEngineState((state) => state.ui.scale);
  const setPath = useEngineState((state) => state.setPath);

  const setScale = (newScale: number) => {
    setPath(['ui', 'scale'], newScale, `Set UI scale to ${Math.round(newScale * 100)}%`);
  };

  return { scale, setScale };
}

/**
 * Hook for editor mode (engine vs template)
 */
export function useEditorMode() {
  const mode = useEngineState((state) => state.ui.editorMode);
  const setPath = useEngineState((state) => state.setPath);

  const setMode = (newMode: 'engine' | 'template') => {
    setPath(['ui', 'editorMode'], newMode, `Switch to ${newMode} mode`);
  };

  const toggleMode = () => {
    setMode(mode === 'engine' ? 'template' : 'engine');
  };

  return { mode, setMode, toggleMode, isTemplateMode: mode === 'template' };
}

/**
 * Hook for active tool
 */
export function useActiveTool() {
  const active = useEngineState((state) => state.tools.active);
  const available = useEngineState((state) => state.tools.available);
  const setPath = useEngineState((state) => state.setPath);

  return {
    tool: available[active],
    setTool: (id: string) => setPath(['tools', 'active'], id, `Select ${id} tool`),
  };
}

/**
 * Hook for panel configuration
 */
export function usePanel(panelId: string) {
  const panel = useEngineState((state) => state.ui.panels[panelId]);
  const setPath = useEngineState((state) => state.setPath);

  const setActiveTab = (tabId: string) => {
    if (panel?.type === 'tabs') {
      setPath(['ui', 'panels', panelId, 'active'], tabId, `Switch to ${tabId} tab`);
    }
  };

  const toggleSection = (sectionId: string) => {
    if (panel?.type === 'stack') {
      const idx = panel.sections.findIndex((s) => s.id === sectionId);
      if (idx !== -1) {
        const collapsed = panel.sections[idx].collapsed;
        setPath(
          ['ui', 'panels', panelId, 'sections', idx, 'collapsed'],
          !collapsed,
          `${collapsed ? 'Expand' : 'Collapse'} ${sectionId}`
        );
      }
    }
  };

  return { panel, setActiveTab, toggleSection };
}

/**
 * Hook for selection
 */
export function useSelection() {
  const selection = useEngineState((state) => state.selection);
  const setPath = useEngineState((state) => state.setPath);

  return {
    selection,
    selectNode: (id: string) =>
      setPath(['selection', 'nodes'], [id], `Select node`),
    selectNodes: (ids: string[]) =>
      setPath(['selection', 'nodes'], ids, `Select ${ids.length} nodes`),
    clearSelection: () =>
      setPath(['selection', 'nodes'], [], 'Clear selection'),
    isSelected: (id: string) => selection.nodes.includes(id),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Tree Utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { Node } from './engineState';

/**
 * Find a node by ID in the tree (recursive)
 */
export function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the path to a node (array of indices)
 */
export function findNodePath(root: Node, id: string, path: number[] = []): number[] | null {
  if (root.id === id) return path;
  for (let i = 0; i < root.children.length; i++) {
    const result = findNodePath(root.children[i], id, [...path, i]);
    if (result) return result;
  }
  return null;
}

/**
 * Get all nodes flattened (for iteration)
 */
export function flattenNodes(root: Node): Node[] {
  const nodes: Node[] = [root];
  for (const child of root.children) {
    nodes.push(...flattenNodes(child));
  }
  return nodes;
}

/**
 * Hook for scene nodes
 */
export function useNodes() {
  const rootNode = useEngineState((state) => state.scene.rootNode);
  const setPath = useEngineState((state) => state.setPath);

  const getNode = (id: string): Node | null => {
    return findNode(rootNode, id);
  };

  const getAllNodes = (): Node[] => {
    return flattenNodes(rootNode);
  };

  const getNodePath = (id: string): number[] | null => {
    return findNodePath(rootNode, id);
  };

  const updateNode = (id: string, updates: Partial<Node>) => {
    const path = findNodePath(rootNode, id);
    if (!path) return;

    // Build the full state path
    const statePath: (string | number)[] = ['scene', 'rootNode'];
    for (const idx of path) {
      statePath.push('children', idx);
    }

    const node = getNode(id);
    if (node) {
      const updated = { ...node, ...updates };
      setPath(statePath, updated, `Update ${node.name}`);
    }
  };

  return { rootNode, getNode, getAllNodes, updateNode, setPath, getNodePath };
}

/**
 * Hook for chat functionality
 */
export function useChat() {
  const chat = useEngineState((state) => state.chat);
  const setPath = useEngineState((state) => state.setPath);
  const getPath = useEngineState((state) => state.getPath);

  // Get current conversation
  const currentConversation = chat.conversations.find(
    (c) => c.id === chat.currentConversationId
  );

  // Create a new conversation
  const createConversation = (title?: string): string => {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newConversation: Conversation = {
      id,
      title: title || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(['chat', 'conversations'], [...conversations, newConversation], 'Create conversation');
    setPath(['chat', 'currentConversationId'], id, 'Switch conversation');
    return id;
  };

  // Switch to a conversation
  const switchConversation = (id: string) => {
    setPath(['chat', 'currentConversationId'], id, 'Switch conversation');
  };

  // Add a message to current conversation
  const addMessage = (role: 'user' | 'assistant', content: string, status?: ChatMessage['status']): string => {
    const convId = chat.currentConversationId;
    if (!convId) return '';

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessage = {
      id: msgId,
      role,
      content,
      timestamp: Date.now(),
      status: status || 'complete',
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return '';

    const updatedConv = {
      ...conversations[convIdx],
      messages: [...conversations[convIdx].messages, message],
      updatedAt: Date.now(),
    };

    setPath(['chat', 'conversations', convIdx], updatedConv, `Add ${role} message`);
    return msgId;
  };

  // Update a message (for streaming)
  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    const convId = chat.currentConversationId;
    if (!convId) return;

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return;

    const conv = conversations[convIdx];
    const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const updatedMsg = { ...conv.messages[msgIdx], ...updates };
    const updatedMessages = [...conv.messages];
    updatedMessages[msgIdx] = updatedMsg;

    setPath(['chat', 'conversations', convIdx, 'messages'], updatedMessages, 'Update message');
  };

  // Append content to a message (for streaming)
  const appendToMessage = (messageId: string, content: string) => {
    const convId = chat.currentConversationId;
    if (!convId) return;

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    const convIdx = conversations.findIndex((c) => c.id === convId);
    if (convIdx === -1) return;

    const conv = conversations[convIdx];
    const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const currentContent = conv.messages[msgIdx].content;
    setPath(
      ['chat', 'conversations', convIdx, 'messages', msgIdx, 'content'],
      currentContent + content,
      'Stream content'
    );
  };

  // Set streaming state
  const setStreaming = (isStreaming: boolean) => {
    setPath(['chat', 'isStreaming'], isStreaming, isStreaming ? 'Start streaming' : 'Stop streaming');
  };

  // Update input draft
  const setInputDraft = (draft: string) => {
    // No history tracking for drafts - direct update
    useEngineState.setState((state) => ({
      ...state,
      chat: { ...state.chat, inputDraft: draft },
    }));
  };

  // Branch conversation at a message index
  const branchConversation = (messageIndex: number): string => {
    if (!currentConversation) return '';

    const id = `conv_${Date.now()}`;
    const newConversation: Conversation = {
      id,
      title: `${currentConversation.title} (branch)`,
      messages: currentConversation.messages.slice(0, messageIndex + 1),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: currentConversation.id,
      branchPoint: messageIndex,
    };

    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(['chat', 'conversations'], [...conversations, newConversation], 'Branch conversation');
    setPath(['chat', 'currentConversationId'], id, 'Switch to branch');
    return id;
  };

  // Delete a conversation
  const deleteConversation = (id: string) => {
    const conversations = getPath<Conversation[]>(['chat', 'conversations']) || [];
    setPath(
      ['chat', 'conversations'],
      conversations.filter((c) => c.id !== id),
      'Delete conversation'
    );

    if (chat.currentConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setPath(
        ['chat', 'currentConversationId'],
        remaining.length > 0 ? remaining[remaining.length - 1].id : null,
        'Switch conversation'
      );
    }
  };

  return {
    chat,
    currentConversation,
    conversations: chat.conversations,
    isStreaming: chat.isStreaming,
    inputDraft: chat.inputDraft,
    createConversation,
    switchConversation,
    addMessage,
    updateMessage,
    appendToMessage,
    setStreaming,
    setInputDraft,
    branchConversation,
    deleteConversation,
  };
}

/**
 * Hook for template management
 */
export function useTemplate() {
  const template = useEngineState((state) => state.template);
  const setPath = useEngineState((state) => state.setPath);
  const batchUpdate = useEngineState((state) => state.batchUpdate);
  const log = useEngineState((state) => state.log);

  // Apply a template - updates tools, render settings, etc.
  const applyTemplate = (templateDef: TemplateDefinition) => {
    console.log('[useTemplate] applyTemplate called with:', templateDef.id, templateDef.name);
    const updates: Array<{ path: (string | number)[]; value: unknown }> = [];

    // Update template state
    updates.push({ path: ['template', 'currentId'], value: templateDef.id });
    updates.push({ path: ['template', 'currentName'], value: templateDef.name });
    updates.push({ path: ['template', 'currentIcon'], value: templateDef.icon });
    updates.push({ path: ['template', 'isCustomized'], value: false });

    // Apply render settings if provided
    if (templateDef.render) {
      // Camera mode
      if (templateDef.render.mode) {
        const modeMap: Record<string, string> = {
          isometric: 'orthographic',
          table: 'topdown',
          sidescroll: 'orthographic',
          free3d: 'perspective',
        };
        updates.push({
          path: ['camera', 'mode'],
          value: modeMap[templateDef.render.mode] || 'perspective',
        });
      }

      // Grid
      if (templateDef.render.grid !== undefined) {
        updates.push({
          path: ['views', 'scene', 'showGrid'],
          value: templateDef.render.grid.enabled ?? true,
        });
        if (templateDef.render.grid.size) {
          updates.push({
            path: ['views', 'scene', 'gridSize'],
            value: templateDef.render.grid.size,
          });
        }
      }

      // Post-process / render mode
      if (templateDef.render.postProcess) {
        // Map post-process presets to render modes
        updates.push({
          path: ['views', 'scene', 'renderMode'],
          value: 'lit',
        });
      }
    }

    // Apply tools if provided
    if (templateDef.view?.tools) {
      // Merge template tools with core tools
      const coreTools = {
        select: {
          id: 'select',
          name: 'Select',
          icon: '◇',
          shortcut: 'V',
          cursor: 'default',
          description: 'Select and inspect entities',
        },
        move: {
          id: 'move',
          name: 'Move',
          icon: '✥',
          shortcut: 'G',
          cursor: 'move',
          description: 'Move selected entities',
        },
      };

      const templateTools: Record<string, unknown> = {};
      for (const [id, tool] of Object.entries(templateDef.view.tools)) {
        templateTools[id] = {
          ...tool,
          cursor: 'crosshair',
          description: tool.name,
        };
      }

      updates.push({
        path: ['tools', 'available'],
        value: { ...coreTools, ...templateTools },
      });

      // Set default tool
      if (templateDef.view.defaultTool) {
        updates.push({
          path: ['tools', 'active'],
          value: templateDef.view.defaultTool,
        });
      }
    }

    // Apply all updates as a batch
    console.log('[useTemplate] Applying updates:', updates);
    batchUpdate(updates, `Apply template: ${templateDef.name}`);
    log('success', `Applied template: ${templateDef.name}`);
    console.log('[useTemplate] Template applied successfully');
  };

  // Simple switch (just changes the ID, for when full template def isn't available)
  const switchTemplate = (id: string, name: string, icon?: string) => {
    batchUpdate([
      { path: ['template', 'currentId'], value: id },
      { path: ['template', 'currentName'], value: name },
      { path: ['template', 'currentIcon'], value: icon || '◇' },
      { path: ['template', 'isCustomized'], value: false },
    ], `Switch to ${name} template`);
    log('success', `Switched to template: ${name}`);
  };

  // Mark template as customized
  const markCustomized = () => {
    if (!template.isCustomized) {
      setPath(['template', 'isCustomized'], true, 'Customize template');
    }
  };

  return {
    currentId: template.currentId,
    currentName: template.currentName,
    currentIcon: template.currentIcon,
    availableIds: template.availableIds,
    isCustomized: template.isCustomized,
    switchTemplate,
    applyTemplate,
    markCustomized,
  };
}
