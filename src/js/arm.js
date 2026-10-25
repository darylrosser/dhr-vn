// The robot arm bolted to the desk, back right: it holds the jack plug. Jacking
// in, it lifts the plug out of its cradle and swings it round to the port at
// the back of your neck; jacking out, it yanks it free and puts it back.
//
// A turret on a clamp, a shoulder, an elbow and a wrist with a two-finger
// gripper: solved each frame (two-bone IK in the plane the turret faces) to
// put the plug's pin on a target, pointing along an approach direction.

import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L1 = 0.67;      // shoulder → elbow
const L2 = 0.62;      // elbow → wrist
const L3 = 0.21;      // wrist → the plug's pin tip
const SHOULDER = 0.24; // above the desk

/**
 * base: Vector3 on the desk top. plug: Object3D, its origin at the pin tip,
 * +y running back to the cable. Returns { group, solve(pin, dir), tail() }.
 */
export function createArm(base, plug, { metal, paint, rubber, glow }) {
  const group = new THREE.Group();
  group.position.copy(base);

  // clamp + turret
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.035, 32), metal);
  foot.position.y = 0.0175;
  const bolts = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 12), metal);
  bolts.rotation.x = Math.PI / 2;
  bolts.position.y = 0.036;
  group.add(foot, bolts);
  const turret = new THREE.Group();
  turret.position.y = 0.035;
  group.add(turret);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.13, 32), paint);
  drum.position.y = 0.065;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.004, 8, 40), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.11;
  const cheekGeo = new THREE.BoxGeometry(0.1, 0.12, 0.022);
  const cheekL = new THREE.Mesh(cheekGeo, paint);
  const cheekR = cheekL.clone();
  cheekL.position.set(0, SHOULDER - 0.035 - 0.02, 0.07);
  cheekR.position.set(0, SHOULDER - 0.035 - 0.02, -0.07);
  turret.add(drum, ring, cheekL, cheekR);

  // a link: a tapered beam along +x with a joint drum at its root, a piston
  // along its back and a bundle of cable along its side
  function link(length, r) {
    const g = new THREE.Group();
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, r * 2.7, 28), metal);
    joint.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 2.9, 20), glow);
    cap.rotation.x = Math.PI / 2;
    cap.scale.set(1, 1, 1);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(length, r * 1.5, r * 1.7), paint);
    beam.position.x = length / 2;
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, length * 0.7, 12), metal);
    piston.rotation.z = Math.PI / 2;
    piston.position.set(length * 0.48, r * 1.05, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, length * 0.32, 12), rubber);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.set(length * 0.3, r * 1.05, 0);
    const wires = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, length * 0.9, 8), rubber);
    wires.rotation.z = Math.PI / 2;
    wires.position.set(length * 0.5, -r * 0.35, r * 0.95);
    g.add(joint, cap, beam, piston, sleeve, wires);
    return g;
  }
  const shoulder = new THREE.Group();
  shoulder.position.y = SHOULDER;
  turret.add(shoulder);
  shoulder.add(link(L1, 0.034));
  const elbow = new THREE.Group();
  elbow.position.x = L1;
  shoulder.add(elbow);
  elbow.add(link(L2, 0.027));
  const wrist = new THREE.Group();
  wrist.position.x = L2;
  elbow.add(wrist);
  const wj = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.06, 24), metal);
  wj.rotation.x = Math.PI / 2;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.06), paint);
  palm.position.x = 0.03;
  wrist.add(wj, palm);
  // fingers either side of the plug's grip
  for (const s of [-1, 1]) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.016), metal);
    finger.position.set(0.095, 0, s * 0.041);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.014, 0.01), rubber);
    tip.position.set(0.125, 0, s * 0.034);
    wrist.add(finger, tip);
  }
  // the plug in its grip: pin forward (+x), cable back (−x)
  plug.rotation.set(0, 0, Math.PI / 2);
  plug.position.set(L3, 0, 0);
  wrist.add(plug);

  const S = new THREE.Vector3();
  const W = new THREE.Vector3();
  const d = new THREE.Vector3();

  /** put the pin tip on `pin`, travelling along `dir` (unit) */
  function solve(pin, dir) {
    group.updateMatrixWorld();
    S.set(base.x, base.y + 0.035 + SHOULDER, base.z);
    W.copy(pin).addScaledVector(dir, -L3);
    d.subVectors(W, S);
    const yaw = Math.atan2(-d.z, d.x);
    turret.rotation.y = yaw;
    const r = Math.hypot(d.x, d.z);
    const D = THREE.MathUtils.clamp(Math.hypot(r, d.y), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.001);
    const a1 = Math.atan2(d.y, r) + Math.acos(THREE.MathUtils.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)); // elbow up
    const inner = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    const a2 = a1 - (Math.PI - inner);
    shoulder.rotation.z = a1;
    elbow.rotation.z = a2 - a1;
    // the wrist turns the gripper onto the approach direction (within the arm's plane)
    const along = dir.x * Math.cos(yaw) - dir.z * Math.sin(yaw);
    wrist.rotation.z = Math.atan2(dir.y, along) - a2;
  }

  /** the plug's cable end, in world space (for the cable) */
  const tail = new THREE.Vector3();
  const back = new THREE.Vector3();
  function tailPoint() {
    plug.updateMatrixWorld();
    tail.set(0, 0.148, 0).applyMatrix4(plug.matrixWorld);
    back.set(0, 1, 0).transformDirection(plug.matrixWorld);
    return { point: tail, dir: back };
  }

  return { group, solve, tail: tailPoint, ring };
}
