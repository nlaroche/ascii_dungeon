/**
 * Thin shell: delegates all game logic to the ECS world.
 *
 * @example
 * const game = new Game(renderer);
 * game.start();
 * game.handleInput('w');
 */

import { createGameWorld } from './createGameWorld.js';

export class Game {
  constructor(renderer) {
    this.renderer = renderer;
    this.world = null;
    this.playerId = null;
    this._animFrame = null;
    this._lastTime = 0;
  }

  start() {
    const { world, playerId } = createGameWorld({ renderer: this.renderer });
    this.world = world;
    this.playerId = playerId;
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    // Update ECS world — all systems run in pipeline order
    const time = this.world.getResource('time');
    time.elapsed += dt;
    this.world.update(dt);

    // Clear input after each frame
    const input = this.world.getResource('input');
    input.key = null;

    this._animFrame = requestAnimationFrame((t) => this._loop(t));
  }

  handleInput(key) {
    if (!this.world) return;
    const input = this.world.getResource('input');
    input.key = key;
  }

  stop() {
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
  }
}
