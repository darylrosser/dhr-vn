// World mode: the terminal is a monitor on a desk in a warehouse.
//
// The geometry here is a procedural blockout (boxes, canvas-texture neon) until
// the Blender scene exists. The mechanism is the real thing: the live terminal
// DOM is re-parented onto the monitor with CSS3DRenderer, the camera starts
// exactly where the screen fills the viewport, then pulls back. Swap
// buildWarehouse() for a GLTF load later and keep the rest.

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const START_FOV = 40;
const WORLD_POSE = { pos: new THREE.Vector3(1.5, 1.75, 3.5), look: new THREE.Vector3(-0.3, 1.55, -1.2), fov: 52 };
// Portrait screens see a narrow slice horizontally: stand further back.
const WORLD_POSE_PORTRAIT = { pos: new THREE.Vector3(1.0, 1.8, 5.2), look: new THREE.Vector3(-0.3, 1.55, -1.2), fov: 58 };
const worldPose = () => (innerWidth / innerHeight < 0.9 ? WORLD_POSE_PORTRAIT : WORLD_POSE);
const FLIGHT_MS = 2300;
const DESK_TOP = 0.775;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Yield between build steps (setTimeout, not rAF, so it also progresses in a background tab).
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export async function createWorld({ rig, reducedMotion, readingUrl, onStatus, onEnter }) {
  onStatus('syncing 20%');
  await nextFrame();

  // ---------------------------------------------------------------- renderers

  let fit = null; // current monitor size + start pose, set by fitMonitor()

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04050a');
  scene.fog = new THREE.FogExp2('#05060b', 0.075);

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
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.25);
  composer.addPass(bloom);
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
  const world = buildWarehouse(scene, readingUrl);
  onStatus('syncing 75%');
  await nextFrame();

  // Warm up shaders now so the first exit doesn't stutter.
  fitMonitor(innerWidth / innerHeight);
  camera.position.copy(WORLD_POSE.pos);
  camera.lookAt(WORLD_POSE.look);
  renderer.compile(scene, camera);
  composer.render();
  onStatus('syncing 95%');

  // ---------------------------------------------------------------- overlay UI

  const ui = document.createElement('div');
  ui.className = 'world-ui';
  ui.innerHTML = `
    <button type="button" data-act="enter">◂ Jack back in</button>
    <a href="${readingUrl}">Bookshelf: reading room →</a>
    <p class="world-hint">Blockout preview // click the monitor or press Esc to return</p>`;
  ui.querySelector('[data-act="enter"]').addEventListener('click', () => leave());

  const tip = document.createElement('div');
  tip.className = 'world-tip';

  // ---------------------------------------------------------------- monitor fit

  // Size the monitor so its screen has the viewport's aspect ratio: the
  // terminal is shown 1:1, so the handoff is seamless at any window size.
  function fitMonitor(aspect) {
    const w = Math.min(0.64, 0.56 * aspect);
    const h = w / aspect;
    const center = new THREE.Vector3(0, Math.max(1.12, DESK_TOP + 0.09 + h / 2 + 0.035), -0.12);
    world.shapeMonitor(w, h, center);
    const d = (h / 2) / Math.tan(THREE.MathUtils.degToRad(START_FOV / 2));
    fit = { w, h, center, startPos: center.clone().add(new THREE.Vector3(0, 0, d)) };
    return fit;
  }

  // ---------------------------------------------------------------- camera flight

  const look = new THREE.Vector3();
  let flight = null;

  function fly(from, to, done) {
    if (reducedMotion) {
      setPose(to.pos, to.look, to.fov);
      done();
      return;
    }
    flight = { from, to, start: performance.now(), done };
  }

  function setPose(pos, target, fov) {
    camera.position.copy(pos);
    look.copy(target);
    camera.lookAt(look);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function stepFlight(now) {
    const t = Math.min(1, (now - flight.start) / FLIGHT_MS);
    const k = ease(t);
    const { from, to } = flight;
    const pos = from.pos.clone().lerp(to.pos, k);
    pos.y += Math.sin(Math.PI * k) * 0.12; // a slight arc, like stepping back and up
    setPose(pos, from.look.clone().lerp(to.look, k), from.fov + (to.fov - from.fov) * k);
    if (t >= 1) {
      const { done } = flight;
      flight = null;
      done();
    }
  }

  // ---------------------------------------------------------------- pointer + hotspots

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const parallax = new THREE.Vector2(0, 0);
  let hovered = null;
  let settled = false; // true once the camera has arrived in the world

  function onPointerMove(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    if (!settled || screenEl.contains(e.target) || ui.contains(e.target)) return setHover(null);
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
    tip.textContent = hovered ? hovered.userData.hotspot.label : '';
    tip.classList.toggle('is-on', !!hovered);
    renderer.domElement.style.cursor = hovered ? 'pointer' : '';
  }

  function onClick(e) {
    if (!settled || !hovered || screenEl.contains(e.target) || ui.contains(e.target)) return;
    const spot = hovered.userData.hotspot;
    if (spot.action === 'enter') leave();
    else if (spot.href) window.location.href = spot.href;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); leave(); }
  }

  // ---------------------------------------------------------------- loop

  let active = false;
  let busy = false;      // exit is setting up / flying out
  let entering = false;  // flying back to the screen
  let raf = 0;
  let pushedHistory = false;
  const clock = new THREE.Clock();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (flight) stepFlight(now);
    else if (settled) {
      // gentle parallax around the world pose
      parallax.lerp(pointer, 0.04);
      const pose = worldPose();
      const pos = pose.pos.clone().add(new THREE.Vector3(parallax.x * 0.22, parallax.y * 0.1, 0));
      setPose(pos, pose.look, pose.fov);
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
  }

  // ---------------------------------------------------------------- exit / enter

  let restore = null;

  function exit() {
    if (active || busy) return;
    busy = true;
    const W = innerWidth;
    const H = innerHeight;
    const { w, center, startPos } = fitMonitor(W / H);

    // Move the live terminal onto the monitor, keeping its scroll position.
    restore = { parent: rig.parentNode, next: rig.nextSibling };
    const scrollY = window.scrollY;
    screenEl.style.width = `${W}px`;
    screenEl.style.height = `${H}px`;
    screenEl.append(rig);
    screenObject.position.copy(center).add(new THREE.Vector3(0, 0, 0.001));
    screenObject.scale.setScalar(w / W);

    document.documentElement.classList.add('in-world');
    document.body.append(renderer.domElement, cssRenderer.domElement, ui, tip);
    onResize();
    setPose(startPos, center, START_FOV);
    cssRenderer.render(cssScene, camera);
    screenEl.scrollTop = scrollY;

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    if (location.hash !== '#world') { history.pushState({ world: true }, '', '#world'); pushedHistory = true; }

    active = true;
    clock.getDelta();
    raf = requestAnimationFrame(loop);
    fly({ pos: startPos, look: center, fov: START_FOV }, worldPose(), () => {
      settled = true;
      busy = false;
      ui.classList.add('is-on');
    });
  }

  // Leave via the UI / Esc / monitor: go back in history if we added an entry,
  // so the back button and these controls stay in sync.
  function leave() {
    if (!active || entering) return;
    if (pushedHistory && location.hash === '#world') history.back(); // popstate → enter()
    else { history.replaceState(null, '', location.pathname + location.search); enter(); }
  }

  // Also allowed mid-exit (back button during the flight): reverse from wherever the camera is.
  function enter() {
    if (!active || entering) return;
    entering = true;
    busy = true;
    settled = false;
    setHover(null);
    ui.classList.remove('is-on');
    fly({ pos: camera.position.clone(), look: look.clone(), fov: camera.fov }, { pos: fit.startPos, look: fit.center, fov: START_FOV }, () => {
      const y = screenEl.scrollTop;
      restore.parent.insertBefore(rig, restore.next);
      cancelAnimationFrame(raf);
      renderer.domElement.remove();
      cssRenderer.domElement.remove();
      ui.remove();
      tip.remove();
      document.documentElement.classList.remove('in-world');
      window.scrollTo(0, y);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      active = false;
      pushedHistory = false;
      busy = false;
      entering = false;
      onEnter();
    });
  }

  window.addEventListener('popstate', () => {
    if (location.hash === '#world' && !active) exit();
    else if (location.hash !== '#world' && active) enter();
  });

  return { exit, enter: leave, get active() { return active; } };
}

// ====================================================================
// Blockout warehouse. Everything below gets replaced by the Blender GLB.
// ====================================================================

function buildWarehouse(scene, readingUrl) {
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
  makeHotspot(monitor, 'Jack back in', { action: 'enter' }, [bezel, backHump, neck], '#ffb000');

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
  makeHotspot(shelf, 'Reading room →', { href: readingUrl }, null, '#ff9a3c', (on) => {
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
  const kinds = shuffle(Object.keys(SCREEN_PAINTERS), rand);
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
    const kind = kinds[(col * rowsY.length + row) % kinds.length];
    screens.push({ ctx: canvas.getContext('2d'), tex, paint: SCREEN_PAINTERS[kind], state: { seed: rand() * 1000 } });
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
    shapeMonitor,
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

function scanlines(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 160; y += 3) ctx.fillRect(0, y, 256, 1);
}

const F1_CODES = ['VER', 'NOR', 'LEC', 'PIA', 'HAM', 'RUS', 'SAI', 'ALO'];

const SCREEN_PAINTERS = {
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
