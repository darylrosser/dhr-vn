// The warehouse: zones built and baked in Blender (blender/), loaded as GLB
// (Meshopt geometry, KTX2 textures, baked lighting → unlit materials), and
// streamed in as the camera heads their way; until then fog and darkness
// stand in for them, and each zone fades up out of the dark as it arrives.
//
// JS still owns the live parts: the home monitor (sized to the viewport), the
// link (desk socket, plug, cable, sparks), the screen-wall content, the city
// and rain in the window, neon flicker, dust and light shafts. The GLBs say
// where those go through glTF extras (three userData):
//   role: 'screen' (col, row) | 'window' (w, h) | 'flicker' | 'spin' (speed)
//         | 'pulse' | 'shaft' (r, h, color) | 'board' (canvas, w, h)
//   hotspot: a key of HOTSPOTS below → the hotspot contract.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const DESK_TOP = 0.775;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Zone frames: where each Blender zone sits (keep in step with blender/zones/*.py).
export const ZONES = {
  deck: { origin: [0, 0, 0], yaw: 0 },
  board: { origin: [7.5, 0, 1.0], yaw: -Math.PI / 2 },
  library: { origin: [-8.0, 0, 0.5], yaw: Math.PI / 2 },
  lounge: { origin: [-6.5, 0, 8.0], yaw: Math.PI / 2 + 0.35 },
  garage: { origin: [8.0, 0, 10.0], yaw: -Math.PI / 2 - 0.35 },
  gym: { origin: [0.0, 0, 14.5], yaw: Math.PI },
};

/** A point in a zone's own frame (three coords) → world space. */
export function zonePoint(zone, x, y, z) {
  const { origin: [ox, oy, oz], yaw } = ZONES[zone];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return V(ox + x * c + z * s, oy + y, oz - x * s + z * c);
}

// What clicking a thing in the room does (hotspot contract labels + targets).
const HOTSPOTS = {
  blog: { label: 'Blog: field reports →', visit: '/blog/' },
  about: { label: 'Case file: about →', visit: '/about/' },
  reading: { label: 'Library: reading room →', visit: '/reading/' },
  contact: { label: 'Lounge: get in touch →', visit: '/contact/' },
  garage: { label: 'Garage: projects (coming soon)', action: 'place', place: 'garage' },
  gym: { label: 'Gym: training log (coming soon)', action: 'place', place: 'gym' },
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
const modelUrl = (zone) => new URL(`../models/${zone}.glb${new URL(import.meta.url).search}`, import.meta.url).href;

export function createWarehouse(scene, renderer, { reducedMotion = false, camera } = {}) {
  const hotspots = [];
  const updaters = [];
  const rand = mulberry32(1993);

  const ktx2 = new KTX2Loader().setTranscoderPath(`${addonsBase()}libs/basis/`).detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  // the floor of the whole hall, under the zones' own baked floors
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: '#06070a' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  // Realtime light only reaches the live, JS-built things (monitor, plug,
  // cable); the zones carry their lighting in their textures.
  scene.add(new THREE.HemisphereLight('#26324a', '#0a0705', 0.6));
  const lamp = new THREE.SpotLight('#ffd9a0', 14, 7, 0.75, 0.65, 1.6);
  lamp.position.set(0.1, 3.15, 0.3);
  lamp.target.position.set(0, DESK_TOP, 0);
  scene.add(lamp, lamp.target);
  const screenGlow = new THREE.PointLight('#ffb000', 1.2, 2.5, 2);
  screenGlow.position.set(0, 1.1, 0.25);
  scene.add(screenGlow);
  const wallGlow = new THREE.PointLight('#2ad4c9', 1.2, 4, 2);
  wallGlow.position.set(0, 1.9, -1.4);
  scene.add(wallGlow);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...o });

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
  makeHotspot(monitor, { label: 'Terminal', action: 'monitor' }, [bezel, housing, neck], '#ffb000');

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

  // ---------------------------------------------------------------- dust in the lamp light

  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) dustPos.set([(rand() - 0.5) * 2.4, DESK_TOP + rand() * 2.4, (rand() - 0.5) * 2], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffd9a0', size: 0.008, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(dust);
  updaters.push((t) => { dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.03; });

  // ---------------------------------------------------------------- zones

  const zones = new Map();      // name → Promise<root>
  const fades = [];             // zones fading up out of the dark
  let onProgress = null;

  function load(name) {
    if (!ZONES[name]) return Promise.resolve(null);
    if (!zones.has(name)) {
      const p = loader.loadAsync(modelUrl(name), (e) => { if (onProgress && e.total) onProgress(name, e.loaded / e.total); })
        .then((gltf) => install(name, gltf.scene))
        .catch((err) => { console.warn(`zone ${name} failed to load`, err); zones.delete(name); return null; });
      zones.set(name, p);
    }
    return zones.get(name);
  }

  async function install(name, root) {
    root.name = `zone:${name}`;
    const screens = [];
    root.traverse((o) => {
      const d = o.userData;
      if (o.isMesh) {
        o.matrixAutoUpdate = false;
        // the baked look is final: no lights, but the room's fog still applies
        if (o.material.isMeshBasicMaterial && o.material.map) o.material.map.anisotropy = 4;
      }
      if (d.role === 'screen') screens.push(o);
      else if (d.role === 'window') buildWindow(o, d);
      else if (d.role === 'flicker') flicker(o);
      else if (d.role === 'spin') updaters.push((t) => { o.rotation.y = t * (d.speed || 3.5); o.updateMatrix(); });
      else if (d.role === 'pulse') updaters.push((t) => { o.scale.setScalar(0.85 + 0.15 * Math.sin(t * 2.2)); o.updateMatrix(); });
      else if (d.role === 'shaft') lightShaft(o, d);
      else if (d.role === 'board') whiteboard(o, d);
      if (d.hotspot && HOTSPOTS[d.hotspot]) makeHotspot(o, HOTSPOTS[d.hotspot]);
    });
    if (screens.length) buildScreenWall(screens);
    root.updateMatrixWorld(true);
    // compile shaders off the main path where the browser can (three r158+)
    if (renderer.compileAsync && camera) await renderer.compileAsync(root, camera, scene).catch(() => {});
    scene.add(root);
    fadeIn(root);
    return root;
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

  // ---------------------------------------------------------------- the wall of screens
  // A curved Batcave-style array behind the desk, purely for show. Each screen
  // is a small canvas redrawn a few times a second (round-robin, 3 per frame).

  function buildScreenWall(faces) {
    const kinds = shuffle(Object.keys(SCREEN_PAINTERS).filter((k) => k !== 'blog'), rand);
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
      const isBlog = face.userData.hotspot === 'blog';
      const kind = isBlog ? 'blog' : kinds[(col * 3 + row) % kinds.length];
      screens.push({ ctx: canvas.getContext('2d'), tex, paint: SCREEN_PAINTERS[kind], state: { seed: rand() * 1000 } });
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

  // ---------------------------------------------------------------- the window: city, rain

  function buildWindow(anchor, { w = 10, h = 5 }) {
    const city = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skylineTexture(rand), fog: false }));
    city.position.z = -0.05;
    anchor.add(city);
    // lit windows that twinkle
    const pts = [];
    for (let i = 0; i < 260; i++) pts.push((rand() - 0.5) * w * 0.96, (rand() - 0.62) * h * 0.85, -0.04);
    const cityGeo = new THREE.BufferGeometry();
    cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const twinkle = new THREE.PointsMaterial({ color: '#ffb86b', size: 0.035, fog: false, transparent: true, opacity: 0.8 });
    anchor.add(new THREE.Points(cityGeo, twinkle));
    updaters.push((t) => { twinkle.opacity = 0.65 + 0.15 * Math.sin(t * 0.9); });
    // rain streaking past the glass
    const count = 420;
    const pos = new Float32Array(count * 6);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * w, y = (rand() - 0.5) * h, z = 0.05 + rand() * 0.25;
      pos.set([x, y, z, x - 0.02, y - 0.18, z], i * 6);
      speed[i] = 5 + rand() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#6ea8c9', transparent: true, opacity: 0.35 }));
    rain.frustumCulled = false;
    anchor.add(rain);
    updaters.push((t, dt) => {
      for (let i = 0; i < count; i++) {
        const o = i * 6;
        let y = pos[o + 1] - speed[i] * dt;
        if (y < -h / 2) y += h;
        pos[o + 1] = y;
        pos[o + 4] = y - 0.18;
      }
      geo.attributes.position.needsUpdate = true;
    });
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

  // a cone of light with dust in it (cheap volumetrics)
  function lightShaft(anchor, { r = 1, h = 4, color = '#ffd9a0' }) {
    const geo = new THREE.CylinderGeometry(r * 0.25, r, h, 32, 1, true);
    geo.translate(0, -h / 2, 0);
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: gradientTexture(), color, transparent: true, opacity: 0.07, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    anchor.add(cone);
    const n = 140;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = -rand() * h, rr = r * (0.25 + 0.75 * (-y / h)) * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      p.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const motes = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.6, depthWrite: false }));
    anchor.add(motes);
    updaters.push((t) => { motes.rotation.y = t * 0.03; motes.position.y = Math.sin(t * 0.25) * 0.05; });
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
          if (m.material.isMeshBasicMaterial) m.material.color.copy(base.get(m)).multiplyScalar(on ? 1.45 : 1);
          else if (tint) { m.material.emissive.copy(tint); m.material.emissiveIntensity = on ? 0.18 : 0; }
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
    isLoaded: (name) => zones.has(name),
    set onProgress(fn) { onProgress = fn; },
    update(t, dt) { for (const u of updaters) u(t, dt); },
  };
}

// ---------------------------------------------------------------- canvas textures

function skylineTexture(rand) {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05101c');
  sky.addColorStop(0.55, '#0d2236');
  sky.addColorStop(0.85, '#3a2a2a');
  sky.addColorStop(1, '#5a3420');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // a holo ad smeared by the rain
  const ad = ctx.createRadialGradient(W * 0.68, H * 0.42, 10, W * 0.68, H * 0.42, 160);
  ad.addColorStop(0, 'rgba(255, 70, 140, .45)');
  ad.addColorStop(1, 'rgba(255, 70, 140, 0)');
  ctx.fillStyle = ad;
  ctx.fillRect(0, 0, W, H);
  // three layers of towers, far to near
  [['#0b1826', 0.45, 0.5], ['#08111b', 0.6, 0.75], ['#04080d', 0.78, 1]].forEach(([fill, base, lit]) => {
    let x = -20;
    while (x < W) {
      const bw = 30 + rand() * 90, bh = H * (0.15 + rand() * 0.45) * (1.2 - base);
      const top = H * base + 40 - bh;
      ctx.fillStyle = fill;
      ctx.fillRect(x, top, bw, H - top);
      for (let wy = top + 6; wy < H; wy += 9) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
          if (rand() < 0.16 * lit) {
            ctx.fillStyle = rand() < 0.8 ? `rgba(255, 184, 107, ${0.25 + rand() * 0.5 * lit})` : `rgba(42, 212, 201, ${0.3 + rand() * 0.4})`;
            ctx.fillRect(wx, wy, 3, 4);
          }
        }
      }
      if (rand() < 0.3) { ctx.fillStyle = '#ff3030'; ctx.fillRect(x + bw / 2, top - 4, 3, 3); }
      x += bw + rand() * 14;
    }
  });
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

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
