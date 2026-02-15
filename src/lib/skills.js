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

// Generate cluster layout for skill tree
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
  
  // Define cluster configuration for each region
  const clusterConfig = {
    inner: { distanceMin: 3, distanceMax: 6, smallCount: [8, 12], notableCount: [2, 3] },
    mid: { distanceMin: 7, distanceMax: 12, smallCount: [10, 15], notableCount: [3, 4] },
    outer: { distanceMin: 13, distanceMax: 18, smallCount: [12, 18], notableCount: [4, 5] },
    deep: { distanceMin: 19, distanceMax: 24, smallCount: [5, 8], notableCount: [2, 3] }
  };
  
  // Generate clusters for each region
  for (const region of REGIONS) {
    const angle = REGION_ANGLES[region];
    const statPool = STAT_POOLS[region];
    const clusterTypes = ['inner', 'mid', 'outer', 'deep'];
    
    let previousClusterNodes = ['start'];
    
    for (let c = 0; c < clusterTypes.length; c++) {
      const clusterType = clusterTypes[c];
      const config = clusterConfig[clusterType];
      const tierPrefix = TIER_PREFIXES[clusterType];
      
      const clusterCenterDistance = (config.distanceMin + config.distanceMax) / 2;
      const clusterCenterX = Math.cos(angle) * clusterCenterDistance;
      const clusterCenterY = Math.sin(angle) * clusterCenterDistance;
      
      const clusterNodes = [];
      
      // Generate small nodes
      const smallCount = Math.floor(rng() * (config.smallCount[1] - config.smallCount[0] + 1)) + config.smallCount[0];
      for (let i = 0; i < smallCount; i++) {
        const distance = config.distanceMin + rng() * (config.distanceMax - config.distanceMin);
        const nodeAngle = angle + (rng() - 0.5) * 1.2;
        const x = Math.cos(nodeAngle) * distance + (rng() - 0.5) * 2;
        const y = Math.sin(nodeAngle) * distance + (rng() - 0.5) * 2;
        
        const statInfo = statPool[Math.floor(rng() * statPool.length)];
        const value = Math.floor(2 + distance * 0.5);
        
        const id = `${region}_${clusterType}_small_${nodeIdCounter++}`;
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
          region
        };
        clusterNodes.push(id);
      }
      
      // Generate notable nodes
      const notableCount = Math.floor(rng() * (config.notableCount[1] - config.notableCount[0] + 1)) + config.notableCount[0];
      for (let i = 0; i < notableCount; i++) {
        const distance = config.distanceMin + rng() * (config.distanceMax - config.distanceMin);
        const nodeAngle = angle + (rng() - 0.5) * 0.8;
        const x = Math.cos(nodeAngle) * distance + (rng() - 0.5) * 1.5;
        const y = Math.sin(nodeAngle) * distance + (rng() - 0.5) * 1.5;
        
        const statInfo = statPool[Math.floor(rng() * statPool.length)];
        const value = Math.floor(8 + distance * 1.5);
        
        const id = `${region}_${clusterType}_notable_${nodeIdCounter++}`;
        nodes[id] = {
          id,
          type: 'notable',
          label: tierPrefix + statInfo.label,
          char: NODE_CHARS.notable[region],
          stat: statInfo.stat,
          value,
          description: `+${value} ${statInfo.label}`,
          x,
          y,
          region
        };
        clusterNodes.push(id);
      }
      
      // Generate keystone for outer and deep clusters
      if (clusterType === 'outer' || clusterType === 'deep') {
        const keystoneCount = clusterType === 'deep' ? 2 : 1;
        for (let i = 0; i < keystoneCount; i++) {
          const distance = config.distanceMin + 2 + rng() * (config.distanceMax - config.distanceMin - 4);
          const nodeAngle = angle + (rng() - 0.5) * 0.4;
          const x = Math.cos(nodeAngle) * distance + (rng() - 0.5) * 1;
          const y = Math.sin(nodeAngle) * distance + (rng() - 0.5) * 1;
          
          const keystoneNames = KEYSTONE_NAMES[region];
          const name = keystoneNames[Math.floor(rng() * keystoneNames.length)];
          const value = Math.floor(30 + distance * 3);
          
          const id = `${region}_${clusterType}_keystone_${nodeIdCounter++}`;
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
            region
          };
          clusterNodes.push(id);
        }
      }
      
      // Connect nodes within cluster
      for (let i = 0; i < clusterNodes.length; i++) {
        const connections = Math.floor(rng() * 2) + 1;
        for (let j = 0; j < connections; j++) {
          const targetIdx = Math.floor(rng() * clusterNodes.length);
          if (targetIdx !== i) {
            edges.push([clusterNodes[i], clusterNodes[targetIdx]]);
          }
        }
      }
      
      // Connect to previous cluster
      const connectCount = Math.floor(rng() * 3) + 3;
      for (let i = 0; i < connectCount && i < previousClusterNodes.length; i++) {
        const targetIdx = Math.floor(rng() * clusterNodes.length);
        edges.push([previousClusterNodes[i], clusterNodes[targetIdx]]);
      }
      
      previousClusterNodes = clusterNodes;
    }
  }
  
  // Add cross-links between adjacent regions
  const regionPairs = [
    ['combat', 'defense'], ['defense', 'vitality'], ['vitality', 'exploration'],
    ['exploration', 'fortune'], ['fortune', 'arcane'], ['arcane', 'combat']
  ];
  
  for (const [regionA, regionB] of regionPairs) {
    const nodesA = Object.keys(nodes).filter(id => nodes[id].region === regionA && nodes[id].type !== 'keystone');
    const nodesB = Object.keys(nodes).filter(id => nodes[id].region === regionB && nodes[id].type !== 'keystone');
    
    const linkCount = Math.floor(rng() * 5) + 6;
    for (let i = 0; i < linkCount; i++) {
      const idxA = Math.floor(rng() * nodesA.length);
      const idxB = Math.floor(rng() * nodesB.length);
      edges.push([nodesA[idxA], nodesB[idxB]]);
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
