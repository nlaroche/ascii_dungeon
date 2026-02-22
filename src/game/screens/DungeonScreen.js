/**
 * DungeonScreen — Wraps the ECS world for dungeon exploration.
 * Creates a new ECS world on enter, runs auto-explore, drains stamina,
 * and transitions to runComplete when stamina/hp runs out or floors cleared.
 */

import { createGameWorld } from '../createGameWorld.js';
import { getDungeonConfig, advanceFloor, spendStamina, hasStamina } from '../../lib/run.js';
import { GameSession } from '../GameSession.js';
import { COMPONENTS } from '../../ecs/components.js';
import { EVENTS } from '../../ecs/events.js';

export const DungeonScreen = {
  /** @type {object|null} */
  _world: null,
  /** @type {number|null} */
  _playerId: null,
  /** @type {number} Auto-explore tick timer */
  _autoTimer: 0,
  /** @type {number} Seconds between auto-explore actions */
  _autoInterval: 0.15,
  /** @type {boolean} */
  _runEnding: false,

  enter(ctx) {
    this._runEnding = false;
    this._autoTimer = 0;
    this._spawnWorld(ctx);
  },

  exit(_ctx) {
    this._world = null;
    this._playerId = null;
  },

  _spawnWorld(ctx) {
    const { renderer, session } = ctx;
    const run = session.currentRun;
    const config = getDungeonConfig(run.floor, run.day);

    const { world, playerId } = createGameWorld({
      renderer,
      dungeonWidth: config.width,
      dungeonHeight: config.height,
      roomCount: config.roomCount,
    });

    this._world = world;
    this._playerId = playerId;

    // Sync session player stats into ECS entity
    this._syncPlayerToECS(session.player);
  },

  /** Push session player stats into ECS components. */
  _syncPlayerToECS(player) {
    const world = this._world;
    const id = this._playerId;
    if (!world || id == null) return;

    const health = world.getComponent(id, COMPONENTS.HEALTH);
    if (health) {
      health.hp = player.hp;
      health.maxHp = player.maxHp;
    }

    const stats = world.getComponent(id, COMPONENTS.COMBAT_STATS);
    if (stats) {
      stats.attack = player.attack;
      stats.defense = player.defense;
    }

    const stamina = world.getComponent(id, COMPONENTS.STAMINA);
    if (stamina) {
      stamina.current = player.stamina;
      stamina.max = player.maxStamina;
    }
  },

  /** Pull ECS entity stats back into session player. */
  _syncECSToSession(ctx) {
    const world = this._world;
    const id = this._playerId;
    if (!world || id == null) return;

    const health = world.getComponent(id, COMPONENTS.HEALTH);
    const stamina = world.getComponent(id, COMPONENTS.STAMINA);
    const inv = world.getComponent(id, COMPONENTS.INVENTORY);

    let player = { ...ctx.session.player };
    if (health) {
      player.hp = health.hp;
      player.maxHp = health.maxHp;
    }
    if (stamina) {
      player.stamina = stamina.current;
      player.maxStamina = stamina.max;
    }
    if (inv) {
      player.gold = inv.gold;
    }

    const newSession = { ...ctx.session, player };
    ctx.screenManager.setSession(newSession);
  },

  update(ctx, dt) {
    if (!this._world || this._runEnding) return;

    // Auto-explore on a timer
    this._autoTimer += dt;
    if (this._autoTimer >= this._autoInterval) {
      this._autoTimer -= this._autoInterval;
      this._doAutoExplore(ctx);
    }

    // Run ECS frame
    const time = this._world.getResource('time');
    time.elapsed += dt;
    this._world.update(dt);

    // Clear input after frame
    const input = this._world.getResource('input');
    input.key = null;

    // Sync ECS → session
    this._syncECSToSession(ctx);

    // Check end conditions
    this._checkEndConditions(ctx);
  },

  handleInput(ctx, key) {
    if (!this._world) return;
    const input = this._world.getResource('input');
    input.key = key;
  },

  render(ctx) {
    const { renderer } = ctx;
    // Center dungeon in viewport by offsetting camera
    if (this._world) {
      const dungeon = this._world.getResource('dungeon');
      const pos = this._playerId != null
        ? this._world.getComponent(this._playerId, COMPONENTS.POSITION)
        : null;
      if (dungeon && pos) {
        // Center viewport on player
        const halfW = Math.floor(renderer.gridWidth / 2);
        const halfH = Math.floor(renderer.gridHeight / 2);
        renderer.cameraOffsetX = -(pos.x - halfW) * renderer.cellSize;
        renderer.cameraOffsetY = -(pos.y - halfH) * renderer.cellSize * 1.5;
      }
    }
    renderer.render();
  },

  /** BFS auto-explore: find nearest target and inject a move key. */
  _doAutoExplore(ctx) {
    const world = this._world;
    if (!world) return;

    const dungeon = world.getResource('dungeon');
    if (!dungeon) return;

    const pos = world.getComponent(this._playerId, COMPONENTS.POSITION);
    if (!pos) return;

    // Check stamina — if too low, end run
    const stamina = world.getComponent(this._playerId, COMPONENTS.STAMINA);
    if (stamina && stamina.current <= 0) return;

    // Find all enemy positions
    const enemies = world.query([COMPONENTS.POSITION, COMPONENTS.AI]);
    const enemyPositions = new Set();
    for (const eid of enemies) {
      if (!world.isAlive(eid)) continue;
      const epos = world.getComponent(eid, COMPONENTS.POSITION);
      enemyPositions.add(`${epos.x},${epos.y}`);
    }

    // Find all collectable positions
    const collectables = world.query([COMPONENTS.POSITION, COMPONENTS.COLLECTABLE]);
    const collectPositions = new Set();
    for (const cid of collectables) {
      if (!world.isAlive(cid)) continue;
      const cpos = world.getComponent(cid, COMPONENTS.POSITION);
      collectPositions.add(`${cpos.x},${cpos.y}`);
    }

    // BFS from player position
    const grid = dungeon.grid;
    const move = this._bfs(pos.x, pos.y, grid, dungeon.width, dungeon.height, enemyPositions, collectPositions);

    if (move) {
      const input = world.getResource('input');
      if (move.dx === 0 && move.dy === -1) input.key = 'w';
      else if (move.dx === 0 && move.dy === 1) input.key = 's';
      else if (move.dx === -1 && move.dy === 0) input.key = 'a';
      else if (move.dx === 1 && move.dy === 0) input.key = 'd';
    }
  },

  /**
   * BFS to find nearest interesting target and return first step direction.
   * Priority: enemy (adjacent=attack) > collectable > unexplored floor.
   */
  _bfs(startX, startY, grid, width, height, enemyPositions, collectPositions) {
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    // Check for adjacent enemy first (attack immediately)
    for (const d of dirs) {
      const key = `${startX + d.dx},${startY + d.dy}`;
      if (enemyPositions.has(key)) {
        return d;
      }
    }

    // BFS to find nearest target
    const visited = new Set();
    visited.add(`${startX},${startY}`);
    // Each entry: [x, y, firstDx, firstDy]
    const queue = [];

    for (const d of dirs) {
      const nx = startX + d.dx;
      const ny = startY + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const cell = grid[ny][nx];
      if (cell.type === 'wall') continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push([nx, ny, d.dx, d.dy]);
    }

    let qi = 0;
    while (qi < queue.length) {
      const [x, y, firstDx, firstDy] = queue[qi++];
      const key = `${x},${y}`;

      // Check if this is a target
      if (enemyPositions.has(key) || collectPositions.has(key)) {
        return { dx: firstDx, dy: firstDy };
      }

      // Unexplored tile is a low-priority target
      const cell = grid[y][x];
      if (!cell.explored) {
        return { dx: firstDx, dy: firstDy };
      }

      // Expand
      for (const d of dirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nCell = grid[ny][nx];
        if (nCell.type === 'wall') continue;
        const nKey = `${nx},${ny}`;
        if (visited.has(nKey)) continue;
        visited.add(nKey);
        queue.push([nx, ny, firstDx, firstDy]);
      }
    }

    // No target found — just try to move in any valid direction
    for (const d of dirs) {
      const nx = startX + d.dx;
      const ny = startY + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (grid[ny][nx].type !== 'wall') return d;
    }

    return null;
  },

  _checkEndConditions(ctx) {
    if (this._runEnding) return;

    const world = this._world;
    if (!world) return;

    const health = world.getComponent(this._playerId, COMPONENTS.HEALTH);
    const stamina = world.getComponent(this._playerId, COMPONENTS.STAMINA);
    const session = ctx.session;

    // Death
    if (health && health.hp <= 0) {
      this._endRun(ctx, 'death');
      return;
    }

    // Stamina depleted
    if (stamina && stamina.current <= 0) {
      this._endRun(ctx, 'retired');
      return;
    }

    // Check if all enemies are dead (floor cleared)
    const enemies = world.query([COMPONENTS.POSITION, COMPONENTS.AI]);
    let aliveEnemies = 0;
    for (const eid of enemies) {
      if (world.isAlive(eid)) {
        const h = world.getComponent(eid, COMPONENTS.HEALTH);
        if (h && h.hp > 0) aliveEnemies++;
      }
    }

    if (aliveEnemies === 0) {
      // Try to advance floor
      const run = session.currentRun;
      const advanced = advanceFloor(run);
      if (advanced) {
        // Next floor
        const newSession = { ...session, currentRun: advanced };
        ctx.screenManager.setSession(newSession);
        this._spawnWorld(ctx);
      } else {
        // Max floors reached — run complete
        this._endRun(ctx, 'cleared');
      }
    }
  },

  _endRun(ctx, reason) {
    this._runEnding = true;
    let session = ctx.session;
    session = GameSession.endRun(session, reason);
    GameSession.save(session);
    ctx.screenManager.setSession(session);
    ctx.screenManager.transition('runComplete');
  },
};
