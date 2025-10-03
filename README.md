# Nimea Wiki and Interactive Map

This is my solution to organizing and presenting my worldbuilding/setting notes and map with my players. The original purpose is to be a game aid for my TTRPG group.

A zero-backend wiki and interactive map for the fantasy realm of Nimea. Built with Eleventy, Decap CMS, and Leaflet.js.

Live Site: https://nimea-wiki.netlify.app/

---

## Features

### Wiki & Content Management
- Wiki with categories for Characters, Locations, Nations & Factions, Gods & Religions, Magic & Powers
- Visual CMS (Decap) for editing content through the browser
- Global search functionality on wiki pages
- Automatic map integration: markers can link to relevant wiki pages (optional custom slug)

### Interactive Map
- Full-screen Leaflet map with pan/zoom, overlays, and info-rich markers
- Route planning with distance and travel-time estimates
- Shareable route links (copy a URL that reconstructs the same markers & waypoints)
- Terrain-aware A* pathfinding that respects road/difficult/unpassable costs
- Advanced panel with travel profile selector (Wagon/Horse/Foot), proportional day markers (End of Day N)
- PWA support: installable app with offline fallback after first load

---

## Why I Built It

Frankly, nothing else existed which does what I am looking (At least not exactly or free): A simple wiki with an interactive map. So I built it myself. 

If you want a deeper explanation, here you go: I wanted a light, self-hostable worldbuilding stack where both the wiki and the map are versioned, editable through a browser, and deployable as a static site. This avoids server costs while keeping collaboration simple.

---

## Live Demo / Install

- Live: https://nimea-wiki.netlify.app/

Local setup:
1. Clone: `git clone https://github.com/BDenizKoca/nimea.git && cd nimea`
2. Install: `npm install`
3. Develop: `npm start` (serves Eleventy with live reload)
4. Build: `npm run build` (outputs to `_site/`)

Notes:
- The EN map page references shared scripts: `/map/js/*` and shared data `/map/data/*`.
- DM editor supports bilingual fields (TR/EN) for marker name, summary, and faction. Top-level fields remain as fallback.
- You can install the site as a PWA from the map header button (supported browsers). After the first successful load, the map works offline with cached assets.

---

## Usage

Public map usage:
- Plan routes, inspect markers, view overlays.
- Use the share button in a built route's summary to copy a link that reconstructs the same path.

DM Mode (optional):
Internal-only editing tools for the GM/DM; usage details are intentionally omitted here.

### Route Sharing

After building a route (at least 2 stops) a button appears in the route summary:

- TR: `Rota Bağlantısını Kopyala`
- EN: `Copy Route Link`

Clicking it copies a URL like:
```
https://example.com/map/?r=v1|m:aurelium;m:camkale;w:1834,992;m:thornhold
```

Format (versioned for future changes):
`v1|` then a `;`-separated list of items.

Items:
- `m:<markerId>` – a map marker by its id
- `w:<x>,<y>` – an ad‑hoc waypoint (internal pixel coords rounded)

Unknown / removed markers are skipped with a small toast warning. Waypoints are recreated in place. If markers have the same IDs across languages the same link works on `/map/` and `/en/map/`.

No compression yet (links stay readable); can migrate to a `v2` format later if needed.

---

## Tech Stack

- **Eleventy (11ty)** - Static-site generation
- **Decap CMS** - Content editing and Git-based publishing
- **Leaflet.js** - Interactive mapping
- **Leaflet-Geoman** - DM drawing/editing tools
- **Turf.js** - Geometric operations (terrain merging/simplification)
- **Netlify** - Hosting, identity, and build pipelines
- **Custom A* pathfinding** - Terrain-aware route calculation

---

## Future Plans

- Additional wiki templates and cross-linking
- Richer marker types and iconography
- Import/export tools for bulk content
- Optional multilingual wiki content
- Auto-generate `map/data/markers.json` from wiki frontmatter during build
- "Show on Map" buttons and direct `/map?focus=<id>` deep links from wiki pages
- Optional map-side filtering/search (kept on wiki for now by design)
- Drag-and-drop reordering for marker images in DM editor

---

## Connect With Me  
Email: [b.denizkoca@gmail.com](mailto:b.denizkoca@gmail.com)  
GitHub: [@BDenizKoca](https://github.com/BDenizKoca)  

---

## License  
MIT License – You can use, modify, and distribute freely with attribution.  
