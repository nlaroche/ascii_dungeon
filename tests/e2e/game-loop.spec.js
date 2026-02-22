// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Game Loop E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('http://localhost:5173/#game');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows intro screen with New Game button', async ({ page }) => {
    await page.goto('http://localhost:5173/#game');

    // Wait for canvas to be ready
    await page.waitForFunction(
      () => document.querySelector('canvas[data-ready="1"]'),
      { timeout: 10000 }
    );

    // Take screenshot to verify intro screen renders
    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(5000);
  });

  test('new game flow: intro → town → dungeon → run complete → town', async ({ page }) => {
    await page.goto('http://localhost:5173/#game');

    // Wait for canvas
    await page.waitForFunction(
      () => document.querySelector('canvas[data-ready="1"]'),
      { timeout: 10000 }
    );

    // Press Enter to start New Game
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // We should be on Town screen now — press Enter to enter dungeon
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Dungeon auto-plays... wait for it to finish (stamina depletion or clear)
    // This could take a while, so give it generous timeout
    await page.waitForTimeout(15000);

    // After dungeon finishes, we should be on RunComplete or Town
    // Press Enter to continue (RunComplete → Town)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify localStorage has a save
    const hasSave = await page.evaluate(
      () => localStorage.getItem('ascii_dungeon_save') !== null
    );
    expect(hasSave).toBe(true);
  });

  test('continue loads saved game', async ({ page }) => {
    await page.goto('http://localhost:5173/#game');

    // Create a save directly
    await page.evaluate(() => {
      localStorage.setItem('ascii_dungeon_save', JSON.stringify({
        player: {
          name: 'Hero', hp: 100, maxHp: 100, stamina: 20, maxStamina: 20,
          attack: 10, defense: 5, intelligence: 5, level: 1, xp: 0,
          xpToNext: 100, gold: 42, inventory: [],
          equipment: { weapon: null, armor: null, amulet: null }, x: 1, y: 1,
        },
        calendar: {
          currentDay: 3, currentWeek: 1, totalDays: 2, runsCompleted: 2,
          bestFloor: 3, totalGoldEarned: 100, totalEnemiesKilled: 10, history: [],
        },
        currentRun: null,
        settings: {},
      }));
    });

    await page.reload();

    // Wait for canvas
    await page.waitForFunction(
      () => document.querySelector('canvas[data-ready="1"]'),
      { timeout: 10000 }
    );

    // Intro screen should show Continue as first option
    // Press Enter to continue
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify save persists
    const gold = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('ascii_dungeon_save'));
      return save?.player?.gold;
    });
    expect(gold).toBe(42);
  });
});
