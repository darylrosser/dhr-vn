// World mode: the whole site is a workshop. Every page has a place in it.
//
// The rooms themselves (Blender-built GLB zones, streamed in) and the live
// props are in warehouse.js. This file is the plumbing:
// - Home: the live terminal DOM is re-parented onto the desk monitor with
//   CSS3DRenderer; the camera starts where the screen fills the viewport.
// - Every other page: the live page becomes a floating datapad over its place.
// - /reading/ (its own three.js app, kind 'app'): the app fades away and you're
//   standing at the workshop bookshelf; going back to the library fades it in.
// - In the world you walk around (walker.js, point and click). Clicking a thing walks you up to
//   it and opens its page in the datapad, without reloads; "jack in" drops you
//   into a page as a normal page again. Places are where each page's exit and
//   return land the camera.

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWarehouse, DESK_TOP } from './warehouse.js';
import { createWalker } from './walker.js';

const START_FOV = 40;
const FLIGHT_MS = 2300;
const READING_URL = '/reading/';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const isPortrait = () => innerWidth / innerHeight < 0.9;

// Where each page lives in the workshop (blender/zones/workshop.py): a camera
// pose. Poses are landscape; portrait screens step back along the view
// direction so the subject still fits. Places without a url are just
// somewhere to stand (for now).
const PLACES = {
  home: { url: '/', label: 'Desk', zone: 'workshop', pos: V(1.5, 1.75, 3.5), look: V(-0.3, 1.45, -1.2), fov: 52, back: 1.7 },
  blog: { url: '/blog/', label: 'TV wall', zone: 'workshop', pos: V(-3.4, 1.65, -2.4), look: V(-6.5, 1.55, -4.3), fov: 54, back: 1.2 },
  about: { url: '/about/', label: 'Case file', zone: 'workshop', pos: V(4.1, 1.6, -1.4), look: V(6.55, 1.45, -1.6), fov: 50, back: 1.0 },
  contact: { url: '/contact/', label: 'Payphone', zone: 'workshop', pos: V(4.7, 1.55, 1.4), look: V(6.8, 1.35, 1.1), fov: 50, back: 1.2 },
  reading: { url: READING_URL, label: 'Bookshelf', zone: 'workshop', pos: V(-3.5, 1.55, 2.8), look: V(-6.6, 1.3, 2.1), fov: 50, back: 1.0 },
  garage: { url: null, label: 'Time machine', zone: 'workshop', pos: V(3.6, 1.6, -1.6), look: V(0.3, 0.7, -5.4), fov: 48, back: 1.4 },
};

function placePose(id) {
  const p = PLACES[id];
  const pos = p.pos.clone();
  if (isPortrait()) pos.add(p.pos.clone().sub(p.look).normalize().multiplyScalar(p.back));
  return { pos, look: p.look.clone(), fov: isPortrait() ? p.fov + 6 : p.fov };
}

function placeForPath(path) {
  if (path === '/' || path === '/index.html') return 'home';
  for (const id of ['blog', 'about', 'contact', 'reading']) if (path.startsWith(`/${id}`)) return id;
  return null;
}

// leave: an arrow out of a door; full page: an expand mark
const EXIT_SVG = '<svg class="jack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>';
const EXPAND_SVG = '<svg class="jack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Yield between build steps (setTimeout, not rAF, so it also progresses in a background tab).
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export async function createWorld({ kind, place, surface, reducedMotion, onStatus, onReturn }) {
  const origin = { kind, place, url: location.pathname, title: document.title };
  onStatus('syncing 20%');
  await nextFrame();

  // ---------------------------------------------------------------- renderers

  let fit = null; // home monitor size + start pose, set by fitMonitor()

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04050a');
  scene.fog = new THREE.FogExp2('#1a130d', 0.035); // dusty air

  const camera = new THREE.PerspectiveCamera(START_FOV, innerWidth / innerHeight, 0.02, 220); // far: the city outside

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // phones: fewer pixels (the bloom pass and the lit materials cost per pixel)
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'world-gl';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.8));
  composer.addPass(new OutputPass());

  const cssScene = new THREE.Scene();
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(innerWidth, innerHeight);
  cssRenderer.domElement.className = 'world-css';

  const screenEl = document.createElement('div');
  screenEl.className = 'world-screen';
  const screenObject = new CSS3DObject(screenEl);
  cssScene.add(screenObject);

  const world = createWarehouse(scene, renderer, { reducedMotion, camera });
  // Off the home page there's no live terminal to put on the monitor: it idles.
  if (kind !== 'terminal') world.setMonitorIdle();
  // the zone you start in has to be there before you see it; the rest stream
  world.onProgress = (zone, k) => { if (zone === PLACES[place].zone) onStatus(`syncing ${Math.round(25 + k * 60)}%`); };
  await world.load(PLACES[place].zone);
  world.onProgress = null;
  onStatus('syncing 90%');
  await nextFrame();

  // Warm up shaders now so the first exit doesn't stutter.
  fitMonitor(innerWidth / innerHeight);
  const warm = placePose(place);
  camera.position.copy(warm.pos);
  camera.lookAt(warm.look);
  renderer.compile(scene, camera);
  world.update(0, 0);
  composer.render();
  // that same frame is what the page's bezel reveals when you hover its edge
  const peek = renderer.domElement.toDataURL('image/jpeg', 0.7);
  onStatus('syncing 95%');

  // ---------------------------------------------------------------- HUD

  const ui = document.createElement('div');
  ui.className = 'world-ui';
  ui.innerHTML = `
    <button type="button" class="world-prompt" data-act="prompt"></button>
    <button type="button" class="world-leave" data-act="leave">${EXIT_SVG}<span>${kind === 'terminal' ? 'Back to the terminal' : 'Leave the workshop'}</span></button>
    <p class="world-hint"><span class="world-hint-keys">Click the floor to walk · drag to look · click things to use them · Esc goes back</span><span class="world-hint-touch">Tap the floor to walk · drag to look · tap things to use them</span></p>`;
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.act === 'leave') leave();
    else if (b && b.dataset.act === 'prompt' && promptNode) useSpot(promptNode.userData.hotspot);
  });

  const tip = document.createElement('div');
  tip.className = 'world-tip';

  // ---------------------------------------------------------------- datapad

  const datapad = document.createElement('section');
  datapad.className = 'datapad';
  datapad.setAttribute('aria-label', 'Datapad');
  datapad.innerHTML = `
    <header class="datapad-bar">
      <span class="datapad-title"></span>
      <button type="button" data-act="jackin" title="Open this page on its own">${EXPAND_SVG}<span>Full page</span></button>
      <button type="button" data-act="close" aria-label="Close datapad">✕</button>
    </header>
    <div class="datapad-body"></div>`;
  const dpTitle = datapad.querySelector('.datapad-title');
  // the visor's lens: slides down over the view while a page is projected
  const lens = document.createElement('div');
  lens.className = 'visor-lens';
  const dpBody = datapad.querySelector('.datapad-body');
  let dpOpen = false;
  let dpUrl = null;

  datapad.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'close') { closeDatapad(); return; }
    if (act && act.dataset.act === 'jackin') { jackInHere(); return; }
    // links to other pages walk you there instead of reloading
    const a = e.target.closest('a[href]');
    if (a && a.origin === location.origin && !a.hash && placeForPath(a.pathname) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      visit(a.pathname);
    }
  });

  function showDatapad(node, title, url, { full = false } = {}) {
    dpBody.replaceChildren(node);
    dpTitle.textContent = title.replace(/ \| dhr\.vn$/, '');
    dpUrl = url;
    dpOpen = true;
    lens.classList.add('is-down');
    if (full) {
      // appear at full size with no transition, then glide to the panel
      datapad.style.transition = 'none';
      datapad.classList.add('is-full', 'is-open');
      void datapad.offsetWidth;
      datapad.style.transition = '';
    } else {
      datapad.classList.remove('is-full');
      datapad.classList.add('is-open');
    }
    for (const pre of node.querySelectorAll('.eye')) {
      if (window.DHRmountEye) window.DHRmountEye(pre, pre.parentElement.querySelector('figcaption'));
    }
    document.title = title;
  }

  function closeDatapad() {
    datapad.classList.remove('is-open', 'is-full');
    lens.classList.remove('is-down');
    dpOpen = false;
  }

  // Pages fetched into the datapad: just their <main>, cached for the visit.
  const pageCache = new Map();
  async function fetchPage(path) {
    if (origin.kind === 'reader' && path === origin.url) return { node: surface, title: origin.title };
    if (pageCache.has(path)) return pageCache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const main = doc.getElementById('main');
    if (!main) throw new Error(`no #main in ${path}`);
    const node = document.createElement('main');
    node.className = 'reader';
    node.innerHTML = main.innerHTML;
    const page = { node, title: doc.title };
    pageCache.set(path, page);
    return page;
  }

  // ---------------------------------------------------------------- monitor fit (home)

  // Size the monitor so its screen has the viewport's aspect ratio: the
  // terminal is shown 1:1, so the handoff is seamless at any window size.
  function fitMonitor(aspect) {
    const w = Math.min(0.92, 0.6 * aspect);
    const h = w / aspect;
    const center = V(0, Math.max(1.12, DESK_TOP + 0.09 + h / 2 + 0.035), -0.12);
    world.shapeMonitor(w, h, center);
    const d = (h / 2) / Math.tan(THREE.MathUtils.degToRad(START_FOV / 2));
    fit = { w, h, center, startPos: center.clone().add(V(0, 0, d)) };
    return fit;
  }

  // ---------------------------------------------------------------- camera flight

  const look = new THREE.Vector3();
  let flight = null;
  let hold = null;   // pose to sit at between flights
  let shake = 0;     // camera jolt, decays every frame

  function fly(from, to, done, { ms = FLIGHT_MS, arc = 0.12, onProgress } = {}) {
    hold = to;
    if (reducedMotion) {
      setPose(to.pos, to.look, to.fov);
      if (onProgress) onProgress(1);
      done();
      return;
    }
    flight = { from, to, start: performance.now(), done, ms, arc, onProgress };
  }
  const flyP = (from, to, opts) => new Promise((resolve) => fly(from, to, resolve, opts));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
  const currentPose = () => ({ pos: camera.position.clone(), look: look.clone(), fov: camera.fov });

  function setPose(pos, target, fov) {
    camera.position.copy(pos);
    look.copy(target);
    camera.lookAt(look);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function stepFlight(now) {
    const t = Math.min(1, (now - flight.start) / flight.ms);
    const k = ease(t);
    const { from, to } = flight;
    const pos = from.pos.clone().lerp(to.pos, k);
    pos.y += Math.sin(Math.PI * k) * flight.arc; // a slight arc, like stepping back and up
    setPose(pos, from.look.clone().lerp(to.look, k), from.fov + (to.fov - from.fov) * k);
    if (flight.onProgress) flight.onProgress(k);
    if (t >= 1) {
      const { done } = flight;
      flight = null;
      done();
    }
  }

  let current = place;  // the place the camera is at (or heading to)
  let visitToken = 0;   // newer visits cancel older ones

  async function flyTo(id, opts) {
    current = id;
    unsettle();
    world.load(PLACES[id].zone); // streams in (and fades up) while we travel
    const from = currentPose();
    const to = placePose(id);
    // across the hall: a longer, higher arc over whatever is in between
    const dist = from.pos.distanceTo(to.pos);
    await flyP(from, to, { ms: Math.min(2600, 1300 + dist * 70), arc: 0.15 + dist * 0.05, ...opts });
    if (current === id) settle();
  }

  // At rest (no flight running) you're on your feet: the walker drives the camera.
  function settle() { settled = true; walker.enable(); }
  function unsettle() { settled = false; walker.disable(); }

  // ---------------------------------------------------------------- pointer + hotspots

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  let hovered = null;
  let settled = false; // no flight running: you're walking (hover, clicks)
  // moving off (keys) puts the visor away
  const walker = createWalker({ camera, dom: renderer.domElement, blocked: world.blocked, reducedMotion, onMoveKey: () => { if (dpOpen && !entering) closeDatapad(); } });
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorHit = new THREE.Vector3();

  const overUi = (target) => screenEl.contains(target) || ui.contains(target) || datapad.contains(target);

  function aim(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
  }

  // a ring on the floor where a click would take you
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshBasicMaterial({
    color: new THREE.Color('#2ad4c9').multiplyScalar(1.6), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  function onPointerMove(e) {
    aim(e);
    ring.visible = false;
    if (!settled || entering || overUi(e.target) || dpOpen) return setHover(null);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.hotspots, true)[0];
    let node = hit && hit.object;
    while (node && !node.userData.hotspot) node = node.parent;
    setHover(node || null);
    if (!node && e.pointerType !== 'touch' && raycaster.ray.intersectPlane(floor, floorHit) && floorHit.distanceTo(camera.position) < 30) {
      ring.position.set(floorHit.x, 0.015, floorHit.z);
      ring.visible = true;
    }
  }

  function setHover(node) {
    if (node === hovered) return;
    if (hovered) hovered.userData.hotspot.highlight(false);
    hovered = node;
    if (hovered) hovered.userData.hotspot.highlight(true);
    tip.textContent = hovered ? hotspotLabel(hovered.userData.hotspot) : '';
    tip.classList.toggle('is-on', !!hovered);
    renderer.domElement.style.cursor = hovered ? 'pointer' : '';
  }

  function hotspotLabel(spot) {
    if (spot.action !== 'monitor') return spot.label;
    if (kind === 'terminal') return current === 'home' ? 'Back to the terminal' : 'Terminal →';
    return 'Terminal →';
  }

  // Click / tap: a thing in the room → walk up to it and use it; the floor →
  // walk there; anywhere while reading → put the datapad away.
  function onClick(e) {
    if (!settled || entering || overUi(e.target) || walker.dragged) return;
    if (dpOpen) { closeDatapad(); return; }
    aim(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.hotspots, true)[0];
    let node = hit && hit.object;
    while (node && !node.userData.hotspot) node = node.parent;
    if (node) { approach(node, hit.point); return; }
    if (raycaster.ray.intersectPlane(floor, floorHit) && floorHit.distanceTo(camera.position) < 30) walker.walkTo(floorHit);
  }

  function useSpot(spot) {
    if (spot.action === 'monitor') {
      if (kind === 'terminal') { if (current === 'home') leave(); else visit('/'); }
      else jackInto('/');
    } else if (spot.visit) visit(spot.visit);
  }

  function approach(node, point) {
    const spot = node.userData.hotspot;
    const d = Math.hypot(point.x - camera.position.x, point.z - camera.position.z);
    if (d > 3.2 && spot.action !== 'monitor') walker.walkTo(point.clone().setY(0), { arrive: 2.2, onArrive: () => useSpot(spot) });
    else useSpot(spot);
  }

  // Walk up to something you can use and the action shows up, like in a game:
  // [E] Open the case file (a button you can tap, too).
  const prompt = ui.querySelector('.world-prompt');
  const facing = new THREE.Vector3();
  let promptNode = null;
  function updatePrompt() {
    let best = null, bestD = Infinity;
    if (settled && !dpOpen && !entering) {
      camera.getWorldDirection(facing);
      const flat = Math.hypot(facing.x, facing.z) || 1;
      for (const node of world.hotspots) {
        const spot = node.userData.hotspot;
        if (!spot.prompt) continue;
        const c = node.userData.center || (node.userData.center = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()));
        const dx = c.x - camera.position.x, dz = c.z - camera.position.z;
        const d = Math.hypot(dx, dz);
        if (d > (spot.reach || 3) || d >= bestD) continue;
        if (d > 0.6 && (dx * facing.x + dz * facing.z) / (d * flat) < 0.45) continue; // in front of you
        best = node;
        bestD = d;
      }
    }
    if (best === promptNode) return;
    promptNode = best;
    if (!best) { prompt.classList.remove('is-on'); return; }
    const spot = best.userData.hotspot;
    const soon = spot.action === 'place';
    prompt.innerHTML = `${soon ? '' : '<kbd>E</kbd>'}<span></span>`;
    prompt.querySelector('span').textContent = spot.action === 'monitor' ? hotspotLabel(spot).replace(' →', '') : spot.prompt;
    prompt.setAttribute('aria-disabled', String(soon));
    prompt.classList.add('is-on');
  }

  function onKey(e) {
    if (e.code === 'KeyE' && promptNode && !dpOpen && !entering && !e.metaKey && !e.ctrlKey) {
      const spot = promptNode.userData.hotspot;
      if (spot.action !== 'place') { e.preventDefault(); useSpot(spot); }
      return;
    }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (dpOpen && !entering) closeDatapad();
    else leave();
  }

  // ---------------------------------------------------------------- loop

  let active = false;
  let busy = false;      // exit is setting up / flying out
  let entering = false;  // heading back to the origin page
  let raf = 0;
  let frameNo = 0;
  let pushedHistory = false;
  const clock = new THREE.Clock();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    frameNo++;
    // reading a datapad with the camera at rest: the room only needs ~10 fps
    if (dpOpen && settled && !flight && shake < 0.0004 && frameNo % 6) return;
    if (flight) stepFlight(now);
    else if (settled) {
      if (!dpOpen) walker.update(dt);
      look.copy(walker.look);
      if (frameNo % 6 === 0) updatePrompt();
    } else if (hold) setPose(hold.pos, hold.look, hold.fov);
    if (shake > 0.0004) {
      camera.position.add(V((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      shake *= Math.pow(0.0005, dt); // gone in ~0.3 s
    }
    world.update(now / 1000, dt);
    composer.render();
    if (kind === 'terminal') cssRenderer.render(cssScene, camera);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    cssRenderer.setSize(innerWidth, innerHeight);
  }

  // ---------------------------------------------------------------- exit (jack out)

  let restore = null;

  function attach() {
    document.documentElement.classList.add('in-world');
    document.body.append(renderer.domElement, ...(kind === 'terminal' ? [cssRenderer.domElement] : []), lens, datapad, ui, tip);
    onResize();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    if (location.hash !== '#world') { history.pushState({ world: true }, '', `${location.pathname}#world`); pushedHistory = true; }
    active = true;
    current = place;
    clock.getDelta();
    raf = requestAnimationFrame(loop);
    prefetch();
  }

  // Once you're in, the other zones load one by one in the background,
  // nearest first, so most trips arrive to a room that's already there.
  let prefetching = false;
  async function prefetch() {
    if (prefetching) return;
    prefetching = true;
    const here = PLACES[place].pos;
    const order = [...new Set(Object.values(PLACES).sort((a, b) => a.pos.distanceTo(here) - b.pos.distanceTo(here)).map((p) => p.zone))];
    for (const zone of order) {
      if (!active) break;
      await world.load(zone);
      await sleep(400);
    }
    prefetching = false;
  }

  function exit() {
    if (active || busy) return;
    busy = true;
    restore = { parent: surface.parentNode, next: surface.nextSibling, scrollY: window.scrollY };
    if (kind === 'terminal') exitTerminal();
    else if (kind === 'app') exitApp();
    else exitPage();
  }

  // The reading shelf app: fade it out and step back from the workshop shelf.
  let hiddenApp = [];
  function exitApp() {
    hiddenApp = [...document.body.children];
    for (const el of hiddenApp) el.classList.add('world-hidden');
    attach();
    world.link.setUnplugged();
    const pose = placePose(place);
    setPose(pose.pos.clone().lerp(pose.look, 0.55), pose.look, pose.fov);
    requestAnimationFrame(() => renderer.domElement.classList.add('is-on'));
    fly(currentPose(), pose, () => {
      settle();
      busy = false;
      ui.classList.add('is-on');
    }, { ms: 1800, arc: 0.03 });
  }

  // Home: the terminal goes onto the monitor; the camera pulls back from it.
  function exitTerminal() {
    const W = innerWidth;
    const H = innerHeight;
    const { w, center, startPos } = fitMonitor(W / H);
    screenEl.style.width = `${W}px`;
    screenEl.style.height = `${H}px`;
    screenEl.append(surface);
    screenObject.position.copy(center).add(V(0, 0, 0.001));
    screenObject.scale.setScalar(w / W);
    attach();
    renderer.domElement.classList.add('is-on');
    setPose(startPos, center, START_FOV);
    cssRenderer.render(cssScene, camera);
    screenEl.scrollTop = restore.scrollY;
    fly({ pos: startPos, look: center, fov: START_FOV }, placePose('home'), () => {
      settle();
      busy = false;
      ui.classList.add('is-on');
    }, {
      // the plug yanks out of the desk socket as it comes into view
      onProgress: (k) => { if (k > 0.26 && world.link.state === 'plugged') world.link.unplug(reducedMotion); },
    });
  }

  // Any other page: the page itself becomes the datapad, shrinking off the full
  // screen while the room fades in behind it and the camera settles on its place.
  function exitPage() {
    attach();
    showDatapad(surface, origin.title, origin.url, { full: true });
    dpBody.scrollTop = restore.scrollY;
    world.link.setUnplugged();
    const pose = placePose(place);
    setPose(pose.pos.clone().lerp(pose.look, 0.4), pose.look, pose.fov);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      datapad.classList.remove('is-full');
      renderer.domElement.classList.add('is-on');
    }));
    fly(currentPose(), pose, () => {
      settle();
      busy = false;
      ui.classList.add('is-on');
    }, { ms: 1800, arc: 0.04 });
  }

  // ---------------------------------------------------------------- moving around

  async function visit(url) {
    if (!active || entering) return;
    const path = new URL(url, location.href).pathname;
    const id = placeForPath(path);
    if (!id) { window.location.assign(url); return; }
    const token = ++visitToken;
    setHover(null);
    if (id === 'reading' && kind === 'app') { closeDatapad(); leave(); return; }
    if (id === 'reading') {
      // the library is its own (three.js) app: walk to the shelf, then go in
      closeDatapad();
      await flyTo('reading');
      if (token === visitToken) jackInto(READING_URL);
      return;
    }
    if (id === 'home') {
      closeDatapad();
      setUrl('/');
      document.title = 'dhr.vn';
      await flyTo('home');
      return;
    }
    // a page opens on the datapad wherever you're standing
    const page = await fetchPage(path).catch(() => null);
    current = id;
    if (token !== visitToken || !active || entering) return;
    if (!page) { jackInto(path); return; }
    showDatapad(page.node, page.title, path);
    if (page.node !== surface) dpBody.scrollTop = 0;
    setUrl(path);
  }

  function setUrl(path) { history.replaceState(history.state, '', `${path}#world`); }

  // "Jack in" on the datapad: become that page. The origin page reverses its
  // jack-out; anything else is a normal page load.
  function jackInHere() {
    if (dpUrl === origin.url && kind === 'reader') leave();
    else jackInto(dpUrl);
  }

  function jackInto(url) {
    entering = true;
    ui.classList.remove('is-on');
    renderer.domElement.classList.remove('is-on');
    setTimeout(() => window.location.assign(url), reducedMotion ? 0 : 450);
  }

  // ---------------------------------------------------------------- enter (back to the origin page)

  // Esc / back button / "Jack back in": return to the page you jacked out of.
  // Goes back in history if we added an entry, so the back button stays in sync.
  function leave() {
    if (!active || entering) return;
    if (pushedHistory && location.hash === '#world') history.back(); // popstate → enter()
    else { history.replaceState(null, '', origin.url); enter(); }
  }

  async function enter() {
    if (!active || entering) return;
    entering = true;
    busy = true;
    unsettle();
    visitToken++;
    setHover(null);
    ui.classList.remove('is-on');
    if (kind === 'terminal') await enterTerminal();
    else if (kind === 'app') await enterApp();
    else await enterPage();
    detach();
    onReturn();
  }

  // Over to the desk socket, the plug slams home (sparks, jolt), the screen
  // powers back on, then the camera flies into it.
  async function enterTerminal() {
    closeDatapad();
    const screenPose = { pos: fit.startPos, look: fit.center, fov: START_FOV };
    if (world.link.state === 'plugged' || reducedMotion) {
      world.link.setPlugged();
      await flyP(currentPose(), screenPose, { ms: 1400, arc: 0.05 });
    } else {
      const socketPose = {
        pos: V(0.82, DESK_TOP + (isPortrait() ? 0.62 : 0.42), isPortrait() ? 1.35 : 0.98),
        look: V(0.28, DESK_TOP + 0.08, 0.2),
        fov: 44,
      };
      await flyP(currentPose(), socketPose, { ms: 1100, arc: 0.04 });
      await world.link.plugIn();
      shake = 0.02;
      surface.classList.remove('crt-on');
      void surface.offsetWidth;
      surface.classList.add('crt-on');
      await sleep(420);
      await flyP(socketPose, screenPose, { ms: 1250, arc: 0.03 });
    }
    const y = screenEl.scrollTop;
    restore.parent.insertBefore(surface, restore.next);
    restore.scrollY = y;
  }

  // Back to the origin place, its datapad grows to full screen, the room fades.
  async function enterPage() {
    if (current !== place || dpUrl !== origin.url) {
      closeDatapad();
      await flyTo(place, { ms: 1300 });
      showDatapad(surface, origin.title, origin.url);
      await sleep(350);
    }
    datapad.classList.add('is-full');
    renderer.domElement.classList.remove('is-on');
    await sleep(600);
    const y = dpBody.scrollTop;
    restore.parent.insertBefore(surface, restore.next);
    restore.scrollY = y;
  }

  // Walk back to the shelf, lean in, and the reading app fades back up.
  async function enterApp() {
    closeDatapad();
    if (current !== place) await flyTo(place, { ms: 1300 });
    const pose = placePose(place);
    fly(currentPose(), { pos: pose.pos.clone().lerp(pose.look, 0.55), look: pose.look, fov: pose.fov }, () => {}, { ms: 900, arc: 0 });
    renderer.domElement.classList.remove('is-on');
    for (const el of hiddenApp) el.classList.remove('world-hidden');
    await sleep(800);
    restore.scrollY = 0;
  }

  function detach() {
    cancelAnimationFrame(raf);
    renderer.domElement.remove();
    cssRenderer.domElement.remove();
    closeDatapad();
    datapad.remove();
    lens.remove();
    ui.remove();
    tip.remove();
    document.documentElement.classList.remove('in-world');
    window.scrollTo(0, restore.scrollY);
    document.title = origin.title;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    active = false;
    pushedHistory = false;
    busy = false;
    entering = false;
    hold = null;
    flight = null;
  }

  window.addEventListener('popstate', () => {
    if (location.hash === '#world' && !active) exit();
    else if (location.hash !== '#world' && active) enter();
  });

  world.link.onJolt = (amount) => { shake = Math.max(shake, amount); };
  return { exit, visit, enter: leave, peek, get active() { return active; } };
}
