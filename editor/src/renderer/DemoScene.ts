// Demo Scene - Creates a sample voxel world

import { Scene } from './Scene'

export function createDemoScene(): Scene {
  const scene = new Scene()

  // Green grass field (12x12)
  const grassColor: [number, number, number, number] = [0.35, 0.55, 0.25, 1]
  scene.addFloor(0, 0, 12, 12, grassColor)

  // Stone walls along one edge
  const wallColor: [number, number, number, number] = [0.45, 0.42, 0.4, 1]
  for (let i = 0; i < 5; i++) {
    scene.addWall(0, i, 3, wallColor)
  }
  // Corner turn
  for (let i = 0; i < 3; i++) {
    scene.addWall(i, 0, 3, wallColor)
  }

  // Goblin "G" standing on the field
  const goblinColor: [number, number, number, number] = [0.7, 0.2, 0.15, 1]
  scene.addGlyph('G', 6, 0.5, 6, goblinColor, 1.2)

  // Trees scattered around
  scene.addTree(2, 8)
  scene.addTree(9, 3)
  scene.addTree(10, 9)
  scene.addTree(4, 10)

  // White fluffy clouds in the sky
  scene.addCloud(3, 7, 5)
  scene.addCloud(8, 8, 3)
  scene.addCloud(5, 9, 8)

  // Small pond with water
  scene.addPond(7, 7, 3, 3)

  // Add a path of lighter grass/dirt leading to the goblin
  const pathColor: [number, number, number, number] = [0.5, 0.45, 0.35, 1]
  for (let i = 3; i < 6; i++) {
    scene.addVoxel(i, 0.12, 6, pathColor, 0.9, 0.15, 0.9)
  }

  // Add some flowers/decoration
  const flowerColors: [number, number, number, number][] = [
    [0.9, 0.3, 0.4, 1],  // Red
    [0.9, 0.8, 0.2, 1],  // Yellow
    [0.4, 0.4, 0.9, 1],  // Blue
    [0.9, 0.5, 0.8, 1],  // Pink
  ]

  // Scatter some flowers
  const flowerPositions = [
    [1, 3], [2, 5], [3, 2], [5, 1], [8, 2], [10, 5], [11, 8], [9, 10], [3, 9]
  ]
  flowerPositions.forEach(([x, z], i) => {
    const color = flowerColors[i % flowerColors.length]
    scene.addVoxel(x, 0.25, z, color, 0.15, 0.3, 0.15, 0.2) // Slight glow
  })

  // Add a small rock formation
  const rockColor: [number, number, number, number] = [0.5, 0.5, 0.52, 1]
  scene.addVoxel(10, 0.2, 1, rockColor, 0.6, 0.4, 0.5)
  scene.addVoxel(10.3, 0.15, 1.3, rockColor, 0.4, 0.3, 0.4)
  scene.addVoxel(9.8, 0.1, 1.2, rockColor, 0.3, 0.2, 0.35)

  return scene
}
