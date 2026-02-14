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
    const x = player.x;
    const y = player.y;
    
    // Check for adjacent enemies
    const adjacentEnemy = this.getAdjacentEnemy(x, y);
    
    if (adjacentEnemy) {
      // Attack!
      this.combat(adjacentEnemy, player);
    } else {
      // Move intelligently
      this.performAIMovement(x, y);
    }
  }

  getAdjacentEnemy(x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < this.state.dungeon.height && 
          nx >= 0 && nx < this.state.dungeon.width) {
        const cell = this.state.dungeon.grid[ny][nx];
        if (cell.contents && cell.contents.type === 'enemy') {
          return { x: nx, y: ny, ...cell.contents };
        }
      }
    }
    return null;
  }

  performAIMovement(x, y) {
    const dungeon = this.state.dungeon;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    
    // Shuffle directions based on "intelligence" - smarter = more exploration
    const shuffled = [...dirs].sort(() => Math.random() - 0.5);
    
    for (const [dx, dy] of shuffled) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (ny >= 0 && ny < dungeon.height && nx >= 0 && nx < dungeon.width) {
        const cell = dungeon.grid[ny][nx];
        
        if (cell.type === 'floor') {
          // Move here
          player.x = nx;
          player.y = ny;
          cell.explored = true;
          this.state.player.stamina--;
          this.state.runStats.stepsTaken++;
          
          // Check for treasure
          if (cell.contents && cell.contents.type === 'treasure') {
            this.collectTreasure(nx, ny, cell.contents);
            cell.contents = null;
          }
          return;
        }
      }
    }
  }

  combat(enemy, player) {
    // Player attacks
    const damage = Math.max(1, player.attack - 5); // Simplified defense
    enemy.hp -= damage;
    this.state.runStats.damageDealt += damage;
    this.log(`You hit the ${enemy.symbol} for ${damage} damage!`);
    
    // Update grid
    this.state.dungeon.grid[enemy.y][enemy.x].contents = enemy;
    
    if (enemy.hp <= 0) {
      // Enemy killed!
      this.state.runStats.enemiesKilled++;
      this.state.runStats.gold += enemy.gold;
      this.state.player.gold += enemy.gold;
      this.state.runStats.xp = (this.state.runStats.xp || 0) + enemy.xp;
      this.state.player.xp += enemy.xp;
      this.state.dungeon.grid[enemy.y][enemy.x].contents = null;
      this.log(`Killed ${enemy.symbol}! +${enemy.gold} gold, +${enemy.xp} XP`);
      
      // Check level up
      if (this.state.player.xp >= this.state.player.xpToNext) {
        this.levelUp();
      }
    } else {
      // Enemy counter-attacks
      const enemyDmg = Math.max(1, enemy.attack - player.defense);
      this.state.player.hp -= enemyDmg;
      this.state.runStats.damageTaken += enemyDmg;
      this.log(`${enemy.symbol} hits you for ${enemyDmg} damage!`);
      
      if (this.state.player.hp <= 0) {
        this.log("You were defeated! Escaping...");
        this.endDungeonRun();
      }
    }
    
    this.state.player.stamina--;
  }

  collectTreasure(x, y, treasure) {
    this.state.player.gold += treasure.gold;
    this.state.player.xp += treasure.xp;
    this.state.runStats.treasureFound++;
    this.state.runStats.gold = (this.state.runStats.gold || 0) + treasure.gold;
    this.log(`Found treasure! +${treasure.gold} gold, +${treasure.xp} XP`);
    
    if (this.state.player.xp >= this.state.player.xpToNext) {
      this.levelUp();
    }
  }

  levelUp() {
    this.state.player.level++;
    this.state.player.xp -= this.state.player.xpToNext;
    this.state.player.xpToNext = Math.floor(this.state.player.xpToNext * 1.5);
    this.state.player.maxHp += 10;
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.attack += 2;
    this.state.player.defense += 1;
    this.log(`LEVEL UP! Now level ${this.state.player.level}!`);
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
