// Walking around the warehouse: first person, eye height ~1.6 m.
// Desktop: WASD / arrows to walk (Shift runs), drag to look, click the floor
// to walk there. Touch: drag to look, tap the floor to walk there.
// Collisions come from the warehouse's floor grid (blocked(x, z, r)).

import * as THREE from 'three';

const EYE = 1.62;
const WALK = 2.0;     // m/s
const RUN = 4.2;
const RADIUS = 0.28;
const LOOK_SPEED = 0.0042; // radians per pixel dragged
const KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createWalker({ camera, dom, blocked, reducedMotion }) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const held = new Set();
  let yaw = 0, pitch = 0, eye = EYE;
  let enabled = false;
  let target = null;      // { point, arrive, onArrive } while auto-walking
  let drag = null;        // pointer drag in progress
  let dragged = false;    // the last press was a drag (not a click)
  let bob = 0;
  let run = false;

  const typing = (e) => e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));

  function onKeyDown(e) {
    if (!enabled || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Shift') run = true;
    if (!KEYS[e.code]) return;
    e.preventDefault();
    held.add(e.code);
    target = null;
  }
  function onKeyUp(e) {
    if (e.key === 'Shift') run = false;
    held.delete(e.code);
  }
  function onBlur() { held.clear(); run = false; drag = null; }

  function onPointerDown(e) {
    if (!enabled || e.target !== dom || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
    dragged = false;
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 6) return;
    dragged = true;
    yaw -= dx * LOOK_SPEED;
    pitch = THREE.MathUtils.clamp(pitch - dy * LOOK_SPEED, -1.2, 1.1);
  }
  function onPointerUp(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // try a step, sliding along whatever is in the way
  function step(dx, dz) {
    const free = (x, z) => !blocked(x, z, RADIUS);
    const stuck = !free(pos.x, pos.z); // spawned inside something: let it walk out
    if (stuck || free(pos.x + dx, pos.z + dz)) { pos.x += dx; pos.z += dz; return true; }
    if (free(pos.x + dx, pos.z)) { pos.x += dx; return true; }
    if (free(pos.x, pos.z + dz)) { pos.z += dz; return true; }
    return false;
  }

  const fwd = new THREE.Vector2();
  function update(dt) {
    if (!enabled) return;
    let mx = 0, mz = 0;
    for (const k of held) { mx += KEYS[k][0]; mz += KEYS[k][1]; }
    const speed = (run ? RUN : WALK) * dt;
    let moving = false;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const s = Math.sin(yaw), c = Math.cos(yaw);
      // forward is -z rotated by yaw; strafe is +x rotated by yaw
      const dx = ((-s) * mz + c * mx) / len * speed;
      const dz = ((-c) * mz - s * mx) / len * speed;
      moving = step(dx, dz);
    } else if (target) {
      fwd.set(target.point.x - pos.x, target.point.z - pos.z);
      const dist = fwd.length();
      // turn towards where we're going while walking there
      const want = Math.atan2(-fwd.x, -fwd.y);
      let dy = want - yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * Math.min(1, dt * 5);
      if (dist <= target.arrive + 0.02) {
        const done = target.onArrive;
        target = null;
        if (done) done();
      } else {
        const k = Math.min(speed, dist - target.arrive) / dist;
        moving = step(fwd.x * k, fwd.y * k);
        if (!moving) { // something in the way: this is as close as it gets
          const done = target.onArrive;
          target = null;
          if (done) done();
        }
      }
    }
    eye += (EYE - eye) * Math.min(1, dt * 3);
    if (moving && !reducedMotion) bob += dt * (run ? 13 : 9);
    const by = reducedMotion ? 0 : Math.sin(bob) * 0.018;
    camera.position.set(pos.x, eye + by, pos.z);
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
    look.set(0, 0, -2).applyQuaternion(camera.quaternion).add(camera.position);
  }

  return {
    look,
    update,
    get enabled() { return enabled; },
    get moving() { return held.size > 0 || !!target; },
    /** take over from wherever the camera is (after a flight) */
    enable() {
      pos.copy(camera.position);
      eye = camera.position.y;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      yaw = Math.atan2(-dir.x, -dir.z);
      pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      enabled = true;
    },
    disable() { enabled = false; held.clear(); target = null; drag = null; },
    /** walk to a floor point, stopping `arrive` metres short; then onArrive */
    walkTo(point, { arrive = 0, onArrive } = {}) {
      target = { point: point.clone(), arrive, onArrive };
    },
    stop() { target = null; },
    /** whether the last pointer press turned into a look-drag (not a click) */
    get dragged() { return dragged; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
