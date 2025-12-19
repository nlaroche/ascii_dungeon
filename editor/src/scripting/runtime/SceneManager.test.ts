// ═══════════════════════════════════════════════════════════════════════════
// Scene Manager Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import { SceneManager } from './SceneManager'
import type { SceneData, EntityData, PrefabData } from './SceneManager'

describe('SceneManager', () => {
  let scene: SceneManager

  const testScene: SceneData = {
    name: 'test-scene',
    entities: [
      {
        id: 'player',
        name: 'Player',
        tags: ['player', 'character'],
        layer: 'actors',
        position: { x: 0, y: 0 },
        enabled: true,
      },
      {
        id: 'enemy-1',
        name: 'Enemy1',
        tags: ['enemy', 'character'],
        layer: 'actors',
        position: { x: 10, y: 5 },
        enabled: true,
      },
      {
        id: 'enemy-2',
        tags: ['enemy'],
        layer: 'actors',
        position: { x: 20, y: 10 },
        enabled: true,
      },
      {
        id: 'wall',
        tags: ['solid'],
        layer: 'environment',
        position: { x: 5, y: 5 },
        enabled: true,
      },
    ],
  }

  beforeEach(() => {
    scene = new SceneManager()
    // Deep clone the test scene to avoid mutations persisting between tests
    scene.registerScene('test-scene', () => JSON.parse(JSON.stringify(testScene)))
  })

  describe('scene loading', () => {
    it('should load a registered scene', async () => {
      const loaded = await scene.loadScene('test-scene')
      expect(loaded).toBe(true)
      expect(scene.getSceneName()).toBe('test-scene')
      expect(scene.getEntityCount()).toBe(4)
    })

    it('should return false for unknown scene', async () => {
      const loaded = await scene.loadScene('unknown')
      expect(loaded).toBe(false)
    })

    it('should clear previous scene when loading new one', async () => {
      await scene.loadScene('test-scene')
      expect(scene.getEntityCount()).toBe(4)

      scene.registerScene('empty', () => ({ name: 'empty', entities: [] }))
      await scene.loadScene('empty')
      expect(scene.getEntityCount()).toBe(0)
    })

    it('should reload current scene', async () => {
      await scene.loadScene('test-scene')
      scene.setPosition('player', 100, 100)

      await scene.reloadScene()
      const pos = scene.getPosition('player')
      expect(pos).toEqual({ x: 0, y: 0 })
    })
  })

  describe('entity queries', () => {
    beforeEach(async () => {
      await scene.loadScene('test-scene')
    })

    it('should get entity by id', () => {
      const entity = scene.getEntity('player')
      expect(entity).toBeDefined()
      expect(entity?.name).toBe('Player')
    })

    it('should find entity by name', () => {
      const entity = scene.findByName('Player')
      expect(entity).toBeDefined()
      expect(entity?.id).toBe('player')
    })

    it('should find entities by tag', () => {
      const enemies = scene.findByTag('enemy')
      expect(enemies).toHaveLength(2)

      const characters = scene.findByTag('character')
      expect(characters).toHaveLength(2)
    })

    it('should find entities by layer', () => {
      const actors = scene.findByLayer('actors')
      expect(actors).toHaveLength(3)

      const environment = scene.findByLayer('environment')
      expect(environment).toHaveLength(1)
    })

    it('should find entities with query', () => {
      const results = scene.findEntities({ tag: 'enemy' })
      expect(results).toHaveLength(2)
    })
  })

  describe('entity hierarchy', () => {
    it('should track parent-child relationships', async () => {
      const hierarchyScene: SceneData = {
        name: 'hierarchy',
        entities: [
          { id: 'parent', children: ['child1', 'child2'] },
          { id: 'child1', parent: 'parent' },
          { id: 'child2', parent: 'parent' },
        ],
      }
      scene.registerScene('hierarchy', () => hierarchyScene)
      await scene.loadScene('hierarchy')

      const parent = scene.getEntity('parent')
      expect(parent?.children).toEqual(['child1', 'child2'])

      const children = scene.getChildren('parent')
      expect(children).toHaveLength(2)

      const childParent = scene.getParent('child1')
      expect(childParent?.id).toBe('parent')
    })
  })

  describe('entity state', () => {
    beforeEach(async () => {
      await scene.loadScene('test-scene')
    })

    it('should set and get position', () => {
      scene.setPosition('player', 50, 75)
      expect(scene.getPosition('player')).toEqual({ x: 50, y: 75 })
    })

    it('should translate entity', () => {
      scene.setPosition('player', 10, 10)
      scene.translate('player', 5, -3)
      expect(scene.getPosition('player')).toEqual({ x: 15, y: 7 })
    })

    it('should set enabled state', () => {
      scene.setEnabled('player', false)
      expect(scene.isEnabled('player')).toBe(false)

      scene.setEnabled('player', true)
      expect(scene.isEnabled('player')).toBe(true)
    })
  })

  describe('spatial queries', () => {
    beforeEach(async () => {
      await scene.loadScene('test-scene')
    })

    it('should calculate distance between entities', () => {
      // player at (0,0), enemy-1 at (10,5)
      const dist = scene.distance('player', 'enemy-1')
      expect(dist).toBeCloseTo(Math.sqrt(100 + 25))
    })

    it('should calculate direction between entities', () => {
      const dir = scene.direction('player', 'enemy-1')
      expect(dir).not.toBeNull()
      expect(dir!.x).toBeGreaterThan(0)
      expect(dir!.y).toBeGreaterThan(0)
    })

    it('should find entities in radius', () => {
      // player at (0,0), wall at (5,5), enemy-1 at (10,5)
      const nearby = scene.findInRadius(0, 0, 8)
      expect(nearby.length).toBeGreaterThanOrEqual(2) // player and wall
    })
  })

  describe('instantiation', () => {
    const testPrefab: PrefabData = {
      id: 'bullet',
      name: 'Bullet',
      entity: {
        id: 'bullet-template',
        tags: ['projectile'],
        position: { x: 0, y: 0 },
      },
    }

    beforeEach(async () => {
      scene.registerPrefab(testPrefab)
      await scene.loadScene('test-scene')
    })

    it('should instantiate a prefab', () => {
      const entity = scene.instantiate('bullet', { x: 5, y: 10 })
      expect(entity).not.toBeNull()
      expect(entity!.position).toEqual({ x: 5, y: 10 })
      expect(entity!.tags).toContain('projectile')
      expect(scene.getEntityCount()).toBe(5)
    })

    it('should give instantiated entity unique ID', () => {
      const entity1 = scene.instantiate('bullet')
      const entity2 = scene.instantiate('bullet')
      expect(entity1!.id).not.toBe(entity2!.id)
    })

    it('should return null for unknown prefab', () => {
      const entity = scene.instantiate('unknown')
      expect(entity).toBeNull()
    })

    it('should parent to specified entity', () => {
      const entity = scene.instantiate('bullet', { x: 0, y: 0 }, 'player')
      expect(entity!.parent).toBe('player')
    })
  })

  describe('destruction', () => {
    beforeEach(async () => {
      await scene.loadScene('test-scene')
    })

    it('should destroy entity', () => {
      expect(scene.getEntity('player')).toBeDefined()
      scene.destroy('player')
      expect(scene.getEntity('player')).toBeUndefined()
      expect(scene.getEntityCount()).toBe(3)
    })

    it('should destroy children when destroying parent', async () => {
      const hierarchyScene: SceneData = {
        name: 'hierarchy',
        entities: [
          { id: 'parent', children: ['child1', 'child2'] },
          { id: 'child1', parent: 'parent' },
          { id: 'child2', parent: 'parent' },
        ],
      }
      scene.registerScene('hierarchy', () => hierarchyScene)
      await scene.loadScene('hierarchy')

      scene.destroy('parent')
      expect(scene.getEntityCount()).toBe(0)
    })

    it('should handle delayed destruction', () => {
      scene.destroy('player', 1)
      expect(scene.getEntity('player')).toBeDefined()

      scene.update(0.5)
      expect(scene.getEntity('player')).toBeDefined()

      scene.update(0.5)
      expect(scene.getEntity('player')).toBeUndefined()
    })
  })

  describe('getAllEntityIds', () => {
    it('should return all entity IDs', async () => {
      await scene.loadScene('test-scene')
      const ids = scene.getAllEntityIds()
      expect(ids).toHaveLength(4)
      expect(ids).toContain('player')
      expect(ids).toContain('enemy-1')
    })
  })
})
