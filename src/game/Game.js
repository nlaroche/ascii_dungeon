import { createPlayer, addGold, addXp, applyDamage } from '../lib/index.js';
import { generateDungeon } from '../lib/index.js';
import { resolveCombat, collectTreasure } from '../lib/index.js';
import { decideAction } from '../lib/index.js';

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
    this.state.phase = 'dungeon';
    this.state.dungeon = generateDungeon({
      width: 20,
      height: 15,
      roomCount: 5,
      playerLevel: this.state.player.level
    });
    this.state.player = {
      ...this.state.player,
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
    this.log("Entered the dungeon...");
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
      this.state.runStats.gold = (this.state.runStats.gold || 0) + result.loot.gold;
      this.state.dungeon.grid[enemy.y][enemy.x].contents = null;
      this.log(`Killed ${enemy.symbol}! +${result.loot.gold} gold, +${result.loot.xp} XP`);
      
      // Update player with loot
      this.state.player = addXp(addGold(player, result.loot.gold), result.loot.xp);
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
      this.log("You were defeated! Escaping...");
      this.endDungeonRun();
    }
  }

  handleTreasure(x, y, treasure) {
    const loot = collectTreasure(treasure);
    
    // Update player with treasure
    this.state.player = addXp(addGold(this.state.player, loot.gold), loot.xp);
    this.state.runStats.treasureFound++;
    this.state.runStats.gold = (this.state.runStats.gold || 0) + loot.gold;
    this.log(`Found treasure! +${loot.gold} gold, +${loot.xp} XP`);
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
    if (!this.renderer) return;
    
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

  renderDungeon() {
    const dungeon = this.state.dungeon;
    const player = this.state.player;
    
    let ascii = '';
    
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.grid[y][x];
        
        if (x === player.x && y === player.y) {
          ascii += '@';
        } else if (cell.contents) {
          ascii += cell.contents.symbol;
        } else if (cell.type === 'wall') {
          ascii += '#';
        } else if (cell.type === 'floor') {
          ascii += '.';
        } else {
          ascii += ' ';
        }
      }
      ascii += '\n';
    }
    
    this.renderer.drawText(ascii, 20, 20, '#00ff00');
  }

  renderSummary() {
    const stats = this.state.runStats;
    const player = this.state.player;
    
    let ascii = `
=== DUNGEON RUN COMPLETE ===

Enemies Killed: ${stats.enemiesKilled}
Treasure Found: ${stats.treasureFound}
Steps Taken: ${stats.stepsTaken}
Gold Earned: ${stats.gold}

Current Gold: ${player.gold}
Level: ${player.level} (${player.xp}/${player.xpToNext} XP)

Press [T] to go to Town
Press [R] for another run
`;
    
    this.renderer.drawText(ascii, 20, 20, '#ffff00');
  }

  renderTown() {
    const player = this.state.player;
    
    let ascii = `
=== THE TOWN ===

Welcome, ${player.name} the Level ${player.level} Hero!

Gold: ${player.gold}
HP: ${player.hp}/${player.maxHp}
Attack: ${player.attack}
Defense: ${player.defense}
Intelligence: ${player.intelligence}

[T] Train Intelligence (+1, costs 50g)
[R] Return to Dungeon
[Q] Quit
`;
    
    this.renderer.drawText(ascii, 20, 20, '#00ffff');
  }

  renderHUD() {
    const player = this.state.player;
    const stats = this.state.runStats;
    
    let hud = `HP: ${player.hp}/${player.maxHp}  Stamina: ${player.stamina}/${player.maxStamina}  Gold: ${player.gold}`;
    this.renderer.drawText(hud, 20, this.renderer.canvas.height - 30, '#ffffff');
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
