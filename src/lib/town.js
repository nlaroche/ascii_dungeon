// Town/Hub System — Pure function module for managing the town between dungeon runs.
// Handles inventory, vendor, inn, upgrades, and equipment management.

import { ITEM_TIERS, ITEM_SLOTS, createItem, getTotalLevel } from './items.js';

// ── Price Table ──

const TIER_PRICES = {
  common: 20,
  uncommon: 50,
  rare: 150,
  epic: 500,
  legendary: 2000,
};

const SELL_MULTIPLIER = 0.4;

// ── Upgrade Config ──

const UPGRADE_BASE_COSTS = {
  stashSize: 100,
  vendorQuality: 200,
  innDiscount: 50,
  blacksmith: 500,
};

// ── Town Lifecycle ──

export function createTown() {
  return {
    stash: [],
    stashCapacity: 20,
    vendor: {
      items: [],
      buybackStack: [],
    },
    inn: {
      restCost: 10,
      healAmount: 0.5,
      staminaRestore: 1.0,
    },
    upgrades: {
      stashSize: 0,
      vendorQuality: 0,
      innDiscount: 0,
      blacksmith: 0,
    },
  };
}

export function refreshVendor(town, playerLevel, day) {
  const itemCount = 4 + Math.floor(Math.random() * 3); // 4-6 items
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const slot = ['weapon', 'armor', 'amulet'][Math.floor(Math.random() * 3)];
    const floorLevel = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);
    const item = createItem(slot, floorLevel, Math.random);
    items.push(item);
  }

  return {
    ...town,
    vendor: {
      items,
      buybackStack: town.vendor.buybackStack,
    },
  };
}

// ── Inventory Management ──

export function addToStash(town, item) {
  const capacity = getStashCapacity(town);
  if (town.stash.length >= capacity) {
    return { town, success: false, message: 'Stash is full!' };
  }
  return {
    town: { ...town, stash: [...town.stash, item] },
    success: true,
    message: 'Item added to stash.',
  };
}

export function removeFromStash(town, itemIndex) {
  if (itemIndex < 0 || itemIndex >= town.stash.length) {
    return { town, item: null };
  }
  const item = town.stash[itemIndex];
  const newStash = town.stash.filter((_, i) => i !== itemIndex);
  return { town: { ...town, stash: newStash }, item };
}

export function sortStash(town, sortBy) {
  const sorted = [...town.stash].sort((a, b) => {
    switch (sortBy) {
      case 'tier': {
        const tierOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        return tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier);
      }
      case 'slot': {
        const slotOrder = ['weapon', 'armor', 'amulet'];
        return slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot);
      }
      case 'level': {
        return getTotalLevel(b) - getTotalLevel(a);
      }
      default:
        return 0;
    }
  });
  return { ...town, stash: sorted };
}

export function isStashFull(town) {
  return town.stash.length >= getStashCapacity(town);
}

export function getStashCapacity(town) {
  return town.stashCapacity + town.upgrades.stashSize * 5;
}

// ── Equipment ──

export function equipItem(town, player, stashIndex) {
  const item = town.stash[stashIndex];
  if (!item) {
    return { town, player, success: false, message: 'Invalid stash index.' };
  }

  const slot = item.slot;
  const currentEquipped = player.equipment?.[slot];

  // Remove from stash
  const { town: newTown } = removeFromStash(town, stashIndex);

  // Add current equipped to stash if exists and there's room
  let finalTown = newTown;
  if (currentEquipped) {
    const { town: afterAdd } = addToStash(newTown, currentEquipped);
    finalTown = afterAdd;
  }

  // Equip new item
  const newEquipment = { ...player.equipment, [slot]: item };
  const newPlayer = { ...player, equipment: newEquipment };

  return {
    town: finalTown,
    player: newPlayer,
    success: true,
    message: `Equipped ${item.name}.`,
  };
}

export function unequipItem(town, player, slot) {
  const item = player.equipment?.[slot];
  if (!item) {
    return { town, player, success: false, message: 'No item equipped in that slot.' };
  }

  const { town: newTown, success, message } = addToStash(town, item);
  if (!success) {
    return { town, player, success: false, message: 'Stash is full!' };
  }

  const newEquipment = { ...player.equipment };
  delete newEquipment[slot];
  const newPlayer = { ...player, equipment: newEquipment };

  return { town: newTown, player: newPlayer, success: true, message: `Unequipped ${item.name}.` };
}

export function compareItems(itemA, itemB) {
  const better = [];
  const worse = [];
  const equal = [];

  const statsA = getItemStats(itemA);
  const statsB = getItemStats(itemB);

  for (const key of Object.keys({ ...statsA, ...statsB })) {
    const valA = statsA[key] || 0;
    const valB = statsB[key] || 0;
    if (valA > valB) better.push(`${key}: +${valA - valB}`);
    else if (valA < valB) worse.push(`${key}: ${valB - valA}`);
    else if (valA > 0) equal.push(`${key}: ${valA}`);
  }

  return { better, worse, equal };
}

function getItemStats(item) {
  if (!item) return {};
  return {
    damage: item.baseDamage || 0,
    defense: item.baseDefense || 0,
    bonus: item.baseBonus || 0,
    level: getTotalLevel(item),
  };
}

// ── Vendor ──

export function getItemBuyPrice(item) {
  return TIER_PRICES[item.tier] || TIER_PRICES.common;
}

export function getItemPrice(item) {
  return Math.floor(getItemBuyPrice(item) * SELL_MULTIPLIER);
}

export function buyItem(town, player, vendorIndex) {
  const item = town.vendor.items[vendorIndex];
  if (!item) {
    return { town, player, success: false, message: 'Invalid vendor selection.' };
  }

  const price = getItemBuyPrice(item);
  if (player.gold < price) {
    return { town, player, success: false, message: 'Not enough gold!' };
  }

  const { town: newTown, success: addSuccess, message } = addToStash(town, item);
  if (!addSuccess) {
    return { town, player, success: false, message: 'Stash is full!' };
  }

  const newVendorItems = town.vendor.items.filter((_, i) => i !== vendorIndex);
  const newPlayer = { ...player, gold: player.gold - price };

  return {
    town: { ...newTown, vendor: { ...newTown.vendor, items: newVendorItems } },
    player: newPlayer,
    success: true,
    message: `Bought ${item.name} for ${price} gold.`,
  };
}

export function sellItem(town, player, stashIndex) {
  const item = town.stash[stashIndex];
  if (!item) {
    return { town, player, success: false, message: 'Invalid stash index.' };
  }

  const price = getItemPrice(item);
  const { town: newTown } = removeFromStash(town, stashIndex);

  const newBuyback = [...newTown.vendor.buybackStack, item].slice(-10); // Keep last 10
  const newPlayer = { ...player, gold: player.gold + price };

  return {
    town: { ...newTown, vendor: { ...newTown.vendor, buybackStack: newBuyback } },
    player: newPlayer,
    success: true,
    message: `Sold ${item.name} for ${price} gold.`,
  };
}

export function buybackItem(town, player, buybackIndex) {
  const item = town.vendor.buybackStack[buybackIndex];
  if (!item) {
    return { town, player, success: false, message: 'Invalid buyback selection.' };
  }

  const price = getItemBuyPrice(item);
  if (player.gold < price) {
    return { town, player, success: false, message: 'Not enough gold!' };
  }

  const { town: newTown, success: addSuccess, message } = addToStash(town, item);
  if (!addSuccess) {
    return { town, player, success: false, message: 'Stash is full!' };
  }

  const newBuyback = town.vendor.buybackStack.filter((_, i) => i !== buybackIndex);
  const newPlayer = { ...player, gold: player.gold - price };

  return {
    town: { ...newTown, vendor: { ...newTown.vendor, buybackStack: newBuyback } },
    player: newPlayer,
    success: true,
    message: `Bought back ${item.name} for ${price} gold.`,
  };
}

// ── Inn ──

export function getRestCost(town) {
  const discount = town.upgrades.innDiscount * 5;
  return Math.max(1, town.inn.restCost - discount);
}

export function restAtInn(town, player) {
  const cost = getRestCost(town);
  if (player.gold < cost) {
    return { town, player, success: false, message: 'Not enough gold to rest!' };
  }

  const maxHp = player.maxHp || 100;
  const maxStamina = player.maxStamina || 100;
  const healAmount = Math.floor(maxHp * town.inn.healAmount);

  const newPlayer = {
    ...player,
    gold: player.gold - cost,
    hp: Math.min(maxHp, (player.hp || maxHp) + healAmount),
    stamina: maxStamina,
  };

  return {
    town,
    player: newPlayer,
    success: true,
    message: `Rested at the inn. Restored ${healAmount} HP and full stamina for ${cost} gold.`,
  };
}

// ── Upgrades ──

export function getUpgradeCost(upgradeType, currentLevel) {
  const base = UPGRADE_BASE_COSTS[upgradeType];
  if (!base) return Infinity;
  return base * Math.pow(2, currentLevel);
}

export function purchaseUpgrade(town, player, upgradeType) {
  const currentLevel = town.upgrades[upgradeType];
  if (currentLevel === undefined) {
    return { town, player, success: false, message: 'Invalid upgrade type.' };
  }

  const cost = getUpgradeCost(upgradeType, currentLevel);
  if (player.gold < cost) {
    return { town, player, success: false, message: 'Not enough gold!' };
  }

  const newTown = {
    ...town,
    upgrades: { ...town.upgrades, [upgradeType]: currentLevel + 1 },
  };
  const newPlayer = { ...player, gold: player.gold - cost };

  return {
    town: newTown,
    player: newPlayer,
    success: true,
    message: `Purchased ${upgradeType} upgrade (level ${currentLevel + 1}) for ${cost} gold.`,
  };
}

export function getUpgradeEffects(town) {
  const u = town.upgrades;
  return {
    stashCapacity: town.stashCapacity + u.stashSize * 5,
    vendorQualityBonus: u.vendorQuality,
    innDiscount: u.innDiscount * 5,
    canUpgradeTier: u.blacksmith >= 1,
  };
}

// ── Loot Processing ──

export function processLootBag(town, lootBag) {
  const added = [];
  const dropped = [];
  let currentTown = town;

  // Sort by tier (lowest first) to drop lowest tier on overflow
  const sortedLoot = [...lootBag].sort((a, b) => {
    const tierOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
  });

  for (const item of sortedLoot) {
    const { town: newTown, success } = addToStash(currentTown, item);
    if (success) {
      added.push(item);
      currentTown = newTown;
    } else {
      dropped.push(item);
    }
  }

  return { town: currentTown, added, dropped };
}
