# Terrain Type Cleanup - Semantic Model

## Current Mess

**9 terrain types defined, only 4 actually used:**

Used:
- `road` (28 instances)
- `medium` (58 instances)
- `difficult` (29 instances)
- `unpassable` (11 instances)

Never used:
- `forest` - identical to `medium`
- `normal` - undefined semantics
- `water` - unused
- `sea` - unused
- `blocked` - duplicate of `unpassable`

## Proposed Clean Model

### Option 1: Minimal (4 types - match actual usage)

```typescript
type TerrainType =
  | 'road'        // Fast travel roads
  | 'open'        // Open terrain (rename from 'medium')
  | 'difficult'   // Rough terrain (mountains, swamps)
  | 'impassable'  // Cannot cross (rename from 'unpassable')
```

**Costs:**
- `road`: 0.7 (fast)
- `open`: 1.0 (normal speed)
- `difficult`: 2.0 (slow)
- `impassable`: 999 (cannot cross)

### Option 2: Expanded (include water for sea travel)

```typescript
type TerrainType =
  | 'road'        // Roads (fast land travel)
  | 'open'        // Open terrain
  | 'difficult'   // Rough terrain
  | 'impassable'  // Blocked terrain
  | 'water'       // Water (for sea routes)
```

**Costs:**
- `road`: 0.7
- `open`: 1.0
- `difficult`: 2.0
- `water`: 0.3 (fast by ship, impassable on foot)
- `impassable`: 999

### Option 3: Full Semantic Model (TTRPG-friendly)

```typescript
type TerrainType =
  // Land
  | 'road'        // Paved roads
  | 'plains'      // Open grassland
  | 'forest'      // Light woods
  | 'hills'       // Hilly terrain
  | 'mountains'   // Difficult mountains
  | 'swamp'       // Marshland

  // Water
  | 'water'       // Lakes, rivers
  | 'sea'         // Ocean

  // Impassable
  | 'wall'        // City walls, cliffs
```

**Costs:**
- `road`: 0.7
- `plains`: 1.0
- `forest`: 1.2
- `hills`: 1.5
- `mountains`: 2.0
- `swamp`: 2.5
- `water`: 0.3 (by boat)
- `sea`: 0.2 (by ship)
- `wall`: 999

## Migration Strategy

### Phase 1: Rename for clarity
```
medium → open (or plains)
unpassable → impassable
forest → (delete, merge into open or create proper forest areas)
blocked → (delete, use impassable)
normal → (delete, use open)
water/sea → water (consolidate)
```

### Phase 2: Update existing data
```bash
# Your 58 "medium" features become "open"
# Your 11 "unpassable" become "impassable"
# road and difficult stay as-is
```

### Phase 3: Add new types as needed
- Want forests? Add them properly with distinct semantics
- Want water routes? Add water type
- Want walls/cliffs? Add wall type

## Recommendation

**Start with Option 1** (minimal):
- Matches your actual usage
- Clean semantics
- Easy migration
- Can expand later

Then add water/sea later when you implement sea travel.

Current types are just legacy cruft from evolution without design.
