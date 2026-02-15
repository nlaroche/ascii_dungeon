import { createPlayer, addGold, addXp, applyDamage } from '../lib/index.js';
import { generateDungeon } from '../lib/index.js';
import { resolveCombat, collectTreasure } from '../lib/index.js';
import { decideAction } from '../lib/index.js';
import { CELL_FLAGS } from '../renderer/Renderer.js';
import { ECHO_TYPES, createEchoState, incrementEcho, getEchoBonuses, clearNewAffinityFlag } from '../lib/echoes.js';

/**
 * Main Game Logic
 * Handles dungeon runs, stamina, loot, and town phases
 */
export class Game {
  constructor(renderer) {
    this.renderer = renderer;
    this.state = {
      phase: 'dungeon', // 'dungeon' | 'summary' | 'town'
      dungeon: null,
      player: createPlayer(),
      echoes: createEchoState(),
      runStats: {
        enemiesKilled: 0,
        treasureFound: 0,
        stepsTaken: 0,
        damageDealt: 0,
        damageTaken: 0
      },
      log: [],
      lastUpdate: Date.now()
    };
  }

  start() {
    this.startDungeonRun();
    this.gameLoop();
  }

  startDungeonRun() {
    // Check for echo bonuses for run start
    const echoBonuses = getEchoBonuses(this.state.echoes);
    
    this.state.phase = 'dungeon';
    this.state.dungeon = generateDungeon({
      width: 20,
      height: 15,
      roomCount: 5,
      playerLevel: this.state.player.level
    });
    
    // Apply echo bonuses to player
    let baseMaxHp = this.state.player.maxHp;
    let baseHp = this.state.player.hp;
    
    // Start HP multiplier (e.g., Revenant)
    const hpMultiplier = echoBonuses.startHpMultiplier;
    const bonusMaxHp = echoBonuses.maxHpBonus;
    
    this.state.player = {
      ...this.state.player,
      hp: Math.floor(baseHp * hpMultiplier) + bonusMaxHp,
      maxHp: Math.floor(baseMaxHp * hpMultiplier) + bonusMaxHp,
      stamina: this.state.player.maxStamina,
      x: 1,
      y: 1
    };
    this.state.runStats = {
      enemiesKilled: 0,
      treasureFound: 0,
      stepsTaken: 0,
      damageDealt: 0,
      damageTaken: 0
    };
    this.state.echoes = clearNewAffinityFlag(this.state.echoes);
    this.log("Entered the dungeon...");
    
    // Check for new affinity unlocks to display
    if (this.state.echoes.newAffinityThisRun) {
      const { getAffinityInfo } = require('../lib/echoes.js');
      const affinities = getAffinityInfo(this.state.echoes);
      const latest = affinities[affinities.length - 1];
      if (latest) {
        this.log(`✨ AFFINITY UNLOCKED: ${latest.label} - ${latest.description}`);
      }
    }
  }

  gameLoop() {
    const now = Date.now();
    const dt = (now - this.state.lastUpdate) / 1000;
    this.state.lastUpdate = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  update(dt) {
    if (this.state.phase === 'dungeon') {
      // AI-driven action every second
      if (this.state.player.stamina > 0) {
        this.performAIAction();
      } else {
        this.endDungeonRun();
      }
    }
  }

  performAIAction() {
    const player = this.state.player;
    const dungeon = this.state.dungeon;
    
    // Use AI library to decide action
    const action = decideAction(
      { x: player.x, y: player.y },
      dungeon.grid,
      { width: dungeon.width, height: dungeon.height }
    );
    
    if (action.type === 'attack') {
      this.combat(action.target);
    } else if (action.type === 'move') {
      this.performMove(action.dx, action.dy);
    }
  }

  performMove(dx, dy) {
    const player = this.state.player;
    const dungeon = this.state.dungeon;
    const nx = player.x + dx;
    const ny = player.y + dy;
    
    if (ny >= 0 && ny < dungeon.height && nx >= 0 && nx < dungeon.width) {
      const cell = dungeon.grid[ny][nx];
      
      if (cell.type === 'floor') {
        // Update player position
        this.state.player = {
          ...player,
          x: nx,
          y: ny,
          stamina: player.stamina - 1
        };
        
        cell.explored = true;
        this.state.runStats.stepsTaken++;
        
        // Track EXPLORE echo every 10 steps
        if (this.state.runStats.stepsTaken % 10 === 0) {
          this.state.echoes = incrementEcho(this.state.echoes, ECHO_TYPES.EXPLORE);
          
          // Check for new affinity
          if (this.state.echoes.newAffinityThisRun) {
            const { getAffinityInfo } = require('../lib/echoes.js');
            const affinities = getAffinityInfo(this.state.echoes);
            const latest = affinities[affinities.length - 1];
            if (latest) {
              this.log(`✨ AFFINITY UNLOCKED: ${latest.label} - ${latest.description}`);
            }
            this.state.echoes = clearNewAffinityFlag(this.state.echoes);
          }
        }
        
        // Check for treasure
        if (cell.contents && cell.contents.type === 'treasure') {
          this.handleTreasure(nx, ny, cell.contents);
          cell.contents = null;
        }
      }
    }
  }

  combat(enemy) {
    const player = this.state.player;
    
    // Use combat library to resolve combat
    const result = resolveCombat(player, enemy);
    
    this.state.runStats.damageDealt += result.defenderDamage;
    this.log(`You hit the ${enemy.symbol} for ${result.defenderDamage} damage!`);
    
    // Update enemy in grid
    if (!result.defenderKilled) {
      this.state.dungeon.grid[enemy.y][enemy.x].contents = {
        ...enemy,
        hp: result.defenderHp
      };
    } else {
      // Enemy killed!
      this.state.runStats.enemiesKilled++;
      
      // Apply echo bonuses
      const echoBonuses = getEchoBonuses(this.state.echoes);
      let goldGained = result.loot.gold;
      let xpGained = result.loot.xp;
      
      // Gold per kill (e.g., Treasure Hunter combo)
      if (echoBonuses.goldPerKill > 0) {
        goldGained += echoBonuses.goldPerKill;
      }
      
      // Gold bonus from echoes
      if (echoBonuses.goldBonus > 0) {
        goldGained = Math.floor(goldGained * (1 + echoBonuses.goldBonus));
      }
      
      this.state.runStats.gold = (this.state.runStats.gold || 0) + goldGained;
      this.state.dungeon.grid[enemy.y][enemy.x].contents = null;
      this.log(`Killed ${enemy.symbol}! +${goldGained} gold, +${xpGained} XP`);
      
      // Track KILL echo
      this.state.echoes = incrementEcho(this.state.echoes, ECHO_TYPES.KILL);
      
      // Check for new affinity
      if (this.state.echoes.newAffinityThisRun) {
        const { getAffinityInfo } = require('../lib/echoes.js');
        const affinities = getAffinityInfo(this.state.echoes);
        const latest = affinities[affinities.length - 1];
        if (latest) {
          this.log(`✨ AFFINITY UNLOCKED: ${latest.label} - ${latest.description}`);
        }
        this.state.echoes = clearNewAffinityFlag(this.state.echoes);
      }
      
      // Update player with loot
      this.state.player = addXp(addGold(player, goldGained), xpGained);
    }
    
    // Handle counter-attack if enemy survived
    if (!result.defenderKilled && result.attackerDamage > 0) {
      this.state.player = applyDamage(player, result.attackerDamage);
      this.state.runStats.damageTaken += result.attackerDamage;
      this.log(`${enemy.symbol} hits you for ${result.attackerDamage} damage!`);
    }
    
    // Decrease stamina
    this.state.player = {
      ...this.state.player,
      stamina: this.state.player.stamina - 1
    };
    
    // Check if player died
    if (this.state.player.hp <= 0) {
      // Track VOID echo on death
      this.state.echoes = incrementEcho(this.state.echoes, ECHO_TYPES.VOID);
      this.log("You were defeated! Gained Void echo...");
      this.endDungeonRun();
    }
  }

  handleTreasure(x, y, treasure) {
    const loot = collectTreasure(treasure);
    
    // Apply echo bonuses
    const echoBonuses = getEchoBonuses(this.state.echoes);
    let goldGained = loot.gold;
    let xpGained = loot.xp;
    
    // Treasure gold multiplier (e.g., Lucky Explorer combo)
    if (echoBonuses.treasureGoldMultiplier > 1.0) {
      goldGained = Math.floor(goldGained * echoBonuses.treasureGoldMultiplier);
    }
    
    // Gold bonus from echoes
    if (echoBonuses.goldBonus > 0) {
      goldGained = Math.floor(goldGained * (1 + echoBonuses.goldBonus));
    }
    
    // Update player with treasure
    this.state.player = addXp(addGold(this.state.player, goldGained), xpGained);
    this.state.runStats.treasureFound++;
    this.state.runStats.gold = (this.state.runStats.gold || 0) + goldGained;
    this.log(`Found treasure! +${goldGained} gold, +${xpGained} XP`);
    
    // Track TREASURE echo
    this.state.echoes = incrementEcho(this.state.echoes, ECHO_TYPES.TREASURE);
    
    // Check for new affinity
    if (this.state.echoes.newAffinityThisRun) {
      const { getAffinityInfo } = require('../lib/echoes.js');
      const affinities = getAffinityInfo(this.state.echoes);
      const latest = affinities[affinities.length - 1];
      if (latest) {
        this.log(`✨ AFFINITY UNLOCKED: ${latest.label} - ${latest.description}`);
      }
      this.state.echoes = clearNewAffinityFlag(this.state.echoes);
    }
  }

  endDungeonRun() {
    this.state.phase = 'summary';
    this.log("Dungeon run complete!");
    this.log(`Enemies: ${this.state.runStats.enemiesKilled}, Treasure: ${this.state.runStats.treasureFound}`);
    this.log(`Steps: ${this.state.runStats.stepsTaken}, Gold earned: ${this.state.runStats.gold}`);
  }

  goToTown() {
    this.state.phase = 'town';
    this.log("Welcome to town!");
  }

  log(message) {
    this.state.log.unshift(message);
    if (this.state.log.length > 50) {
      this.state.log.pop();
    }
  }

  render() {
    this.renderer.clearGrid();
    
    if (this.state.phase === 'dungeon') {
      this.renderDungeon();
    } else if (this.state.phase === 'summary') {
      this.renderSummary();
    } else if (this.state.phase === 'town') {
      this.renderTown();
    }
    
    // Always render HUD
    this.renderHUD();
  }

  renderString(x, y, text, fg, bg) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== '\n') {
        this.renderer.setCell(x + i, y, ch, fg, bg || '#000000', 0, CELL_FLAGS.VISIBLE);
      }
    }
  }

  renderDungeon() {
    const dungeon = this.state.dungeon;
    const player = this.state.player;
    
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.grid[y][x];
        
        if (x === player.x && y === player.y) {
          this.renderer.setCell(x, y, '@', '#00ff00', '#000000', 0.5, CELL_FLAGS.VISIBLE);
        } else if (cell.contents) {
          this.renderer.setCell(x, y, cell.contents.symbol, '#ff0000', '#000000', 0.5, CELL_FLAGS.VISIBLE);
        } else if (cell.type === 'wall') {
          this.renderer.setCell(x, y, '#', '#666666', '#333333', 1.0, CELL_FLAGS.VISIBLE);
        } else if (cell.type === 'floor') {
          this.renderer.setCell(x, y, '.', '#333333', '#111111', 0.0, CELL_FLAGS.VISIBLE);
        } else {
          this.renderer.setCell(x, y, ' ', '#000000', '#000000', 0.0, 0);
        }
      }
    }
  }

  renderSummary() {
    const stats = this.state.runStats;
    const player = this.state.player;
    
    this.renderString(2, 2, '=== DUNGEON RUN COMPLETE ===', '#ffff00');
    this.renderString(2, 4, 'Enemies Killed: ' + stats.enemiesKilled, '#ffff00');
    this.renderString(2, 5, 'Treasure Found: ' + stats.treasureFound, '#ffff00');
    this.renderString(2, 6, 'Steps Taken: ' + stats.stepsTaken, '#ffff00');
    this.renderString(2, 7, 'Gold Earned: ' + stats.gold, '#ffff00');
    this.renderString(2, 9, 'Current Gold: ' + player.gold, '#ffffff');
    this.renderString(2, 10, 'Level: ' + player.level + ' (' + player.xp + '/' + player.xpToNext + ' XP)', '#ffffff');
    this.renderString(2, 12, 'Press [T] to go to Town', '#888888');
    this.renderString(2, 13, 'Press [R] for another run', '#888888');
  }

  renderTown() {
    const player = this.state.player;
    const echoes = this.state.echoes;
    const { getAffinityInfo, getNextAffinityHint } = require('../lib/echoes.js');
    
    this.renderString(2, 2, '=== THE TOWN ===', '#00ffff');
    this.renderString(2, 4, 'Welcome, ' + player.name + ' the Level ' + player.level + ' Hero!', '#ffffff');
    this.renderString(2, 6, 'Gold: ' + player.gold, '#ffff00');
    this.renderString(2, 7, 'HP: ' + player.hp + '/' + player.maxHp, '#ff0000');
    this.renderString(2, 8, 'Attack: ' + player.attack, '#ff6666');
    this.renderString(2, 9, 'Defense: ' + player.defense, '#66ff66');
    this.renderString(2, 10, 'Intelligence: ' + player.intelligence, '#6666ff');
    
    // Display Echoes
    let echoY = 12;
    this.renderString(2, echoY, '=== ECHOES ===', '#aa88ff');
    echoY++;
    this.renderString(2, echoY++, `Kill: ${echoes.kill}`, '#ff6666');
    this.renderString(2, echoY++, `Treasure: ${echoes.treasure}`, '#ffdd00');
    this.renderString(2, echoY++, `Explore: ${echoes.explore}`, '#00aaff');
    this.renderString(2, echoY++, `Survive: ${echoes.survive}`, '#66ff66');
    if (echoes.void > 0) {
      this.renderString(2, echoY++, `Void: ${echoes.void}`, '#8800ff');
    }
    
    // Display unlocked affinities
    const affinities = getAffinityInfo(echoes);
    if (affinities.length > 0) {
      echoY++;
      this.renderString(2, echoY++, '=== AFFINITIES ===', '#aa88ff');
      for (const affinity of affinities) {
        this.renderString(2, echoY++, `* ${affinity.label}`, '#ffffff');
      }
    }
    
    // Show hint for next affinity
    const hint = getNextAffinityHint(echoes);
    if (hint) {
      echoY++;
      this.renderString(2, echoY++, `Hint: ${hint.label} soon...`, '#888888');
    }
    
    echoY++;
    this.renderString(2, echoY++, '[R] Return to Dungeon', '#888888');
    this.renderString(2, echoY++, '[Q] Quit', '#888888');
  }

  renderHUD() {
    const player = this.state.player;
    const stats = this.state.runStats;
    
    let hud = 'HP: ' + player.hp + '/' + player.maxHp + '  Stamina: ' + player.stamina + '/' + player.maxStamina + '  Gold: ' + player.gold;
    this.renderString(1, this.renderer.gridHeight - 1, hud, '#ffffff');
  }

  // Handle user input (called from UI)
  handleInput(key) {
    if (this.state.phase === 'summary') {
      if (key === 't' || key === 'T') {
        this.goToTown();
      } else if (key === 'r' || key === 'R') {
        this.startDungeonRun();
      }
    } else if (this.state.phase === 'town') {
      if (key === 'r' || key === 'R') {
        this.startDungeonRun();
      } else if (key === 't' || key === 'T') {
        if (this.state.player.gold >= 50) {
          this.state.player.gold -= 50;
          this.state.player.intelligence++;
          this.log("Intelligence increased!");
        } else {
          this.log("Not enough gold!");
        }
      }
    }
  }
}
