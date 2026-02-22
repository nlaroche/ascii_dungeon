import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntroScreen } from '../../../src/game/screens/IntroScreen.js';
import { GameSession } from '../../../src/game/GameSession.js';

// Mock localStorage
const store = {};
globalThis.localStorage = {
  getItem: vi.fn((key) => store[key] ?? null),
  setItem: vi.fn((key, val) => { store[key] = val; }),
  removeItem: vi.fn((key) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};

// Mock renderer
const mockRenderer = {
  gridWidth: 80,
  gridHeight: 50,
  clearGrid: vi.fn(),
  setCell: vi.fn(),
  tilemap: { setTile: vi.fn(), clearGrid: vi.fn() },
};

function makeCtx(session = null) {
  return {
    renderer: mockRenderer,
    session,
    screenManager: {
      setSession: vi.fn(),
      transition: vi.fn(),
    },
  };
}

describe('IntroScreen', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.clearAllMocks();
  });

  it('shows only New Run when no save exists', () => {
    const ctx = makeCtx();
    IntroScreen.enter(ctx);
    expect(IntroScreen._menuItems).toHaveLength(1);
    expect(IntroScreen._menuItems[0].label).toContain('New Run');
  });

  it('shows Continue + New Run when save exists', () => {
    GameSession.save(GameSession.create());
    const ctx = makeCtx();
    IntroScreen.enter(ctx);
    expect(IntroScreen._menuItems).toHaveLength(2);
    expect(IntroScreen._menuItems[0].label).toContain('Continue');
    expect(IntroScreen._menuItems[1].label).toContain('New Run');
  });

  it('New Game creates session and transitions to town', () => {
    const ctx = makeCtx();
    IntroScreen.enter(ctx);
    IntroScreen.handleInput(ctx, 'Enter');
    expect(ctx.screenManager.setSession).toHaveBeenCalled();
    expect(ctx.screenManager.transition).toHaveBeenCalledWith('town');
  });

  it('arrow keys navigate menu', () => {
    GameSession.save(GameSession.create());
    const ctx = makeCtx();
    IntroScreen.enter(ctx);

    expect(IntroScreen._selected).toBe(0);
    IntroScreen.handleInput(ctx, 'ArrowDown');
    expect(IntroScreen._selected).toBe(1);
    IntroScreen.handleInput(ctx, 'ArrowUp');
    expect(IntroScreen._selected).toBe(0);
  });
});
