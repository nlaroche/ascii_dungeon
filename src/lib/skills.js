// Path of Exile-style Skill Tree Graph
// A massive interconnected graph with fog of war discovery mechanics
// Generated procedurally for 400+ nodes

import { COLORS } from './palette.js';

// ── Constants ──

const REGIONS = ['combat', 'defense', 'vitality', 'exploration', 'fortune', 'arcane'];

// Seeded PRNG for deterministic generation
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

// Region stat pools for procedural node generation
const STAT_POOLS = {
  combat: [
    { stat: 'attack', label: 'Strike' },
    { stat: 'critChance', label: 'Precision' },
    { stat: 'critMultiplier', label: 'Lethality' },
    { stat: 'attackSpeed', label: 'Swiftness' },
    { stat: 'aoeRadius', label: 'Reach' },
    { stat: 'bleedChance', label: 'Rend' },
  ],
  defense: [
    { stat: 'defense', label: 'Guard' },
    { stat: 'blockChance', label: 'Bulwark' },
    { stat: 'dodgeChance', label: 'Reflex' },
    { stat: 'damageReduction', label: 'Fortify' },
    { stat: 'thorns', label: 'Retaliate' },
    { stat: 'armor', label: 'Plate' },
  ],
  vitality: [
    { stat: 'maxHP', label: 'Vigor' },
    { stat: 'hpRegen', label: 'Mend' },
    { stat: 'lifesteal', label: 'Siphon' },
    { stat: 'resistAll', label: 'Endure' },
    { stat: 'healBonus', label: 'Restore' },
    { stat: 'reviveChance', label: 'Defiance' },
  ],
  exploration: [
    { stat: 'moveSpeed', label: 'Stride' },
    { stat: 'staminaMax', label: 'Endurance' },
    { stat: 'mapReveal', label: 'Sight' },
    { stat: 'secretDetect', label: 'Intuition' },
    { stat: 'trapDisarm', label: 'Finesse' },
    { stat: 'stealthChance', label: 'Shadow' },
  ],
  fortune: [
    { stat: 'goldFind', label: 'Greed' },
    { stat: 'itemRarity', label: 'Luck' },
    { stat: 'shopDiscount', label: 'Bargain' },
    { stat: 'chestBonus', label: 'Plunder' },
    { stat: 'vendorPrice', label: 'Appraise' },
    { stat: 'doubleDropChance', label: 'Windfall' },
  ],
  arcane: [
    { stat: 'manaMax', label: 'Reservoir' },
    { stat: 'spellPower', label: 'Channel' },
    { stat: 'cooldownReduction', label: 'Haste' },
    { stat: 'auraRange', label: 'Radiance' },
    { stat: 'elementalDamage', label: 'Infuse' },
    { stat: 'manaRegen', label: 'Flow' },
  ],
};

// Keystone names by region
const KEYSTONE_NAMES = {
  combat: ['God of War', 'Annihilator', 'Berserker', 'Warlord', 'Death Dealer', 'Fury Incarnate'],
  defense: ['Iron Fortress', 'Unbreakable', 'Living Shield', 'Stone Sentinel', 'Immortal', 'Bulwark Eternal'],
  vitality: ['Godtouched', 'Blood God', 'Phoenix', 'Life Force', 'Regeneration Incarnate', 'Eternal Life'],
  exploration: ['Shadow Dancer', 'Trailblazer', 'Master Explorer', 'Pathfinder Supreme', 'Ghost Walker', 'World Walker'],
  fortune: ['Lucky Star', 'Treasure God', 'Magnate', 'King of Gold', 'Fortune Incarnate', 'Wealth Manifest'],
  arcane: ['Archon', 'Mana Siphon', 'Aura Master', 'Sorcerer Supreme', 'Arcane Incarnate', 'Elemental Lord'],
};

// Name generation helpers
const TIER_PREFIXES = {
  inner: '',
  mid: 'Greater ',
  outer: 'Supreme ',
  deep: 'Transcendent '
};

const NODE_CHARS = {
  small: '·',
  notable: { combat: '/', defense: '[', vitality: '+', exploration: '.', fortune: '$', arcane: '*' },
  keystone: '★'
};

const REGION_COLORS = {
  combat: COLORS.combat,
  defense: COLORS.defense,
  vitality: COLORS.vitality,
  exploration: COLORS.exploration,
  fortune: COLORS.fortune,
  arcane: COLORS.arcane,
};

const REGION_ANGLES = {
  combat: 0,
  defense: Math.PI / 3,
  vitality: (2 * Math.PI) / 3,
  exploration: Math.PI,
  fortune: (4 * Math.PI) / 3,
  arcane: (5 * Math.PI) / 3
};

// Ring radii for each tier (in grid units)
const RING_RADII = {
  inner: [3, 4.5, 6],        // 3 rings
  mid: [8, 9.5, 11],         // 3 rings
  outer: [13, 14.5, 16, 18], // 4 rings
  deep: [20, 22, 24]         // 3 rings
};

// Node counts per tier
const TIER_CONFIG = {
  inner: { smallPerRing: 4, notablePerTier: 2 },
  mid: { smallPerRing: 5, notablePerTier: 3 },
  outer: { smallPerRing: 6, notablePerTier: 4 },
  deep: { smallPerRing: 3, notablePerTier: 2 }
};

// Minimum distance between nodes (grid units)
const MIN_NODE_DISTANCE = 1.8;

// Generate structured ring-based layout for skill tree
function generateSkillGraph() {
  const nodes = {};
  const edges = [];
  let nodeIdCounter = 0;
  
  // Create start node at origin
  const startNode = {
    id: 'start',
    type: 'small',
    label: 'Origin',
    char: '●',
    stat: null,
    value: 0,
    description: 'Starting point of your journey',
    x: 0,
    y: 0,
    region: 'combat'
  };
  nodes['start'] = startNode;
  
  // Store nodes by region and tier for later edge connection
  const regionNodes = {};
  for (const region of REGIONS) {
    regionNodes[region] = { inner: [], mid: [], outer: [], deep: [] };
  }
  
  // Generate nodes for each region using ring layout
  for (const region of REGIONS) {
    const baseAngle = REGION_ANGLES[region];
    const wedgeWidth = Math.PI / 3.5; // slightly less than 60 deg for gaps
    const statPool = STAT_POOLS[region];
    
    const tiers = ['inner', 'mid', 'outer', 'deep'];
    
    for (let t = 0; t < tiers.length; t++) {
      const tier = tiers[t];
      const radii = RING_RADII[tier];
      const config = TIER_CONFIG[tier];
      
      // Calculate how many slots per ring based on circumference
      const slotsPerRing = radii.map(r => Math.max(4, Math.floor((r * wedgeWidth) / MIN_NODE_DISTANCE)));
      
      // Generate small nodes on each ring
      for (let ringIdx = 0; ringIdx < radii.length; ringIdx++) {
        const radius = radii[ringIdx];
        const slots = slotsPerRing[ringIdx];
        
        // Determine how many small nodes to place on this ring
        const smallCount = Math.max(2, Math.floor(config.smallPerRing * (1 - ringIdx * 0.15)));
        
        for (let i = 0; i < smallCount; i++) {
          // Evenly distribute nodes along the arc
          const angleOffset = (i + 0.5) * wedgeWidth / smallCount;
          const nodeAngle = baseAngle - wedgeWidth / 2 + angleOffset;
          
          const x = Math.cos(nodeAngle) * radius;
          const y = Math.sin(nodeAngle) * radius;
          
          const statInfo = statPool[Math.floor(rng() * statPool.length)];
          const value = Math.floor(2 + radius * 0.5);
          
          const id = `${region}_${tier}_small_${nodeIdCounter++}`;
          nodes[id] = {
            id,
            type: 'small',
            label: statInfo.label,
            char: '·',
            stat: statInfo.stat,
            value,
            description: `+${value} ${statInfo.label}`,
            x,
            y,
            region,
            tier,
            ring: ringIdx,
            slot: i,
            totalSlots: smallCount
          };
          regionNodes[region][tier].push(id);
        }
      }
      
      // Generate notable nodes at key positions (every few slots)
      const notableCount = config.notablePerTier;
      const allSmallIds = regionNodes[region][tier].filter(id => nodes[id].type === 'small');
      
      if (allSmallIds.length > 0) {
        for (let i = 0; i < notableCount; i++) {
          // Pick positions evenly distributed
          const slotIdx = Math.floor((i + 0.5) * allSmallIds.length / notableCount);
          const smallNode = nodes[allSmallIds[slotIdx]];
          
          // Offset slightly from the small node
          const offsetAngle = 0.15;
          const smallNodeAngle = Math.atan2(smallNode.y, smallNode.x);
          const radius = Math.sqrt(smallNode.x * smallNode.x + smallNode.y * smallNode.y) + 0.8;
          
          const x = Math.cos(smallNodeAngle + offsetAngle) * radius;
          const y = Math.sin(smallNodeAngle + offsetAngle) * radius;
          
          const statInfo = statPool[Math.floor(rng() * statPool.length)];
          const value = Math.floor(8 + radius * 1.5);
          
          const id = `${region}_${tier}_notable_${nodeIdCounter++}`;
          nodes[id] = {
            id,
            type: 'notable',
            label: TIER_PREFIXES[tier] + statInfo.label,
            char: NODE_CHARS.notable[region],
            stat: statInfo.stat,
            value,
            description: `+${value} ${statInfo.label}`,
            x,
            y,
            region,
            tier,
            ring: -1,
            slot: i,
            totalSlots: notableCount
          };
          regionNodes[region][tier].push(id);
        }
      }
      
      // Generate keystones for outer and deep tiers
      if (tier === 'outer' || tier === 'deep') {
        const keystoneCount = tier === 'deep' ? 2 : 1;
        const lastRingRadius = radii[radii.length - 1] + 1.5;
        
        for (let i = 0; i < keystoneCount; i++) {
          const angleOffset = (i + 0.5) * wedgeWidth / keystoneCount - wedgeWidth / 4;
          const nodeAngle = baseAngle + angleOffset;
          
          const x = Math.cos(nodeAngle) * lastRingRadius;
          const y = Math.sin(nodeAngle) * lastRingRadius;
          
          const keystoneNames = KEYSTONE_NAMES[region];
          const name = keystoneNames[Math.floor(rng() * keystoneNames.length)];
          const value = Math.floor(30 + lastRingRadius * 3);
          
          const id = `${region}_${tier}_keystone_${nodeIdCounter++}`;
          nodes[id] = {
            id,
            type: 'keystone',
            label: name,
            char: '★',
            stat: statPool[Math.floor(rng() * statPool.length)].stat,
            value,
            description: `+${value} ${name}`,
            x,
            y,
            region,
            tier,
            ring: -1,
            slot: i,
            totalSlots: keystoneCount
          };
          regionNodes[region][tier].push(id);
        }
      }
    }
  }
  
  // Connect nodes within each region using structured approach
  for (const region of REGIONS) {
    const tiers = ['inner', 'mid', 'outer', 'deep'];
    
    for (let t = 0; t < tiers.length; t++) {
      const tier = tiers[t];
      const tierNodes = regionNodes[region][tier];
      
      // Get small nodes sorted by angle
      const smallNodes = tierNodes
        .map(id => nodes[id])
        .filter(n => n.type === 'small')
        .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
      
      // Connect adjacent small nodes on same ring
      for (let i = 0; i < smallNodes.length; i++) {
        const node = smallNodes[i];
        const nextIdx = (i + 1) % smallNodes.length;
        
        // Connect to next node on ring
        if (!edges.some(e => e[0] === node.id && e[1] === smallNodes[nextIdx].id) &&
            !edges.some(e => e[1] === node.id && e[0] === smallNodes[nextIdx].id)) {
          edges.push([node.id, smallNodes[nextIdx].id]);
        }
        
        // Connect to node 2 steps away (create mesh)
        const nextNextIdx = (i + 2) % smallNodes.length;
        if (smallNodes.length > 4) {
          edges.push([node.id, smallNodes[nextNextIdx].id]);
        }
      }
      
      // Connect notable nodes to nearby small nodes
      const notableNodes = tierNodes
        .map(id => nodes[id])
        .filter(n => n.type === 'notable' || n.type === 'keystone');
      
      for (const notable of notableNodes) {
        // Find 2 closest small nodes
        const distances = smallNodes.map(small => ({
          id: small.id,
          dist: Math.sqrt((small.x - notable.x) ** 2 + (small.y - notable.y) ** 2)
        }));
        distances.sort((a, b) => a.dist - b.dist);
        
        for (let i = 0; i < Math.min(2, distances.length); i++) {
          if (!edges.some(e => (e[0] === notable.id && e[1] === distances[i].id) ||
                              (e[1] === notable.id && e[0] === distances[i].id))) {
            edges.push([notable.id, distances[i].id]);
          }
        }
      }
      
      // Connect to previous tier (radial connections)
      if (t > 0) {
        const prevTier = tiers[t - 1];
        const prevTierNodes = regionNodes[region][prevTier]
          .map(id => nodes[id]);
        
        for (const currNode of tierNodes.map(id => nodes[id])) {
          // Find closest node in previous tier
          let closest = null;
          let closestDist = Infinity;
          
          for (const prevNode of prevTierNodes) {
            const dist = Math.sqrt((currNode.x - prevNode.x) ** 2 + (currNode.y - prevNode.y) ** 2);
            if (dist < closestDist) {
              closestDist = dist;
              closest = prevNode;
            }
          }
          
          if (closest && !edges.some(e => (e[0] === currNode.id && e[1] === closest.id) ||
                                          (e[1] === currNode.id && e[0] === closest.id))) {
            edges.push([currNode.id, closest.id]);
          }
        }
      } else {
        // Connect inner tier to start node
        const innerSmallNodes = tierNodes
          .map(id => nodes[id])
          .filter(n => n.type === 'small');
        
        // Connect a few inner nodes to start
        const connectCount = Math.min(3, innerSmallNodes.length);
        for (let i = 0; i < connectCount; i++) {
          if (!edges.some(e => e[0] === 'start' && e[1] === innerSmallNodes[i].id) &&
              !edges.some(e => e[1] === 'start' && e[0] === innerSmallNodes[i].id)) {
            edges.push(['start', innerSmallNodes[i].id]);
          }
        }
      }
    }
  }
  
  // Add cross-links between adjacent regions at boundaries
  const regionPairs = [
    ['combat', 'defense'], ['defense', 'vitality'], ['vitality', 'exploration'],
    ['exploration', 'fortune'], ['fortune', 'arcane'], ['arcane', 'combat']
  ];
  
  for (const [regionA, regionB] of regionPairs) {
    // Get outer tier nodes from each region
    const nodesA = regionNodes[regionA].outer.map(id => nodes[id]);
    const nodesB = regionNodes[regionB].outer.map(id => nodes[id]);
    
    // Find closest pair and add a few links
    const linkCount = 2;
    
    for (let i = 0; i < linkCount; i++) {
      let bestA = null;
      let bestB = null;
      let bestDist = Infinity;
      
      for (const a of nodesA) {
        for (const b of nodesB) {
          const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (dist < bestDist) {
            bestDist = dist;
            bestA = a;
            bestB = b;
          }
        }
      }
      
      if (bestA && bestB) {
        if (!edges.some(e => (e[0] === bestA.id && e[1] === bestB.id) ||
                            (e[1] === bestA.id && e[0] === bestB.id))) {
          edges.push([bestA.id, bestB.id]);
        }
        
        // Remove used nodes to get diverse connections
        nodesA.splice(nodesA.indexOf(bestA), 1);
        nodesB.splice(nodesB.indexOf(bestB), 1);
        
        if (nodesA.length === 0 || nodesB.length === 0) break;
      }
    }
  }
  
  // Validate graph connectivity using BFS
  const visited = new Set();
  const queue = ['start'];
  visited.add('start');
  
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [a, b] of edges) {
      if (a === current && !visited.has(b)) {
        visited.add(b);
        queue.push(b);
      } else if (b === current && !visited.has(a)) {
        visited.add(a);
        queue.push(a);
      }
    }
  }
  
  // Connect any unreachable nodes
  for (const nodeId of Object.keys(nodes)) {
    if (!visited.has(nodeId)) {
      let nearestDist = Infinity;
      let nearestNode = null;
      
      for (const visitedNode of visited) {
        const dx = nodes[nodeId].x - nodes[visitedNode].x;
        const dy = nodes[nodeId].y - nodes[visitedNode].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestNode = visitedNode;
        }
      }
      
      if (nearestNode) {
        edges.push([nodeId, nearestNode]);
        visited.add(nodeId);
      }
    }
  }
  
  return { nodes, edges };
}

// Generate the skill graph
const generated = generateSkillGraph();
export const SKILL_GRAPH_NODES = generated.nodes;
export const SKILL_GRAPH_EDGES = generated.edges;

// Build adjacency map from edges
function buildAdjacencyMap(edges) {
  const adj = {};
  for (const [a, b] of edges) {
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

export const SKILL_GRAPH_ADJACENCY = buildAdjacencyMap(SKILL_GRAPH_EDGES);

// ── Helper Functions ──

export function getRegionColor(region) {
  return REGION_COLORS[region] || COLORS.recordLow;
}

export function getNodeTypeChar(type) {
  const chars = {
    small: '·',
    notable: '◆',
    keystone: '★'
  };
  return chars[type] || '?';
}

// ── State Functions ──

export function createSkillTree() {
  return {
    allocated: new Set(['start']),
    totalPoints: 0
  };
}

export function canAllocate(tree, nodeId) {
  const node = SKILL_GRAPH_NODES[nodeId];
  if (!node) return false;
  if (tree.allocated.has(nodeId)) return false;
  
  // Check if node is adjacent to any allocated node
  const adjacent = SKILL_GRAPH_ADJACENCY[nodeId];
  if (!adjacent) return false;
  
  for (const neighborId of adjacent) {
    if (tree.allocated.has(neighborId)) {
      return true;
    }
  }
  return false;
}

export function allocateNode(tree, nodeId) {
  if (!canAllocate(tree, nodeId)) {
    return tree;
  }
  
  const newAllocated = new Set(tree.allocated);
  newAllocated.add(nodeId);
  
  return {
    allocated: newAllocated,
    totalPoints: tree.totalPoints + 1
  };
}

export function deallocateNode(tree, nodeId) {
  // Cannot deallocate start node
  if (nodeId === 'start') {
    return tree;
  }
  
  // Cannot deallocate if not allocated
  if (!tree.allocated.has(nodeId)) {
    return tree;
  }
  
  // Check if removal would disconnect graph
  // Remove the node temporarily
  const testAllocated = new Set(tree.allocated);
  testAllocated.delete(nodeId);
  
  // BFS from start to check if all other allocated nodes are still reachable
  const visited = new Set();
  const queue = ['start'];
  visited.add('start');
  
  while (queue.length > 0) {
    const current = queue.shift();
    const adjacent = SKILL_GRAPH_ADJACENCY[current];
    
    if (adjacent) {
      for (const neighbor of adjacent) {
        if (testAllocated.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  
  // Check if any allocated node is now disconnected
  for (const node of testAllocated) {
    if (!visited.has(node)) {
      // Would disconnect the graph
      return tree;
    }
  }
  
  // Safe to deallocate
  const newAllocated = new Set(tree.allocated);
  newAllocated.delete(nodeId);
  
  return {
    allocated: newAllocated,
    totalPoints: tree.totalPoints - 1
  };
}

export function getVisibleNodes(tree) {
  // Build set of visible node IDs (allocated + neighbors)
  const visibleIds = new Set(tree.allocated);
  
  // Add neighbors of allocated nodes
  for (const nodeId of tree.allocated) {
    const neighbors = SKILL_GRAPH_ADJACENCY[nodeId];
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!tree.allocated.has(neighbor)) {
          visibleIds.add(neighbor);
        }
      }
    }
  }
  
  // Build visible nodes array
  const visible = [];
  for (const nodeId of visibleIds) {
    const node = SKILL_GRAPH_NODES[nodeId];
    const status = tree.allocated.has(nodeId) ? 'allocated' : 'available';
    visible.push({
      ...node,
      status
    });
  }
  
  return visible;
}

export function getVisibleEdges(tree) {
  // Build set of visible node IDs (allocated + neighbors)
  const visibleIds = new Set(tree.allocated);
  
  for (const nodeId of tree.allocated) {
    const neighbors = SKILL_GRAPH_ADJACENCY[nodeId];
    if (neighbors) {
      for (const neighbor of neighbors) {
        visibleIds.add(neighbor);
      }
    }
  }
  
  // Filter edges to only include those where both endpoints are visible
  return SKILL_GRAPH_EDGES.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b));
}

export function getSkillBonuses(tree) {
  const bonuses = {};
  
  for (const nodeId of tree.allocated) {
    const node = SKILL_GRAPH_NODES[nodeId];
    if (node && node.stat && node.value > 0) {
      bonuses[node.stat] = (bonuses[node.stat] || 0) + node.value;
    }
  }
  
  return bonuses;
}

export function getNodeInfo(nodeId) {
  return SKILL_GRAPH_NODES[nodeId] || null;
}

export function getAvailablePoints(playerLevel, floorsCleared) {
  return playerLevel + floorsCleared;
}

export function getRemainingPoints(playerLevel, floorsCleared, tree) {
  return getAvailablePoints(playerLevel, floorsCleared) - tree.totalPoints;
}

export function getTreeStats(tree) {
  const totalAllocated = tree.allocated.size;
  const regionCounts = {
    combat: 0,
    defense: 0,
    vitality: 0,
    exploration: 0,
    fortune: 0,
    arcane: 0
  };
  
  // Count all nodes in graph
  const totalNodes = Object.keys(SKILL_GRAPH_NODES).length;
  
  // Count region distribution for allocated nodes
  for (const nodeId of tree.allocated) {
    const node = SKILL_GRAPH_NODES[nodeId];
    if (node && regionCounts.hasOwnProperty(node.region)) {
      regionCounts[node.region]++;
    }
  }
  
  // Count visible nodes (allocated + available)
  let totalVisible = 0;
  for (const [nodeId] of Object.entries(SKILL_GRAPH_NODES)) {
    if (tree.allocated.has(nodeId) || canAllocate(tree, nodeId)) {
      totalVisible++;
    }
  }
  
  return {
    totalAllocated,
    totalVisible,
    totalNodes,
    regionCounts
  };
}

// Export all regions for convenience
export { REGIONS };
