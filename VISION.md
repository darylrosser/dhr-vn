# dhr.vn: vision

The site should feel like being inside a video game: a rainy cyberpunk warehouse in Saigon
where the pages of the site are places. Underneath it all, every page is a plain, fast,
readable HTML page, so nobody is ever forced to wait for (or be able to run) the 3D.

This file is the brief for the real build (Blender + three.js, done later in cloud sessions).
What exists today is the vibe check: the terminal, the reader, and a procedural blockout.

## Look

- **Blade Runner 2049 amber:** amber phosphor CRTs, teal haze, hot orange for warnings. Rain,
  fog, neon that buzzes and occasionally fails. Signage in Vietnamese (`SÁCH`, "books").
- **Short text can be fully stylised** (home terminal, About dossier, HUD, in-world screens).
  **Long text never is:** posts are read in the calm reader (Lora, ~68ch, paper or night theme).
  The fiction lives in transitions and frames, not on top of paragraphs.

## The warehouse

Daryl's dream office: one huge cyberpunk warehouse, split into **zones** you fast-travel
between (fixed camera stops, never free roaming). Each zone is a little diorama in the dark,
lit by its own pool of light, with fog and darkness between them. Most of the space is just
darkness, rain light and silhouettes, which is why it's buildable.

| Zone | What's there | Page it could hold |
|------|--------------|--------------------|
| **Command deck** | Desk, the terminal, the curved wall of screens | `/` home |
| **Garage** | A DeLorean-style gull-wing car under a single spotlight, doors up, tool chest, oil-slick floor | Projects / things I've built |
| **Gym** | Squat rack, barbell, a few plates, chalk dust in a light shaft, a whiteboard with PRs | A "now" page or training log, or just a joke hotspot |
| **Lounge** | Old leather sofa, rug, record player, low warm lamps, maybe an F1 sim rig | Contact ("pull up a seat"), or the podcast archive |
| **Library / reading room** | Floor-to-ceiling shelves, ladder, reading chair, warm light | `/reading/` |
| **Evidence board** | Case file, photos, red string, VK machine | `/about/` |

Notes for the build:
- Buy or download hero props instead of modelling them (Sketchfab / Fab, Poly Haven, KitBash3D),
  checking licences. Use a generic "gull-wing 80s sports car" rather than a branded DeLorean
  model if the licence is unclear.
- Each zone is a separately loaded GLB, streamed in when the camera heads toward it. Fog hides
  zones that aren't loaded yet.
- Detail goes where the camera stops. Everything else is silhouettes and emissive strips.

### Zone detail

- **The desk + terminal:** the home page *is* this monitor. Jacking out pulls the camera back
  from it. It's the one screen you can actually use.
- **The wall of screens:** a curved Batcave-style array (currently 7 × 3) behind the desk.
  Purely for show: oscilloscopes, rain radar over Saigon, a district map of tracked bookshops,
  F1 live timing, library inventory, CCTV of the loading dock, a VK subject-lock reticle,
  syslog, a Saigon clock. Personal fake data, animated cheaply (canvas textures, a few fps).
- **The window:** huge industrial grid, rain, distant city lights.
- **The bookshelf → reading room:** a warm, quieter space (lamp light, wood, paper tones).
  It's the bridge to the existing three.js reading shelf, so the vibe change is on purpose.
- Later: more places as pages appear (see below), sound, easter eggs.

## Pages are places

| Page | Place | Notes |
|------|-------|-------|
| `/` | Desk terminal | The monitor. Jack out / in. |
| `/blog/` | News terminal or a dot-matrix printer | Posts "print"; picking one opens the reader. |
| `/blog/<post>/` | Datapad | Reader layout over the dimmed, paused scene. |
| `/about/` | Case file on an evidence board, beside a VK machine | The dossier panel. |
| `/reading/` | Bookshelf → reading room | Warm lighting shift. |
| `/contact/` | Lounge sofa (or a payphone / radio) | |
| Projects (future) | Garage, the car | |
| Now / training (future) | Gym whiteboard | |

## How it should behave

1. **Every page is a normal HTML page first.** Search engines, screen readers, slow phones and
   data-saver users get the plain site. Nothing below may break that.
2. **The world loads in the background** only after the page is usable, only on capable devices.
   The jack-out control doubles as the loading status.
3. **Once in the world, you stay in it.** Links swap page content in place (pushState / fetch)
   and the camera travels to the page's place, like fast travel. No full reloads.
4. **Any page can be an entry point.** A post opened from Google shows the reader with a
   jack-out control; jacking out loads the world and flies to the blog's place.
5. **The handoff is seamless.** The live DOM is moved into 3D (CSS3DRenderer) at the exact
   size it was on screen, and the camera starts where it fills the viewport.
6. **Remember the choice.** Someone who was in world mode last time starts on the plain page,
   then flies in as soon as the world is ready.
7. **Respect the reader:** pause rendering while reading, sound off by default, reduced motion
   means cuts instead of flights, Esc / back button always lead out.

## Jacking in / out

You are the one who's wired in, man-machine. The cable comes *from you* (off the bottom of
the frame, as if from the back of your neck) and plugs into the computer.

- **Jack out:** the plug yanks out of the computer's port and whips back toward the camera,
  off screen, as the view pulls back into the warehouse.
- **Jack in:** the cable snakes in from the bottom of the frame and slams into the port
  (sparks, flash, jolt), the screen powers on CRT-style, the camera dives into it.
- Today's blockout has the right plug, socket, sparks and slam, but the cable runs to the back
  of the monitor. Re-route its far end to a point just below the camera (and animate it with
  the camera) to get the first-person version.

## Build order

1. ✅ Terminal home, reader pages, About dossier.
2. ✅ Jack out / in from the home terminal into a blockout scene (desk, screen wall, shelf).
3. ✅ Every page gets a place + jack-out; in-place navigation; datapad reader overlay.
   Next: first-person neural cable; remember world mode between visits.
4. Blender: model and bake the warehouse (baked lighting, KTX2 textures, Meshopt), stream it in
   zones; keep the hotspot contract from `world.js`.
5. Reading room; sound; HUD; easter eggs.

## Handoff: the cloud build (Blender + three.js)

Start here. The site is live at dhr.vn from this repo (`main` → Netlify runs `node build.mjs`,
publishes `dist/`). Everything works today with a **procedural blockout**; the job is to
replace the blockout with the real warehouse without breaking the plumbing.

### What exists and must keep working

- Every page is plain HTML first (terminal home, reader pages, `/reading/` shelf app, `/mac`).
- `src/js/uplink.js` (every page): capability check, background load of `world.js`, the ways
  out of a page: corner **✕** (`[data-jack]`, with an uplink LED) and the **bezel edge**
  (`[data-jack-edge]`, hover peeks at a render of the page's place via `--world-peek`).
- `src/js/world.js` → `createWorld({ kind, place, surface, … })`, three kinds of origin:
  `terminal` (live DOM onto the desk monitor via CSS3D), `reader` (page becomes the datapad),
  `app` (the `/reading/` shelf fades; you stand at the bookshelf).
- In the world: HUD, hotspots, datapad links and terminal `cd` visit places without reloads
  (`#world` in the URL); "Jack in" opens a page normally; Esc / back return to the origin page.
- Places and camera poses: `PLACES` in world.js. Hotspot contract:
  `object.userData.hotspot = { label, visit: '/url/' | action: 'monitor', highlight(on) }`.
- `world.link` (desk socket + plug + sparks) and `world.shapeMonitor(w, h, center)` (the home
  monitor must match the viewport's aspect so the CSS3D handoff is seamless).

### What is placeholder (replace)

- All of `buildWarehouse()`: boxes, canvas-texture neon, the 7×3 screen wall, desk, shelf,
  evidence board, lounge. Swap for GLB zones (see "The warehouse" above), keep the contracts.
- Not built at all yet: **garage + DeLorean-style car, gym**, the reading room as a real space.
- The datapad is a floating panel. Target: pages land on real objects, e.g. a futuristic
  holo-table / console you lean over, a device on the desk, the evidence board itself.
- The jack-in cable runs to the monitor; target is the first-person neural cable (above).

### Constraints

- Performance: first zone ≤ ~5 MB (Meshopt + KTX2 via gltf-transform), baked lighting,
  emissive + bloom for neon, stream other zones as the camera heads there, fog hides the rest.
  World mode only loads after the page is usable and only on capable devices.
- three.js: the site uses `0.170.0` via an import map; `/reading/` still pins `0.158.0`
  (world.js runs on both today). Upgrade the shelf app deliberately if needed.
- Long text is never stylised (reader layout, ~68ch). Reduced motion = cuts, not flights.
- Never break the plain pages: search engines, screen readers, slow phones.

### How to run / check

`npm run dev` → http://127.0.0.1:4321 (restart after editing `build.mjs`). Check every page:
✕ and edge exit, HUD visits, datapad links, Jack in, Esc twice, back button mid-flight, phone
width (portrait poses step back), and `/reading/` round trip.
