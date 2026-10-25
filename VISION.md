# dhr.vn: vision

The site should feel like being inside a video game: a dusty cyberpunk workshop in Saigon
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

## The workshop

Daryl's dream workshop: one dusty brick room you **walk around** in first person, point and
click like a virtual tour, the same on desktop and phone: click / tap the floor to walk there,
drag to look, click things to use them (WASD / arrows work too, quietly). Late sun pours
through a huge factory window into the haze; the time machine sits in the middle, cables
snaking off it across a dark, dirty concrete floor. The room is analogue and lived-in; the
tech in it stays cyberpunk (amber and teal screens, neon on the kit). The plain pages are the
accessible way in, so world mode doesn't need fast-travel buttons.

One room on purpose: fewer, more detailed things beat a big empty hall of dioramas.

| Thing | What's there | Page |
|-------|--------------|------|
| **The desk** | A battered workbench, the terminal plus four more screens on poles, keyboard, solder station, coffee rings | `/` home |
| **The TV wall** | Floor-to-ceiling rack of mismatched old TVs, each a different colour of static; the big one on the bench is the blog | `/blog/` |
| **Evidence board** | Case file, photos, red string | `/about/` |
| **Payphone** | On the east wall under pink neon | `/contact/` |
| **Bookcase** | Full of books, an armchair and an oil lamp beside it | `/reading/` |
| **The time machine** | The Back to the Future DeLorean, kit bolted on, valves glowing | Projects (coming) |
| **F1 sim rig** | Front corner, live timing on its screen | (just for fun) |

Notes for the build:
- Props and materials come from Poly Haven (CC0, scanned) where they fit; anything bespoke
  (the desk rig, the TVs, the time machine) is modelled by script. The DeLorean is a fan
  replica built from scratch: no badges or logos.
- The room is one GLB (`workshop`), loaded before you see it.
- Later: looping video on some of the TVs.

## Pages are places

| Page | Place | Notes |
|------|-------|-------|
| `/` | Desk terminal | The monitor. Jack out / in. |
| `/blog/` | The big TV on the TV wall | Picking a post opens the reader. |
| `/blog/<post>/` | Datapad | Reader layout over the dimmed, paused scene. |
| `/about/` | Case file on an evidence board, beside a VK machine | The dossier panel. |
| `/reading/` | Bookcase → reading room | Warm lighting shift. |
| `/contact/` | The payphone | |
| Projects (future) | The time machine | |

## How it should behave

1. **Every page is a normal HTML page first.** Search engines, screen readers, slow phones and
   data-saver users get the plain site. Nothing below may break that.
2. **The world loads in the background** only after the page is usable, only on capable devices.
   The jack-out control doubles as the loading status.
3. **Once in the world, you stay in it.** Walk up to something and its action shows up like
   in a game (**[E] Open the case file**, a button you can tap too); clicking it works as well.
   The page then appears on your **AR visor**: its tinted lens slides down over your view, the
   page projects in from a thin line and flickers as it catches, barely see-through, the room
   dimmed but visible around the edges (pushState / fetch, no reloads). Closing folds it back to
   a line and the lens lifts. Links on it
   do the same; "Full page" opens the page on its own.
4. **Any page can be an entry point.** A post opened from Google shows the reader with a
   jack-out control; jacking out loads the world and flies to the blog's place.
5. **The handoff is seamless.** The live DOM is moved into 3D (CSS3DRenderer) at the exact
   size it was on screen, and the camera starts where it fills the viewport.
6. **Remember the choice.** Someone who was in world mode last time starts on the plain page,
   then flies in as soon as the world is ready.
7. **Respect the reader:** pause rendering while reading, sound off by default, reduced motion
   means cuts instead of flights (and no head bob), Esc / back button always lead out.

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
publishes `dist/`). The warehouse is built by scripts in `blender/` (see "The Blender
pipeline" below) and loaded by `src/js/warehouse.js`; walking is `src/js/walker.js`.

### What exists and must keep working

- Every page is plain HTML first (terminal home, reader pages, `/reading/` shelf app, `/mac`).
- `src/js/uplink.js` (every page): capability check, background load of `world.js`, the ways
  out of a page: corner **✕** (`[data-jack]`, with an uplink LED) and the **bezel edge**
  (`[data-jack-edge]`, hover peeks at a render of the page's place via `--world-peek`).
- `src/js/world.js` → `createWorld({ kind, place, surface, … })`, three kinds of origin:
  `terminal` (live DOM onto the desk monitor via CSS3D), `reader` (page becomes the datapad),
  `app` (the `/reading/` shelf fades; you stand at the bookshelf).
- In the world: walking, hotspots, datapad links and terminal `cd` open pages without reloads
  (`#world` in the URL); "Jack in" opens a page normally; Esc / back return to the origin page.
- Places and camera poses: `PLACES` in world.js (where each page's exit lands you and where
  "jack back in" flies back to). Hotspot contract:
  `object.userData.hotspot = { label, visit: '/url/' | action: 'monitor', highlight(on) }`;
  in the GLBs a node's `hotspot` extra names a key of `HOTSPOTS` in warehouse.js.
- `world.link` (desk socket + plug + sparks) and `world.shapeMonitor(w, h, center)` (the home
  monitor must match the viewport's aspect so the CSS3D handoff is seamless).

### Still to do

- The datapad is a floating panel. Target: pages land on real objects, e.g. a futuristic
  holo-table / console you lean over, a device on the desk, the evidence board itself.
- The jack-in cable runs to the monitor; target is the first-person neural cable (above).
- Hero props worth buying / swapping in later: a proper office chair, a real turntable and
  speakers, a squat rack, a sim rig; and more love on the DeLorean (body curvature, interior).
- Sound; easter eggs; a projects page for the garage and a now / training page for the gym.

### The Blender pipeline

- `blender/build.py [workshop] [--quick]`: model, bake and export to `blender/out/` (needs
  the `bpy==5.2.3` module in a Python 3.13 venv outside the repo). The room is
  `blender/zones/workshop.py` (with `delorean.py` and `books.py`), written in three.js
  coordinates; helpers in `blender/lib.py`.
- Look: scanned PBR materials (Poly Haven, fetched on demand into `blender/cache/` by
  `assets.py`; needs `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org` reachable),
  shaded live in three.js, lit by a Cycles-baked, OIDN-denoised lightmap per group (second UV
  set), plus an environment map for reflections and bloom for neon.
- `blender/preview_car.py out.png [yaw] [elevation]`: a quick studio render of the time machine
  alone; `blender/preview_zone.py <zone> out.png cam… look…`: a quick render of one zone from a
  camera (three.js coordinates), for checking a layout without baking.
- `cd blender && npm install && node pack.mjs`: resize textures, KTX2 (Basis ETC1S) + Meshopt
  into `src/models/<zone>.glb`, lightmaps to `src/models/<zone>_<group>.ktx2`.
- Extras on GLB nodes wire up the live bits: `role` (`screen` + `painter`/`tint`, `window`,
  `flicker`, `spin`, `pulse`, `shaft`, `board`, `display`, `light`), `hotspot`, `lightmap` + `lm`.

### Constraints

- Performance: the room ≤ ~5–6 MB (Meshopt + KTX2 via gltf-transform), baked lighting,
  emissive + bloom for neon and the window.
  World mode only loads after the page is usable and only on capable devices.
- three.js: `0.170.0` via an import map everywhere, `/reading/` included (moved up from
  `0.158.0` with the GLB warehouse: lightmaps / emissive props rendered dark on the old one).
- Long text is never stylised (reader layout, ~68ch). Reduced motion = cuts, not flights.
- Never break the plain pages: search engines, screen readers, slow phones.

### How to run / check

`npm run dev` → http://127.0.0.1:4321 (restart after editing `build.mjs`). Check every page:
✕ and edge exit, walking (keys, drag, click the floor), clicking things, datapad links, Jack in,
Esc twice, back button mid-flight, phone width (portrait poses step back, drag + tap), and the
`/reading/` round trip.
