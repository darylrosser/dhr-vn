// Walking around the warehouse: first person, eye height ~1.6 m, the usual PC
// game controls.
// Desktop: click the view to take the mouse (pointer lock), move the mouse to
// look, WASD to walk (Shift runs), ↑ ↓ to walk and ← → to turn; click what
// the crosshair is on; Esc gives the mouse back.
// Touch (or no pointer lock): drag to look, tap the floor to walk there.
// Collisions come from the warehouse's floor grid (blocked(x, z, r)).

import * as THREE from 'three';

const EYE = 1.62;
const WALK = 2.0;          // m/s
const RUN = 4.2;
const TURN = 1.9;          // rad/s for ← →
const RADIUS = 0.28;
const MOUSE_SPEED = 0.0022; // radians per pixel of mouse movement (locked)
const DRAG_SPEED = 0.005;   // radians per pixel dragged (touch)
// [strafe, forward, turn]
const KEYS = {
  KeyW: [0, 1, 0], KeyS: [0, -1, 0], KeyA: [-1, 0, 0], KeyD: [1, 0, 0],
  ArrowUp: [0, 1, 0], ArrowDown: [0, -1, 0], ArrowLeft: [0, 0, 1], ArrowRight: [0, 0, -1],
};

export function createWalker({ camera, dom, blocked, reducedMotion }) {
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const held = new Set();
  let yaw = 0, pitch = 0, eye = EYE;
  let enabled = false;
  let target = null;      // { point, arrive, onArrive } while auto-walking
  let drag = null;        // touch / mouse drag in progress (when not locked)
  let dragged = false;    // the last press was a drag (not a click)
  let unlockedAt = -1e9;  // when the browser last gave the mouse back
  let bob = 0;
  let run = false;

  const typing = (e) => e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  const locked = () => document.pointerLockElement === dom;
  const canLock = matchMedia('(pointer: fine)').matches && 'requestPointerLock' in dom;

  function turnBy(dyaw, dpitch) {
    yaw += dyaw;
    pitch = THREE.MathUtils.clamp(pitch + dpitch, -1.2, 1.1);
  }

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

  function onMouseMove(e) {
    if (!enabled || !locked()) return;
    turnBy(-e.movementX * MOUSE_SPEED, -e.movementY * MOUSE_SPEED);
  }

  function onPointerDown(e) {
    if (!enabled || locked() || e.target !== dom || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
    dragged = false;
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 8) return;
    dragged = true;
    // touch: you drag the world, like turning your head the other way
    turnBy(dx * DRAG_SPEED, dy * DRAG_SPEED);
  }
  function onPointerUp(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }
  function onLockChange() {
    if (!locked()) unlockedAt = performance.now();
    document.documentElement.classList.toggle('is-locked', locked());
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('pointerlockchange', onLockChange);

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
    let mx = 0, mz = 0, turn = 0;
    for (const k of held) { mx += KEYS[k][0]; mz += KEYS[k][1]; turn += KEYS[k][2]; }
    if (turn) yaw += Math.sign(turn) * TURN * dt;
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
    /** the mouse is captured: aim with the crosshair (screen centre) */
    get locked() { return locked(); },
    /** desktop pointer: whether clicking the view should capture the mouse */
    canLock,
    lock() { if (canLock && !locked()) dom.requestPointerLock(); },
    unlock() { if (locked()) document.exitPointerLock(); },
    /** Esc that the browser just spent on giving the mouse back */
    justUnlocked: () => performance.now() - unlockedAt < 400,
    /** take over from wherever the camera is (after a flight) */
    enable() {
      pos.copy(camera.position);
      eye = camera.position.y;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      yaw = Math.atan2(-dir.x, -dir.z);
      pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      enabled = true;
    },
    disable() {
      enabled = false;
      held.clear();
      target = null;
      drag = null;
      if (locked()) document.exitPointerLock();
    },
    /** walk to a floor point, stopping `arrive` metres short; then onArrive */
    walkTo(point, { arrive = 0, onArrive } = {}) {
      target = { point: point.clone(), arrive, onArrive };
    },
    stop() { target = null; },
    /** whether the last pointer press turned into a look-drag (not a click) */
    get dragged() { return dragged; },
  };
}
