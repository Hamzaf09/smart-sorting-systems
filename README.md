# Smart Sorting Systems - IEEE IES Day Jordan 2026

Five original smart sorting concepts, each with a labelled isometric render and a fully interactive working simulation.

| # | Concept | Simulation |
|---|---------|-----------|
| 01 | Orbit Picker - 3-DOF arm, IR + camera, ring of bins | `sim/orbit.html` |
| 02 | Revolver Vault - rotating chute over a ring of cups | `sim/revolver.html` |
| 03 | TiltSort Arena - servo-tilted plate with PD control | `sim/tiltsort.html` |
| 04 | TriSense Line - conveyor with colour / height / metal fusion and pushers | `sim/trisense.html` |
| 05 | Cascade Tower - screw lift, scan chamber, servo flap tree | `sim/cascade.html` |
| 06 | Pustache Sorter - upgraded Tinkercad design: escapement, lit chamber, reject cup, swing chute | `sim/pustache.html` |

Open `index.html` for the report and links to every simulation.

## Run / deploy
Pure static site (HTML + vanilla JS + canvas, no build step, no dependencies, all paths relative).
Serve the repository root with any static host (Cloudflare Pages: build command empty, output directory `/`).

## Layout
- `index.html` - report, scorecard, renders, links
- `sim/` - shared `engine.js` (isometric canvas engine + UI shell), `sim.css`, one `*.js` + `*.html` per concept
- `renders/` - static labelled isometric renders (SVG + PNG)
- `src/` - Python generator for the static renders (optional, not needed to run the site)

## 3D model (Pustache Sorter)
`3d/pustache.html` is an interactive 3D viewer (orbit, explode, parts list). `3d/downloads/` has the assembly STL, 30 per-part STLs and a BOM CSV; import into Fusion 360 / Tinkercad. Regenerate with `python3 src/pustache_cad.py` (numpy only). Units: mm, Z up.
