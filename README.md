# Smart Sorting Systems - IEEE IES Day Jordan 2026

Five original smart sorting concepts, each with a labelled isometric render and a fully interactive working simulation.

| # | Concept | Simulation |
|---|---------|-----------|
| 01 | Orbit Picker - 3-DOF arm, IR + camera, ring of bins | `sim/orbit.html` |
| 02 | Revolver Vault - rotating chute over a ring of cups | `sim/revolver.html` |
| 03 | TiltSort Arena - servo-tilted plate with PD control | `sim/tiltsort.html` |
| 04 | TriSense Line - conveyor with colour / height / metal fusion and pushers | `sim/trisense.html` |
| 05 | Cascade Tower - screw lift, scan chamber, servo flap tree | `sim/cascade.html` |

Open `index.html` for the report and links to every simulation.

## Run / deploy
Pure static site (HTML + vanilla JS + canvas, no build step, no dependencies, all paths relative).
Serve the repository root with any static host (Cloudflare Pages: build command empty, output directory `/`).

## Layout
- `index.html` - report, scorecard, renders, links
- `sim/` - shared `engine.js` (isometric canvas engine + UI shell), `sim.css`, one `*.js` + `*.html` per concept
- `renders/` - static labelled isometric renders (SVG + PNG)
- `src/` - Python generator for the static renders (optional, not needed to run the site)
