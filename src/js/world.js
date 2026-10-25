// World mode: the whole site is a warehouse. Every page has a place in it.
//
// The geometry here is a procedural blockout (boxes, canvas-texture neon) until
// the Blender scene exists. The mechanisms are the real thing:
// - Home: the live terminal DOM is re-parented onto the desk monitor with
//   CSS3DRenderer; the camera starts where the screen fills the viewport.
// - Every other page: the live page becomes a floating datapad over its place.
// - /reading/ (its own three.js app, kind 'app'): the app fades away and you're
//   standing at the warehouse bookshelf; going back to the library fades it in.
// - In the world, places are visited without reloads (pages fetched into the
//   datapad); "jack in" drops you into a page as a normal page again.
// Swap buildWarehouse() for a GLTF load later and keep the rest.

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const START_FOV = 40;
const FLIGHT_MS = 2300;
const DESK_TOP = 0.775;
const READING_URL = '/reading/';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const isPortrait = () => innerWidth / innerHeight < 0.9;

// Where each page lives. Poses are landscape; portrait screens step back along
// the view direction so the subject still fits.
const PLACES = {
  home: { url: '/', label: 'Desk', pos: V(1.5, 1.75, 3.5), look: V(-0.3, 1.55, -1.2), fov: 52, back: 1.7 },
  blog: { url: '/blog/', label: 'Blog', pos: V(0, 1.95, 1.0), look: V(0, 1.8, -2.75), fov: 50, back: 1.0 },
  about: { url: '/about/', label: 'Case file', pos: V(1.45, 1.6, 1.65), look: V(3.4, 1.5, 0.95), fov: 50, back: 1.0 },
  contact: { url: '/contact/', label: 'Lounge', pos: V(0.5, 1.55, 4.4), look: V(-2.3, 0.6, 2.6), fov: 50, back: 1.4 },
  reading: { url: READING_URL, label: 'Library', pos: V(-1.0, 1.4, 0.85), look: V(-2.9, 1.1, -0.55), fov: 50, back: 1.0 },
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

const PLUG_SVG = '<svg class="jack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 2.5v4.5M14.5 2.5v4.5"/><rect x="6.5" y="7" width="11" height="7.5" rx="1.5"/><path d="M12 14.5v2.5a4 4 0 0 1-4 4H4"/></svg>';

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
  scene.fog = new THREE.FogExp2('#05060b', 0.07);

  const camera = new THREE.PerspectiveCamera(START_FOV, innerWidth / innerHeight, 0.02, 80);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'world-gl';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.25));
  composer.addPass(new OutputPass());

  const cssScene = new THREE.Scene();
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(innerWidth, innerHeight);
  cssRenderer.domElement.className = 'world-css';

  const screenEl = document.createElement('div');
  screenEl.className = 'world-screen';
  const screenObject = new CSS3DObject(screenEl);
  cssScene.add(screenObject);

  onStatus('syncing 45%');
  await nextFrame();
  const world = buildWarehouse(scene);
  // Off the home page there's no live terminal to put on the monitor: it idles.
  if (kind !== 'terminal') world.setMonitorIdle();
  onStatus('syncing 75%');
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
    <nav class="world-hud" aria-label="Warehouse">${Object.entries(PLACES).map(([id, p]) => `<button type="button" data-place="${id}">${p.label}</button>`).join('')}</nav>
    <button type="button" class="world-leave" data-act="leave">${PLUG_SVG}<span>Jack back in</span></button>
    <p class="world-hint">Blockout preview // click things in the room · Esc closes · Esc again goes back</p>`;
  ui.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'leave') leave();
    else if (b.dataset.place) visit(PLACES[b.dataset.place].url);
  });
  function markHud() {
    for (const b of ui.querySelectorAll('[data-place]')) b.setAttribute('aria-current', String(b.dataset.place === current));
  }

  const tip = document.createElement('div');
  tip.className = 'world-tip';

  // ---------------------------------------------------------------- datapad

  const datapad = document.createElement('section');
  datapad.className = 'datapad';
  datapad.setAttribute('aria-label', 'Datapad');
  datapad.innerHTML = `
    <header class="datapad-bar">
      <span class="datapad-title"></span>
      <button type="button" data-act="jackin" title="Open this page normally">${PLUG_SVG}<span>Jack in</span></button>
      <button type="button" data-act="close" aria-label="Close datapad">✕</button>
    </header>
    <div class="datapad-body"></div>`;
  const dpTitle = datapad.querySelector('.datapad-title');
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
    const w = Math.min(0.64, 0.56 * aspect);
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
    settled = false;
    markHud();
    await flyP(currentPose(), placePose(id), { ms: 1600, arc: 0.15, ...opts });
    if (current === id) settled = true;
  }

  // ---------------------------------------------------------------- pointer + hotspots

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const parallax = new THREE.Vector2(0, 0);
  let hovered = null;
  let settled = false; // camera at rest at a place (hover, parallax)

  const overUi = (target) => screenEl.contains(target) || ui.contains(target) || datapad.contains(target);

  function onPointerMove(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    if (!settled || entering || overUi(e.target)) return setHover(null);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(world.hotspots, true)[0];
    let node = hit && hit.object;
    while (node && !node.userData.hotspot) node = node.parent;
    setHover(node || null);
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
    if (kind === 'terminal') return current === 'home' ? 'Jack back in' : 'Terminal →';
    return 'Terminal: jack in →';
  }

  function onClick(e) {
    if (!settled || !hovered || overUi(e.target)) return;
    const spot = hovered.userData.hotspot;
    if (spot.action === 'monitor') {
      if (kind === 'terminal') { if (current === 'home') leave(); else visit('/'); }
      else jackInto('/');
    } else if (spot.visit) visit(spot.visit);
  }

  function onKey(e) {
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
      parallax.lerp(pointer, 0.04);
      const pose = placePose(current);
      setPose(pose.pos.add(V(parallax.x * 0.22, parallax.y * 0.1, 0)), pose.look, pose.fov);
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
    document.body.append(renderer.domElement, ...(kind === 'terminal' ? [cssRenderer.domElement] : []), datapad, ui, tip);
    onResize();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    if (location.hash !== '#world') { history.pushState({ world: true }, '', `${location.pathname}#world`); pushedHistory = true; }
    active = true;
    current = place;
    markHud();
    clock.getDelta();
    raf = requestAnimationFrame(loop);
  }

  function exit() {
    if (active || busy) return;
    busy = true;
    restore = { parent: surface.parentNode, next: surface.nextSibling, scrollY: window.scrollY };
    if (kind === 'terminal') exitTerminal();
    else if (kind === 'app') exitApp();
    else exitPage();
  }

  // The reading shelf app: fade it out and step back from the warehouse shelf.
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
      settled = true;
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
      settled = true;
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
      settled = true;
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
    const pageP = fetchPage(path).catch(() => null);
    if (current !== id || !dpOpen) { closeDatapad(); await flyTo(id); }
    const page = await pageP;
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
    settled = false;
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

// ====================================================================
// Blockout warehouse. Everything below gets replaced by the Blender GLB.
// ====================================================================

function buildWarehouse(scene) {
  const hotspots = [];
  const updaters = [];
  const rand = mulberry32(1993);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...o });
  const box = (w, h, d, material, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------------------------------------------------------------- room

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#0b0b0e', { roughness: 0.28, metalness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = mat('#0c0d12', { roughness: 0.9 });
  box(30, 10, 0.2, wallMat, 0, 5, -7.1);
  box(0.2, 10, 20, wallMat, -7.5, 5, 0);
  box(0.2, 10, 20, wallMat, 7.5, 5, 0);

  const steel = mat('#15171d', { roughness: 0.6, metalness: 0.6 });
  for (const x of [-4.5, 4.5]) for (const z of [-5.5, -1.5, 2.5]) box(0.35, 8, 0.35, steel, x, 4, z);
  for (const z of [-5.5, -1.5, 2.5]) box(15, 0.4, 0.3, steel, 0, 7.2, z);

  // big industrial window on the back wall, city glow behind it
  const glass = new THREE.MeshBasicMaterial({ color: '#0f2740', fog: false });
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0, 4, -6.98);
  scene.add(windowGroup);
  const winW = 10, winH = 5, cols = 8, rows = 4;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glass);
  windowGroup.add(pane);
  for (let i = 0; i <= cols; i++) box(0.06, winH, 0.06, steel, -winW / 2 + (winW / cols) * i, 0, 0.03, windowGroup);
  for (let j = 0; j <= rows; j++) box(winW, 0.06, 0.06, steel, 0, -winH / 2 + (winH / rows) * j, 0.03, windowGroup);
  // distant city lights
  const cityGeo = new THREE.BufferGeometry();
  const cityPts = [];
  for (let i = 0; i < 260; i++) cityPts.push((rand() - 0.5) * winW * 0.96, (rand() - 0.65) * winH * 0.9, 0.01);
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPts, 3));
  windowGroup.add(new THREE.Points(cityGeo, new THREE.PointsMaterial({ color: '#ffb86b', size: 0.04, fog: false, transparent: true, opacity: 0.8 })));

  // rain streaking past the window
  const rainCount = 420;
  const rainPos = new Float32Array(rainCount * 6);
  const rainSpeed = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const x = (rand() - 0.5) * winW, y = rand() * winH + 1.5, z = -6.7 - rand() * 0.2;
    rainPos.set([x, y, z, x - 0.02, y - 0.18, z], i * 6);
    rainSpeed[i] = 5 + rand() * 4;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  scene.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#6ea8c9', transparent: true, opacity: 0.35 })));
  updaters.push((t, dt) => {
    for (let i = 0; i < rainCount; i++) {
      const o = i * 6;
      let y = rainPos[o + 1] - rainSpeed[i] * dt;
      if (y < 1.5) y += winH;
      rainPos[o + 1] = y;
      rainPos[o + 4] = y - 0.18;
    }
    rainGeo.attributes.position.needsUpdate = true;
  });

  // ---------------------------------------------------------------- neon

  const sach = neonSign('SÁCH', '#2ad4c9', 1024, 320);
  sach.scale.setScalar(2.4);
  sach.position.set(-2.4, 3.6, -6.85);
  scene.add(sach);
  updaters.push((t) => {
    // a tired tube: mostly on, occasionally stutters
    const s = Math.sin(t * 13) + Math.sin(t * 7.3);
    sach.material.opacity = (t % 9 > 8.4 && s > 0.6) ? 0.25 : 1;
  });

  const dhr = neonSign('DHR.VN', '#ff7a1a', 1024, 240);
  dhr.scale.setScalar(1.5);
  dhr.position.set(4.2, 2.8, -2.6);
  dhr.rotation.y = -0.85;
  scene.add(dhr);

  for (const [x, color] of [[-4.5, '#2ad4c9'], [4.5, '#ff7a1a']]) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), toneMapped: false }));
    tube.position.set(x + (x < 0 ? 0.2 : -0.2), 2.2, -3.2);
    scene.add(tube);
    const glow = new THREE.PointLight(color, 1.6, 5, 2);
    glow.position.copy(tube.position);
    scene.add(glow);
  }

  // ---------------------------------------------------------------- lights

  scene.add(new THREE.HemisphereLight('#26324a', '#0a0705', 0.45));
  const windowLight = new THREE.DirectionalLight('#5fa8d3', 0.5);
  windowLight.position.set(0, 5, -8);
  scene.add(windowLight);

  const lamp = new THREE.SpotLight('#ffd9a0', 14, 7, 0.55, 0.65, 1.6);
  lamp.position.set(0.1, 3.2, 0.3);
  lamp.target.position.set(0, DESK_TOP, 0);
  scene.add(lamp, lamp.target);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 24, 1, true), mat('#1b1a17', { side: THREE.DoubleSide }));
  shade.position.set(0.1, 3.25, 0.3);
  scene.add(shade);
  box(0.01, 4, 0.01, steel, 0.1, 5.35, 0.3);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(4), toneMapped: false }));
  bulb.position.set(0.1, 3.18, 0.3);
  scene.add(bulb);

  // the screen's own amber spill onto the desk
  const screenGlow = new THREE.PointLight('#ffb000', 1.6, 2.5, 2);
  screenGlow.position.set(0, 1.1, 0.25);
  scene.add(screenGlow);

  // ---------------------------------------------------------------- desk

  const wood = mat('#2a2119', { roughness: 0.65 });
  box(1.8, 0.05, 0.85, wood, 0, DESK_TOP - 0.025, 0);
  for (const x of [-0.85, 0.85]) for (const z of [-0.37, 0.37]) box(0.05, DESK_TOP - 0.05, 0.05, steel, x, (DESK_TOP - 0.05) / 2, z);

  box(0.46, 0.025, 0.16, mat('#17171a', { roughness: 0.5 }), 0, DESK_TOP + 0.0125, 0.22);
  const keyGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb000').multiplyScalar(0.6), transparent: true, opacity: 0.35, toneMapped: false }));
  keyGlow.rotation.x = -Math.PI / 2;
  keyGlow.position.set(0, DESK_TOP + 0.026, 0.22);
  scene.add(keyGlow);

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 20), mat('#d9d2c3', { roughness: 0.4 }));
  mug.position.set(0.52, DESK_TOP + 0.05, 0.12);
  scene.add(mug);

  // to-read stack on the desk
  let stackY = DESK_TOP;
  for (let i = 0; i < 6; i++) {
    const h = 0.03 + rand() * 0.025;
    const b = box(0.22 + rand() * 0.05, h, 0.15 + rand() * 0.03, mat(bookColor(rand)), -0.62 + (rand() - 0.5) * 0.03, stackY + h / 2, 0.05);
    b.rotation.y = (rand() - 0.5) * 0.35;
    stackY += h;
  }

  // ---------------------------------------------------------------- the link: socket, plug, cable
  // You're "jacked in" while reading the terminal: a heavy plug sits in a desk
  // socket, cabled to the back of the monitor. Jacking out yanks it; jacking in
  // slams it home. p = 0 plugged … 1 lying on the desk.

  const SOCKET = new THREE.Vector3(0.36, DESK_TOP, 0.3);
  const SOCKET_TOP = SOCKET.clone().setY(DESK_TOP + 0.026);
  const metal = mat('#2c2e33', { roughness: 0.3, metalness: 0.9 });
  const rubber = mat('#121214', { roughness: 0.55, metalness: 0.15 });

  const socketBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.026, 32), metal);
  socketBase.position.set(SOCKET.x, DESK_TOP + 0.013, SOCKET.z);
  const socketHole = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), new THREE.MeshBasicMaterial({ color: '#000000' }));
  socketHole.rotation.x = -Math.PI / 2;
  socketHole.position.copy(SOCKET_TOP).add(new THREE.Vector3(0, 0.0005, 0));
  const ringMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const socketRing = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 8, 40), ringMat);
  socketRing.rotation.x = -Math.PI / 2;
  socketRing.position.copy(SOCKET_TOP);
  scene.add(socketBase, socketHole, socketRing);

  // plug: local origin at the pin tip, +y runs up to the cable
  const plug = new THREE.Group();
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.032, 20), metal);
  pin.position.y = 0.016;
  const plugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.075, 24), rubber);
  plugBody.position.y = 0.068;
  const collarMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0315, 0.0315, 0.006, 24), collarMat);
  collar.position.y = 0.045;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12), metal);
  grip.position.y = 0.09;
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.027, 0.045, 16), rubber);
  boot.position.y = 0.128;
  plug.add(pin, plugBody, collar, grip, boot);
  scene.add(plug);

  const PLUGGED = SOCKET_TOP.clone().add(new THREE.Vector3(0, -0.03, 0)); // pin buried in the socket
  const LIFTED = SOCKET_TOP.clone().add(new THREE.Vector3(0, 0.14, 0));
  const RESTING = new THREE.Vector3(0.53, DESK_TOP + 0.031, 0.43);
  let plugP = 0;

  function placePlug(p) {
    plugP = p;
    if (p <= 0.35) {
      plug.position.lerpVectors(PLUGGED, LIFTED, p / 0.35);
      plug.rotation.set(0, 0, 0);
    } else {
      const k = (p - 0.35) / 0.65;
      plug.position.lerpVectors(LIFTED, RESTING, k);
      plug.position.y += Math.sin(k * Math.PI) * 0.05;
      plug.rotation.set(0, k * 0.7, k * 1.52); // tips over and lies on its side
    }
    cableDirty = true;
  }

  // cable: monitor back → along the desk → up into the plug
  const monitorPort = new THREE.Vector3(0.06, DESK_TOP + 0.13, -0.3);
  let cable = null;
  let cableDirty = true;
  const up = new THREE.Vector3();
  function rebuildCable() {
    plug.updateMatrixWorld();
    const top = new THREE.Vector3(0, 0.148, 0).applyMatrix4(plug.matrixWorld);
    up.set(0, 1, 0).applyQuaternion(plug.quaternion);
    const out = top.clone().addScaledVector(up, 0.07);
    const lay = new THREE.Vector3(monitorPort.x + 0.07, DESK_TOP + 0.012, monitorPort.z + 0.1);
    const slack = new THREE.Vector3(Math.max(lay.x, out.x) + 0.1, DESK_TOP + 0.012, (lay.z + out.z) / 2 + 0.06);
    const near = new THREE.Vector3(out.x + 0.02, Math.max(DESK_TOP + 0.015, out.y - 0.05), out.z + 0.04);
    const curve = new THREE.CatmullRomCurve3([monitorPort, lay, slack, near, out, top], false, 'centripetal');
    if (cable) cable.geometry.dispose();
    else { cable = new THREE.Mesh(undefined, rubber); scene.add(cable); }
    cable.geometry = new THREE.TubeGeometry(curve, 80, 0.011, 8, false);
    cableDirty = false;
  }

  // sparks + a flash at the socket
  const SPARKS = 80;
  const sparkPos = new Float32Array(SPARKS * 3).fill(-50);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: new THREE.Color('#ffd27a').multiplyScalar(3), size: 0.009, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  })));
  const flash = new THREE.PointLight('#bff7ff', 0, 0.9, 2);
  flash.position.copy(SOCKET_TOP).add(new THREE.Vector3(0, 0.06, 0));
  scene.add(flash);

  function burst(n, speed, color) {
    flash.color.set(color);
    for (let i = 0, made = 0; i < SPARKS && made < n; i++) {
      if (sparkLife[i] > 0) continue;
      made++;
      const a = rand() * Math.PI * 2;
      const lift = 0.35 + rand() * 0.65;
      const v = speed * (0.4 + rand() * 0.9);
      sparkPos.set([SOCKET_TOP.x, SOCKET_TOP.y + 0.01, SOCKET_TOP.z], i * 3);
      sparkVel.set([Math.cos(a) * v * (1 - lift), v * lift, Math.sin(a) * v * (1 - lift)], i * 3);
      sparkLife[i] = 0.25 + rand() * 0.4;
    }
  }

  function setRing(connected) {
    ringMat.color.set(connected ? '#2ad4c9' : '#ff6a1a').multiplyScalar(2.2);
    collarMat.color.set(connected ? '#2ad4c9' : '#5a2a10').multiplyScalar(connected ? 2.2 : 1);
  }

  let anim = null; // { from, to, ms, t, easeFn, done }
  const link = {
    state: 'plugged', // 'plugged' | 'moving' | 'unplugged'
    onJolt: () => {},
    unplug(instant) {
      if (link.state !== 'plugged') return;
      setRing(false);
      if (instant) { placePlug(1); link.state = 'unplugged'; return; }
      link.state = 'moving';
      burst(22, 1.1, '#ffb000');
      flash.intensity = 0.8;
      link.onJolt(0.006);
      anim = { from: plugP, to: 1, ms: 650, t: 0, easeFn: (k) => 1 - Math.pow(1 - k, 3), done: () => { link.state = 'unplugged'; } };
    },
    plugIn() {
      return new Promise((resolve) => {
        if (link.state === 'plugged') { resolve(); return; }
        link.state = 'moving';
        // slow approach, then it accelerates into the socket
        anim = {
          from: plugP, to: 0, ms: 700, t: 0, easeFn: (k) => k * k * k,
          done: () => {
            link.state = 'plugged';
            setRing(true);
            burst(60, 1.6, '#bff7ff');
            flash.intensity = 1.6;
            resolve();
          },
        };
      });
    },
    setPlugged() { anim = null; placePlug(0); link.state = 'plugged'; setRing(true); },
    setUnplugged() { anim = null; placePlug(1); link.state = 'unplugged'; setRing(false); },
  };
  setRing(true);
  placePlug(0);

  updaters.push((t, dt) => {
    if (anim) {
      anim.t = Math.min(1, anim.t + (dt * 1000) / anim.ms);
      placePlug(anim.from + (anim.to - anim.from) * anim.easeFn(anim.t));
      if (anim.t >= 1) { const { done } = anim; anim = null; done(); }
    }
    if (cableDirty) rebuildCable();
    let alive = false;
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      alive = true;
      sparkLife[i] -= dt;
      const o = i * 3;
      sparkVel[o + 1] -= 4.2 * dt;
      sparkPos[o] += sparkVel[o] * dt;
      sparkPos[o + 1] += sparkVel[o + 1] * dt;
      sparkPos[o + 2] += sparkVel[o + 2] * dt;
      if (sparkPos[o + 1] < DESK_TOP + 0.003) { sparkPos[o + 1] = DESK_TOP + 0.003; sparkVel[o + 1] *= -0.35; sparkVel[o] *= 0.6; sparkVel[o + 2] *= 0.6; }
      if (sparkLife[i] <= 0) sparkPos[o + 1] = -50;
    }
    if (alive) sparkGeo.attributes.position.needsUpdate = true;
    flash.intensity *= Math.pow(0.002, dt);
    // unplugged: the socket ring blinks like it wants you back
    if (link.state === 'unplugged') ringMat.color.set('#ff6a1a').multiplyScalar(Math.sin(t * 6) > 0 ? 2.2 : 0.5);
  });

  // ---------------------------------------------------------------- monitor (hotspot)

  const monitor = new THREE.Group();
  scene.add(monitor);
  const shell = mat('#1a1814', { roughness: 0.45, metalness: 0.25 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shell);
  const backHump = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shell);
  const glassBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000000' }));
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.04), shell);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.18), shell);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2ad4c9').multiplyScalar(4), toneMapped: false }));
  monitor.add(bezel, backHump, glassBack, neck, base, led);
  makeHotspot(monitor, 'Terminal', { action: 'monitor' }, [bezel, backHump, neck], '#ffb000');

  // Off the home page the monitor shows a standby screen instead of the live terminal.
  function setMonitorIdle() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#060402';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = AMBER;
    ctx.font = '900 italic 64px Orbitron, "Arial Black", sans-serif';
    ctx.fillText('DHR.VN', 40, 120);
    ctx.font = '20px "Share Tech Mono", monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('DHR-OS 4.0.0 // TERMINAL STANDBY', 40, 175);
    ctx.fillStyle = TEAL;
    ctx.fillText('> JACK IN TO RESUME_', 40, 230);
    scanlinesBig(ctx, 512, 320);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    glassBack.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2) });
  }

  function shapeMonitor(w, h, c) {
    const frame = 0.035;
    bezel.scale.set(w + frame * 2, h + frame * 2, 0.05);
    bezel.position.set(c.x, c.y, c.z - 0.026);
    backHump.scale.set(w * 0.7, h * 0.7, 0.16);
    backHump.position.set(c.x, c.y, c.z - 0.13);
    glassBack.scale.set(w, h, 1);
    glassBack.position.set(c.x, c.y, c.z + 0.0005);
    const bottom = c.y - h / 2 - frame;
    const neckH = bottom - DESK_TOP;
    neck.scale.y = neckH;
    neck.position.set(c.x, DESK_TOP + neckH / 2, c.z - 0.1);
    base.position.set(c.x, DESK_TOP + 0.01, c.z - 0.08);
    led.position.set(c.x + w / 2 - 0.01, bottom + 0.012, c.z + 0.001);
    monitorPort.set(c.x + 0.06, DESK_TOP + 0.13, c.z - 0.2);
    cableDirty = true;
  }

  // ---------------------------------------------------------------- bookshelf (hotspot → reading)

  const shelf = new THREE.Group();
  shelf.position.set(-2.9, 0, -0.55);
  shelf.rotation.y = 0.95;
  scene.add(shelf);
  const shelfWood = mat('#2b2018', { roughness: 0.7 });
  const SW = 1.6, SH = 2.2, SD = 0.34, levels = 5;
  box(0.04, SH, SD, shelfWood, -SW / 2, SH / 2, 0, shelf);
  box(0.04, SH, SD, shelfWood, SW / 2, SH / 2, 0, shelf);
  box(SW, 0.04, SD, shelfWood, 0, SH, 0, shelf);
  box(SW, SH, 0.02, shelfWood, 0, SH / 2, -SD / 2, shelf);
  const levelH = SH / levels;
  for (let i = 0; i < levels; i++) box(SW, 0.03, SD, shelfWood, 0, i * levelH + 0.015, 0, shelf);

  // books: one InstancedMesh, ~170 spines
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: '#ff9a3c', emissiveIntensity: 0 });
  const books = new THREE.InstancedMesh(bookGeo, bookMat, 200);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let n = 0;
  for (let i = 0; i < levels; i++) {
    let x = -SW / 2 + 0.03;
    while (x < SW / 2 - 0.06 && n < 200) {
      const bw = 0.025 + rand() * 0.04;
      const bh = levelH * (0.6 + rand() * 0.3);
      const lean = rand() < 0.06 ? 0.25 : 0;
      q.setFromEuler(new THREE.Euler(0, 0, lean));
      m4.compose(new THREE.Vector3(x + bw / 2, i * levelH + 0.03 + bh / 2, 0.02), q, new THREE.Vector3(bw, bh, SD * (0.7 + rand() * 0.2)));
      books.setMatrixAt(n, m4);
      books.setColorAt(n, new THREE.Color(bookColor(rand)));
      n++;
      x += bw + (rand() < 0.08 ? 0.05 : 0.002);
    }
  }
  books.count = n;
  shelf.add(books);
  const shelfLight = new THREE.PointLight('#ff9a3c', 2.2, 3.2, 2);
  shelfLight.position.set(0.2, 1.9, 0.7);
  shelf.add(shelfLight);
  makeHotspot(shelf, 'Library: reading room →', { visit: READING_URL }, null, '#ff9a3c', (on) => {
    bookMat.emissiveIntensity = on ? 0.1 : 0;
    shelfLight.intensity = on ? 4 : 2.2;
  });

  // ---------------------------------------------------------------- the wall of screens
  // A curved Batcave-style array behind the desk, purely for show. Each screen
  // is a small canvas redrawn a few times a second (round-robin, 3 per frame).

  const wall = new THREE.Group();
  scene.add(wall);
  const WALL_R = 3.0, WALL_CZ = 0.25;
  const angles = [-48, -32, -16, 0, 16, 32, 48].map((d) => THREE.MathUtils.degToRad(d));
  const rowsY = [1.22, 1.84, 2.46];
  const SCR_W = 0.88, SCR_H = 0.56;
  const bezelMat = mat('#101114', { roughness: 0.5, metalness: 0.4 });
  const kinds = shuffle(Object.keys(SCREEN_PAINTERS).filter((k) => k !== 'blog'), rand);
  const screens = [];
  angles.forEach((a, col) => rowsY.forEach((y, row) => {
    const holder = new THREE.Group();
    holder.position.set(WALL_R * Math.sin(a), y, WALL_CZ - WALL_R * Math.cos(a));
    holder.rotation.y = -a;
    holder.rotation.x = row === 2 ? 0.12 : row === 0 ? -0.05 : 0; // top row tilts down at you
    wall.add(holder);
    box(SCR_W + 0.05, SCR_H + 0.05, 0.06, bezelMat, 0, 0, -0.035, holder);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(SCR_W, SCR_H),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }),
    );
    holder.add(face);
    const isBlog = col === 3 && row === 1; // the blog lives on the centre screen
    const kind = isBlog ? 'blog' : kinds[(col * rowsY.length + row) % kinds.length];
    screens.push({ ctx: canvas.getContext('2d'), tex, paint: SCREEN_PAINTERS[kind], state: { seed: rand() * 1000 } });
    if (isBlog) {
      makeHotspot(holder, 'Blog: field reports →', { visit: '/blog/' }, null, TEAL, (on) => {
        face.material.color.setScalar(on ? 1.8 : 1.25);
      });
    }
  }));
  // support truss behind the array
  box(5.6, 0.08, 0.08, steel, 0, 2.82, WALL_CZ - WALL_R - 0.25);
  box(5.6, 0.08, 0.08, steel, 0, 0.88, WALL_CZ - WALL_R - 0.25);
  for (const [x, color] of [[-1.3, '#2ad4c9'], [1.3, '#ffb000']]) {
    const spill = new THREE.PointLight(color, 1.4, 4, 2);
    spill.position.set(x, 2, -1.2);
    scene.add(spill);
  }
  for (const sc of screens) { sc.paint(sc.ctx, 0, sc.state); sc.tex.needsUpdate = true; }
  let screenCursor = 0;
  updaters.push((t) => {
    for (let i = 0; i < 3; i++) {
      const sc = screens[screenCursor];
      screenCursor = (screenCursor + 1) % screens.length;
      sc.paint(sc.ctx, t, sc.state);
      sc.tex.needsUpdate = true;
    }
  });

  // ---------------------------------------------------------------- evidence board (hotspot → about)

  const board = new THREE.Group();
  board.position.set(3.4, 0, 0.95);
  board.rotation.y = -1.25;
  scene.add(board);
  const cork = mat('#5c4128', { roughness: 0.95 });
  box(1.8, 1.15, 0.04, cork, 0, 1.55, 0, board);
  box(1.9, 0.05, 0.06, steel, 0, 2.15, 0.01, board);
  box(1.9, 0.05, 0.06, steel, 0, 0.95, 0.01, board);
  box(0.05, 1.6, 0.05, steel, -0.8, 0.8, -0.05, board);
  box(0.05, 1.6, 0.05, steel, 0.8, 0.8, -0.05, board);
  const pins = [];
  const paper = ['#d9d2c3', '#c9b98f', '#e8e2d4', '#9c8f78'];
  for (let i = 0; i < 9; i++) {
    const w = 0.18 + rand() * 0.14;
    const h = 0.13 + rand() * 0.16;
    const x = -0.72 + (i % 3) * 0.5 + (rand() - 0.5) * 0.14;
    const y = 1.2 + Math.floor(i / 3) * 0.33 + (rand() - 0.5) * 0.06;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(i === 4 ? '#2a2e33' : paper[i % paper.length], { roughness: 0.9 }));
    card.position.set(x, y, 0.025);
    card.rotation.z = (rand() - 0.5) * 0.12;
    board.add(card);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(1.4), toneMapped: false }));
    pin.position.set(x, y + h / 2 - 0.02, 0.035);
    board.add(pin);
    pins.push(pin.position.clone());
  }
  // red string between the clues
  const stringPts = [];
  for (const [a, b] of [[0, 4], [4, 8], [2, 4], [4, 6], [1, 5], [3, 7]]) stringPts.push(pins[a], pins[b]);
  board.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stringPts), new THREE.LineBasicMaterial({ color: new THREE.Color('#ff3030').multiplyScalar(1.3), toneMapped: false })));
  const boardLight = new THREE.SpotLight('#ffd9a0', 4, 4, 0.6, 0.7, 1.5);
  boardLight.position.set(-1.0, 2.9, 1.2);
  boardLight.target.position.set(0, 1.55, 0);
  board.add(boardLight, boardLight.target);
  // the VK machine on a cart beside it
  box(0.5, 0.75, 0.4, steel, 1.25, 0.375, 0.2, board);
  const vk = box(0.42, 0.18, 0.32, mat('#1a1c20', { roughness: 0.4, metalness: 0.5 }), 1.25, 0.84, 0.2, board);
  const vkEye = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAL).multiplyScalar(2), toneMapped: false }));
  vkEye.position.set(1.25, 0.88, 0.37);
  board.add(vkEye);
  updaters.push((t) => { vkEye.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2.2)); });
  makeHotspot(board, 'Case file: about →', { visit: '/about/' }, [vk], '#ffb000', (on) => {
    boardLight.intensity = on ? 7 : 4;
  });

  // ---------------------------------------------------------------- lounge (hotspot → contact)

  const lounge = new THREE.Group();
  lounge.position.set(-2.5, 0, 2.7);
  lounge.rotation.y = 1.35;
  scene.add(lounge);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), mat('#3a1c17', { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.005;
  lounge.add(rug);
  const leather = mat('#4a2a1a', { roughness: 0.45, metalness: 0.05 });
  const sofa = new THREE.Group();
  sofa.position.set(0, 0, -0.45);
  lounge.add(sofa);
  box(1.9, 0.38, 0.8, leather, 0, 0.24, 0, sofa);
  box(1.9, 0.5, 0.18, leather, 0, 0.62, -0.31, sofa);
  box(0.18, 0.32, 0.8, leather, -0.95, 0.5, 0, sofa);
  box(0.18, 0.32, 0.8, leather, 0.95, 0.5, 0, sofa);
  for (const x of [-0.45, 0.45]) box(0.85, 0.1, 0.62, mat('#56301e', { roughness: 0.5 }), x, 0.48, 0.06, sofa);
  // low table, a record player, a floor lamp
  box(0.9, 0.04, 0.5, wood, 0, 0.36, 0.45, lounge);
  for (const x of [-0.4, 0.4]) for (const z of [0.25, 0.65]) box(0.03, 0.34, 0.03, steel, x, 0.17, z, lounge);
  box(0.36, 0.08, 0.3, mat('#2a1f18', { roughness: 0.5 }), -0.15, 0.42, 0.45, lounge);
  const record = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.008, 32), mat('#050505', { roughness: 0.3 }));
  record.position.set(-0.15, 0.465, 0.45);
  lounge.add(record);
  updaters.push((t) => { record.rotation.y = t * 3.5; });
  box(0.025, 1.5, 0.025, steel, 1.15, 0.75, -0.55, lounge);
  const loungeShade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb46a').multiplyScalar(1.5), side: THREE.DoubleSide, toneMapped: false }));
  loungeShade.position.set(1.15, 1.55, -0.55);
  lounge.add(loungeShade);
  const loungeLight = new THREE.PointLight('#ffb46a', 3, 4, 2);
  loungeLight.position.set(1.15, 1.45, -0.4);
  lounge.add(loungeLight);
  makeHotspot(lounge, 'Lounge: get in touch →', { visit: '/contact/' }, null, '#ffb46a', (on) => {
    loungeLight.intensity = on ? 5 : 3;
  });

  // ---------------------------------------------------------------- dust in the lamp light

  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) dustPos.set([(rand() - 0.5) * 2.4, DESK_TOP + rand() * 2.4, (rand() - 0.5) * 2], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffd9a0', size: 0.008, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);
  updaters.push((t) => { dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.03; });

  // ---------------------------------------------------------------- helpers

  function makeHotspot(object, label, opts, meshes, color, onHighlight) {
    const tint = new THREE.Color(color);
    const targets = meshes || [];
    object.userData.hotspot = {
      label,
      ...opts,
      highlight(on) {
        for (const m of targets) {
          m.material.emissive.copy(tint);
          m.material.emissiveIntensity = on ? 0.18 : 0;
        }
        if (onHighlight) onHighlight(on);
      },
    };
    hotspots.push(object);
  }

  return {
    hotspots,
    link,
    shapeMonitor,
    setMonitorIdle,
    update(t, dt) { for (const u of updaters) u(t, dt); },
  };
}

// ---------------------------------------------------------------- screen wall content
// Each painter draws one 256×160 frame at time t. Pure decoration, so: fake data,
// but personal fake data (Saigon, F1, the book pile).

const AMBER = '#ffb000', TEAL = '#2ad4c9', HOT = '#ff6a1a', DIM = '#6b4c12';

function screenBase(ctx, title) {
  ctx.fillStyle = '#050402';
  ctx.fillRect(0, 0, 256, 160);
  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = DIM;
  ctx.fillText(title, 8, 6);
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 255, 159);
}

function scanlinesBig(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
}

function scanlines(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 160; y += 3) ctx.fillRect(0, y, 256, 1);
}

const F1_CODES = ['VER', 'NOR', 'LEC', 'PIA', 'HAM', 'RUS', 'SAI', 'ALO'];

const SCREEN_PAINTERS = {
  blog(ctx, t) {
    screenBase(ctx, 'TRANSMISSIONS // BLOG');
    ctx.fillStyle = AMBER;
    ctx.font = '26px "Share Tech Mono", monospace';
    ctx.fillText('FIELD REPORTS', 10, 28);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = TEAL;
    ctx.fillText('LATEST:', 10, 76);
    ctx.fillStyle = AMBER;
    ctx.fillText('ENGLISH BOOKS IN SAIGON', 10, 92);
    ctx.fillText('19 STORES // 400 BOOKS', 10, 106);
    if (Math.sin(t * 4) > -0.2) { ctx.fillStyle = TEAL; ctx.fillText('> OPEN_', 10, 140); }
    scanlines(ctx);
  },
  scope(ctx, t, s) {
    screenBase(ctx, 'SIG // CH-2');
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 256; x += 2) {
      const y = 85 + Math.sin(x * 0.06 + t * 4 + s.seed) * 26 * Math.sin(t * 0.7 + x * 0.01) + Math.sin(x * 0.31 + t * 9) * 5;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    scanlines(ctx);
  },
  bars(ctx, t, s) {
    screenBase(ctx, 'LOAD // SECTOR 7');
    s.v = s.v || Array.from({ length: 14 }, () => Math.random());
    s.v = s.v.map((v) => Math.min(1, Math.max(0.05, v + (Math.random() - 0.5) * 0.15)));
    s.v.forEach((v, i) => {
      ctx.fillStyle = v > 0.85 ? HOT : AMBER;
      ctx.fillRect(10 + i * 17, 150 - v * 120, 12, v * 120);
    });
    scanlines(ctx);
  },
  code(ctx, t, s) {
    screenBase(ctx, 'TTY3 // DECRYPT');
    ctx.fillStyle = AMBER;
    const off = Math.floor(t * 6 + s.seed);
    for (let i = 0; i < 11; i++) {
      let line = '';
      let k = (off + i) * 2654435761;
      for (let j = 0; j < 8; j++) { k = (k * 1103515245 + 12345) >>> 0; line += (k >>> 16 & 0xffff).toString(16).padStart(4, '0') + ' '; }
      ctx.fillStyle = i === 10 ? TEAL : AMBER;
      ctx.fillText(line.toUpperCase(), 8, 22 + i * 12);
    }
    scanlines(ctx);
  },
  radar(ctx, t, s) {
    screenBase(ctx, 'RAIN RADAR // SGN');
    const cx = 128, cy = 86, r = 62, a = t * 1.6 + s.seed;
    ctx.strokeStyle = DIM;
    for (const rr of [20, 41, 62]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    s.blips = s.blips || Array.from({ length: 9 }, () => [Math.random() * Math.PI * 2, 10 + Math.random() * 50]);
    for (const [ba, br] of s.blips) {
      const age = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      ctx.fillStyle = `rgba(42,212,201,${Math.max(0, 1 - age / 3)})`;
      ctx.fillRect(cx + Math.cos(ba) * br - 2, cy + Math.sin(ba) * br - 2, 5, 5);
    }
    ctx.fillStyle = AMBER;
    ctx.fillText('PRECIP 98%', 186, 146);
    scanlines(ctx);
  },
  map(ctx, t, s) {
    screenBase(ctx, 'SAIGON // DISTRICT 1');
    if (!s.roads) {
      const r = mulberry32(Math.floor(s.seed));
      s.roads = Array.from({ length: 26 }, () => [r() * 256, 18 + r() * 142, r() * 256, 18 + r() * 142]);
      s.dots = Array.from({ length: 7 }, () => [20 + r() * 216, 30 + r() * 120]);
    }
    ctx.strokeStyle = DIM;
    for (const [a, b, c, d] of s.roads) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, 150); ctx.bezierCurveTo(90, 120, 120, 60, 230, 30); ctx.stroke();
    s.dots.forEach(([x, y], i) => {
      if (Math.sin(t * 3 + i * 1.7) > -0.3) { ctx.fillStyle = i ? TEAL : HOT; ctx.fillRect(x - 3, y - 3, 6, 6); }
    });
    ctx.fillStyle = AMBER;
    ctx.fillText('BOOKSHOPS TRACKED: 19', 8, 146);
    scanlines(ctx);
  },
  timing(ctx, t, s) {
    screenBase(ctx, 'F1 // LIVE TIMING');
    s.gaps = s.gaps || F1_CODES.map((_, i) => i * 1.4 + Math.random());
    s.gaps = s.gaps.map((g, i) => (i ? Math.max(0.1, g + (Math.random() - 0.5) * 0.05) : 0));
    F1_CODES.forEach((c, i) => {
      const y = 22 + i * 17;
      ctx.fillStyle = i < 3 ? TEAL : AMBER;
      ctx.fillText(`P${i + 1}`, 10, y);
      ctx.fillText(c, 40, y);
      ctx.fillStyle = AMBER;
      ctx.fillText(i ? `+${s.gaps[i].toFixed(3)}` : 'LEADER', 180, y);
    });
    scanlines(ctx);
  },
  library(ctx) {
    screenBase(ctx, 'LIBRARY // INVENTORY');
    ctx.fillStyle = AMBER;
    ctx.font = '26px "Share Tech Mono", monospace';
    ctx.fillText('412', 10, 24);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('VOLUMES', 64, 38);
    [['BUSINESS BIO', 47.5], ['SCI-FI', 17.7], ['HISTORY', 11.2], ['TO-READ', 63]].forEach(([k, v], i) => {
      const y = 70 + i * 21;
      ctx.fillStyle = DIM;
      ctx.fillText(k, 10, y);
      ctx.fillRect(110, y + 2, 136, 7);
      ctx.fillStyle = k === 'TO-READ' ? HOT : TEAL;
      ctx.fillRect(110, y + 2, 136 * v / 100, 7);
    });
    scanlines(ctx);
  },
  reticle(ctx, t) {
    screenBase(ctx, 'VK-7 // SUBJECT LOCK');
    ctx.save();
    ctx.translate(128, 86);
    ctx.rotate(t * 0.8);
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, 44, 0.2, 1.2); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = AMBER;
    ctx.beginPath(); ctx.moveTo(128, 50); ctx.lineTo(128, 122); ctx.moveTo(92, 86); ctx.lineTo(164, 86); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 5) > 0 ? HOT : DIM;
    ctx.fillText('MATCH 99.2%', 176, 146);
    scanlines(ctx);
  },
  cctv(ctx, t, s) {
    const img = ctx.createImageData(256, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 90;
      img.data[i] = v; img.data[i + 1] = v * 0.7; img.data[i + 2] = v * 0.3; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = AMBER;
    ctx.fillText(`CAM 0${1 + Math.floor(s.seed) % 8} // LOADING DOCK`, 8, 6);
    if (Math.sin(t * 4) > 0) { ctx.fillStyle = HOT; ctx.fillText('● REC', 210, 6); }
    scanlines(ctx);
  },
  clock(ctx) {
    screenBase(ctx, 'LOCAL // ICT UTC+7');
    const now = new Date(Date.now() + (7 * 60 + new Date().getTimezoneOffset()) * 60000);
    ctx.fillStyle = AMBER;
    ctx.font = '40px "Share Tech Mono", monospace';
    ctx.fillText(now.toTimeString().slice(0, 8), 26, 52);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = TEAL;
    ctx.fillText('SAIGON // 31°C // RAIN', 60, 120);
    scanlines(ctx);
  },
  spectrum(ctx, t, s) {
    screenBase(ctx, 'AUDIO // WATER RIGHTS');
    for (let i = 0; i < 32; i++) {
      const v = Math.abs(Math.sin(t * 3 + i * 0.5 + s.seed) * Math.sin(t * 1.3 + i * 0.21)) * 110 + 6;
      for (let y = 0; y < v; y += 5) {
        ctx.fillStyle = y > 80 ? HOT : y > 50 ? AMBER : TEAL;
        ctx.fillRect(8 + i * 7.6, 150 - y, 6, 3);
      }
    }
    scanlines(ctx);
  },
  syslog(ctx, t, s) {
    screenBase(ctx, 'SYSLOG // DHR-OS');
    const lines = ['SPINNER 7 DEPARTING', 'BOOK BUDGET EXCEEDED', 'COFFEE RESERVES 61%', 'CHIHUAHUA: DEFECTIVE', 'UPLINK STABLE', 'OFF-WORLD AD QUEUED', 'MORATORIUM: IGNORED', 'RAIN: CONTINUOUS', 'OWL: ARTIFICIAL'];
    const off = Math.floor(t * 1.5 + s.seed);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i === 9 ? TEAL : AMBER;
      ctx.fillText(`> ${lines[(off + i) % lines.length]}`, 8, 22 + i * 13);
    }
    scanlines(ctx);
  },
};

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function neonSign(text, color, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = `700 ${Math.round(h * 0.62)}px Orbitron, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = color;
  ctx.lineWidth = h * 0.035;
  ctx.shadowColor = color;
  ctx.shadowBlur = h * 0.12;
  for (let i = 0; i < 3; i++) ctx.strokeText(text, w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = h * 0.012;
  ctx.strokeText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15), fog: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, h / w), material);
}

function bookColor(rand) {
  const palette = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#1d1d22', '#8a3a1a', '#24504f', '#b08a4a'];
  return palette[Math.floor(rand() * palette.length)];
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
