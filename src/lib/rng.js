/**
 * Seeded PRNG — mulberry32.
 * Deterministic random number generator for reproducible tests and gameplay.
 *
 * @example
 * const rng = createRng(42);
 * rng();        // 0.0–1.0
 * rng.int(10);  // 0–9
 * rng.range(5, 10); // 5–9
 * rng.pick(['a', 'b', 'c']); // random element
 * rng.shuffle([1, 2, 3]);    // in-place shuffle
 */

/**
 * Create a seeded PRNG using mulberry32.
 * @param {number} seed Integer seed
 * @returns {Function & { int, range, pick, shuffle, float }} RNG with utility methods
 */
export function createRng(seed) {
  let s = seed | 0;

  /** Return a float in [0, 1). */
  function next() {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Random integer in [0, max).
   * @param {number} max Exclusive upper bound
   * @returns {number}
   */
  next.int = function(max) {
    return Math.floor(next() * max);
  };

  /**
   * Random integer in [min, max).
   * @param {number} min Inclusive lower bound
   * @param {number} max Exclusive upper bound
   * @returns {number}
   */
  next.range = function(min, max) {
    return min + Math.floor(next() * (max - min));
  };

  /**
   * Random float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  next.float = function(min, max) {
    return min + next() * (max - min);
  };

  /**
   * Pick a random element from an array.
   * @param {Array} arr
   * @returns {*}
   */
  next.pick = function(arr) {
    return arr[Math.floor(next() * arr.length)];
  };

  /**
   * Fisher-Yates shuffle (in-place).
   * @param {Array} arr
   * @returns {Array} Same array, shuffled
   */
  next.shuffle = function(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  return next;
}
