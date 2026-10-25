// Standing in one spot: you don't walk, you look around. Drag to turn your
// head (you grab the scene, like Street View), as far each way as the spot
// allows (there's nothing to see past it) and a bit up and down; ← → ↑ ↓ do the same. lookAt()
// turns you towards something. Smoothed, so a click on something across the
// room is a glance, not a cut.

import * as THREE from 'three';

const PITCH_MIN = -0.6, PITCH_MAX = 0.65;
const DRAG_SPEED = 0.0035;  // radians per pixel dragged
const KEY_SPEED = 1.4;      // rad/s
const KEYS = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

/** at: where you stand (eye height); facing: a point the spot faces;
 *  left / right: how far you can turn your head each way (radians) */
export function createSeat({ camera, dom, reducedMotion, at, facing, left = 1.2, right = 1.2 }) {
  const eye = at.clone();
  const centre = Math.atan2(-(facing.x - at.x), -(facing.z - at.z));
  const look = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const held = new Set();
  let yaw = 0, pitch = 0;       // where you're looking
  let goalYaw = 0, goalPitch = 0;
  let enabled = false;
  let drag = null;
  let dragged = false;

  const typing = (e) => e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  const clamp = () => {
    goalYaw = THREE.MathUtils.clamp(goalYaw, centre - right, centre + left);
    goalPitch = THREE.MathUtils.clamp(goalPitch, PITCH_MIN, PITCH_MAX);
  };

  function onKeyDown(e) {
    if (!enabled || typing(e) || e.metaKey || e.ctrlKey || e.altKey || !KEYS[e.code]) return;
    e.preventDefault();
    held.add(e.code);
  }
  function onKeyUp(e) { held.delete(e.code); }
  function onBlur() { held.clear(); drag = null; }

  function onPointerDown(e) {
    if (!enabled || e.target !== dom || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // the view has the keyboard now (not a focused link or the terminal's prompt)
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
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
    goalYaw += dx * DRAG_SPEED;
    goalPitch += dy * DRAG_SPEED;
    clamp();
  }
  function onPointerUp(e) { if (drag && e.pointerId === drag.id) drag = null; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  function aim(point) {
    const dx = point.x - eye.x, dy = point.y - eye.y, dz = point.z - eye.z;
    goalYaw = Math.atan2(-dx, -dz);
    goalPitch = Math.atan2(dy, Math.hypot(dx, dz));
    clamp();
  }

  function update(dt) {
    if (!enabled) return;
    for (const k of held) { goalYaw += KEYS[k][0] * KEY_SPEED * dt; goalPitch += KEYS[k][1] * KEY_SPEED * dt; }
    if (held.size) clamp();
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * (drag ? 18 : 7));
    yaw += (goalYaw - yaw) * k;
    pitch += (goalPitch - pitch) * k;
    euler.set(pitch, yaw, 0);
    camera.position.copy(eye);
    camera.quaternion.setFromEuler(euler);
    look.set(0, 0, -2).applyQuaternion(camera.quaternion).add(camera.position);
  }

  return {
    look,
    update,
    get enabled() { return enabled; },
    /** sit back down, looking where the camera looks now (after a flight) */
    enable() {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      yaw = goalYaw = Math.atan2(-dir.x, -dir.z);
      pitch = goalPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      clamp();
      enabled = true;
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    },
    disable() { enabled = false; held.clear(); drag = null; },
    /** turn your head towards a point (smoothly) */
    lookAt: aim,
    /** whether the last pointer press turned into a look-drag (not a click) */
    get dragged() { return dragged; },
  };
}
