import { test, expect } from '@playwright/test';

/**
 * E2E smoke tests for the Workbench view.
 * Navigates to each tab and verifies no JS errors, no uncaught exceptions,
 * and basic content renders.
 */

// All workbench tabs to test — label must match sidebar button text
const TABS = [
  { label: 'Game Loop' },
  { label: 'Dungeon' },
  { label: 'Combat' },
  { label: 'Player' },
  { label: 'AI' },
  { label: 'Economy' },
  { label: 'Items' },
  { label: 'Graphics' },
  { label: 'Intelligence' },
  { label: 'Skill Trees' },
  { label: 'Juice' },
  { label: 'Palette' },
];

test.describe('Workbench tabs', () => {
  for (const tab of TABS) {
    test(`${tab.label} tab loads without errors`, async ({ page }) => {
      const errors = [];
      const uncaught = [];

      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => uncaught.push(err.message));

      await page.goto('/#workbench');
      await page.waitForTimeout(300);

      // Click the sidebar button (scoped to nav to avoid heading collisions)
      const sidebar = page.locator('nav, .sidebar, aside').first();
      await sidebar.getByText(tab.label, { exact: true }).click();
      await page.waitForTimeout(800);

      // Check for runtime errors (ignore 404/favicon noise)
      const realErrors = errors.filter(e => !e.includes('404') && !e.includes('favicon'));
      expect(uncaught, `Uncaught exceptions on ${tab.label}`).toEqual([]);
      expect(realErrors, `Console errors on ${tab.label}`).toEqual([]);
    });
  }
});

test.describe('Palette Lab content', () => {
  test('renders all 7 sections with palette data', async ({ page }) => {
    const uncaught = [];
    page.on('pageerror', err => uncaught.push(err.message));

    await page.goto('/#workbench');
    await page.waitForTimeout(300);

    const sidebar = page.locator('nav, .sidebar, aside').first();
    await sidebar.getByText('Palette', { exact: true }).click();
    await page.waitForTimeout(500);

    expect(uncaught).toEqual([]);

    // Section 1: Full palette grid — 29 swatches
    const swatches = page.locator('.swatch');
    await expect(swatches).toHaveCount(29);

    // Section 2: Semantic map — check headings exist
    await expect(page.getByRole('heading', { name: 'CC-29 Palette' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Semantic Color Map' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entity Preview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dungeon Preview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Item Color Ramps' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skill Region Colors' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contrast Pairs' })).toBeVisible();

    // Section 3: Entity preview tiles (@ g s ! $)
    const tiles = page.locator('.tile');
    expect(await tiles.count()).toBeGreaterThanOrEqual(5);

    // Section 5: Color ramps
    const rampSegments = page.locator('.ramp-segment');
    expect(await rampSegments.count()).toBe(16); // 4 ramps x 4 colors

    // Section 6: Skill regions
    const regionSwatches = page.locator('.region-swatch');
    expect(await regionSwatches.count()).toBe(6);

    // Section 7: Contrast pairs
    const contrastPreviews = page.locator('.contrast-preview');
    expect(await contrastPreviews.count()).toBeGreaterThanOrEqual(5);
  });
});
