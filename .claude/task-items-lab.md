Create TWO changes:

## 1. Create `src/workbench/sections/ItemsLab.svelte`

A comprehensive workbench tab for testing the Living Records item system. Follow the same Svelte 4 component style as GraphicsLab.svelte.

Import functions from `../../lib/items.js`:
- `generateRandomItem`, `addRecordXP`, `getItemStats`, `checkResonance`, `getVisualInfo`
- `RECORD_TYPES`, `ITEM_SLOTS`, `ITEM_TIERS`

### Layout (top to bottom):

#### Section 1: Item Generator
- Floor level slider (1-30, default 5)
- Three buttons: "Generate Weapon", "Generate Armor", "Generate Amulet"
- Generated items appear in an "Inventory" list below (max 10 items)
- Each item shows: glyph (colored), name, tier badge, slot

#### Section 2: Item Inspector (shows selected item details)
- Click an item in inventory to select it
- Shows:
  - Item name/title (from getVisualInfo)
  - Tier and slot
  - Record levels as progress bars (4 bars, one per record type)
    - Each bar shows: record name, level X/10, XP progress within current level
    - Color-coded: kill=red, treasure=gold, explore=blue, survive=green
  - Visual marks list (from item.visualMarks)
  - Derived stats (from getItemStats) in a clean stat block
  - Primary record indicator

#### Section 3: Record Simulator
- Four buttons with icons: "Kill Enemy (+10 XP)", "Find Treasure (+15 XP)", "Explore Room (+8 XP)", "Survive Hit (+12 XP)"
- Each button adds XP to the selected item's corresponding record
- A "Bulk" toggle that adds 50 XP instead of the base amount
- Watch the item grow in real-time as you click

#### Section 4: Equipment & Resonance
- Three equipment slots shown as boxes: Weapon, Armor, Amulet
- Click an inventory item, then click a matching slot to equip it
- An "Unequip" button on each occupied slot
- Below the slots: Resonance indicator
  - If resonance is active: show type, level, and bonuses with a glowing border effect
  - If not: show "No resonance - equip items with matching primary records"

### Styling
- Use the same dark theme as other workbench sections (bg: #111, text: #eee)
- Section headers in orange (#ffaa00) like GraphicsLab
- Record type colors: kill=#ff4444, treasure=#ffdd00, explore=#44aaff, survive=#44ff44
- Tier colors: common=#aaaaaa, uncommon=#44ff44, rare=#4488ff, epic=#aa44ff, legendary=#ffaa00
- Progress bars with colored fills
- Clean, readable layout with proper spacing
- Use CSS grid or flexbox, NOT tables

## 2. Modify `src/workbench/Workbench.svelte`

Add ItemsLab to the workbench:
- Import: `import ItemsLab from './sections/ItemsLab.svelte';`
- Add to sections array: `{ id: 'items', label: 'Items' }`
- Add to the if/else chain: `{:else if activeSection === 'items'} <ItemsLab />`

Place it after 'economy' in the sections list.
