/**
 * Lightweight spy renderer for testing RenderSystem.
 * Records all setCell calls for assertion.
 *
 * @example
 * const spy = createSpyRenderer();
 * renderSystem(world, 0.016); // world has spy as renderer resource
 * expect(spy.cells.length).toBe(5);
 * expect(spy.cellAt(3, 4)).toEqual({ char: '@', fg: '#00ff00', ... });
 */

/**
 * Create a spy renderer that records all setCell/clearGrid calls.
 * @param {number} [gridWidth=80]
 * @param {number} [gridHeight=45]
 * @returns {object} Spy renderer instance
 */
export function createSpyRenderer(gridWidth = 80, gridHeight = 45) {
  let cells = [];
  let clearCount = 0;
  let lightClearCount = 0;
  const lightTexels = [];

  return {
    gridWidth,
    gridHeight,

    /** All recorded setCell calls. */
    get cells() { return cells; },

    /** How many times clearGrid was called. */
    get clearCount() { return clearCount; },

    setCell(x, y, char, fg, bg, depth, flags) {
      cells.push({ x, y, char, fg, bg, depth, flags });
    },

    clearGrid() {
      cells = [];
      clearCount++;
    },

    clearLightMap() {
      lightTexels.length = 0;
      lightClearCount++;
    },

    setLightTexel(x, y, r, g, b) {
      lightTexels.push({ x, y, r, g, b });
    },

    /** Find the last cell set at a given position. */
    cellAt(x, y) {
      for (let i = cells.length - 1; i >= 0; i--) {
        if (cells[i].x === x && cells[i].y === y) return cells[i];
      }
      return null;
    },

    /** Find all cells with a given character. */
    cellsWithChar(char) {
      return cells.filter(c => c.char === char);
    },

    /** Reset all recorded data. */
    reset() {
      cells = [];
      clearCount = 0;
      lightClearCount = 0;
      lightTexels.length = 0;
    },
  };
}
