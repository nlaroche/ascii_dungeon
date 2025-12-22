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
  scripts: Record<string, string>  // relativePath -> source code
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
    name: 'World',
    type: 'Node',
    children: [
      // ═══════════════════════════════════════════════════════════════════════════
      // PERSISTENT LAYER - Survives screen transitions
      // Contains: Player, GameData, EdgeTrigger
      // ═══════════════════════════════════════════════════════════════════════════
      {
        id: 'persistent-layer',
        name: 'PersistentLayer',
        type: 'Node',
        children: [
          // Player with camera - survives screen transitions
          {
            id: 'player',
            name: 'Player',
            type: 'GlyphNode',
            children: [
              // Camera as child - will follow player automatically
              {
                id: 'player-camera-node',
                name: 'Camera',
                type: 'Node',
                children: [],
                components: [
                  {
                    id: 'camera-rect',
                    script: 'Rect2D',
                    enabled: true,
                    properties: { x: 0, y: 0, width: 80, height: 50 }
                  },
                  {
                    id: 'main-camera',
                    script: 'Camera',
                    enabled: true,
                    properties: {
                      priority: 10,
                      active: true,
                      zoom: 1.2,
                      blendTime: 0.3,
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
                meta: { isCamera: true }
              }
            ],
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
                properties: { char: '@', fg: [0.3, 1.0, 0.5], bg: [0, 0, 0], emission: 0.4, emissionColor: [0.2, 0.8, 0.3] }
              },
              {
                id: 'player-collider',
                script: 'Collider',
                enabled: true,
                properties: { blocksMovement: true, layer: 'player' }
              },
              {
                id: 'player-behavior',
                script: 'PlayerController',
                enabled: true,
                properties: {
                  tickDuration: 150  // Animation duration in ms
                }
              }
            ],
            meta: { layer: 'player', isPlayer: true }
          },
          // GameData - persistent game state
          {
            id: 'game-data',
            name: 'GameData',
            type: 'Node',
            children: [],
            components: [
              {
                id: 'game-data-component',
                script: 'GameData',
                enabled: true,
                properties: {
                  health: 100,
                  maxHealth: 100,
                  gold: 250
                }
              }
            ],
            meta: { persistent: true }
          }
        ],
        components: [
          {
            id: 'world-manager',
            script: 'WorldManager',
            enabled: true,
            properties: {
              screenWidth: 80,
              screenHeight: 50,
              worldX: 0,
              worldY: 0,
              minX: -40,
              maxX: 39,
              minY: -25,
              maxY: 24
            }
          },
          {
            id: 'edge-trigger',
            script: 'EdgeTrigger',
            enabled: true,
            properties: {
              edgeThreshold: 2,
              minX: -40,
              maxX: 39,
              minY: -25,
              maxY: 24,
              cooldown: 0.5
            }
          }
        ],
        meta: { persistent: true }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // SCREEN LAYER - Gets cleared and repopulated on screen transitions
      // Contains: Terrain, Mountains, Buildings, NPCs, etc.
      // ═══════════════════════════════════════════════════════════════════════════
      {
        id: 'screen-layer',
        name: 'ScreenLayer',
        type: 'Node',
        children: [
          // ─────────────────────────────────────────────────────────────────────────
          // TERRAIN - Large 80x50 map
          // ─────────────────────────────────────────────────────────────────────────
          {
            id: 'floor',
        name: 'World Floor',
        type: 'TerrainNode',
        children: [],
        components: [
          {
            id: 'floor-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -40, y: -25, width: 80, height: 50 }
          },
          {
            id: 'floor-terrain',
            script: 'Terrain',
            enabled: true,
            properties: {
              width: 80,
              height: 50,
              grid: [4000, 'floor']
            }
          }
        ],
        meta: { layer: 'terrain', zIndex: 0, isFloor: true }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // MOUNTAINS - Northern mountain range
      // ═══════════════════════════════════════════════════════════════════════════
      {
        id: 'mountain-north',
        name: 'Northern Mountains',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'mountain-north-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -35, y: -24, width: 70, height: 6 }
          },
          {
            id: 'mountain-north-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '      /\\          /\\    /\\          /\\              /\\          /\\      \n     /##\\   /\\   /##\\  /##\\   /\\   /##\\    /\\     /##\\   /\\   /##\\     \n    /####\\ /##\\ /####\\/####\\ /##\\ /####\\  /##\\   /####\\ /##\\ /####\\    \n   /######\\####\\/############\\####\\######\\/####\\ /######\\####\\######\\   \n  /########\\##/\\##############\\##/\\######/\\####\\/########\\##/\\######\\  \n /##########\\/##\\##############\\/##\\####/##\\##/\\##########\\/##\\######\\ ' }
          },
          {
            id: 'mountain-north-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'terrain' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, terrain: 'mountain' }
      },

      // Eastern mountains
      {
        id: 'mountain-east',
        name: 'Eastern Mountains',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'mountain-east-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 30, y: -18, width: 8, height: 36 }
          },
          {
            id: 'mountain-east-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   /\\   \n  /##\\  \n /####\\ \n/######\\\n|######|\n|######|\n/######\\\n|######|\n\\######/\n/######\\\n|######|\n|######|\n\\######/\n /####\\ \n  /##\\  \n /####\\ \n/######\\\n|######|\n|######|\n\\######/\n/######\\\n|######|\n|######|\n\\######/\n/######\\\n|######|\n|######|\n\\######/\n /####\\ \n  /##\\  \n /####\\ \n/######\\\n|######|\n|######|\n\\######/\n \\####/ ' }
          },
          {
            id: 'mountain-east-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'terrain' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, terrain: 'mountain' }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // VILLAGE CENTER - Main buildings
      // ═══════════════════════════════════════════════════════════════════════════

      // Grand Tavern (The Golden Tankard)
      {
        id: 'tavern',
        name: 'The Golden Tankard',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'tavern-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -12, y: -10, width: 14, height: 7 }
          },
          {
            id: 'tavern-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '     ____     \n    /    \\    \n   /######\\   \n  |########|  \n  |##|  |##|  \n  |##|  |##|  \n  |==|  |==|  ' }
          },
          {
            id: 'tavern-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'tavern' }
      },

      // Church with bell tower
      {
        id: 'church',
        name: 'Village Church',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'church-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 8, y: -12, width: 12, height: 9 }
          },
          {
            id: 'church-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '     +      \n    /|\\     \n   / | \\    \n  /  |  \\   \n |########| \n |########| \n |########| \n |###||###| \n |===||===| ' }
          },
          {
            id: 'church-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'church' }
      },

      // Blacksmith with forge
      {
        id: 'blacksmith',
        name: 'Blacksmith Forge',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'blacksmith-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -18, y: 2, width: 11, height: 6 }
          },
          {
            id: 'blacksmith-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   _____   \n  /FORGE\\  \n |#######| \n |#[*]###| \n |#######| \n |=======| ' }
          },
          {
            id: 'blacksmith-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'blacksmith' }
      },

      // Market stalls
      {
        id: 'market-stall-1',
        name: 'Fruit Stand',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'market-stall-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -3, y: -2, width: 6, height: 3 }
          },
          {
            id: 'market-stall-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '______\n|oOoO|\n|____|' }
          },
          {
            id: 'market-stall-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'object' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'market' }
      },

      {
        id: 'market-stall-2',
        name: 'Weapon Stand',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'market-stall-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 4, y: -2, width: 6, height: 3 }
          },
          {
            id: 'market-stall-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '______\n|/|\\+|\n|____|' }
          },
          {
            id: 'market-stall-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'object' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'market' }
      },

      // Village Well (center)
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
            properties: { x: -1, y: 3, width: 5, height: 4 }
          },
          {
            id: 'well-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: ' ___ \n/---\\\n|~~~|\n\\___/' }
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
            properties: { interactionRange: 2, promptText: 'Drink' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      // Farmhouses
      {
        id: 'farmhouse-1',
        name: 'Farmhouse',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'farmhouse-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -28, y: 8, width: 8, height: 5 }
          },
          {
            id: 'farmhouse-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   /\\   \n  /##\\  \n |####| \n |####| \n |====| ' }
          },
          {
            id: 'farmhouse-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'farmhouse' }
      },

      {
        id: 'farmhouse-2',
        name: 'Farmhouse',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'farmhouse-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -28, y: -8, width: 8, height: 5 }
          },
          {
            id: 'farmhouse-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '   /\\   \n  /##\\  \n |####| \n |####| \n |====| ' }
          },
          {
            id: 'farmhouse-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, blocksVision: true, layer: 'building' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0, building: 'farmhouse' }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // FIELDS - Wheat and crop fields outside village
      // ═══════════════════════════════════════════════════════════════════════════

      // Wheat field 1 (west)
      {
        id: 'wheat-field-1',
        name: 'Wheat Field',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'wheat-field-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -35, y: 0, width: 12, height: 8 }
          },
          {
            id: 'wheat-field-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '.,\',.\',.\',.\'\n\',.\',.,\',.\'.\n.,\',.\',.\',.\'\n\',.\',.,\',.\'.\n.,\',.\',.\',.\'\n\',.\',.,\',.\'.\n.,\',.\',.\',.\'\n\',.\',.,\',.\'.' }
          }
        ],
        meta: { layer: 'objects', zIndex: -1, field: 'wheat' }
      },

      // Wheat field 2 (south-west)
      {
        id: 'wheat-field-2',
        name: 'Wheat Field 2',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'wheat-field-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -35, y: 12, width: 14, height: 6 }
          },
          {
            id: 'wheat-field-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '.,\',.\',.\',.\',.\n\',.\',.,\',.\'.,\'\n.,\',.\',.\',.\',.\n\',.\',.,\',.\'.,\'\n.,\',.\',.\',.\',.\n\',.\',.,\',.\'.,\'' }
          }
        ],
        meta: { layer: 'objects', zIndex: -1, field: 'wheat' }
      },

      // Corn field (south)
      {
        id: 'corn-field',
        name: 'Corn Field',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'corn-field-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -5, y: 14, width: 16, height: 6 }
          },
          {
            id: 'corn-field-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '| | | | | | | | \n| | | | | | | | \n| | | | | | | | \n| | | | | | | | \n| | | | | | | | \n| | | | | | | | ' }
          }
        ],
        meta: { layer: 'objects', zIndex: -1, field: 'corn' }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // TREES - Forest areas
      // ═══════════════════════════════════════════════════════════════════════════

      // Pine forest (west)
      {
        id: 'pine-1',
        name: 'Pine Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'pine-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -22, y: -14, width: 5, height: 5 }
          },
          {
            id: 'pine-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '  ^  \n ^^^ \n^^^^^\n^^^^^\n |#| ' }
          },
          {
            id: 'pine-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      {
        id: 'pine-2',
        name: 'Pine Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'pine-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -26, y: -12, width: 5, height: 5 }
          },
          {
            id: 'pine-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '  ^  \n ^^^ \n^^^^^\n^^^^^\n |#| ' }
          },
          {
            id: 'pine-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      // Oak trees (east)
      {
        id: 'oak-1',
        name: 'Oak Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'oak-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 20, y: 5, width: 7, height: 4 }
          },
          {
            id: 'oak-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: ' &&&&& \n&&&&&&&\n &&&&& \n  |#|  ' }
          },
          {
            id: 'oak-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      {
        id: 'oak-2',
        name: 'Oak Tree',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'oak-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 22, y: 12, width: 7, height: 4 }
          },
          {
            id: 'oak-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: ' &&&&& \n&&&&&&&\n &&&&& \n  |#|  ' }
          },
          {
            id: 'oak-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'environment' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // SHEEP - Tick-based wandering AI
      // ═══════════════════════════════════════════════════════════════════════════

      {
        id: 'sheep-1',
        name: 'Sheep',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'sheep-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 15, y: 8, width: 1, height: 1 }
          },
          {
            id: 'sheep-1-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 's', fg: [0.95, 0.95, 0.95], bg: [0, 0, 0] }
          },
          {
            id: 'sheep-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: false, layer: 'animal' }
          },
          {
            id: 'sheep-1-behavior',
            script: 'TickWanderAI',
            enabled: true,
            properties: {
              moveChance: 40,
              wanderRadius: 6
            }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, animal: true }
      },

      {
        id: 'sheep-2',
        name: 'Sheep',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'sheep-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 18, y: 10, width: 1, height: 1 }
          },
          {
            id: 'sheep-2-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 's', fg: [0.95, 0.95, 0.95], bg: [0, 0, 0] }
          },
          {
            id: 'sheep-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: false, layer: 'animal' }
          },
          {
            id: 'sheep-2-behavior',
            script: 'TickWanderAI',
            enabled: true,
            properties: {
              moveChance: 50,
              wanderRadius: 5
            }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, animal: true }
      },

      {
        id: 'sheep-3',
        name: 'Sheep',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'sheep-3-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 16, y: 12, width: 1, height: 1 }
          },
          {
            id: 'sheep-3-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 's', fg: [0.9, 0.9, 0.85], bg: [0, 0, 0] }
          },
          {
            id: 'sheep-3-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: false, layer: 'animal' }
          },
          {
            id: 'sheep-3-behavior',
            script: 'TickWanderAI',
            enabled: true,
            properties: {
              moveChance: 35,
              wanderRadius: 7
            }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, animal: true }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // NPCs - Village inhabitants
      // ═══════════════════════════════════════════════════════════════════════════

      {
        id: 'npc-farmer',
        name: 'Farmer Giles',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'farmer-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -30, y: 5, width: 1, height: 1 }
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
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'The harvest is good this year!' }
      },

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
            properties: { x: 1, y: -3, width: 1, height: 1 }
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
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'Looking to buy something?' }
      },

      {
        id: 'npc-blacksmith',
        name: 'Smithy',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'blacksmith-npc-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: -14, y: 6, width: 1, height: 1 }
          },
          {
            id: 'blacksmith-npc-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 'S', fg: [0.8, 0.4, 0.2], bg: [0, 0, 0] }
          },
          {
            id: 'blacksmith-npc-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'npc' }
          },
          {
            id: 'blacksmith-npc-interactable',
            script: 'Interactable',
            enabled: true,
            properties: { interactionRange: 2, promptText: 'Forge' }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'Need something forged?' }
      },

      {
        id: 'npc-priest',
        name: 'Father Thomas',
        type: 'GlyphNode',
        children: [],
        components: [
          {
            id: 'priest-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 12, y: -4, width: 1, height: 1 }
          },
          {
            id: 'priest-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: 'P', fg: [0.9, 0.9, 0.7], bg: [0, 0, 0] }
          },
          {
            id: 'priest-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'npc' }
          },
          {
            id: 'priest-interactable',
            script: 'Interactable',
            enabled: true,
            properties: { interactionRange: 2, promptText: 'Pray' }
          }
        ],
        meta: { layer: 'entities', zIndex: 0, npc: true, dialog: 'May the light guide you.' }
      },

      // ═══════════════════════════════════════════════════════════════════════════
      // DECORATIONS - Details
      // ═══════════════════════════════════════════════════════════════════════════

      // Campfire near tavern
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
            properties: { x: -5, y: -6, width: 3, height: 2 }
          },
          {
            id: 'campfire-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '***\n\\#/' }
          },
          {
            id: 'campfire-glyph',
            script: 'Glyph',
            enabled: true,
            properties: { char: '*', fg: [1.0, 0.5, 0.1], bg: [0, 0, 0], emission: 1.0, emissionColor: [1.0, 0.4, 0.1] }
          }
        ],
        meta: { layer: 'objects', zIndex: 1 }
      },

      // Fence sections
      {
        id: 'fence-1',
        name: 'Fence',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'fence-1-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 12, y: 6, width: 10, height: 1 }
          },
          {
            id: 'fence-1-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '=|=|=|=|=|' }
          },
          {
            id: 'fence-1-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'object' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      },

      {
        id: 'fence-2',
        name: 'Fence',
        type: 'GlyphMapNode',
        children: [],
        components: [
          {
            id: 'fence-2-rect',
            script: 'Rect2D',
            enabled: true,
            properties: { x: 12, y: 15, width: 10, height: 1 }
          },
          {
            id: 'fence-2-glyphmap',
            script: 'GlyphMap',
            enabled: true,
            properties: { cells: '=|=|=|=|=|' }
          },
          {
            id: 'fence-2-collider',
            script: 'Collider',
            enabled: true,
            properties: { blocksMovement: true, layer: 'object' }
          }
        ],
        meta: { layer: 'objects', zIndex: 0 }
      }
    ],
    components: [],
    meta: { screenContent: true }
  },

      // ═══════════════════════════════════════════════════════════════════════════
      // UI LAYER - HUD elements (fixed screen position, persists)
      // ═══════════════════════════════════════════════════════════════════════════
      {
        id: 'ui-container',
        name: 'UI',
        type: 'Node',
        children: [
          // Health bar
          {
            id: 'ui-health',
            name: 'Health Bar',
            type: 'GlyphMapNode',
            children: [],
            components: [
              {
                id: 'ui-health-rect',
                script: 'Rect2D',
                enabled: true,
                properties: { x: -38, y: -23, width: 14, height: 2 }
              },
              {
                id: 'ui-health-glyphmap',
                script: 'GlyphMap',
                enabled: true,
                properties: { cells: 'HP [##########]\n   100/100    ' }
              }
            ],
            meta: { layer: 'ui', ui: true, screenSpace: true }
          },

          // Gold counter
          {
            id: 'ui-gold',
            name: 'Gold Counter',
            type: 'GlyphMapNode',
            children: [],
            components: [
              {
                id: 'ui-gold-rect',
                script: 'Rect2D',
                enabled: true,
                properties: { x: 28, y: -23, width: 10, height: 1 }
              },
              {
                id: 'ui-gold-glyphmap',
                script: 'GlyphMap',
                enabled: true,
                properties: { cells: '$ Gold: 250' }
              }
            ],
            meta: { layer: 'ui', ui: true, screenSpace: true }
          },

          // Mini inventory
          {
            id: 'ui-inventory',
            name: 'Quick Inventory',
            type: 'GlyphMapNode',
            children: [],
            components: [
              {
                id: 'ui-inventory-rect',
                script: 'Rect2D',
                enabled: true,
                properties: { x: -38, y: 20, width: 18, height: 3 }
              },
              {
                id: 'ui-inventory-glyphmap',
                script: 'GlyphMap',
                enabled: true,
                properties: { cells: '+----------------+\n| / ] [ + o  ?   |\n+----------------+' }
              }
            ],
            meta: { layer: 'ui', ui: true, screenSpace: true }
          },

          // Location indicator
          {
            id: 'ui-location',
            name: 'Location',
            type: 'GlyphMapNode',
            children: [],
            components: [
              {
                id: 'ui-location-rect',
                script: 'Rect2D',
                enabled: true,
                properties: { x: 20, y: 20, width: 18, height: 1 }
              },
              {
                id: 'ui-location-glyphmap',
                script: 'GlyphMap',
                enabled: true,
                properties: { cells: '~ Meadow Village ~' }
              }
            ],
            meta: { layer: 'ui', ui: true, screenSpace: true }
          }
        ],
        components: [],
        meta: { layer: 'ui', isUIRoot: true }
      }
    ],
    components: [],
    meta: { description: 'A sprawling village with fields, mountains, and wandering sheep' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Projects Registry
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PROJECTS: DemoProjectData[] = [
  {
    id: 'simple-rpg',
    name: 'Meadow Village',
    description: 'A sprawling roguelike village with mountains, farms, wandering sheep, and tick-based gameplay. Perfect for exploring the engine.',
    icon: '🏘',
    template: 'isometric-rpg',
    features: [
      'Roguelike tick system (sheep move when you move)',
      'Camera follows player (child node)',
      'Mountain ranges and forests',
      'Wheat and corn fields',
      'Village with tavern, church, blacksmith',
      'Wandering sheep with AI',
      'Multiple NPCs to interact with',
      'UI elements (health, gold, inventory)',
      'Glowing campfire'
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
      'buildings/_category.json': {
        name: 'Buildings',
        icon: '#',
        description: 'Houses, huts, and structures'
      },
      // Character prefabs - wrapped in { name, template } format
      'characters/player.prefab.json': {
        name: 'Player',
        description: 'Player character with camera',
        tags: ['player', 'character'],
        template: {
          id: 'player-prefab',
          name: 'Player',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: '@', fg: [0.2, 1.0, 0.4], bg: [0, 0, 0], emission: 0.3 } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'player' } }
          ],
          meta: { layer: 'entities', isPlayer: true }
        }
      },
      'characters/farmer.prefab.json': {
        name: 'Farmer NPC',
        description: 'Friendly farmer villager',
        tags: ['npc', 'villager'],
        template: {
          id: 'farmer-prefab',
          name: 'Farmer',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: 'F', fg: [0.7, 0.5, 0.3], bg: [0, 0, 0] } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'npc' } },
            { id: 'c4', script: 'Interactable', enabled: true, properties: { interactionRange: 2, promptText: 'Talk' } }
          ],
          meta: { layer: 'entities', npc: true, dialog: 'Hello traveler!' }
        }
      },
      'characters/merchant.prefab.json': {
        name: 'Merchant NPC',
        description: 'Village merchant for trading',
        tags: ['npc', 'merchant', 'shop'],
        template: {
          id: 'merchant-prefab',
          name: 'Merchant',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: 'M', fg: [1.0, 0.8, 0.0], bg: [0, 0, 0] } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'npc' } },
            { id: 'c4', script: 'Interactable', enabled: true, properties: { interactionRange: 2, promptText: 'Trade' } }
          ],
          meta: { layer: 'entities', npc: true, dialog: 'Want to trade?' }
        }
      },
      'characters/goblin.prefab.json': {
        name: 'Goblin',
        description: 'Small green enemy',
        tags: ['enemy', 'monster'],
        template: {
          id: 'goblin-prefab',
          name: 'Goblin',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: 'g', fg: [0.4, 0.8, 0.2], bg: [0, 0, 0] } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'enemy' } }
          ],
          meta: { layer: 'entities', enemy: true }
        }
      },
      'characters/sheep.prefab.json': {
        name: 'Sheep',
        description: 'Fluffy wandering sheep',
        tags: ['animal', 'passive'],
        template: {
          id: 'sheep-prefab',
          name: 'Sheep',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: 's', fg: [0.9, 0.9, 0.9], bg: [0, 0, 0] } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'animal' } }
          ],
          meta: { layer: 'entities', animal: true }
        }
      },
      // Environment prefabs
      'environment/oak-tree.prefab.json': {
        name: 'Oak Tree',
        description: 'Large oak tree with foliage',
        tags: ['tree', 'nature'],
        template: {
          id: 'oak-tree-prefab',
          name: 'Oak Tree',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 5, height: 3 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: ' &&& \n&&&&&\n |#| ' } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'environment' } }
          ],
          meta: { layer: 'objects' }
        }
      },
      'environment/pine-tree.prefab.json': {
        name: 'Pine Tree',
        description: 'Tall evergreen pine tree',
        tags: ['tree', 'nature'],
        template: {
          id: 'pine-tree-prefab',
          name: 'Pine Tree',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 5, height: 4 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: '  ^  \n ^^^ \n^^^^^\n |#| ' } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'environment' } }
          ],
          meta: { layer: 'objects' }
        }
      },
      'environment/campfire.prefab.json': {
        name: 'Campfire',
        description: 'Glowing campfire with embers',
        tags: ['fire', 'light', 'animated'],
        template: {
          id: 'campfire-prefab',
          name: 'Campfire',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 3, height: 2 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: '***\n\\#/' } },
            { id: 'c3', script: 'Glyph', enabled: true, properties: { char: '*', fg: [1.0, 0.6, 0.1], bg: [0, 0, 0], emission: 0.8 } }
          ],
          meta: { layer: 'objects', animated: true }
        }
      },
      'environment/well.prefab.json': {
        name: 'Well',
        description: 'Village water well',
        tags: ['water', 'interactable'],
        template: {
          id: 'well-prefab',
          name: 'Well',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 4, height: 3 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: '/--\\\n|~~|\n\\__/' } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'environment' } },
            { id: 'c4', script: 'Interactable', enabled: true, properties: { interactionRange: 1.5, promptText: 'Drink' } }
          ],
          meta: { layer: 'objects' }
        }
      },
      'environment/rock.prefab.json': {
        name: 'Rock',
        description: 'Small boulder',
        tags: ['rock', 'obstacle'],
        template: {
          id: 'rock-prefab',
          name: 'Rock',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: 'o', fg: [0.5, 0.5, 0.5], bg: [0, 0, 0] } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, layer: 'environment' } }
          ],
          meta: { layer: 'objects' }
        }
      },
      'environment/bush.prefab.json': {
        name: 'Bush',
        description: 'Decorative shrub',
        tags: ['plant', 'decoration'],
        template: {
          id: 'bush-prefab',
          name: 'Bush',
          type: 'GlyphNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 1, height: 1 } },
            { id: 'c2', script: 'Glyph', enabled: true, properties: { char: '*', fg: [0.2, 0.6, 0.2], bg: [0, 0, 0] } }
          ],
          meta: { layer: 'objects' }
        }
      },
      // Building prefabs
      'buildings/hut.prefab.json': {
        name: 'Village Hut',
        description: 'Small village dwelling',
        tags: ['building', 'house'],
        template: {
          id: 'hut-prefab',
          name: 'Village Hut',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 6, height: 4 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: '  /\\  \n /##\\ \n |##| \n |==| ' } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, blocksVision: true, layer: 'building' } }
          ],
          meta: { layer: 'objects', building: 'hut' }
        }
      },
      'buildings/inn.prefab.json': {
        name: 'Inn',
        description: 'Village inn for travelers',
        tags: ['building', 'inn'],
        template: {
          id: 'inn-prefab',
          name: 'Inn',
          type: 'GlyphMapNode',
          children: [],
          components: [
            { id: 'c1', script: 'Rect2D', enabled: true, properties: { x: 0, y: 0, width: 10, height: 5 } },
            { id: 'c2', script: 'GlyphMap', enabled: true, properties: { cells: '    /\\    \n   /##\\   \n  /####\\  \n |######| \n |==##==| ' } },
            { id: 'c3', script: 'Collider', enabled: true, properties: { blocksMovement: true, blocksVision: true, layer: 'building' } }
          ],
          meta: { layer: 'objects', building: 'inn' }
        }
      }
    },
    scripts: {
      'PlayerController.ts': `// ═══════════════════════════════════════════════════════════════════════════
// PlayerController Component - WASD movement for player entities
// Responds to keyboard input during play mode
// Uses TickSystem's smooth tick for synchronized animations
// ═══════════════════════════════════════════════════════════════════════════

import { Component, component, property, lifecycle } from '@engine/core'
import { Runtime, TransformCache, Ticks, type EasingType } from '@engine/runtime'

@component({
  name: 'PlayerController',
  icon: '🎮',
  description: 'WASD movement control for player character'
})
export class PlayerController extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties (exposed in inspector)
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Move Speed',
    group: 'Movement',
    min: 0.1,
    max: 20,
    step: 0.1,
    tooltip: 'Movement speed in cells per second (non-grid mode)'
  })
  moveSpeed: number = 5

  @property({
    type: 'boolean',
    label: 'Grid Snap',
    group: 'Movement',
    tooltip: 'Snap movement to grid cells'
  })
  gridSnap: boolean = true

  @property({
    type: 'select',
    label: 'Easing',
    group: 'Animation',
    options: ['linear', 'easeOut', 'easeOutQuad', 'easeInOut', 'easeOutBack', 'bounce'],
    tooltip: 'Movement animation easing (uses global tick duration)'
  })
  easing: EasingType = 'easeOut'

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private storeAccessor: (() => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }) | null = null
  private startX: number = 0
  private startY: number = 0
  private targetX: number = 0
  private targetY: number = 0
  private isMoving: boolean = false

  // ─────────────────────────────────────────────────────────────────────────
  // Store Integration (injected by engine)
  // ─────────────────────────────────────────────────────────────────────────

  setStoreAccessor(accessor: () => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }): void {
    this.storeAccessor = accessor
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    console.log('[PlayerController] Initialized on node:', this.node?.name)
    this.isMoving = false
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[PlayerController] Disposed')
  }

  /**
   * Called each frame during play mode
   */
  onUpdate(_deltaTime: number): void {
    // If currently animating a move, lerp position
    if (this.isMoving && Ticks.isAnimating()) {
      this.updateLerpPosition()
    } else if (this.isMoving && !Ticks.isAnimating()) {
      this.finishMove()
    }

    // Don't accept new input while tick is animating
    if (Ticks.isInputBlocked()) {
      return
    }

    // Check for movement input
    let dx = 0
    let dy = 0

    if (Runtime.isKeyDown('KeyW') || Runtime.isKeyDown('ArrowUp')) {
      dy = -1
    } else if (Runtime.isKeyDown('KeyS') || Runtime.isKeyDown('ArrowDown')) {
      dy = 1
    }

    if (Runtime.isKeyDown('KeyA') || Runtime.isKeyDown('ArrowLeft')) {
      dx = -1
    } else if (Runtime.isKeyDown('KeyD') || Runtime.isKeyDown('ArrowRight')) {
      dx = 1
    }

    if (dx !== 0 || dy !== 0) {
      this.startMove(dx, dy)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smooth Movement
  // ─────────────────────────────────────────────────────────────────────────

  private startMove(dx: number, dy: number): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    this.startX = (storeComp.properties.x as number) ?? 0
    this.startY = (storeComp.properties.y as number) ?? 0

    this.targetX = this.startX + dx
    this.targetY = this.startY + dy

    this.isMoving = true
    TransformCache.getInstance().markDirty(this.node.id)

    // Trigger global tick - other entities will react
    Ticks.tick()
  }

  private updateLerpPosition(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    const t = Ticks.getEasedProgress(this.easing)
    storeComp.properties.x = this.startX + (this.targetX - this.startX) * t
    storeComp.properties.y = this.startY + (this.targetY - this.startY) * t

    TransformCache.getInstance().markDirty(this.node.id)
  }

  private finishMove(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    storeComp.properties.x = this.targetX
    storeComp.properties.y = this.targetY
    this.isMoving = false

    TransformCache.getInstance().markDirty(this.node.id)
  }
}
`,
      'TickWanderAI.ts': `// ═══════════════════════════════════════════════════════════════════════════
// TickWanderAI Component - Roguelike tick-based wandering with smooth animation
// Only moves when the player moves (on tick), but animates smoothly
// Perfect for polished roguelike behavior
// ═══════════════════════════════════════════════════════════════════════════

import { Component, component, property, lifecycle } from '@engine/core'
import { TransformCache, Ticks, type EasingType } from '@engine/runtime'

@component({
  name: 'TickWanderAI',
  icon: '🎲',
  description: 'Roguelike tick-based wandering with smooth animation'
})
export class TickWanderAI extends Component {
  // ─────────────────────────────────────────────────────────────────────────
  // Properties (exposed in inspector)
  // ─────────────────────────────────────────────────────────────────────────

  @property({
    type: 'number',
    label: 'Move Chance',
    group: 'Movement',
    min: 0,
    max: 100,
    step: 5,
    tooltip: 'Percent chance to move each tick (0-100)'
  })
  moveChance: number = 50

  @property({
    type: 'number',
    label: 'Wander Radius',
    group: 'Movement',
    min: 1,
    max: 50,
    step: 1,
    tooltip: 'Maximum distance from starting position'
  })
  wanderRadius: number = 8

  @property({
    type: 'boolean',
    label: 'Diagonal Movement',
    group: 'Movement',
    tooltip: 'Allow diagonal movement'
  })
  allowDiagonal: boolean = false

  @property({
    type: 'select',
    label: 'Easing',
    group: 'Animation',
    options: ['linear', 'easeOut', 'easeOutQuad', 'easeInOut', 'easeOutBack', 'bounce'],
    tooltip: 'Movement animation easing'
  })
  easing: EasingType = 'easeOut'

  // ─────────────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────────────

  private homeX: number = 0
  private homeY: number = 0
  private lerpStartX: number = 0
  private lerpStartY: number = 0
  private lerpTargetX: number = 0
  private lerpTargetY: number = 0
  private isMoving: boolean = false
  private unsubscribe: (() => void) | null = null
  private storeAccessor: (() => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }) | null = null

  // ─────────────────────────────────────────────────────────────────────────
  // Store Integration (injected by engine)
  // ─────────────────────────────────────────────────────────────────────────

  setStoreAccessor(accessor: () => { entities: { components: Record<string, { properties?: Record<string, unknown> }> } }): void {
    this.storeAccessor = accessor
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  @lifecycle('Execute:Init')
  onInit(): void {
    console.log('[TickWanderAI] Initialized on node:', this.node?.name)

    // Store home position (for wander radius)
    if (this.node && this.storeAccessor) {
      const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
      if (rect2DComp) {
        const state = this.storeAccessor()
        const storeComp = state.entities.components[rect2DComp.id]
        if (storeComp?.properties) {
          this.homeX = (storeComp.properties.x as number) ?? 0
          this.homeY = (storeComp.properties.y as number) ?? 0
        }
      }
    }

    // Subscribe to tick events - move when player moves
    this.unsubscribe = Ticks.subscribe((_tickNumber) => {
      this.onTick()
    })
  }

  @lifecycle('Execute:Dispose')
  onDispose(): void {
    console.log('[TickWanderAI] Disposed')
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tick Handler - Called when player moves
  // ─────────────────────────────────────────────────────────────────────────

  private onTick(): void {
    // Random chance to skip this tick
    if (Math.random() * 100 > this.moveChance) {
      this.isMoving = false
      return
    }
    this.startMove()
  }

  private startMove(): void {
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    this.lerpStartX = (storeComp.properties.x as number) ?? 0
    this.lerpStartY = (storeComp.properties.y as number) ?? 0

    const direction = this.pickDirection(this.lerpStartX, this.lerpStartY)
    if (!direction) {
      this.isMoving = false
      return
    }

    this.lerpTargetX = this.lerpStartX + direction.dx
    this.lerpTargetY = this.lerpStartY + direction.dy
    this.isMoving = true
  }

  private pickDirection(currentX: number, currentY: number): { dx: number; dy: number } | null {
    const directions: { dx: number; dy: number }[] = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ]

    if (this.allowDiagonal) {
      directions.push(
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
      )
    }

    const validDirections = directions.filter(dir => {
      const newX = currentX + dir.dx
      const newY = currentY + dir.dy
      const distFromHome = Math.abs(newX - this.homeX) + Math.abs(newY - this.homeY)
      return distFromHome <= this.wanderRadius
    })

    if (validDirections.length === 0) {
      const towardHomeX = Math.sign(this.homeX - currentX)
      const towardHomeY = Math.sign(this.homeY - currentY)
      if (towardHomeX !== 0) return { dx: towardHomeX, dy: 0 }
      if (towardHomeY !== 0) return { dx: 0, dy: towardHomeY }
      return null
    }

    return validDirections[Math.floor(Math.random() * validDirections.length)]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update - Lerp position each frame during tick animation
  // ─────────────────────────────────────────────────────────────────────────

  onUpdate(_deltaTime: number): void {
    if (!this.isMoving) return
    if (!this.node || !this.storeAccessor) return

    const rect2DComp = this.node.components.find(c => c.script === 'Rect2D')
    if (!rect2DComp) return

    const state = this.storeAccessor()
    const storeComp = state.entities.components[rect2DComp.id]
    if (!storeComp?.properties) return

    if (Ticks.isAnimating()) {
      const t = Ticks.getEasedProgress(this.easing)
      storeComp.properties.x = this.lerpStartX + (this.lerpTargetX - this.lerpStartX) * t
      storeComp.properties.y = this.lerpStartY + (this.lerpTargetY - this.lerpStartY) * t
      TransformCache.getInstance().markDirty(this.node.id)
    } else {
      storeComp.properties.x = this.lerpTargetX
      storeComp.properties.y = this.lerpTargetY
      this.isMoving = false
      TransformCache.getInstance().markDirty(this.node.id)
    }
  }
}
`,
    'GameData.ts': `
import { Component, component, property, lifecycle } from '@scripting'

/**
 * GameData - Persistent game state that survives screen transitions
 * Tracks player stats, inventory, visited screens, and screen modifications
 */
@component({ name: 'GameData', icon: '💾' })
export class GameDataComponent extends Component {
  // Player stats
  @property({ type: 'number', label: 'Health' })
  health: number = 100

  @property({ type: 'number', label: 'Max Health' })
  maxHealth: number = 100

  @property({ type: 'number', label: 'Gold' })
  gold: number = 0

  // Runtime state (not serialized as properties)
  private inventory: string[] = []
  private visitedScreens: Set<string> = new Set()
  private screenChanges: Map<string, object[]> = new Map()

  @lifecycle('Execute:Init')
  onInit(): void {
    // Mark starting screen as visited
    this.visitedScreens.add('0_0')
    console.log('[GameData] Initialized - starting at screen 0,0')
  }

  // Screen tracking
  markScreenVisited(worldX: number, worldY: number): void {
    const key = \`\${worldX}_\${worldY}\`
    this.visitedScreens.add(key)
  }

  isScreenVisited(worldX: number, worldY: number): boolean {
    return this.visitedScreens.has(\`\${worldX}_\${worldY}\`)
  }

  getVisitedCount(): number {
    return this.visitedScreens.size
  }

  // Screen changes (for persistent modifications like opened chests)
  recordScreenChange(worldX: number, worldY: number, change: object): void {
    const key = \`\${worldX}_\${worldY}\`
    const changes = this.screenChanges.get(key) || []
    changes.push(change)
    this.screenChanges.set(key, changes)
  }

  getScreenChanges(worldX: number, worldY: number): object[] {
    return this.screenChanges.get(\`\${worldX}_\${worldY}\`) || []
  }

  // Inventory management
  addItem(itemId: string): void {
    this.inventory.push(itemId)
  }

  removeItem(itemId: string): boolean {
    const index = this.inventory.indexOf(itemId)
    if (index >= 0) {
      this.inventory.splice(index, 1)
      return true
    }
    return false
  }

  hasItem(itemId: string): boolean {
    return this.inventory.includes(itemId)
  }

  getInventory(): string[] {
    return [...this.inventory]
  }

  // Health management
  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount)
    return this.health > 0
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  isDead(): boolean {
    return this.health <= 0
  }

  // Gold management
  addGold(amount: number): void {
    this.gold += amount
  }

  spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount
      return true
    }
    return false
  }
}
`,
    'WorldManager.ts': `
import { Component, component, property, lifecycle, TransformCache } from '@scripting'

interface SerializedNode {
  id: string
  name: string
  type: string
  components: Array<{ id: string; script: string; enabled: boolean; properties: Record<string, unknown> }>
  children: SerializedNode[]
  meta?: Record<string, unknown>
}

/**
 * WorldManager - Handles screen transitions and world navigation
 * Manages the ScreenLayer, caching screens, and procedural generation
 */
@component({ name: 'WorldManager', icon: '🗺️' })
export class WorldManagerComponent extends Component {
  @property({ type: 'number', label: 'World X' })
  worldX: number = 0

  @property({ type: 'number', label: 'World Y' })
  worldY: number = 0

  @property({ type: 'number', label: 'Screen Width' })
  screenWidth: number = 80

  @property({ type: 'number', label: 'Screen Height' })
  screenHeight: number = 50

  // Map bounds (for centered maps)
  @property({ type: 'number', label: 'Min X' })
  minX: number = -40

  @property({ type: 'number', label: 'Max X' })
  maxX: number = 39

  @property({ type: 'number', label: 'Min Y' })
  minY: number = -25

  @property({ type: 'number', label: 'Max Y' })
  maxY: number = 24

  // Screen cache
  private screenCache: Map<string, SerializedNode[]> = new Map()
  private initialized: boolean = false

  @lifecycle('Execute:Init')
  onInit(): void {
    if (this.initialized) return
    this.initialized = true

    // Cache the initial screen (home base)
    this.cacheCurrentScreen()
    console.log(\`[WorldManager] Initialized at world position (\${this.worldX}, \${this.worldY})\`)
  }

  /**
   * Transition to an adjacent screen
   */
  transitionTo(direction: 'north' | 'south' | 'east' | 'west'): void {
    console.log(\`[WorldManager] Transitioning \${direction} from (\${this.worldX}, \${this.worldY})\`)

    // 1. Cache current screen
    this.cacheCurrentScreen()

    // 2. Update world coordinates
    const deltas: Record<string, [number, number]> = {
      north: [0, -1],
      south: [0, 1],
      east: [1, 0],
      west: [-1, 0]
    }
    const [dx, dy] = deltas[direction]
    this.worldX += dx
    this.worldY += dy

    // Update the component property in store
    const state = this.storeAccessor()
    const comp = state.entities.components[this.componentId]
    if (comp?.properties) {
      comp.properties.worldX = this.worldX
      comp.properties.worldY = this.worldY
    }

    // 3. Clear and repopulate screen layer
    const key = \`\${this.worldX}_\${this.worldY}\`
    if (this.screenCache.has(key)) {
      console.log(\`[WorldManager] Loading cached screen \${key}\`)
      this.loadCachedScreen(key)
    } else {
      console.log(\`[WorldManager] Generating new screen \${key}\`)
      this.generateScreen()
    }

    // 4. Reposition player at opposite edge
    this.repositionPlayer(direction)

    // 5. Update GameData if present
    this.updateGameData()
  }

  private cacheCurrentScreen(): void {
    const key = \`\${this.worldX}_\${this.worldY}\`
    const screenLayer = this.findScreenLayer()
    if (!screenLayer) {
      console.warn('[WorldManager] Could not find ScreenLayer to cache')
      return
    }

    const serialized = this.serializeChildren(screenLayer)
    this.screenCache.set(key, serialized)
    console.log(\`[WorldManager] Cached screen \${key} with \${serialized.length} children\`)
  }

  private findScreenLayer(): any {
    const state = this.storeAccessor()
    // Find ScreenLayer node (sibling of PersistentLayer)
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'ScreenLayer') {
        return node
      }
    }
    return null
  }

  private findPlayer(): any {
    const state = this.storeAccessor()
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'Player' || node.meta?.isPlayer) {
        return node
      }
    }
    return null
  }

  private serializeChildren(node: any): SerializedNode[] {
    const state = this.storeAccessor()
    const result: SerializedNode[] = []

    for (const childId of node.children || []) {
      const child = state.entities.nodes[childId]
      if (!child) continue

      result.push({
        id: child.id,
        name: child.name,
        type: child.type || 'Node',
        components: (child.components || []).map((compId: string) => {
          const comp = state.entities.components[compId]
          return comp ? {
            id: comp.id,
            script: comp.script,
            enabled: comp.enabled,
            properties: { ...comp.properties }
          } : null
        }).filter(Boolean),
        children: this.serializeChildren(child),
        meta: child.meta ? { ...child.meta } : undefined
      })
    }

    return result
  }

  private loadCachedScreen(key: string): void {
    const cached = this.screenCache.get(key)
    if (!cached) return

    const screenLayer = this.findScreenLayer()
    if (!screenLayer) return

    // Clear current children
    this.clearScreenLayer(screenLayer)

    // Recreate nodes from cache
    const state = this.storeAccessor()
    for (const nodeData of cached) {
      this.instantiateNode(nodeData, screenLayer.id, state)
    }
  }

  private clearScreenLayer(screenLayer: any): void {
    const state = this.storeAccessor()

    // Remove all children recursively
    const removeRecursive = (nodeId: string) => {
      const node = state.entities.nodes[nodeId]
      if (!node) return

      // Remove children first
      for (const childId of [...(node.children || [])]) {
        removeRecursive(childId)
      }

      // Remove components
      for (const compId of node.components || []) {
        delete state.entities.components[compId]
      }

      // Remove node
      delete state.entities.nodes[nodeId]
    }

    // Clear all screen layer children
    for (const childId of [...(screenLayer.children || [])]) {
      removeRecursive(childId)
    }
    screenLayer.children = []
  }

  private instantiateNode(data: SerializedNode, parentId: string, state: any): void {
    // Create new IDs
    const newId = \`\${data.id}_\${Date.now()}_\${Math.random().toString(36).slice(2, 5)}\`

    // Create components with new IDs
    const componentIds: string[] = []
    for (const compData of data.components) {
      const newCompId = \`\${compData.id}_\${Date.now()}_\${Math.random().toString(36).slice(2, 5)}\`
      state.entities.components[newCompId] = {
        id: newCompId,
        script: compData.script,
        enabled: compData.enabled,
        properties: { ...compData.properties }
      }
      componentIds.push(newCompId)
    }

    // Create node
    state.entities.nodes[newId] = {
      id: newId,
      name: data.name,
      type: data.type,
      children: [],
      components: componentIds,
      meta: data.meta ? { ...data.meta } : undefined
    }

    // Add to parent
    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(newId)
    }

    // Recursively instantiate children
    for (const childData of data.children || []) {
      this.instantiateNode(childData, newId, state)
    }
  }

  private generateScreen(): void {
    const screenLayer = this.findScreenLayer()
    if (!screenLayer) return

    // Clear existing content
    this.clearScreenLayer(screenLayer)

    const state = this.storeAccessor()

    // Seeded random for consistent generation
    const seed = this.worldX * 10000 + this.worldY
    const rng = this.seededRandom(seed)

    // Generate terrain (grass background with some variation)
    const terrainId = \`terrain_\${Date.now()}\`
    const terrainGlyphId = \`terrain_glyph_\${Date.now()}\`
    const terrainRectId = \`terrain_rect_\${Date.now()}\`

    // Create terrain glyph map data (using centered coordinates)
    const cells: any[] = []
    for (let y = this.minY; y <= this.maxY; y++) {
      for (let x = this.minX; x <= this.maxX; x++) {
        const grassChars = ['.', ',', "'", '\`']
        const char = grassChars[Math.floor(rng() * grassChars.length)]
        const greenVariation = 0.2 + rng() * 0.3
        cells.push({
          x, y, char,
          fg: [0.1, greenVariation, 0.1],
          bg: [0.02, 0.05, 0.02]
        })
      }
    }

    state.entities.components[terrainRectId] = {
      id: terrainRectId, script: 'Rect2D', enabled: true,
      properties: { x: this.minX, y: this.minY, width: this.screenWidth, height: this.screenHeight }
    }
    state.entities.components[terrainGlyphId] = {
      id: terrainGlyphId, script: 'GlyphMap', enabled: true,
      properties: { cells, zIndex: 0 }
    }
    state.entities.nodes[terrainId] = {
      id: terrainId, name: 'Terrain', type: 'GlyphNode',
      children: [], components: [terrainRectId, terrainGlyphId]
    }
    screenLayer.children.push(terrainId)

    // Generate trees (avoid edges where player might spawn, use centered coords)
    const treeCount = Math.floor(5 + rng() * 15)
    for (let i = 0; i < treeCount; i++) {
      const x = Math.floor(this.minX + 5 + rng() * (this.screenWidth - 10))
      const y = Math.floor(this.minY + 5 + rng() * (this.screenHeight - 10))
      this.createTree(screenLayer.id, x, y, state, rng)
    }

    // Generate rocks (use centered coords)
    const rockCount = Math.floor(2 + rng() * 8)
    for (let i = 0; i < rockCount; i++) {
      const x = Math.floor(this.minX + 3 + rng() * (this.screenWidth - 6))
      const y = Math.floor(this.minY + 3 + rng() * (this.screenHeight - 6))
      this.createRock(screenLayer.id, x, y, state)
    }

    console.log(\`[WorldManager] Generated screen with \${treeCount} trees and \${rockCount} rocks\`)
  }

  private createTree(parentId: string, x: number, y: number, state: any, rng: () => number): void {
    const id = \`tree_\${Date.now()}_\${Math.random().toString(36).slice(2, 5)}\`
    const rectId = \`\${id}_rect\`
    const glyphId = \`\${id}_glyph\`
    const colliderId = \`\${id}_collider\`

    const treeChars = ['♣', '♠', '▲', '🌲']
    const char = treeChars[Math.floor(rng() * treeChars.length)]
    const greenShade = 0.3 + rng() * 0.4

    state.entities.components[rectId] = {
      id: rectId, script: 'Rect2D', enabled: true,
      properties: { x, y, width: 1, height: 1 }
    }
    state.entities.components[glyphId] = {
      id: glyphId, script: 'Glyph', enabled: true,
      properties: { char, fg: [0.1, greenShade, 0.1], bg: [0, 0, 0], zIndex: 5 }
    }
    state.entities.components[colliderId] = {
      id: colliderId, script: 'Collider', enabled: true,
      properties: { solid: true, shape: 'box' }
    }
    state.entities.nodes[id] = {
      id, name: 'Tree', type: 'GlyphNode',
      children: [], components: [rectId, glyphId, colliderId]
    }

    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(id)
    }
  }

  private createRock(parentId: string, x: number, y: number, state: any): void {
    const id = \`rock_\${Date.now()}_\${Math.random().toString(36).slice(2, 5)}\`
    const rectId = \`\${id}_rect\`
    const glyphId = \`\${id}_glyph\`
    const colliderId = \`\${id}_collider\`

    state.entities.components[rectId] = {
      id: rectId, script: 'Rect2D', enabled: true,
      properties: { x, y, width: 1, height: 1 }
    }
    state.entities.components[glyphId] = {
      id: glyphId, script: 'Glyph', enabled: true,
      properties: { char: '●', fg: [0.5, 0.5, 0.5], bg: [0, 0, 0], zIndex: 5 }
    }
    state.entities.components[colliderId] = {
      id: colliderId, script: 'Collider', enabled: true,
      properties: { solid: true, shape: 'box' }
    }
    state.entities.nodes[id] = {
      id, name: 'Rock', type: 'GlyphNode',
      children: [], components: [rectId, glyphId, colliderId]
    }

    const parent = state.entities.nodes[parentId]
    if (parent) {
      parent.children = parent.children || []
      parent.children.push(id)
    }
  }

  private repositionPlayer(fromDirection: string): void {
    const player = this.findPlayer()
    if (!player) return

    // Find player's Rect2D component
    const state = this.storeAccessor()
    let rect2DComp: any = null
    for (const compId of player.components || []) {
      const comp = state.entities.components[compId]
      if (comp?.script === 'Rect2D') {
        rect2DComp = comp
        break
      }
    }
    if (!rect2DComp) return

    // Place player at opposite edge
    const opposites: Record<string, string> = {
      north: 'south', south: 'north', east: 'west', west: 'east'
    }
    const entryEdge = opposites[fromDirection]

    // Positions using centered coordinates
    const positions: Record<string, [number, number]> = {
      north: [0, this.minY + 3],                    // Center X, near north edge
      south: [0, this.maxY - 3],                    // Center X, near south edge
      east: [this.maxX - 3, 0],                     // Near east edge, center Y
      west: [this.minX + 3, 0]                      // Near west edge, center Y
    }

    const [x, y] = positions[entryEdge]
    rect2DComp.properties.x = x
    rect2DComp.properties.y = y

    // Mark transform dirty
    TransformCache.getInstance().markDirty(player.id)

    console.log(\`[WorldManager] Repositioned player to (\${x}, \${y}) on \${entryEdge} edge\`)
  }

  private updateGameData(): void {
    // Find GameData component and mark screen as visited
    const state = this.storeAccessor()
    for (const compId in state.entities.components) {
      const comp = state.entities.components[compId]
      if (comp?.script === 'GameData') {
        // We can't call methods on components directly, so we'd need signals
        // For now, just log
        console.log(\`[WorldManager] Would update GameData for screen (\${this.worldX}, \${this.worldY})\`)
        break
      }
    }
  }

  private seededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }
  }

  // Public getter for edge trigger
  getWorldPosition(): { x: number; y: number } {
    return { x: this.worldX, y: this.worldY }
  }
}
`,
    'EdgeTrigger.ts': `
import { Component, component, property, lifecycle, TransformCache, Ticks } from '@scripting'

/**
 * EdgeTrigger - Detects when player reaches map boundaries and triggers screen transitions
 * Supports centered maps (e.g., -40 to +40) via minX/maxX/minY/maxY properties
 */
@component({ name: 'EdgeTrigger', icon: '🚪' })
export class EdgeTriggerComponent extends Component {
  @property({ type: 'number', label: 'Edge Threshold', min: 1, max: 5 })
  edgeThreshold: number = 2

  // Map bounds (for centered maps)
  @property({ type: 'number', label: 'Min X' })
  minX: number = -40

  @property({ type: 'number', label: 'Max X' })
  maxX: number = 39

  @property({ type: 'number', label: 'Min Y' })
  minY: number = -25

  @property({ type: 'number', label: 'Max Y' })
  maxY: number = 24

  @property({ type: 'number', label: 'Cooldown (seconds)' })
  cooldown: number = 0.5

  private lastTransitionTime: number = 0
  private worldManager: any = null
  private initialized: boolean = false

  @lifecycle('Execute:Init')
  onInit(): void {
    if (this.initialized) return
    this.initialized = true
    console.log(\`[EdgeTrigger] Initialized - bounds: (\${this.minX},\${this.minY}) to (\${this.maxX},\${this.maxY}), threshold: \${this.edgeThreshold}\`)
  }

  @lifecycle('Execute:Update')
  onUpdate(): void {
    // Check cooldown
    const now = Ticks.getTime()
    if (now - this.lastTransitionTime < this.cooldown) {
      return
    }

    // Find player
    const player = this.findPlayer()
    if (!player) return

    // Get player position
    const pos = TransformCache.getInstance().getWorldPosition(player.id)
    if (!pos) return

    // Check edges using actual map bounds
    let direction: 'north' | 'south' | 'east' | 'west' | null = null

    if (pos.x <= this.minX + this.edgeThreshold) {
      direction = 'west'
    } else if (pos.x >= this.maxX - this.edgeThreshold) {
      direction = 'east'
    } else if (pos.y <= this.minY + this.edgeThreshold) {
      direction = 'north'
    } else if (pos.y >= this.maxY - this.edgeThreshold) {
      direction = 'south'
    }

    if (direction) {
      console.log(\`[EdgeTrigger] Player at \${direction} edge (pos: \${pos.x}, \${pos.y})\`)
      this.triggerTransition(direction)
      this.lastTransitionTime = now
    }
  }

  private findPlayer(): any {
    const state = this.storeAccessor()
    for (const nodeId in state.entities.nodes) {
      const node = state.entities.nodes[nodeId]
      if (node.name === 'Player' || node.meta?.isPlayer) {
        return node
      }
    }
    return null
  }

  private triggerTransition(direction: 'north' | 'south' | 'east' | 'west'): void {
    // Find WorldManager component
    if (!this.worldManager) {
      const state = this.storeAccessor()
      for (const compId in state.entities.components) {
        const comp = state.entities.components[compId]
        if (comp?.script === 'WorldManager') {
          this.worldManager = comp
          break
        }
      }
    }

    if (!this.worldManager) {
      console.warn('[EdgeTrigger] Could not find WorldManager component')
      return
    }

    // We need to call the WorldManager's transitionTo method
    // Since we can't call methods directly, we need to find the component instance
    // For now, we'll access it through the PlayModeManager's component instances
    const instances = (window as any).__componentInstances
    if (instances) {
      for (const [id, instance] of instances) {
        if (instance.constructor.name === 'WorldManagerComponent' ||
            (instance as any).transitionTo) {
          (instance as any).transitionTo(direction)
          return
        }
      }
    }

    console.warn('[EdgeTrigger] Could not find WorldManager instance to call transitionTo')
  }
}
`
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
    palettes: {},
    scripts: {}
  }
]

export function getDemoProject(id: string): DemoProjectData | undefined {
  return DEMO_PROJECTS.find(d => d.id === id)
}
