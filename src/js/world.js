// World mode: the whole site is a workshop; you stand behind its desk.
//
// The room (a Blender-built GLB) and the live props are in warehouse.js; the
// robot arm is arm.js, looking around is seat.js. This file is the plumbing:
// - The desk monitor is your browser. Jacking out of a page (or the home
//   terminal) leaves it on the monitor, live DOM via CSS3DRenderer: the camera
//   starts where the screen fills the window, the arm yanks the plug out of
//   your neck, and you get up from the chair to your spot behind the desk.
// - From there you look around (no walking). Clicking a thing opens its page
//   on that monitor and you lean in (the TV wall or a screen → blog, the
//   evidence board → about); the books open the reading app; for the phone
//   you sit down and it lifts up with the contact page on it. No overlays:
//   lean back (Esc) and you're where you were.
// - "Jack in": you sit down, the arm plugs you back in and you dive into the
//   monitor, into whatever page is on it. Esc / back from the room returns to
//   where you came from.
// - /reading/ (its own three.js app, kind 'app'): the app fades away and you're
//   looking at the books on the desk; going back fades it in again.

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWarehouse, DESK_TOP } from './warehouse.js';
import { createSeat } from './seat.js';

const START_FOV = 40;   // leaning into the monitor
const SEAT_FOV = 52;    // standing back
const CHAIR_FOV = 56;   // sat at the desk
const READING_URL = '/reading/';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Where you stand, and what you look at (blender/zones/workshop.py has them).
const STAND = V(0, 1.72, 2.5);    // behind the desk, straight on to the screens
const CHAIR = V(0, 1.22, 1.15);   // sat at the desk (jacking in, the phone)
const GAZE = {
  desk: V(0, 1.2, -1.5),         // the screens, the window beyond, the car off to the right
  monitor: V(0, 1.1, -0.12),
  books: V(-0.92, DESK_TOP + 0.08, 0.26),
  phone: V(0.5, DESK_TOP, 0.32),
};
const PHONE_PX = 360;           // the contact page on the phone: a phone-width layout

function placeForPath(path) {
  if (path === '/' || path === '/index.html') return 'home';
  for (const id of ['blog', 'about', 'contact', 'reading']) if (path.startsWith(`/${id}`)) return id;
  return null;
}

// jack in: a plug; lean back: an arrow out of the screen
const JACK_SVG = '<svg class="jack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4"/></svg>';
const BACK_SVG = '<svg class="jack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8l-4 4 4 4M6 12h12"/></svg>';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Yield between build steps (setTimeout, not rAF, so it also progresses in a background tab).
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export async function createWorld({ kind, place, surface, reducedMotion, onStatus, onReturn }) {
  const origin = { kind, place, url: location.pathname, title: document.title };
  onStatus('syncing 20%');
  await nextFrame();

  // ---------------------------------------------------------------- renderers

  let fit = null; // monitor size + the pose where it fills the window, from fitMonitor()
  const look = new THREE.Vector3();
  let flight = null;
  let hold = null;   // pose to sit at between flights
  let shake = 0;     // camera jolt, decays every frame

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04050a');
  scene.fog = new THREE.FogExp2('#1a130d', 0.035); // dusty air

  const camera = new THREE.PerspectiveCamera(SEAT_FOV, innerWidth / innerHeight, 0.02, 220); // far: the city outside

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

  // the monitor's screen: whatever page is on it, at the window's own size
  const screenEl = document.createElement('div');
  screenEl.className = 'world-screen';
  const screenObject = new CSS3DObject(screenEl);
  screenObject.visible = false;
  cssScene.add(screenObject);

  // the phone's screen: the contact page at phone width
  const phoneEl = document.createElement('div');
  phoneEl.className = 'world-phone';
  const phoneObject = new CSS3DObject(phoneEl);
  phoneObject.visible = false;
  cssScene.add(phoneObject);

  const world = createWarehouse(scene, renderer, { reducedMotion, camera });
  // Off the home page there's no live terminal: until a page goes on the monitor, it idles.
  if (kind !== 'terminal') world.setMonitorIdle();
  world.onProgress = (zone, k) => onStatus(`syncing ${Math.round(25 + k * 60)}%`);
  await world.load('workshop');
  world.onProgress = null;
  onStatus('syncing 90%');
  await nextFrame();

  // Warm up shaders now so the first exit doesn't stutter.
  fitMonitor(innerWidth / innerHeight);
  setPose(STAND, GAZE.desk, SEAT_FOV);
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
    <button type="button" class="world-leave world-back" data-act="back">${BACK_SVG}<span>Lean back</span></button>
    <button type="button" class="world-leave" data-act="jackin">${JACK_SVG}<span>Jack in</span></button>
    <p class="world-hint"><span class="world-hint-keys">Drag to look · click things to use them · Esc goes back</span><span class="world-hint-touch">Drag to look · tap things to use them</span></p>`;
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.act === 'back') back();
    else if (b && b.dataset.act === 'jackin') jackIn();
  });

  const tip = document.createElement('div');
  tip.className = 'world-tip';
  // the jolt of the plug going in: the picture tears for a moment
  const glitch = document.createElement('div');
  glitch.className = 'world-glitch';

  // mode: 'seated' (looking around) | 'leaned' (reading the monitor) | 'phone' | 'moving'
  let mode = 'moving';
  function setMode(m) {
    mode = m;
    ui.dataset.mode = m;
    // only what you're leaning into takes clicks, keys and focus
    screenEl.style.pointerEvents = m === 'leaned' ? 'auto' : 'none';
    screenEl.inert = m !== 'leaned';
    phoneEl.style.pointerEvents = m === 'phone' ? 'auto' : 'none';
    phoneEl.inert = m !== 'phone';
    if (m === 'seated') seat.enable();
    else seat.disable();
  }

  // ---------------------------------------------------------------- the monitor: your browser

  // Size the monitor so its screen has the window's aspect ratio: the page is
  // shown 1:1, so leaning in until it fills the window is seamless.
  function fitMonitor(aspect) {
    const w = Math.min(0.92, 0.6 * aspect);
    const h = w / aspect;
    const center = V(0, Math.max(1.12, DESK_TOP + 0.09 + h / 2 + 0.035), -0.12);
    world.shapeMonitor(w, h, center);
    const d = (h / 2) / Math.tan(THREE.MathUtils.degToRad(START_FOV / 2));
    fit = { w, h, center, startPos: center.clone().add(V(0, 0, d)) };
    screenEl.style.width = `${innerWidth}px`;
    screenEl.style.height = `${innerHeight}px`;
    screenObject.position.copy(center).add(V(0, 0, 0.001));
    screenObject.scale.setScalar(w / innerWidth);
    return fit;
  }
  const monitorPose = () => ({ pos: fit.startPos.clone(), look: fit.center.clone(), fov: START_FOV });
  const seatPose = (at = GAZE.desk) => ({ pos: STAND.clone(), look: at.clone(), fov: SEAT_FOV });
  const chairPose = (at = GAZE.monitor) => ({ pos: CHAIR.clone(), look: at.clone(), fov: CHAIR_FOV });

  let mon = { url: null, title: '' }; // what's on the monitor
  function putOnMonitor(node, url, title) {
    if (screenEl.firstChild !== node) screenEl.replaceChildren(node);
    screenEl.classList.toggle('is-terminal', node === surface && kind === 'terminal');
    screenObject.visible = true;
    mon = { url, title };
    for (const pre of node.querySelectorAll('.eye')) {
      if (window.DHRmountEye) window.DHRmountEye(pre, pre.parentElement.querySelector('figcaption'));
    }
    document.title = title;
  }

  // Pages fetched for the monitor or the phone: just their <main>, cached for the visit.
  const pageCache = new Map();
  async function fetchPage(path, fresh = false) {
    // the page you came from is already here (unless the phone wants its own copy)
    if (!fresh && origin.kind === 'reader' && path === origin.url) return { node: surface, title: origin.title };
    const key = fresh ? `${path}|phone` : path;
    if (pageCache.has(key)) return pageCache.get(key);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const main = doc.getElementById('main');
    if (!main) throw new Error(`no #main in ${path}`);
    const node = document.createElement('main');
    node.className = 'reader';
    node.innerHTML = main.innerHTML;
    const page = { node, title: doc.title };
    pageCache.set(key, page);
    return page;
  }

  // links on the monitor (or the phone) open there too, without reloads
  function onPageClick(e) {
    const a = e.target.closest('a[href]');
    if (a && a.origin === location.origin && !a.hash && placeForPath(a.pathname) && !e.metaKey && !e.ctrlKey && !a.target) {
      e.preventDefault();
      visit(a.pathname);
    }
  }
  screenEl.addEventListener('click', onPageClick);
  phoneEl.addEventListener('click', onPageClick);

  // ---------------------------------------------------------------- camera flight

  function fly(from, to, done, { ms = 1200, arc = 0, onProgress } = {}) {
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
    camera.updateMatrixWorld();
  }

  function stepFlight(now) {
    const t = Math.min(1, (now - flight.start) / flight.ms);
    const k = ease(t);
    const { from, to } = flight;
    const pos = from.pos.clone().lerp(to.pos, k);
    pos.y += Math.sin(Math.PI * k) * flight.arc;
    setPose(pos, from.look.clone().lerp(to.look, k), from.fov + (to.fov - from.fov) * k);
    if (flight.onProgress) flight.onProgress(k);
    if (t >= 1) {
      const { done } = flight;
      flight = null;
      done();
    }
  }

  // ---------------------------------------------------------------- leaning in and back

  let token = 0; // newer moves cancel older ones

  async function leanIn() {
    const my = ++token;
    setMode('moving');
    setHover(null);
    await flyP(currentPose(), monitorPose(), { ms: 1500, arc: 0.05 });
    if (my === token && active && !entering) {
      setMode('leaned');
      // the terminal takes your typing again
      if (mon.url === '/' && kind === 'terminal') surface.querySelector('input')?.focus({ preventScroll: true });
    }
  }

  let lastLook = GAZE.desk.clone(); // where you were looking before you leaned in
  async function leanBack() {
    const my = ++token;
    setMode('moving');
    await flyP(currentPose(), seatPose(lastLook), { ms: 1400, arc: 0.05 });
    if (my === token && active && !entering) setMode('seated');
  }

  // ---------------------------------------------------------------- the phone

  const phone = world.phone;
  const phoneHeld = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  let phoneAnim = null; // { from, to, t, ms, done }
  const fwd = new THREE.Vector3();
  const screenPos = new THREE.Vector3();

  // held up in front of you, as big as fits (the screen ~86% of the window's height)
  function heldPose() {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(phone.height / (0.86 * 2 * tan), phone.width / (0.9 * 2 * tan * camera.aspect));
    camera.getWorldDirection(fwd);
    phoneHeld.quaternion.copy(camera.quaternion);
    // the screen sits a little in front of the phone's centre
    phoneHeld.position.copy(camera.position).addScaledVector(fwd, dist + 0.005);
    return phoneHeld;
  }

  function movePhone(to, ms) {
    const o = phone.object;
    return new Promise((resolve) => {
      const from = { position: o.position.clone(), quaternion: o.quaternion.clone() };
      if (reducedMotion) { o.position.copy(to.position); o.quaternion.copy(to.quaternion); resolve(); return; }
      phoneAnim = { from, to: { position: to.position.clone(), quaternion: to.quaternion.clone() }, t: 0, ms, done: resolve };
    });
  }
  function stepPhone(dt) {
    const a = phoneAnim, o = phone.object;
    a.t = Math.min(1, a.t + (dt * 1000) / a.ms);
    const k = ease(a.t);
    o.position.lerpVectors(a.from.position, a.to.position, k);
    o.position.y += Math.sin(Math.PI * k) * 0.08; // picked up, not slid
    o.quaternion.slerpQuaternions(a.from.quaternion, a.to.quaternion, k);
    if (a.t >= 1) { phoneAnim = null; a.done(); }
  }

  async function raisePhone(page, path) {
    const my = ++token;
    if (mode === 'leaned') await leanBack();
    if (my !== token) return;
    setMode('moving');
    setHover(null);
    // sit down at the desk, then pick it up
    await flyP(currentPose(), chairPose(GAZE.phone.clone().add(V(0, 0.25, -0.5))), { ms: 1100, arc: 0.04 });
    if (my !== token) return;
    phoneEl.replaceChildren(page.node);
    phoneEl.scrollTop = 0;
    phoneEl.style.width = `${PHONE_PX}px`;
    phoneEl.style.height = `${Math.round(PHONE_PX * phone.height / phone.width)}px`;
    await movePhone(heldPose(), 750);
    if (my !== token || !active) return;
    phoneObject.visible = true;
    setMode('phone');
    setUrl(path);
    document.title = page.title;
  }

  async function lowerPhone({ ms = 650 } = {}) {
    const my = ++token;
    phoneObject.visible = false;
    setMode('moving');
    await movePhone(phone.object.userData.rest, ms);
    setUrl(mon.url || origin.url);
    document.title = mon.url ? mon.title : origin.title;
    if (my !== token || !active || entering) return;
    await flyP(currentPose(), seatPose(lastLook), { ms: 1200, arc: 0.06 }); // and get up
    if (my === token && active && !entering) setMode('seated');
  }

  // ---------------------------------------------------------------- pointer + hotspots

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  let hovered = null;
  // left round to the bookcase and the tool wall, right to the evidence board; never the bare wall behind you
  const seat = createSeat({ camera, dom: renderer.domElement, reducedMotion, at: STAND, facing: GAZE.desk, left: 1.05, right: 1.05 });

  const overUi = (target) => ui.contains(target) || (mode === 'leaned' && screenEl.contains(target)) || (mode === 'phone' && phoneEl.contains(target));

  function aim(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.hotspots, true)[0];
    let node = hit && hit.object;
    while (node && !node.userData.hotspot) node = node.parent;
    return node || null;
  }

  function onPointerMove(e) {
    aim(e);
    if (mode !== 'seated' || overUi(e.target) || e.pointerType === 'touch') return setHover(null);
    setHover(pick());
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
    if (mon.url) return `${mon.title.replace(/ \| dhr\.vn$/, '') || 'Terminal'} →`;
    return 'Terminal →';
  }

  // Click / tap a thing in reach: use it. Holding the phone, anywhere off it
  // puts it down.
  function onClick(e) {
    if (entering || seat.dragged || overUi(e.target)) return;
    if (mode === 'phone') { lowerPhone(); return; }
    if (mode !== 'seated') return;
    aim(e);
    const node = pick();
    if (node) use(node);
  }

  const center = new THREE.Vector3();
  function use(node) {
    const spot = node.userData.hotspot;
    lastLook.copy(look);
    if (spot.action === 'monitor') {
      if (mon.url) leanIn();
      else visit('/');
    } else if (spot.action === 'look') {
      new THREE.Box3().setFromObject(node).getCenter(center);
      seat.lookAt(center);
    } else if (spot.visit) visit(spot.visit);
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    back();
  }

  // Esc / "Lean back": put the phone down, lean back from the monitor, or
  // (sat back already) return to the page you came from.
  function back() {
    if (entering) return;
    if (mode === 'phone') lowerPhone();
    else if (mode === 'leaned') leanBack();
    else if (mode === 'seated') leave();
  }

  // ---------------------------------------------------------------- loop

  let active = false;
  let busy = false;      // exit is setting up / flying out
  let entering = false;  // jacking back in
  let raf = 0;
  let frameNo = 0;
  let pushedHistory = false;
  const clock = new THREE.Clock();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    frameNo++;
    // reading the monitor or the phone, nothing moving: the room only needs ~10 fps
    if ((mode === 'leaned' || mode === 'phone') && !flight && !phoneAnim && shake < 0.0004 && frameNo % 6) return;
    if (flight) stepFlight(now);
    else if (mode === 'seated') { seat.update(dt); look.copy(seat.look); }
    else if (hold) setPose(hold.pos, hold.look, hold.fov);
    if (shake > 0.0004) {
      camera.position.add(V((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      shake *= Math.pow(0.0005, dt); // gone in ~0.3 s
    }
    camera.updateMatrixWorld();
    if (phoneAnim) stepPhone(dt);
    if (phoneObject.visible) {
      // the page sits on the phone's screen
      phone.screen.getWorldPosition(screenPos);
      phoneObject.position.copy(screenPos);
      phone.screen.getWorldQuaternion(phoneObject.quaternion);
      phoneObject.scale.setScalar(phone.width / PHONE_PX);
    }
    world.update(now / 1000, dt);
    composer.render();
    cssRenderer.render(cssScene, camera);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    cssRenderer.setSize(innerWidth, innerHeight);
    if (!active) return;
    fitMonitor(innerWidth / innerHeight);
    if (mode === 'leaned') { const p = monitorPose(); hold = p; setPose(p.pos, p.look, p.fov); }
    if (kind === 'terminal' && mode === 'leaned') surface.querySelector('input')?.focus({ preventScroll: true });
    if (mode === 'phone') { const h = heldPose(); phone.object.position.copy(h.position); phone.object.quaternion.copy(h.quaternion); }
  }

  // ---------------------------------------------------------------- exit (jack out)

  let restore = null;

  function attach() {
    document.documentElement.classList.add('in-world');
    document.body.append(renderer.domElement, cssRenderer.domElement, glitch, ui, tip);
    onResize();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    if (location.hash !== '#world') { history.pushState({ world: true }, '', `${location.pathname}#world`); pushedHistory = true; }
    active = true;
    clock.getDelta();
    raf = requestAnimationFrame(loop);
  }

  function exit() {
    if (active || busy) return;
    busy = true;
    restore = { parent: surface.parentNode, next: surface.nextSibling, scrollY: window.scrollY };
    if (kind === 'app') exitApp();
    else exitScreen();
  }

  // The reading shelf app fades away: you're looking at the books on the desk,
  // and sit back.
  let hiddenApp = [];
  function exitApp() {
    hiddenApp = [...document.body.children];
    for (const el of hiddenApp) el.classList.add('world-hidden');
    attach();
    world.link.setUnplugged();
    setPose(CHAIR.clone().lerp(GAZE.books, 0.4), GAZE.books, CHAIR_FOV);
    requestAnimationFrame(() => renderer.domElement.classList.add('is-on'));
    fly(currentPose(), seatPose(), () => {
      busy = false;
      setMode('seated');
      ui.classList.add('is-on');
    }, { ms: 1800 });
  }

  // The terminal or the page you're on goes onto the monitor; the camera
  // starts where it fills the window, you sit back, the arm yanks the plug out
  // of your neck, and you get up.
  function exitScreen() {
    fitMonitor(innerWidth / innerHeight);
    putOnMonitor(surface, origin.url, origin.title);
    attach();
    setPose(fit.startPos, fit.center, START_FOV);
    world.link.setPlugged();
    renderer.domElement.classList.add('is-on');
    cssRenderer.render(cssScene, camera);
    screenEl.scrollTop = restore.scrollY;
    fly(monitorPose(), chairPose(), async () => {
      await sleep(900); // the arm puts the plug back in its cradle
      await flyP(currentPose(), seatPose(), { ms: 1500, arc: 0.08 });
      busy = false;
      setMode('seated');
      ui.classList.add('is-on');
    }, {
      ms: 1500,
      onProgress: (k) => { if (k > 0.2 && world.link.state === 'plugged') world.link.unplug(reducedMotion); },
    });
  }

  // ---------------------------------------------------------------- visiting pages, in place

  async function visit(url) {
    if (!active || entering) return;
    const path = new URL(url, location.href).pathname;
    const id = placeForPath(path);
    if (!id) { window.location.assign(url); return; }
    const my = ++token;
    setHover(null);
    if (id === 'reading') {
      // the reading list is its own (three.js) app: a look at the books, then in
      if (kind === 'app') { leave(); return; }
      if (mode === 'phone') await lowerPhone({ ms: 300 });
      else if (mode === 'leaned') await leanBack();
      seat.lookAt(GAZE.books);
      await sleep(500);
      if (active && !entering) goTo(READING_URL);
      return;
    }
    if (id === 'home' && kind !== 'terminal') { jackInto('/'); return; }
    const page = id === 'home' ? { node: surface, title: origin.title } : await fetchPage(path, id === 'contact').catch(() => null);
    if (my !== token || !active || entering) return;
    if (!page) { window.location.assign(path); return; }
    if (id === 'contact') { raisePhone(page, path); return; }
    if (mode === 'phone') await lowerPhone({ ms: 300 });
    putOnMonitor(page.node, path, page.title);
    if (page.node !== surface) screenEl.scrollTop = 0;
    setUrl(path);
    if (mode !== 'leaned') leanIn();
  }

  function setUrl(path) { history.replaceState(history.state, '', `${path}#world`); }

  // "Jack in": the page on the monitor (or the phone) becomes the page. The
  // one you came from reverses its jack-out; anything else, after the arm has
  // plugged you in, is a normal page load.
  function jackIn() {
    if (entering || busy) return;
    const url = mode === 'phone' ? '/contact/' : mon.url;
    if (!url || (url === origin.url && kind !== 'app')) leave();
    else jackInto(url);
  }

  async function jackInto(url) {
    if (entering) return;
    entering = true;
    token++;
    ui.classList.remove('is-on');
    setHover(null);
    if (mode === 'phone') await lowerPhone({ ms: 300 });
    await plugIn();
    renderer.domElement.classList.remove('is-on');
    setTimeout(() => window.location.assign(url), reducedMotion ? 0 : 200);
  }

  // straight to another page (the reading app): the room fades out
  function goTo(url) {
    entering = true;
    ui.classList.remove('is-on');
    renderer.domElement.classList.remove('is-on');
    setTimeout(() => window.location.assign(url), reducedMotion ? 0 : 450);
  }

  // Sit down facing the monitor, the arm swings the plug into your neck
  // (sparks, a jolt, the picture tears), then you dive into the screen.
  async function plugIn() {
    setMode('moving');
    if (world.link.state !== 'plugged') {
      // sit down, glancing right at the arm as it comes for you
      await flyP(currentPose(), chairPose(V(0.32, 1.06, -0.12)), { ms: 1300, arc: 0.05 });
      await world.link.plugIn();
      glitch.classList.remove('is-on');
      void glitch.offsetWidth;
      glitch.classList.add('is-on');
      await sleep(380);
    }
    await flyP(currentPose(), monitorPose(), { ms: 1150 });
  }

  // ---------------------------------------------------------------- enter (back to the origin page)

  // Esc / back button: return to the page you jacked out of. Goes back in
  // history if we added an entry, so the back button stays in sync.
  function leave() {
    if (!active || entering) return;
    if (pushedHistory && location.hash === '#world') history.back(); // popstate → enter()
    else { history.replaceState(null, '', origin.url); enter(); }
  }

  async function enter() {
    if (!active || entering) return;
    entering = true;
    busy = true;
    token++;
    setHover(null);
    ui.classList.remove('is-on');
    if (mode === 'phone') await lowerPhone({ ms: 300 });
    if (kind === 'app') await enterApp();
    else await enterScreen();
    detach();
    onReturn();
  }

  async function enterScreen() {
    if (mon.url !== origin.url) {
      putOnMonitor(surface, origin.url, origin.title);
      screenEl.scrollTop = restore.scrollY;
    }
    await plugIn();
    if (kind === 'terminal') {
      surface.classList.remove('crt-on');
      void surface.offsetWidth;
      surface.classList.add('crt-on');
    }
    const y = screenEl.scrollTop;
    restore.parent.insertBefore(surface, restore.next);
    restore.scrollY = y;
  }

  // A look at the books, lean in, and the reading app fades back up.
  async function enterApp() {
    setMode('moving');
    await flyP(currentPose(), seatPose(GAZE.books), { ms: 800 });
    fly(currentPose(), { pos: CHAIR.clone().lerp(GAZE.books, 0.4), look: GAZE.books.clone(), fov: CHAIR_FOV }, () => {}, { ms: 1200 });
    renderer.domElement.classList.remove('is-on');
    for (const el of hiddenApp) el.classList.remove('world-hidden');
    await sleep(800);
    restore.scrollY = 0;
  }

  function detach() {
    cancelAnimationFrame(raf);
    renderer.domElement.remove();
    cssRenderer.domElement.remove();
    glitch.remove();
    ui.remove();
    tip.remove();
    document.documentElement.classList.remove('in-world');
    window.scrollTo(0, restore.scrollY);
    document.title = origin.title;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    setMode('moving');
    phoneObject.visible = false;
    phone.object.position.copy(phone.object.userData.rest.position);
    phone.object.quaternion.copy(phone.object.userData.rest.quaternion);
    active = false;
    pushedHistory = false;
    busy = false;
    entering = false;
    hold = null;
    flight = null;
    mon = { url: null, title: '' };
    screenObject.visible = false;
  }

  window.addEventListener('popstate', () => {
    if (location.hash === '#world' && !active) exit();
    else if (location.hash !== '#world' && active) enter();
  });

  world.link.onJolt = (amount) => { shake = Math.max(shake, amount); };
  return { exit, visit, enter: leave, peek, get active() { return active; } };
}
