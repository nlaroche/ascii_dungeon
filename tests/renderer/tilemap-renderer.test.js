// TilemapRenderer tests

import { createMockDevice, createMockCanvas } from '../helpers/gpu-mock.js';
import {
  CELL_SIZE_BYTES,
  CELL_FLAGS,
  colorToU32,
  createTilemapRenderer,
} from '../../src/renderer/TilemapRenderer.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}: ${message}`);
  }
}

function assertArrayEquals(actual, expected, message) {
  if (actual.length !== expected.length) {
    throw new Error(`Array length mismatch: ${message}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`Array mismatch at index ${i}: ${message}`);
    }
  }
}

// Test colorToU32 with various hex formats
function testColorToU32() {
  console.log('Testing colorToU32...');
  
  // #ff0000 -> red
  let result = colorToU32('#ff0000');
  assertEquals(result, 0xff0000ff, '#ff0000 should be red with full alpha');
  
  // #0f0 -> green (expanded to #00ff00)
  result = colorToU32('#0f0');
  assertEquals(result, 0x00ff00ff, '#0f0 should be green');
  
  // #000000 -> black
  result = colorToU32('#000000');
  assertEquals(result, 0x000000ff, '#000000 should be black');
  
  // #ffffff -> white
  result = colorToU32('#ffffff');
  assertEquals(result, 0xffffffff, '#ffffff should be white');
  
  // Without # prefix
  result = colorToU32('ff00ff');
  assertEquals(result, 0xff00ffff, 'ff00ff should be magenta');
  
  console.log('colorToU32 tests passed!');
}

// Test CELL_SIZE_BYTES equals 24
function testCellSizeBytes() {
  console.log('Testing CELL_SIZE_BYTES...');
  assertEquals(CELL_SIZE_BYTES, 24, 'CELL_SIZE_BYTES must be 24');
  console.log('CELL_SIZE_BYTES test passed!');
}

// Test setTile writes correct bytes
function testSetTile() {
  console.log('Testing setTile...');
  
  const device = createMockDevice();
  const canvas = createMockCanvas(1024, 512);
  const ctx = canvas.getContext('webgpu');
  
  // Create a dummy atlas texture
  const atlasTexture = device.createTexture({
    size: [1024, 384],
    format: 'r8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  
  const renderer = createTilemapRenderer(
    device,
    'bgra8unorm',
    atlasTexture,
    10, // gridWidth
    5   // gridHeight
  );
  
  // Test setting a single tile
  const fg = colorToU32('#ff0000');
  const bg = colorToU32('#0000ff');
  renderer.setTile(3, 2, 65, fg, bg, 0.5, CELL_FLAGS.VISIBLE | CELL_FLAGS.EXPLORED);
  
  // Verify the data was written correctly via DataView
  const offset = (2 * 10 + 3) * CELL_SIZE_BYTES;
  
  // glyph at offset 0
  assertEquals(renderer.dataView.getUint32(offset, true), 65, 'glyph should be 65');
  
  // fg at offset 4
  assertEquals(renderer.dataView.getUint32(offset + 4, true), fg, 'fg should match');
  
  // bg at offset 8
  assertEquals(renderer.dataView.getUint32(offset + 8, true), bg, 'bg should match');
  
  // depth at offset 12
  assertEquals(renderer.dataView.getFloat32(offset + 12, true), 0.5, 'depth should be 0.5');
  
  // light at offset 16 (default 1.0)
  assertEquals(renderer.dataView.getFloat32(offset + 16, true), 1.0, 'light should default to 1.0');
  
  // flags at offset 20 (VISIBLE | EXPLORED = 1 | 2 = 3)
  assertEquals(renderer.dataView.getUint32(offset + 20, true), 3, 'flags should be 3');
  
  console.log('setTile test passed!');
}

// Test clearGrid zeros buffer
function testClearGrid() {
  console.log('Testing clearGrid...');
  
  const device = createMockDevice();
  const canvas = createMockCanvas(1024, 512);
  
  const atlasTexture = device.createTexture({
    size: [1024, 384],
    format: 'r8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  
  const renderer = createTilemapRenderer(
    device,
    'bgra8unorm',
    atlasTexture,
    10,
    5
  );
  
  // First, write some data
  renderer.setTile(0, 0, 65, colorToU32('#ffffff'), colorToU32('#000000'), 0.0, CELL_FLAGS.VISIBLE);
  renderer.setTile(9, 4, 90, colorToU32('#ff00ff'), colorToU32('#00ff00'), 1.0, CELL_FLAGS.HIGHLIGHTED);
  
  // Verify data was written
  const initialGlyph = renderer.dataView.getUint32(0, true);
  assertEquals(initialGlyph, 65, 'initial glyph should be set');
  
  // Now clear the grid
  renderer.clearGrid();
  
  // Verify entire buffer is zero
  const uint8 = new Uint8Array(renderer.cpuBuffer);
  for (let i = 0; i < uint8.length; i++) {
    if (uint8[i] !== 0) {
      throw new Error(`Buffer byte at index ${i} should be 0 but was ${uint8[i]}`);
    }
  }
  
  console.log('clearGrid test passed!');
}

// Test that coordinates outside bounds are ignored
function testSetTileOutOfBounds() {
  console.log('Testing setTile out of bounds...');
  
  const device = createMockDevice();
  const canvas = createMockCanvas(1024, 512);
  
  const atlasTexture = device.createTexture({
    size: [1024, 384],
    format: 'r8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  
  const renderer = createTilemapRenderer(
    device,
    'bgra8unorm',
    atlasTexture,
    10,
    5
  );
  
  // Write some valid data first
  renderer.setTile(5, 2, 65, colorToU32('#ffffff'), colorToU32('#000000'), 0.0, CELL_FLAGS.VISIBLE);
  
  // Try to write outside bounds - should not crash and should not modify buffer
  renderer.setTile(-1, 2, 99, colorToU32('#ff0000'), colorToU32('#00ff00'), 0.0, 0);
  renderer.setTile(10, 2, 99, colorToU32('#ff0000'), colorToU32('#00ff00'), 0.0, 0);
  renderer.setTile(5, -1, 99, colorToU32('#ff0000'), colorToU32('#00ff00'), 0.0, 0);
  renderer.setTile(5, 5, 99, colorToU32('#ff0000'), colorToU32('#00ff00'), 0.0, 0);
  
  // Original data should be unchanged
  const offset = (2 * 10 + 5) * CELL_SIZE_BYTES;
  assertEquals(renderer.dataView.getUint32(offset, true), 65, 'original glyph should be unchanged');
  
  console.log('Out of bounds test passed!');
}

// Run all tests
function runTests() {
  try {
    testColorToU32();
    testCellSizeBytes();
    testSetTile();
    testClearGrid();
    testSetTileOutOfBounds();
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
