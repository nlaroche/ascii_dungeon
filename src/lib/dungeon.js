/**
 * Dungeon Generation Module - Pure dungeon generation
 * No side effects, no dependencies on Game or Renderer
 */

/**
 * Generate a dungeon with rooms and contents
 * @param {Object} config - Configuration object
 * @param {number} config.width - Dungeon width
 * @param {number} config.height - Dungeon height
 * @param {number} config.roomCount - Number of rooms to generate
 * @param {number} config.playerLevel - Player level for scaling enemies
 * @returns {Object} Dungeon object with grid, width, height, rooms
 */
export function generateDungeon(config = {}) {
  const width = config.width || 20;
  const height = config.height || 15;
  const roomCount = config.roomCount || 5;
  const playerLevel = config.playerLevel || 1;
  
  // Generate empty grid
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        type: 'wall',
        explored: false,
        seen: false,
        contents: null
      });
    }
    grid.push(row);
  }

  // Simple room carving
  const rooms = [];
  for (let i = 0; i < roomCount; i++) {
    const roomW = 3 + Math.floor(Math.random() * 4);
    const roomH = 3 + Math.floor(Math.random() * 3);
    const roomX = 1 + Math.floor(Math.random() * (width - roomW - 2));
    const roomY = 1 + Math.floor(Math.random() * (height - roomH - 2));
    
    rooms.push({ x: roomX, y: roomY, w: roomW, h: roomH });
    
    for (let ry = roomY; ry < roomY + roomH; ry++) {
      for (let rx = roomX; rx < roomX + roomW; rx++) {
        grid[ry][rx].type = 'floor';
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    const prevCenterX = Math.floor(prev.x + prev.w / 2);
    const prevCenterY = Math.floor(prev.y + prev.h / 2);
    const currCenterX = Math.floor(curr.x + curr.w / 2);
    const currCenterY = Math.floor(curr.y + curr.h / 2);
    
    // Horizontal corridor
    const startX = Math.min(prevCenterX, currCenterX);
    const endX = Math.max(prevCenterX, currCenterX);
    for (let x = startX; x <= endX; x++) {
      grid[prevCenterY][x].type = 'floor';
    }
    
    // Vertical corridor
    const startY = Math.min(prevCenterY, currCenterY);
    const endY = Math.max(prevCenterY, currCenterY);
    for (let y = startY; y <= endY; y++) {
      grid[y][currCenterX].type = 'floor';
    }
  }

  // Add enemies and treasure to rooms (skip first room = start)
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const enemyChance = 0.3 + (playerLevel * 0.05);
    
    if (Math.random() <      const ex = room.x + Math enemyChance) {
.floor(Math.random() * room.w);
      const ey = room.y + Math.floor(Math.random() * room.h);
      if (grid[ey][ex].type === 'floor') {
        grid[ey][ex].contents = {
          type: 'enemy',
          hp: 20 + playerLevel * 10,
          maxHp: 20 + playerLevel * 10,
          attack: 5 + playerLevel * 2,
          xp: 25 + playerLevel * 10,
          gold: 10 + playerLevel * 5,
          symbol: ['g', 'o', 's', 'S', 'T'][Math.floor(Math.random() * 5)]
        };
      }
    }
    
    if (Math.random() < 0.4) {
      const tx = room.x + Math.floor(Math.random() * room.w);
      const ty = room.y + Math.floor(Math.random() * room.h);
      if (grid[ty][tx].type === 'floor' && !grid[ty][tx].contents) {
        grid[ty][tx].contents = {
          type: 'treasure',
          gold: 5 + Math.floor(Math.random() * 20 * playerLevel),
          xp: 10 + Math.floor(Math.random() * 15),
          symbol: '$'
        };
      }
    }
  }

  return { grid, width, height, rooms };
}
