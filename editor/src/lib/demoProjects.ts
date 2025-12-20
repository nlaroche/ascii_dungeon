// ═══════════════════════════════════════════════════════════════════════════
// Demo Projects - Embedded demo scene data
// ═══════════════════════════════════════════════════════════════════════════

export interface DemoProjectData {
  id: string
  name: string
  description: string
  icon: string
  template: string
  features: string[]
  projectJson: object
  sceneJson: object
  palettes: Record<string, object>
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple RPG Village Demo
// Uses correct component structure: Rect2D for position, Glyph/GlyphMap for visuals
// ─────────────────────────────────────────────────────────────────────────────

const SIMPLE_RPG_SCENE = {
  version: '1.0.0',
  savedAt: new Date().toISOString(),
  rootNode: {
    id: 'scene-root',
    name: 'Village Scene',
    type: 'Node',
    children: [
      // TERRAIN LAYER - Floor tiles using Terrain component with prefab IDs
      {
        id: 'floor',
        name: 'Village Floor',
        type: 'TerrainNode',
        children: [],
        components: [
          {
            id: 'floor-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -20, y: -15, width: 40, height: 30 }
          },
          {
            id: 'floor-terrain',
            script: 'Terrain',
            enabled: true,
            properties: {
              width: 40,
              height: 30,
              // RLE compressed grid: [count, prefabId, ...]
              // 1200 cells of 'floor' prefab
              grid: [1200, 'floor']
            }
          }
        ],
        meta: { layer: 'terrain', zIndex: 0, isFloor: true }
      },
      // PLAYER LAYER - Player character with Rect2D + Glyph + Camera
      {
        id: 'player',
        name: 'Player',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'player-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 0, y: 0, width: 1, height: 1 }
          },
          {
            id: 'player-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: '@', fg: [0.2, 1.0, 0.4], bg: [0, 0, 0], emission: 0.5, emissionColor: [0.1, 0.5, 0.2] }
          },
          {
            id: 'player-camera',
            script: 'Camera',
            enabled: true,
            properties: {
              priority: 10,
              active: true,
              zoom: 1.5,
              blendTime: 0.5,
              blendCurve: 'easeInOut',
              rotation: 0,
              postProcess: {
                enabled: false,
                crtEnabled: false,
                crtSettings: {
                  scanlines: 0, curvature: 0, bloom: 0, noise: 0,
                  chromatic: 0, flicker: 0, vignette: 0, pixelate: 0, colorShift: 0
                },
                effects: []
              }
            }
          },
          {
            id: 'player-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'player' }
          }
        ],
        meta: { layer: 'player', isPlayer: true }
      },
      // OBJECTS LAYER - Village Hut with ASCII art
      {
        id: 'hut-1',
        name: 'Village Hut',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'hut-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -8, y: -6, width: 6, height: 4 }
          },
          {
            id: 'hut-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '  /\\  \n /##\\ \n |##| \n |==| ' }
          },
          {
            id: 'hut-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'hut' }
      },
      // OBJECTS LAYER - Blacksmith building
      {
        id: 'hut-2',
        name: 'Blacksmith',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'hut-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 6, y: -4, width: 9, height: 4 }
          },
          {
            id: 'hut-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   ___   \n  /###\\  \n |#####| \n |=====| ' }
          },
          {
            id: 'hut-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'blacksmith' }
      },
      // OBJECTS LAYER - Inn building
      {
        id: 'hut-3',
        name: 'Inn',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'hut-3-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -5, y: 5, width: 10, height: 5 }
          },
          {
            id: 'hut-3-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '    /\\    \n   /##\\   \n  /####\\  \n |######| \n |==##==| ' }
          },
          {
            id: 'hut-3-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'inn' }
      },
      // ENTITIES LAYER - Farmer NPC
      {
        id: 'npc-farmer',
        name: 'Farmer',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'farmer-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 5, y: 3, width: 1, height: 1 }
          },
          {
            id: 'farmer-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 'F', fg: [0.7, 0.5, 0.3], bg: [0, 0, 0] }
          },
          {
            id: 'farmer-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'npc' }
          },
          {
            id: 'farmer-interactable',
            script: 'Interactable',
            enabled: true,
            properties: { interactionRange: 2, promptText: 'Talk' }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'Hello traveler!' }
      },
      // ENTITIES LAYER - Merchant NPC
      {
        id: 'npc-merchant',
        name: 'Merchant',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'merchant-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -3, y: 2, width: 1, height: 1 }
          },
          {
            id: 'merchant-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 'M', fg: [1.0, 0.8, 0.0], bg: [0, 0, 0] }
          },
          {
            id: 'merchant-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'npc' }
          },
          {
            id: 'merchant-interactable',
            script: 'Interactable',
            enabled: true,
            properties: { interactionRange: 2, promptText: 'Trade' }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'Want to trade?' }
      },
      // OBJECTS LAYER - Oak Tree
      {
        id: 'tree-1',
        name: 'Oak Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'tree-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 12, y: -3, width: 7, height: 3 }
          },
          {
            id: 'tree-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '  &&&  \n &&&&& \n  |#|  ' }
          },
          {
            id: 'tree-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },
      // OBJECTS LAYER - Pine Tree
      {
        id: 'tree-2',
        name: 'Pine Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'tree-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -14, y: 3, width: 7, height: 4 }
          },
          {
            id: 'tree-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   ^   \n  ^^^  \n ^^^^^ \n  |#|  ' }
          },
          {
            id: 'tree-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },
      // OBJECTS LAYER - Village Well
      {
        id: 'well',
        name: 'Village Well',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'well-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 2, y: 1, width: 6, height: 3 }
          },
          {
            id: 'well-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: ' /--\\ \n |~~| \n \\__/ ' }
          },
          {
            id: 'well-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          },
          {
            id: 'well-interactable',
            script: 'Interactable',
            enabled: true,
            properties: { interactionRange: 1.5, promptText: 'Drink' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },
      // EFFECTS LAYER - Campfire with emission
      {
        id: 'campfire',
        name: 'Campfire',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'campfire-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 8, y: 7, width: 5, height: 3 }
          },
          {
            id: 'campfire-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: ' *** \n*###*\n \\#/ ' }
          },
          {
            id: 'campfire-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: '*', fg: [1.0, 0.6, 0.1], bg: [0, 0, 0], emission: 0.8 }
          }
        ],
        meta: { layer: 'objects', zIndex: 1 }
      }
    ],
    components: [],
    meta: { description: 'A peaceful village with huts and NPCs' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Projects Registry
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PROJECTS: DemoProjectData[] = [
  {
    id: 'simple-rpg',
    name: 'Simple RPG Village',
    description: 'A peaceful village with huts, NPCs, trees, and a campfire. Great for learning the engine.',
    icon: '🏘',
    template: 'isometric-rpg',
    features: [
      'Player with camera follow',
      'ASCII art buildings',
      'NPCs with dialog',
      'Animated campfire',
      'Trees and well',
      'Sound effects'
    ],
    projectJson: {
      name: 'Simple RPG Village',
      version: '1.0.0',
      engine: 'ascii-dungeon',
      template: 'isometric-rpg',
      settings: {
        targetFPS: 60,
        resolution: [1280, 720]
      }
    },
    sceneJson: SIMPLE_RPG_SCENE,
    palettes: {
      // Category files
      'characters/_category.json': {
        name: 'Characters',
        icon: '@',
        description: 'Player characters and NPCs'
      },
      'environment/_category.json': {
        name: 'Environment',
        icon: '&',
        description: 'Trees, rocks, and decorations'
      },
      // Character prefabs
      'characters/player.prefab.json': {
        id: 'player-prefab',
        name: 'Player',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: '@', fg: [0.2, 1.0, 0.4], bg: [0, 0, 0], emission: 0.3 } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'player' } }
        ],
        meta: { layer: 'entities', isPlayer: true }
      },
      'characters/farmer.prefab.json': {
        id: 'farmer-prefab',
        name: 'Farmer NPC',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: 'F', fg: [0.7, 0.5, 0.3], bg: [0, 0, 0] } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'npc' } },
          { script: 'Interactable', properties: { interactionRange: 2, promptText: 'Talk' } }
        ],
        meta: { layer: 'entities', npc: true, dialog: 'Hello traveler!' }
      },
      'characters/merchant.prefab.json': {
        id: 'merchant-prefab',
        name: 'Merchant NPC',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: 'M', fg: [1.0, 0.8, 0.0], bg: [0, 0, 0] } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'npc' } },
          { script: 'Interactable', properties: { interactionRange: 2, promptText: 'Trade' } }
        ],
        meta: { layer: 'entities', npc: true, dialog: 'Want to trade?' }
      },
      'characters/goblin.prefab.json': {
        id: 'goblin-prefab',
        name: 'Goblin',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: 'g', fg: [0.4, 0.8, 0.2], bg: [0, 0, 0] } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'enemy' } }
        ],
        meta: { layer: 'entities', enemy: true }
      },
      // Environment prefabs
      'environment/oak-tree.prefab.json': {
        id: 'oak-tree-prefab',
        name: 'Oak Tree',
        type: 'GlyphMapNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 5, height: 3 } },
          { script: 'GlyphMap', properties: { cells: ' &&& \n&&&&&\n |#| ' } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'environment' } }
        ],
        meta: { layer: 'objects' }
      },
      'environment/pine-tree.prefab.json': {
        id: 'pine-tree-prefab',
        name: 'Pine Tree',
        type: 'GlyphMapNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 5, height: 4 } },
          { script: 'GlyphMap', properties: { cells: '  ^  \n ^^^ \n^^^^^\n |#| ' } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'environment' } }
        ],
        meta: { layer: 'objects' }
      },
      'environment/campfire.prefab.json': {
        id: 'campfire-prefab',
        name: 'Campfire',
        type: 'GlyphMapNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 3, height: 2 } },
          { script: 'GlyphMap', properties: { cells: '***\n\\#/' } },
          { script: 'Glyph', properties: { char: '*', fg: [1.0, 0.6, 0.1], bg: [0, 0, 0], emission: 0.8 } }
        ],
        meta: { layer: 'objects', animated: true }
      },
      'environment/well.prefab.json': {
        id: 'well-prefab',
        name: 'Well',
        type: 'GlyphMapNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 4, height: 3 } },
          { script: 'GlyphMap', properties: { cells: '/--\\\n|~~|\n\\__/' } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'environment' } },
          { script: 'Interactable', properties: { interactionRange: 1.5, promptText: 'Drink' } }
        ],
        meta: { layer: 'objects' }
      },
      'environment/rock.prefab.json': {
        id: 'rock-prefab',
        name: 'Rock',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: 'o', fg: [0.5, 0.5, 0.5], bg: [0, 0, 0] } },
          { script: 'Collider', properties: { blocksMovement: true, layer: 'environment' } }
        ],
        meta: { layer: 'objects' }
      },
      'environment/bush.prefab.json': {
        id: 'bush-prefab',
        name: 'Bush',
        type: 'GlyphNode',
        components: [
          { script: 'Rect2D', properties: { x: 0, y: 0, width: 1, height: 1 } },
          { script: 'Glyph', properties: { char: '*', fg: [0.2, 0.6, 0.2], bg: [0, 0, 0] } }
        ],
        meta: { layer: 'objects' }
      }
    }
  },
  {
    id: 'empty',
    name: 'Empty Scene',
    description: 'Start with a blank canvas. Just a player, camera, and your imagination.',
    icon: '📄',
    template: 'isometric-rpg',
    features: [
      'Basic player setup',
      'Camera ready',
      'Clean slate'
    ],
    projectJson: {
      name: 'New Project',
      version: '1.0.0',
      engine: 'ascii-dungeon',
      settings: {
        targetFPS: 60,
        resolution: [1280, 720]
      }
    },
    sceneJson: {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      rootNode: {
        id: 'scene-root',
        name: 'Main Scene',
        type: 'Node',
        children: [
          {
            id: 'player',
            name: 'Player',
            type: 'GlyphNode',
            children: [],
            components: [
              {
                id: 'player-rect',
                script: 'Rect2D',
                enabled: true,
                properties: { x: 0, y: 0, width: 1, height: 1 }
              },
              {
                id: 'player-glyph',
                script: 'Glyph',
                enabled: true,
                properties: { char: '@', fg: [0.2, 0.9, 0.4], bg: [0, 0, 0] }
              },
              {
                id: 'player-camera',
                script: 'Camera',
                enabled: true,
                properties: {
                  priority: 10,
                  active: true,
                  zoom: 1.0,
                  blendTime: 0.5,
                  blendCurve: 'easeInOut',
                  rotation: 0,
                  postProcess: {
                    enabled: false,
                    crtEnabled: false,
                    crtSettings: {
                      scanlines: 0, curvature: 0, bloom: 0, noise: 0,
                      chromatic: 0, flicker: 0, vignette: 0, pixelate: 0, colorShift: 0
                    },
                    effects: []
                  }
                }
              }
            ],
            meta: { isPlayer: true }
          }
        ],
        components: [],
        meta: {}
      }
    },
    palettes: {}
  }
]

export function getDemoProject(id: string): DemoProjectData | undefined {
  return DEMO_PROJECTS.find(d => d.id === id)
}
