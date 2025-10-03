# DM Mode Testing Guide

## How to Access & Test DM Features

### 1. Enter DM Mode
- Turkish: `http://localhost:8080/map/?dm`
- English: `http://localhost:8080/en/map/?dm`

### 2. DM Controls Location
All DM controls appear in the **top-left corner** of the map:

```
┌─────────────────────────────────┐
│ [Publish] [Download]            │  ← Publish/Download controls
│ [Login] [Status]                │  ← Authentication
│ [Road] [Medium] [Difficult]     │  ← Terrain painting modes
│ [Unpassable] [Normal]           │
│ [Optimize]                      │  ← Optimize/Merge tool ⚡
│ [Import]                        │  ← Bulk import
│                                 │
│         MAP AREA                │
└─────────────────────────────────┘
```

### 3. Terrain Painting Workflow

**Step 1: Select a terrain mode**
- Click one of: Road, Medium, Difficult, Unpassable, or Normal
- Button should highlight when selected

**Step 2: Draw on the map**
- Use the Leaflet-Geoman toolbar (appears on the left after selecting terrain)
- Draw polygons or lines on the map
- Each shape becomes a terrain feature

**Step 3: Paint multiple features**
- Draw several adjacent areas of the same terrain type
- Example: Paint 5 separate "Road" polygons that touch each other

**Step 4: Optimize terrain**
- Click the **"Optimize"** button (Turkish: "Optimize Et")
- This will:
  1. Merge adjacent features of the same type (5 roads → 1 road)
  2. Simplify the geometry (remove redundant nodes)
  3. Show notification with statistics

### 4. Expected Results

**Before Optimization:**
```
Terrain features: 15
- 5 road polygons (adjacent)
- 3 difficult terrain areas (adjacent)
- 7 other features
Total nodes: ~2,500
```

**After Clicking Optimize:**
```
Terrain features: 9
- 1 merged road polygon (was 5)
- 1 merged difficult terrain (was 3)
- 7 other features
Total nodes: ~350 (86% reduction)
```

**Notification should say:**
- English: "Terrain optimized: 2500 → 350 nodes (86.0% reduction)"
- Turkish: "Arazi optimize edildi: 2500 → 350 düğüm (%86.0 azalma)"

### 5. Troubleshooting

**Problem: Buttons show "dm.optimizeTerrain" instead of "Optimize"**
- **Cause:** i18n data not loaded
- **Solution:** Refresh the page (should be fixed now)

**Problem: "Optimize" button does nothing**
- **Cause:** No terrain features painted yet
- **Solution:** Draw some terrain first (see Step 2 above)

**Problem: "No terrain features to merge"**
- **Cause:** No adjacent features of same type
- **Solution:** Draw 2+ touching polygons of the same terrain type

**Problem: Can't see the Optimize button**
- **Check:** Are you in DM mode? (URL should have `?dm`)
- **Check:** Scroll/zoom the map controls in top-left
- **Check:** Browser console for JavaScript errors

### 6. Testing Checklist

- [ ] Enter DM mode (`?dm` in URL)
- [ ] See all DM controls in top-left (Publish, Login, Terrain modes, Optimize, Import)
- [ ] Buttons show translated text (not "dm.something")
- [ ] Click "Road" terrain mode
- [ ] Draw 2-3 adjacent road polygons on map
- [ ] Click "Optimize" button
- [ ] See notification: "Terrain optimized: X → Y nodes"
- [ ] Features are merged (3 roads → 1 road)
- [ ] Polygon still visible on map with same shape

### 7. Console Debugging

Open browser console (F12) and check for:

**Good signs:**
```
i18n data loaded for DM modules
🔧 Starting terrain optimization...
Step 1: Merging adjacent features...
Step 2: Simplifying geometries...
Simplified road: 150 → 25 nodes
✅ Optimization complete: {nodesBefore: 150, nodesAfter: 25, ...}
```

**Bad signs:**
```
Cannot read property 'dm' of undefined  ← i18n not loaded
Turf is not defined                     ← Turf.js not loaded
optimizeTerrain is not a function       ← DM module not initialized
```

### 8. What Each Button Does

| Button | Turkish | English | Function |
|--------|---------|---------|----------|
| Publish | Yayınla | Publish | Save to GitHub (requires login) |
| Download | İndir | Download | Download JSON files locally |
| Login | Giriş yap | Login | Authenticate with Netlify Identity |
| Status | Durum | Status | Show auth status |
| Road | Yol | Road | Paint road terrain (0.7x time) |
| Medium | Orta | Medium | Paint medium terrain (1.5x time) |
| Difficult | Zorlu | Difficult | Paint difficult terrain (2.0x time) |
| Unpassable | Geçilmez | Unpassable | Paint unpassable terrain (50x time) |
| Normal | Normal | Normal | Paint normal terrain (1.0x time) |
| **Optimize** | **Optimize Et** | **Optimize** | **Merge + simplify terrain** |
| Import | İçe Aktar | Import | Bulk marker import from CSV |

### 9. Quick Test Script

```javascript
// Paste in browser console to check DM status

console.log('DM Mode:', window.__nimea?.state?.isDmMode);
console.log('i18n loaded:', !!window.i18n);
console.log('DM module:', !!window.__nimea?.dmModule);
console.log('Optimize function:', !!window.__nimea?.dmModule?.optimizeTerrain);
console.log('Terrain features:', window.__nimea?.state?.terrain?.features?.length);
```

**Expected output:**
```
DM Mode: true
i18n loaded: true
DM module: true
Optimize function: true
Terrain features: 5
```

---

## Summary

1. **Access DM:** Add `?dm` to URL
2. **Paint terrain:** Click terrain button, draw polygons
3. **Optimize:** Click "Optimize" button after painting
4. **Result:** Merged features + simplified geometry

The optimize button should be visible as a **separate button** labeled "Optimize Et" (TR) or "Optimize" (EN) in the top-left controls.
