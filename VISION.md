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

Daryl's dream workshop: one big dusty brick room, late sun pouring through a huge factory
window into the haze, the time machine in the middle with cables snaking across a dark,
dirty concrete floor. You **stand behind the desk**, straight on to its screens, and look
around (drag, or the arrow keys): left round to the bookcase and the tool wall, right to the evidence
board, never the bare wall behind you. No walking: everything does something from where you
stand, and pages open in place. The room is analogue and lived-in; the tech in it stays
cyberpunk (amber and teal screens, neon on the kit). The plain pages are the accessible way in.

| Where | What's there | Does |
|-------|--------------|------|
| **In front: the desk** | A battered workbench: the monitor plus three more screens round it (none top right, so the car shows), a mechanical keyboard on a desk mat, the books on the go (real covers), the phone, a notepad of to-dos, coffee, tools, a rubber duck, the robot arm holding the jack plug | The monitor is your browser (`/`, and every page) |
| **Left: the TV wall** | Floor-to-ceiling rack of mismatched old TVs, each a different colour of static; the big one on the bench is the blog (so is the top-left desk screen) | `/blog/` on the monitor |
| **Left, nearer: the bookcase** | Steel uprights, plank shelves, full of books | `/reading/` |
| **Left, nearest: the tool wall** | Pegboard of tools over a bench, DHR.VN in teal neon | |
| **On the desk** | The stack of books | `/reading/` (its own app) |
| **On the desk** | The phone | `/contact/`: it comes up into view where you're looking, the page on it |
| **Ahead, right of the screens** | The Back to the Future DeLorean, kit bolted on, valves glowing, the window behind; your side's gull-wing is up on the cabin (grey leather, the time circuits showing today's date, the flux capacitor glowing) | Projects (coming) |
| **Right: the east wall** | The evidence board (photos, red string), a payphone under pink neon | `/about/` on the monitor |

Notes for the build:
- Props and materials come from Poly Haven (CC0, scanned) where they fit; anything bespoke
  (the desk rig, the TVs, the arm, the time machine) is modelled by script. The DeLorean is a
  fan replica built from scratch: no badges or logos.
- The room is one GLB (`workshop`), loaded before you see it.
- Dust and dirt are a shader (drifts on everything facing up, grime low on the walls), not
  textures: the room costs no more to download for being filthier.
- Later: looping video on some of the TVs.

## Pages are places

| Page | Where it shows | Notes |
|------|----------------|-------|
| `/` | The monitor (the terminal) | Jack out / in. |
| `/blog/`, posts | The monitor | You jack in to read. |
| `/about/` | The monitor | The dossier panel. |
| `/reading/` | A look at the books, then the reading app | Warm lighting shift. |
| `/contact/` | The phone, held up in front of you | Phone-width layout. |
| Projects (future) | The time machine | |

## How it should behave

1. **Every page is a normal HTML page first.** Search engines, screen readers, slow phones and
   data-saver users get the plain site. Nothing below may break that.
2. **The world loads in the background** only after the page is usable, only on capable devices.
   The jack-out control doubles as the loading status.
3. **Going into the screen is always jacking in.** Click the monitor, or a thing that opens a
   page (the TV wall → blog, the evidence board → about): you sit down, the arm plugs you in,
   the page comes up on the monitor and you dive into it (the page you came from without a
   reload; any other loads for real). Out in the room the monitor runs a screensaver: JACK IN
   TO ENTER. The phone comes up into view wherever you're looking, the contact page on it; Esc
   puts it down. No jumping across the room, so no extra UI to get back.
4. **Any page can be an entry point.** A post opened from Google shows the reader with a
   jack-out control; jacking out leaves it on the monitor and you get up from it.
5. **The handoff is seamless.** The live DOM is moved into 3D (CSS3DRenderer) at the exact
   size it was on screen, and the camera starts where it fills the viewport.
6. **Remember the choice.** Someone who was in world mode last time starts on the plain page,
   then flies in as soon as the world is ready.
7. **Respect the reader:** pause rendering while reading, sound off by default, reduced motion
   means cuts instead of flights, Esc / back button always lead out.

## Jacking in / out

You are the one who's wired in, man-machine: a port at the back of your neck, a cable from it
to the back of the monitor, and a robot arm bolted to the desk that does the plugging.

- **Jack out:** you start in the page; you sit back, the arm yanks the plug out of
  your neck (sparks, a jolt) and carries it back to its cradle on the desk, and you get up.
- **Jack in:** you sit down facing the monitor, the arm lifts the plug, swings it past your
  ear and slams it home (sparks, a jolt, the picture tears), then you dive into the screen
  and you're on the plain page (the terminal powers on CRT-style).

## Build order

1. ✅ Terminal home, reader pages, About dossier.
2. ✅ Jack out / in from the home terminal into a blockout scene (desk, screen wall, shelf).
3. ✅ Every page gets a place + jack-out; in-place navigation.
   Next: remember world mode between visits.
4. Blender: model and bake the warehouse (baked lighting, KTX2 textures, Meshopt), stream it in
   zones; keep the hotspot contract from `world.js`.
5. Reading room; sound; HUD; easter eggs.

## Handoff: the cloud build (Blender + three.js)

Start here. The site is live at dhr.vn from this repo (`main` → Netlify runs `node build.mjs`,
publishes `dist/`). The warehouse is built by scripts in `blender/` (see "The Blender
pipeline" below) and loaded by `src/js/warehouse.js`; looking around is `src/js/seat.js`,
the robot arm `src/js/arm.js`.

### What exists and must keep working

- Every page is plain HTML first (terminal home, reader pages, `/reading/` shelf app, `/mac`).
- `src/js/uplink.js` (every page): capability check, background load of `world.js`, the ways
  out of a page: corner **✕** (`[data-jack]`, with an uplink LED) and the **bezel edge**
  (`[data-jack-edge]`, hover peeks at a render of the page's place via `--world-peek`).
- `src/js/world.js` → `createWorld({ kind, place, surface, … })`, three kinds of origin:
  `terminal` (live DOM onto the desk monitor via CSS3D), `reader` (the page's `<main>` onto
  the monitor the same way), `app` (the `/reading/` shelf fades; you're looking at the books).
- In the world: hotspots and the monitor jack you into pages (the origin page without a
  reload); the phone holds contact (`#world` in the URL while it's up); Esc puts the phone
  down, or jacks you back into the origin page; the back button too.
- Hotspot contract:
  `object.userData.hotspot = { label, visit: '/url/' | action: 'monitor' | 'look', highlight(on) }`;
  in the GLB a node's `hotspot` extra names a key of `HOTSPOTS` in warehouse.js.
- `world.link` (arm + plug + cable + sparks: `unplug`, `plugIn`, `setPlugged`, `setUnplugged`)
  and `world.shapeMonitor(w, h, center)` (the monitor must match the viewport's aspect so the
  CSS3D handoff is seamless).

### Still to do

- Looping video on some of the TVs.
- More love on the DeLorean (body curvature); a projects page for it.
- Sound; easter eggs.

### The Blender pipeline

- `blender/build.py [workshop] [--quick]`: model, bake and export to `blender/out/` (needs
  the `bpy==5.2.3` and `pillow` modules in a Python 3.13 venv outside the repo). The room is
  `blender/zones/workshop.py` (with `delorean.py` and `books.py`), written in three.js
  coordinates; helpers in `blender/lib.py`, drawn textures (keycaps, the desk mat,
  handwriting) in `blender/textures.py`.
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
  The arm, the phone and the monitor are JS; the room leaves gaps for them (positions in
  warehouse.js match workshop.py).

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
✕ and edge exit (the arm unplugs you), looking around (drag, arrows), clicking things (pages
on the monitor, the phone), links on the monitor, Jack in (the arm plugs you in), Esc twice,
back button mid-flight, phone width (drag + tap), and the `/reading/` round trip.
