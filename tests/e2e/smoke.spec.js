import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * Check if a PNG screenshot is all black by reading raw pixel bytes.
 * Uses the PNG IDAT chunks - if all RGB values are 0, it's black.
 * Simpler approach: just check the file size. An all-black PNG compresses
 * to a very small file. A rendered scene will be much larger.
 */
function isScreenshotTooSmall(filePath, minBytes = 5000) {
  const stats = readFileSync(filePath);
  return stats.length < minBytes;
}

test.describe('Game view smoke test', () => {
  test('page loads, no GPU errors, canvas renders', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarnings = [];
    const uncaughtExceptions = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (error) => {
      uncaughtExceptions.push(error.message);
    });

    await page.goto('/');

    // Wait for canvas to appear
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible', timeout: 15_000 });

    // Wait for renderer to signal ready
    await page.locator('canvas[data-ready="1"]').waitFor({ timeout: 10_000 });

    // Give GPU extra frames to flush
    await page.waitForTimeout(500);

    // Screenshot just the canvas
    const screenshotPath = 'tests/e2e/screenshots/game.png';
    await canvas.screenshot({ path: screenshotPath });

    // Report findings
    if (consoleWarnings.length > 0) {
      console.log('CONSOLE WARNINGS (' + consoleWarnings.length + '):', consoleWarnings.slice(0, 5).join('\n'));
    }

    // Assertions
    expect(uncaughtExceptions, 'Uncaught exceptions').toEqual([]);

    const gpuErrors = consoleErrors.filter(e => !e.includes('404') && !e.includes('favicon'));
    expect(gpuErrors, 'GPU/runtime console errors').toEqual([]);

    // A rendered scene produces a PNG > 5KB. An all-black canvas compresses to ~1KB.
    const tooSmall = isScreenshotTooSmall(screenshotPath);
    expect(tooSmall, 'Canvas screenshot should not be trivially small (likely all black)').toBe(false);

    // Also check for any WebGPU validation warnings
    const shaderWarnings = consoleWarnings.filter(w => w.includes('Error while parsing WGSL') || w.includes('is invalid'));
    expect(shaderWarnings, 'WebGPU validation warnings').toEqual([]);
  });
});

test.describe('Graphics Lab smoke test', () => {
  test('graphics lab renders, no GPU errors', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarnings = [];
    const uncaughtExceptions = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (error) => {
      uncaughtExceptions.push(error.message);
    });

    await page.goto('/#workbench');

    // Click on Graphics tab
    await page.getByText('Graphics').click();

    // Wait for the graphics lab canvas to be ready
    const canvas = page.locator('.preview canvas');
    await canvas.waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('.preview canvas[data-ready="1"]').waitFor({ timeout: 10_000 });

    await page.waitForTimeout(500);

    const screenshotPath = 'tests/e2e/screenshots/graphics-lab.png';
    await canvas.screenshot({ path: screenshotPath });

    if (consoleWarnings.length > 0) {
      console.log('CONSOLE WARNINGS (' + consoleWarnings.length + '):', consoleWarnings.slice(0, 5).join('\n'));
    }

    expect(uncaughtExceptions, 'Uncaught exceptions').toEqual([]);

    const gpuErrors = consoleErrors.filter(e => !e.includes('404') && !e.includes('favicon'));
    expect(gpuErrors, 'GPU/runtime console errors').toEqual([]);

    const tooSmall = isScreenshotTooSmall(screenshotPath);
    expect(tooSmall, 'Graphics Lab screenshot should not be trivially small').toBe(false);

    const shaderWarnings = consoleWarnings.filter(w => w.includes('Error while parsing WGSL') || w.includes('is invalid'));
    expect(shaderWarnings, 'WebGPU validation warnings').toEqual([]);
  });
});
