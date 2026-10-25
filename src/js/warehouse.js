// The workshop: one room built and baked in Blender (blender/), loaded as a
// GLB (Meshopt geometry, KTX2 textures, baked lighting → unlit materials),
// fading up out of the dark as it arrives.
//
// JS still owns the live parts: the home monitor (sized to the viewport), the
// link (desk socket, plug, cable, sparks), what the screens and TVs show, the
// hazy view out of the window, neon flicker and the sunbeam. The GLB says
// where those go through glTF extras (three userData):
//   role: 'screen' (col, row, painter?, tint?) | 'window' (w, h) | 'flicker'
//         | 'spin' (speed) | 'pulse' | 'shaft' (r, h, top, sides, color, opacity)
//         | 'board' (canvas, w, h) | 'display' (painter)
//   hotspot: a key of HOTSPOTS below → the hotspot contract.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DESK_TOP = 0.775;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The Blender zones (blender/zones/*.py); each is built in world space.
export const ZONES = { workshop: {} };

// What clicking a thing in the room does (hotspot contract labels + targets).
// `prompt` is the action offered when you walk up to it ([E] …).
const HOTSPOTS = {
  blog: { label: 'Blog: field reports →', prompt: 'Read the blog', reach: 4.3, visit: '/blog/' },
  about: { label: 'Case file: about →', prompt: 'Open the case file', visit: '/about/' },
  reading: { label: 'Bookshelf: reading list →', prompt: 'Browse the books', visit: '/reading/' },
  contact: { label: 'Payphone: get in touch →', prompt: 'Make a call', visit: '/contact/' },
  garage: { label: 'Time machine: projects (coming soon)', prompt: 'Projects: coming soon', action: 'place', place: 'garage' },
};

const AMBER = '#ffb000', TEAL = '#2ad4c9', HOT = '#ff6a1a', DIM = '#6b4c12';

// three's addons live wherever the page's import map says (0.170 on the site,
// 0.158 on /reading/): the Basis transcoder is next to them.
function addonsBase() {
  try {
    const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent);
    return map.imports['three/addons/'];
  } catch (e) {
    return `https://cdn.jsdelivr.net/npm/three@0.${THREE.REVISION}.0/examples/jsm/`;
  }
}

// models ship next to the scripts, with the same cache-busting version
const modelUrl = (file) => new URL(`../models/${file}${new URL(import.meta.url).search}`, import.meta.url).href;

// Lightmaps store light / LM in sRGB (blender/lib.py); Cycles' diffuse light ×
// albedo is the outgoing radiance, three divides irradiance by π, and the
// bake looks right a touch brighter than physical.
const LIGHTMAP_GAIN = Math.PI * 1.25;

export function createWarehouse(scene, renderer, { reducedMotion = false, camera } = {}) {
  const hotspots = [];
  const updaters = [];
  const rand = mulberry32(1993);

  const ktx2 = new KTX2Loader().setTranscoderPath(`${addonsBase()}libs/basis/`).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  // dark ground under the baked floor, for the moment before the room arrives
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: '#06070a' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // The zones' diffuse light is baked (lightmaps). Live light is only what the
  // bake can't do: the desk lamp's highlights on wet and shiny things, the
  // screen's spill on the JS-built monitor and plug, and reflections (an
  // environment of the bright window, warm bulbs and screens, blurred).
  const lamp = new THREE.SpotLight('#ffd9a0', 5, 7, 0.75, 0.65, 1.6);
  lamp.position.set(0.1, 3.15, 0.3);
  lamp.target.position.set(0, DESK_TOP, 0);
  scene.add(lamp, lamp.target);
  const screenGlow = new THREE.PointLight('#ffb000', 0.6, 2.5, 2);
  screenGlow.position.set(0, 1.1, 0.25);
  scene.add(screenGlow);
  // one spare spotlight for a zone that asks for live highlights (the garage's
  // lamp on the stainless car); made up front so loading it recompiles nothing
  const spareSpot = new THREE.SpotLight('#ffffff', 0, 9, 0.6, 0.5, 1.6);
  scene.add(spareSpot, spareSpot.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(workshopRoom(), 0.035).texture;
  pmrem.dispose();

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...o });

  // ---------------------------------------------------------------- the link: socket, plug, cable
  // You're "jacked in" while reading the terminal: a heavy plug sits in a desk
  // socket, cabled to the back of the monitor. Jacking out yanks it; jacking in
  // slams it home. p = 0 plugged … 1 lying on the desk.

  const SOCKET = new THREE.Vector3(0.36, DESK_TOP, 0.3);
  const SOCKET_TOP = SOCKET.clone().setY(DESK_TOP + 0.026);
  const metal = mat('#2c2e33', { roughness: 0.3, metalness: 0.9, envMapIntensity: 0.6 });
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
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: new THREE.Color('#ffd27a').multiplyScalar(3), size: 0.009, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);
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
  // Rebuilt to the viewport's aspect by shapeMonitor(): a bevelled frame with
  // the screen cut out, a housing behind it, neck and foot.

  const monitor = new THREE.Group();
  scene.add(monitor);
  const shell = mat('#1c1a17', { roughness: 0.42, metalness: 0.35 });
  const housingMat = mat('#141311', { roughness: 0.6, metalness: 0.2 });
  const bezel = new THREE.Mesh(new THREE.BufferGeometry(), shell);
  const housing = new THREE.Mesh(new THREE.BufferGeometry(), housingMat);
  const glassBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000000' }));
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.04), shell);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.18), shell);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAL).multiplyScalar(4), toneMapped: false }));
  const vents = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ventTexture(), transparent: true, depthWrite: false }));
  monitor.add(bezel, housing, glassBack, neck, base, led, vents);
  makeHotspot(monitor, { label: 'Terminal', prompt: 'Use the terminal', reach: 1.9, action: 'monitor' }, [bezel, housing, neck], '#ffb000');

  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }

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
    const fw = w + frame * 2, fh = h + frame * 2;
    const face = roundedRect(fw, fh, 0.018);
    const hole = roundedRect(w, h, 0.004);
    face.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
    bezel.geometry.dispose();
    bezel.geometry = new THREE.ExtrudeGeometry(face, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
    bezel.position.set(c.x, c.y, c.z - 0.043);
    housing.geometry.dispose();
    housing.geometry = new THREE.ExtrudeGeometry(roundedRect(fw * 0.8, fh * 0.78, 0.05), { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 6 });
    housing.position.set(c.x, c.y + 0.01, c.z - 0.2);
    vents.scale.set(fw * 0.5, 0.05, 1);
    vents.rotation.set(-Math.PI / 2 + 0.2, 0, 0);
    vents.position.set(c.x, c.y + fh * 0.39 + 0.02, c.z - 0.13);
    glassBack.scale.set(w, h, 1);
    glassBack.position.set(c.x, c.y, c.z + 0.0005);
    const bottom = c.y - h / 2 - frame;
    const neckH = bottom - DESK_TOP;
    neck.scale.y = neckH;
    neck.position.set(c.x, DESK_TOP + neckH / 2, c.z - 0.12);
    base.position.set(c.x, DESK_TOP + 0.01, c.z - 0.1);
    led.position.set(c.x + w / 2 - 0.01, bottom + 0.012, c.z + 0.001);
    monitorPort.set(c.x + 0.06, DESK_TOP + 0.13, c.z - 0.2);
    cableDirty = true;
  }

  // ---------------------------------------------------------------- collisions
  // A 10 cm grid over the floor: a cell is blocked when any surface passes
  // through it between ankle and head height. Filled in when the room loads
  // (sampling its triangles), read by the walker.

  const CELL = 0.1, GX0 = -7.6, GZ0 = -10.6, GW = 152, GH = 168;
  const grid = new Uint8Array(GW * GH);
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const p = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();

  function rasterize(root) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.role === 'screen') return;
      const pos = o.geometry.attributes.position;
      const index = o.geometry.index;
      const count = index ? index.count : pos.count;
      for (let t = 0; t < count; t += 3) {
        for (let k = 0; k < 3; k++) tri[k].fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(o.matrixWorld);
        const [a, b, c] = tri;
        if (Math.max(a.y, b.y, c.y) < 0.15 || Math.min(a.y, b.y, c.y) > 1.9) continue;
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        const n = Math.min(400, Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / 0.07));
        for (let i = 0; i <= n; i++) {
          for (let j = 0; j <= n - i; j++) {
            p.copy(a).addScaledVector(ab, i / n).addScaledVector(ac, j / n);
            if (p.y < 0.15 || p.y > 1.9) continue;
            const gx = Math.floor((p.x - GX0) / CELL), gz = Math.floor((p.z - GZ0) / CELL);
            if (gx >= 0 && gz >= 0 && gx < GW && gz < GH) grid[gz * GW + gx] = 1;
          }
        }
      }
    });
  }

  function blocked(x, z, r = 0.28) {
    const x0 = Math.floor((x - r - GX0) / CELL), x1 = Math.floor((x + r - GX0) / CELL);
    const z0 = Math.floor((z - r - GZ0) / CELL), z1 = Math.floor((z + r - GZ0) / CELL);
    if (x0 < 0 || z0 < 0 || x1 >= GW || z1 >= GH) return true; // outside the room
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        if (!grid[gz * GW + gx]) continue;
        const cx = GX0 + (gx + 0.5) * CELL - x, cz = GZ0 + (gz + 0.5) * CELL - z;
        if (cx * cx + cz * cz <= r * r) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- zones

  const zones = new Map();      // name → Promise<root>
  const fades = [];             // zones fading up out of the dark
  let onProgress = null;

  function load(name) {
    if (!ZONES[name]) return Promise.resolve(null);
    if (!zones.has(name)) {
      const p = loader.loadAsync(modelUrl(`${name}.glb`), (e) => { if (onProgress && e.total) onProgress(name, e.loaded / e.total); })
        .then((gltf) => install(name, gltf.scene))
        .catch((err) => { console.warn(`zone ${name} failed to load`, err); zones.delete(name); return null; });
      zones.set(name, p);
    }
    return zones.get(name);
  }

  async function install(name, root) {
    root.name = `zone:${name}`;
    const screens = [];
    const lit = [];
    const lights = [];
    // the zone's own meshes never move: freeze their matrices (first, so the
    // live things built below, like the view out of the window, keep theirs)
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.updateMatrix();
      o.matrixAutoUpdate = false;
      for (const m of [].concat(o.material)) {
        for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = 4;
        if (m.isMeshStandardMaterial) m.envMapIntensity = 0.5;
      }
    });
    root.traverse((o) => {
      const d = o.userData;
      if (d.lightmap) lit.push(lightmap(o, d.lightmap, d.lm || 4));
      if (d.role === 'screen') screens.push(o);
      else if (d.role === 'window') buildWindow(o, d);
      else if (d.role === 'flicker') flicker(o);
      else if (d.role === 'spin') {
        const base = o.quaternion.clone();
        const turn = new THREE.Quaternion();
        const axis = new THREE.Vector3(0, 1, 0);
        updaters.push((t) => { o.quaternion.copy(base).multiply(turn.setFromAxisAngle(axis, t * (d.speed || 3.5))); o.updateMatrix(); });
      }
      else if (d.role === 'pulse') {
        // relative to its own scale (compressed meshes carry their size in it)
        const base = o.scale.clone();
        updaters.push((t) => { o.scale.copy(base).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.2)); o.updateMatrix(); });
      }
      else if (d.role === 'shaft') sunbeam(o, d);
      else if (d.role === 'board') whiteboard(o, d);
      else if (d.role === 'light') lights.push(o);
      else if (d.role === 'display') display(o, d.painter);
      if (d.hotspot && HOTSPOTS[d.hotspot]) makeHotspot(o, HOTSPOTS[d.hotspot]);
    });
    if (screens.length) buildScreenWall(screens);
    await Promise.all(lit);
    root.updateMatrixWorld(true);
    rasterize(root);
    for (const a of lights) {
      const d = a.userData;
      a.getWorldPosition(spareSpot.position);
      spareSpot.target.position.copy(spareSpot.position).y -= 1;
      spareSpot.color.set(d.color || '#ffffff');
      spareSpot.intensity = d.intensity || 20;
      spareSpot.angle = d.angle || 0.6;
      spareSpot.distance = d.distance || 9;
    }
    // compile shaders off the main path where the browser can (three r158+)
    if (renderer.compileAsync && camera) await renderer.compileAsync(root, camera, scene).catch(() => {});
    scene.add(root);
    fadeIn(root);
    return root;
  }

  // Baked light for a mesh (or a group of them): its lightmap on the second UV
  // set. Materials can be shared across lightmaps, so each pair gets a copy.
  const lightmaps = new Map();
  const litMaterials = new Map();
  async function lightmap(object, name, range) {
    if (!lightmaps.has(name)) {
      lightmaps.set(name, ktx2.loadAsync(modelUrl(`${name}.ktx2`)).then((tex) => {
        tex.channel = 1;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        return tex;
      }));
    }
    const tex = await lightmaps.get(name).catch((err) => { console.warn(`lightmap ${name}`, err); return null; });
    if (!tex) return;
    object.traverse((o) => {
      if (!o.isMesh || !o.material.isMeshStandardMaterial) return;
      const key = `${o.material.uuid}|${name}`;
      if (!litMaterials.has(key)) {
        const m = o.material.clone();
        // three lights only the diffuse part with a lightmap, so fully metallic
        // surfaces (the car's stainless) would go black: keep some diffuse
        m.metalness = Math.min(m.metalness, 0.35);
        m.lightMap = tex;
        m.lightMapIntensity = range * LIGHTMAP_GAIN;
        litMaterials.set(key, m);
      }
      o.material = litMaterials.get(key);
    });
  }

  // Each zone rises out of the dark: every material's colour ramps from black.
  function fadeIn(root) {
    const mats = new Map();
    root.traverse((o) => {
      if (!o.isMesh && !o.isPoints && !o.isLineSegments) return;
      for (const m of [].concat(o.material)) {
        if (mats.has(m)) continue;
        mats.set(m, { color: m.color ? m.color.clone() : null, emissive: m.emissive ? m.emissive.clone() : null });
      }
    });
    const fade = { mats, t: reducedMotion ? 1 : 0 };
    fades.push(fade);
    applyFade(fade);
  }
  function applyFade(fade) {
    const k = fade.t * fade.t;
    for (const [m, base] of fade.mats) {
      if (base.color) m.color.copy(base.color).multiplyScalar(k);
      if (base.emissive) m.emissive.copy(base.emissive).multiplyScalar(k);
    }
  }
  updaters.push((t, dt) => {
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      f.t = Math.min(1, f.t + dt / 0.9);
      applyFade(f);
      if (f.t >= 1) fades.splice(i, 1);
    }
  });

  // ---------------------------------------------------------------- screens and TVs
  // Every screen in the room (the desk's, the TV wall, the benches), purely for
  // show. Each is a small canvas redrawn a few times a second (round-robin,
  // 3 per frame). A screen can name its painter (the TVs: 'static') and tint.

  function buildScreenWall(faces) {
    const kinds = shuffle(Object.keys(SCREEN_PAINTERS).filter((k) => k !== 'blog' && k !== 'static'), rand);
    const screens = [];
    faces.sort((a, b) => (a.userData.col - b.userData.col) || (a.userData.row - b.userData.row));
    for (const face of faces) {
      const { col, row } = face.userData;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // glTF UVs
      face.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) });
      // (by now makeHotspot has swapped the 'blog' tag for the hotspot itself)
      const isBlog = face.userData.hotspot === 'blog' || face.userData.hotspot?.visit === '/blog/';
      const kind = isBlog ? 'blog' : SCREEN_PAINTERS[face.userData.painter] ? face.userData.painter : kinds[(col * 3 + row) % kinds.length];
      screens.push({ ctx: canvas.getContext('2d'), tex, paint: SCREEN_PAINTERS[kind], state: { seed: rand() * 1000, tint: face.userData.tint } });
      if (isBlog) face.userData.onHighlight = (on) => face.material.color.setScalar(on ? 1.8 : 1.25);
    }
    for (const sc of screens) { sc.paint(sc.ctx, 0, sc.state); sc.tex.needsUpdate = true; }
    let cursor = 0;
    updaters.push((t) => {
      for (let i = 0; i < 3; i++) {
        const sc = screens[cursor];
        cursor = (cursor + 1) % screens.length;
        sc.paint(sc.ctx, t, sc.state);
        sc.tex.needsUpdate = true;
      }
    });
  }

  // a single screen showing one of the screen-wall painters (the F1 rig's timing)
  function display(face, painter) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false; // glTF UVs
    face.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) });
    const paint = SCREEN_PAINTERS[painter] || SCREEN_PAINTERS.timing;
    const ctx = canvas.getContext('2d');
    const state = { seed: rand() * 1000 };
    let next = 0;
    updaters.push((t) => {
      if (t < next) return;
      next = t + 0.25;
      paint(ctx, t, state);
      tex.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- the window: late sun through haze

  // The view out: blown-out late-afternoon haze, the city beyond only ghosts
  // of towers in it (one tall ad still glowing teal), and grimy glass. Bright
  // enough to bloom. Local frame: the window's centre, +z into the room,
  // outside is -z.
  function buildWindow(anchor, { w = 8, h = 4 }) {
    const STREET = -4.5; // street level, below the window centre
    const GLOW = new THREE.Color('#ffd9a8');
    const flat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: false, ...opts });

    const sky = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), flat('#ffffff', { map: hazeTexture() }));
    sky.position.set(0, STREET + 40, -120);
    anchor.add(sky);

    // towers: two rows of soft silhouettes, nearly lost in the glare
    const rows = [
      { z: -90, n: 14, spread: 200, hmin: 30, hmax: 90, wmin: 10, wmax: 24, k: 0.9 },
      { z: -45, n: 9, spread: 110, hmin: 20, hmax: 60, wmin: 6, wmax: 14, k: 0.78 },
    ];
    for (const row of rows) {
      const mat = flat(new THREE.Color('#6a5040').lerp(GLOW, row.k).multiplyScalar(1.15));
      for (let i = 0; i < row.n; i++) {
        const bw = row.wmin + rand() * (row.wmax - row.wmin);
        const bh = row.hmin + rand() * (row.hmax - row.hmin);
        const x = (i / (row.n - 1) - 0.5) * row.spread + (rand() - 0.5) * 8;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), mat);
        tower.position.set(x, STREET + bh / 2, row.z + (rand() - 0.5) * 6);
        anchor.add(tower);
      }
    }
    // a tall teal ad on the nearer skyline, washed out by the sun, breathing
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(3, 18), flat(new THREE.Color(TEAL), { transparent: true, opacity: 0.5 }));
    ad.position.set(12, STREET + 22, -44);
    anchor.add(ad);
    updaters.push((t) => { ad.material.opacity = 0.35 + 0.15 * Math.sin(t * 0.7) + (Math.sin(t * 23) > 0.97 ? -0.2 : 0); });

    // the glass: years of dust, thicker towards the bottom edge
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: grimeTexture(), transparent: true, depthWrite: false, fog: false, color: '#c8a880',
    }));
    glass.position.z = -0.03;
    anchor.add(glass);
  }

  // ---------------------------------------------------------------- neon, shafts, boards

  // a tired tube: mostly on, occasionally stutters
  function flicker(o) {
    const m = o.material;
    const base = m.emissiveIntensity;
    const phase = rand() * 9;
    updaters.push((t) => {
      const s = Math.sin(t * 13) + Math.sin(t * 7.3);
      m.emissiveIntensity = ((t + phase) % 9 > 8.4 && s > 0.6) ? base * 0.2 : base;
    });
  }

  // a beam of light through the dusty air (cheap volumetrics): an open prism
  // fading along its length; sides 4 makes it square, like the window
  function sunbeam(anchor, { r = 1, h = 4, top = 0.25, sides = 32, color = '#ffd9a0', opacity = 0.07 }) {
    const geo = new THREE.CylinderGeometry(r * top, r, h, sides, 1, true);
    if (sides === 4) geo.rotateY(Math.PI / 4);
    geo.translate(0, -h / 2, 0);
    const beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: gradientTexture(), color, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
    anchor.add(beam);
  }

  // the gym whiteboard: PRs in marker
  function whiteboard(o, { w = 1.2, h = 0.8 }) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round(512 * h / w);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9dcd6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 34px "Share Tech Mono", monospace';
    ctx.fillStyle = '#1d3f8a';
    ctx.fillText('PRs // 2026', 28, 52);
    ctx.font = '26px "Share Tech Mono", monospace';
    const rows = [['SQUAT', '140 kg'], ['DEADLIFT', '180 kg'], ['BENCH', '100 kg'], ['BOOKS', '412 ↑'], ['SLEEP', 'n/a']];
    rows.forEach(([k, v], i) => {
      ctx.fillStyle = i === 3 ? '#b3261e' : '#222';
      ctx.fillText(k, 28, 104 + i * 40);
      ctx.fillText(v, 300, 104 + i * 40);
    });
    ctx.strokeStyle = '#b3261e';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(355, 98 + 3 * 40, 80, 22, -0.05, 0, Math.PI * 2); ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    o.material = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.55, 0.55, 0.55) });
  }

  // ---------------------------------------------------------------- hotspots

  function makeHotspot(object, spot, meshes, color) {
    const tint = color ? new THREE.Color(color) : null;
    // baked meshes are unlit: brighten a private copy of the material instead
    const targets = meshes || [];
    if (!meshes) {
      object.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone();
        targets.push(m);
      });
    }
    const base = new Map(targets.map((m) => [m, m.material.color.clone()]));
    object.userData.hotspot = {
      ...spot,
      highlight(on) {
        if (object.userData.onHighlight) { object.userData.onHighlight(on); return; }
        for (const m of targets) {
          if (m.material.isMeshBasicMaterial || !tint) m.material.color.copy(base.get(m)).multiplyScalar(on ? 1.6 : 1);
          else { m.material.emissive.copy(tint); m.material.emissiveIntensity = on ? 0.18 : 0; }
        }
      },
    };
    hotspots.push(object);
  }

  return {
    hotspots,
    link,
    shapeMonitor,
    setMonitorIdle,
    load,
    blocked,
    isLoaded: (name) => zones.has(name),
    set onProgress(fn) { onProgress = fn; },
    update(t, dt) { for (const u of updaters) u(t, dt); },
  };
}

// ---------------------------------------------------------------- environment

// What shiny things reflect: a dim brick room, the big bright window at one
// end, warm bulbs overhead, the glow of the TV wall (blurred into an
// environment map).
function workshopRoom() {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#120d0a');
  const strip = (color, k, w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    room.add(m);
  };
  strip('#ffd9a8', 4, 8, 4.2, 0, 3.6, -10);        // the window
  strip('#ffb15a', 3, 1.2, 0.6, 0, 6, -2);         // bulbs overhead
  strip('#2ad4c9', 1.2, 4, 2.5, -6.9, 1.9, -4.2, Math.PI / 2); // the TV wall
  strip('#ff3fa4', 0.8, 2, 1.5, -6.9, 2.4, -3, Math.PI / 2);
  strip('#ffb000', 1.5, 2.2, 0.8, 0, 1.2, -0.4);   // the desk's screens
  return room;
}

// ---------------------------------------------------------------- canvas textures

// sky for the view out: a warm glare low down, paling up into dusty haze
function hazeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#a89070');
  g.addColorStop(0.5, '#e8c89a');
  g.addColorStop(0.8, '#fff0d8');
  g.addColorStop(1, '#ffe2b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// dirty glass: blotchy dust, streaks, heavier along the bottom
function grimeTexture() {
  const W = 256, H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const r = mulberry32(77);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(90,70,50,0.10)');
  g.addColorStop(0.7, 'rgba(90,70,50,0.18)');
  g.addColorStop(1, 'rgba(70,55,40,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = r() * H, rr = 3 + r() * 14;
    const b = ctx.createRadialGradient(x, y, 0, x, y, rr);
    b.addColorStop(0, `rgba(80,62,44,${0.03 + r() * 0.06})`);
    b.addColorStop(1, 'rgba(80,62,44,0)');
    ctx.fillStyle = b;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  ctx.fillStyle = 'rgba(70,55,40,0.12)';
  for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, r() * H * 0.6, 1, 10 + r() * 50); // drip streaks
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function ventTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  for (let x = 4; x < 124; x += 8) ctx.fillRect(x, 3, 4, 10);
  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------- screen wall content
// Each painter draws one 256×160 frame at time t. Pure decoration, so: fake data,
// but personal fake data (Saigon, F1, the book pile).

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

// one big frame of TV snow, shared: each TV shows a random window of it
let snow = null;
function snowCanvas() {
  if (snow) return snow;
  snow = document.createElement('canvas');
  snow.width = 512;
  snow.height = 320;
  const ctx = snow.getContext('2d');
  const img = ctx.createImageData(512, 320);
  const r = mulberry32(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.pow(r(), 1.6) * 230;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return snow;
}

const SCREEN_PAINTERS = {
  // an old TV between channels, tinted: snow, a rolling band, now and then a test card
  static(ctx, t, s) {
    const tint = s.tint || '#ffffff';
    const phase = (t + s.seed) % 17;
    if (phase < 1.6) {
      const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
      bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 160); });
      ctx.fillStyle = '#000';
      ctx.fillRect(70, 62, 116, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '16px "Share Tech Mono", monospace';
      ctx.textBaseline = 'top';
      ctx.fillText('NO SIGNAL', 88, 70);
    } else {
      ctx.drawImage(snowCanvas(), Math.random() * 256, Math.random() * 160, 256, 160, 0, 0, 256, 160);
      const y = ((t * 40 + s.seed * 7) % 220) - 30; // the rolling band
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, y, 256, 26);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 256, 160);
    ctx.globalCompositeOperation = 'source-over';
    scanlines(ctx);
  },
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

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
