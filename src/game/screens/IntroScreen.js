/**
 * IntroScreen — Dungeon scene background with Svelte overlay for menu.
 * Background renders auto-exploring dungeon via dungeonScene.js.
 * UI (title, menu, torches) is handled by IntroOverlay.svelte in App.svelte.
 */

import { onSetup as dungeonSetup, onFrame as dungeonFrame, setConfig } from '../../workbench/scenes/dungeonScene.js';
import { GameSession } from '../GameSession.js';

export const IntroScreen = {
  _dt: 0.016,
  _initialized: false,

  enter(ctx) {
    const { renderer } = ctx;
    setConfig({ animSpeed: 0.6, torchIntensity: 0.5, visionRadius: 8 });
    dungeonSetup(renderer);
    this._initialized = true;
  },

  exit(_ctx) {
    this._initialized = false;
  },

  update(_ctx, dt) {
    this._dt = dt;
  },

  /** Menu actions are handled by IntroOverlay.svelte via App.svelte */
  handleInput(_ctx, _key) {},
  handleMouseMove(_ctx, _gx, _gy) {},
  handleClick(_ctx, _gx, _gy) {},

  /** Called from App.svelte when IntroOverlay dispatches menuSelect */
  activateMenu(ctx, action) {
    const { screenManager } = ctx;
    if (action === 'new-run') {
      const session = GameSession.create();
      GameSession.save(session);
      screenManager.setSession(session);
      screenManager.transition('town');
    } else if (action === 'continue') {
      const session = GameSession.load();
      if (session) {
        screenManager.setSession(session);
        screenManager.transition('town');
      }
    }
  },

  render(ctx) {
    if (!this._initialized) return;
    const { renderer } = ctx;
    dungeonFrame(renderer, this._dt);
  },
};
