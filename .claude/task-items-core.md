Create a new file `src/lib/items.js` implementing the "Living Records" item system.

This is a pure-function module (no classes, no side effects) matching the style of player.js and combat.js.

## Core Concept
Items are "living records" that grow and transform based on player actions. Each item tracks 4 record types. As records level up, items gain visual marks and stat bonuses. When equipped items share the same dominant record type, they "resonate" for bonus effects.

## Record Types (4 total)
- `kill` — tracks enemy kills. Grants: attack damage bonus, crit chance at level 5+
- `treasure` — tracks gold/loot found. Grants: gold find bonus, rare item chance
- `explore` — tracks rooms/tiles explored. Grants: FOV/vision range bonus, movement speed
- `survive` — tracks damage survived. Grants: defense bonus, HP regen

## Item Slots
Items can be: `weapon`, `armor`, or `amulet`

## Item Tiers
- common, uncommon, rare, epic, legendary
- Tier affects base stats and visual appearance

## Required Functions

### createLivingItem(baseItem, floorLevel)
Returns a new item with:
```javascript
{
  ...baseItem,           // name, slot, tier (determined by floorLevel + RNG)
  id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  floorCreated: floorLevel,
  records: {
    kill:     { level: 0, xp: 0 },
    treasure: { level: 0, xp: 0 },
    explore:  { level: 0, xp: 0 },
    survive:  { level: 0, xp: 0 }
  },
  primaryRecord: null,
  visualMarks: []
}
```

### addRecordXP(item, recordType, xp)
Pure function. Returns new item with updated record XP/level.
XP curve: `10 * Math.pow(2, currentLevel)` per level (10, 20, 40, 80, 160...).
Max level: 10.
On level up, push a visual mark string to `visualMarks`.
Update `primaryRecord` to the record type with highest level.

### getItemStats(item)
Returns derived stats object based on record levels:
```javascript
{
  attackBonus: kill.level * 3,
  critChance: kill.level >= 5 ? (kill.level - 4) * 0.05 : 0,
  defenseBonus: survive.level * 2,
  hpRegen: survive.level >= 3 ? survive.level * 0.5 : 0,
  goldMultiplier: 1 + treasure.level * 0.1,
  visionBonus: explore.level,
  moveSpeedBonus: explore.level >= 4 ? 0.1 * (explore.level - 3) : 0
}
```

### checkResonance(equippedItems)
Takes array of equipped items (up to 3).
Returns resonance info:
- If 2+ items share the same `primaryRecord` type, they resonate
- Resonance level = minimum level of the shared record across resonating items
- Resonance bonuses scale with resonance level
```javascript
{
  active: true/false,
  type: 'kill'|'treasure'|'explore'|'survive'|null,
  level: number,
  bonuses: { ... }  // scaled bonuses for the resonance type
}
```

### getVisualInfo(item)
Returns display properties based on item state:
```javascript
{
  glyph: ')',           // changes with slot and growth
  color: '#aaaaaa',     // changes with primary record type
  glowColor: null,      // non-null when resonating
  name: 'Iron Sword',   // base name
  title: 'Iron Sword of the Killer',  // with primary record suffix
  description: 'A sword with 3 killing marks and a blood groove.'
}
```

Glyph by slot: weapon=`)`, armor=`[`, amulet=`"`
Color by primary record: kill=`#ff4444`, treasure=`#ffdd00`, explore=`#44aaff`, survive=`#44ff44`, none=`#aaaaaa`

### generateRandomItem(floorLevel, slot)
Convenience function. Generates a random item name and calls createLivingItem.
Item names should be thematic (e.g. "Iron Sword", "Leather Vest", "Bone Amulet" at low floors, "Obsidian Blade", "Dragonscale Mail" at high floors).

### getVisualMark(recordType, level)
Returns a descriptive string for the visual mark at that level.
Examples:
- kill level 1: "sharpened edge"
- kill level 5: "executioner's mark"
- kill level 10: "godkiller aura"
- treasure level 1: "golden tint"
- explore level 1: "compass rune"
- survive level 1: "battle scar"

## Important
- All functions are pure (no mutation, return new objects)
- Use ES module exports (export function ...)
- No classes, no this
- No external dependencies
- Follow the exact style of player.js and combat.js
