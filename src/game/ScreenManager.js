/**
 * ScreenManager — Screen lifecycle manager + RAF loop.
 * Replaces Game.js as the top-level controller.
 *
 * Each screen implements:
 *   { enter(ctx), exit(ctx), update(ctx, dt), render(ctx),
 *     handleInput(ctx, key), handleMouseMove?(ctx, gx, gy), handleClick?(ctx, gx, gy) }
 *
 * @example
 * const sm = new ScreenManager(renderer, session, screens);
 * sm.start(); // begins on 'intro'
 */

export class ScreenManager {
  /**
   * @param {object} renderer Renderer instance
   * @param {object|null} session Initial session (null = no save loaded)
   * @param {object} screens Screen registry { name: screenObject }
   */
  constructor(renderer, session, screens, opts = {}) {
    this.renderer = renderer;
    this.session = session;
    this.screens = screens;
    this.currentScreenName = null;
    this.currentScreen = null;
    this._animFrame = null;
    this._lastTime = 0;
    this._onBeforeFrame = opts.onBeforeFrame || null;
  }

  /** @returns {object} Context passed to all screen methods */
  get ctx() {
    return {
      renderer: this.renderer,
      session: this.session,
      screenManager: this,
    };
  }

  /**
   * Transition to a named screen.
   * @param {string} screenName
   */
  transition(screenName) {
    const next = this.screens[screenName];
    if (!next) throw new Error(`Unknown screen: ${screenName}`);

    if (this.currentScreen && this.currentScreen.exit) {
      this.currentScreen.exit(this.ctx);
    }

    this.currentScreenName = screenName;
    this.currentScreen = next;

    if (this.currentScreen.enter) {
      this.currentScreen.enter(this.ctx);
    }
  }

  /**
   * Update the session (screens mutate session through this).
   * @param {object} newSession
   */
  setSession(newSession) {
    this.session = newSession;
  }

  /** Start the RAF loop on the intro screen. */
  start() {
    this.transition('intro');
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  /** Stop the RAF loop. */
  stop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }

  /**
   * Forward keyboard input to the current screen.
   * @param {string} key
   */
  handleInput(key) {
    if (this.currentScreen && this.currentScreen.handleInput) {
      this.currentScreen.handleInput(this.ctx, key);
    }
  }

  /**
   * Forward mouse move to the current screen (grid coordinates).
   * @param {number} gx Grid X
   * @param {number} gy Grid Y
   */
  handleMouseMove(gx, gy) {
    if (this.currentScreen && this.currentScreen.handleMouseMove) {
      this.currentScreen.handleMouseMove(this.ctx, gx, gy);
    }
  }

  /**
   * Forward mouse click to the current screen (grid coordinates).
   * @param {number} gx Grid X
   * @param {number} gy Grid Y
   */
  handleClick(gx, gy) {
    if (this.currentScreen && this.currentScreen.handleClick) {
      this.currentScreen.handleClick(this.ctx, gx, gy);
    }
  }

  /** @private */
  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    if (this._onBeforeFrame) this._onBeforeFrame();

    if (this.currentScreen) {
      if (this.currentScreen.update) {
        this.currentScreen.update(this.ctx, dt);
      }
      if (this.currentScreen.render) {
        this.currentScreen.render(this.ctx);
      }
    }

    this._animFrame = requestAnimationFrame((t) => this._loop(t));
  }
}
