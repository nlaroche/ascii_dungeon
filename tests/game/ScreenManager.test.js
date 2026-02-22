import { describe, it, expect, vi } from 'vitest';
import { ScreenManager } from '../../src/game/ScreenManager.js';

// Minimal mock renderer
const mockRenderer = {
  gridWidth: 80,
  gridHeight: 50,
  clearGrid: vi.fn(),
};

function makeScreen(name) {
  return {
    enter: vi.fn(),
    exit: vi.fn(),
    update: vi.fn(),
    render: vi.fn(),
    handleInput: vi.fn(),
    _name: name,
  };
}

describe('ScreenManager', () => {
  it('transitions to named screen calling enter/exit', () => {
    const a = makeScreen('a');
    const b = makeScreen('b');
    const sm = new ScreenManager(mockRenderer, null, { a, b, intro: a });

    sm.transition('a');
    expect(a.enter).toHaveBeenCalledOnce();

    sm.transition('b');
    expect(a.exit).toHaveBeenCalledOnce();
    expect(b.enter).toHaveBeenCalledOnce();
  });

  it('throws on unknown screen name', () => {
    const sm = new ScreenManager(mockRenderer, null, {});
    expect(() => sm.transition('nonexistent')).toThrow('Unknown screen');
  });

  it('forwards handleInput to current screen', () => {
    const a = makeScreen('a');
    const sm = new ScreenManager(mockRenderer, null, { a, intro: a });
    sm.transition('a');

    sm.handleInput('ArrowUp');
    expect(a.handleInput).toHaveBeenCalledWith(sm.ctx, 'ArrowUp');
  });

  it('setSession updates session', () => {
    const sm = new ScreenManager(mockRenderer, null, {});
    expect(sm.session).toBeNull();
    sm.setSession({ player: { hp: 50 } });
    expect(sm.session.player.hp).toBe(50);
  });

  it('ctx returns renderer, session, and screenManager', () => {
    const session = { player: {} };
    const sm = new ScreenManager(mockRenderer, session, {});
    const ctx = sm.ctx;
    expect(ctx.renderer).toBe(mockRenderer);
    expect(ctx.session).toBe(session);
    expect(ctx.screenManager).toBe(sm);
  });
});
