/**
 * AI Module - Pure AI decision-making
 * No side effects, takes data in, returns action object
 */

/**
 * Decide next action for the player
 * @param {Object} playerPos - Player position {x, y}
 * @param {Array} dungeonGrid - 2D array of dungeon cells
 * @param {Object} dungeonSize - Dungeon size {width, height}
 * @returns {Object} Action object {type, dx, dy, target}
 */
export function decideAction(playerPos, dungeonGrid, dungeonSize) {
  const x = playerPos.x;
  const y = playerPos.y;
  
  // Check for adjacent enemies
  const adjacentEnemy = getAdjacentEnemy(x, y, dungeonGrid, dungeonSize);
  
  if (adjacentEnemy) {
    return {
      type: 'attack',
      target: adjacentEnemy
    };
  }
  
  // Otherwise, move intelligently
  const moveDirection = getIntelligentMove(x, y, dungeonGrid, dungeonSize);
  
  return {
    type: 'move',
    dx: moveDirection.dx,
    dy: moveDirection.dy
  };
}

/**
 * Get adjacent enemy if any
 * @param {number} x - Player X position
 * @param {number} y - Player Y position
 * @param {Array} grid - Dungeon grid
 * @param {Object} size - Dungeon size
 * @returns {Object|null} Enemy info or null
 */
function getAdjacentEnemy(x, y, grid, size) {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (ny >= 0 && ny < size.height && nx >= 0 && nx < size.width) {
      const cell = grid[ny][nx];
      if (cell.contents && cell.contents.type === 'enemy') {
        return { x: nx, y: ny, ...cell.contents };
      }
    }
  }
  
  return null;
}

/**
 * Get intelligent move direction
 * @param {number} x - Player X position
 * @param {number} y - Player Y position
 * @param {Array} grid - Dungeon grid
 * @param {Object} size - Dungeon size
 * @returns {Object} Direction {dx, dy}
 */
function getIntelligentMove(x, y, grid, size) {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  
  // Shuffle directions for exploration
  const shuffled = [...dirs].sort(() => Math.random() - 0.5);
  
  for (const [dx, dy] of shuffled) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (ny >= 0 && ny < size.height && nx >= 0 && nx < size.width) {
      const cell = grid[ny][nx];
      
      if (cell.type === 'floor') {
        return { dx, dy };
      }
    }
  }
  
  // No valid move found, stay in place
  return { dx: 0, dy: 0 };
}
