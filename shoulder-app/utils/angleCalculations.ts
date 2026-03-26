/**
 * angleCalculations.ts
 *
 * Pure, framework-free functions for computing joint angles from MediaPipe
 * landmarks. All heavy computation lives here so it is easy to unit-test
 * independently of Vue / MediaPipe.
 *
 * Coordinate conventions
 * ──────────────────────
 * MediaPipe normalised coords: x right (0→1), y down (0→1), z depth (negative = closer).
 * For 2-D (frontal/sagittal) calculations we intentionally ignore Z — depth
 * estimation is MediaPipe's weakest axis and adds noise.
 * For rotation we use Z carefully and note the limitation in comments.
 *
 * All angles returned in degrees, range 0–180, or null if landmarks are
 * below the visibility threshold.
 */

import type { Landmark } from '~/types/pose'
import { VISIBILITY_THRESHOLD } from '~/types/pose'

// ─── 2-D vector helpers ───────────────────────────────────────────────────────

interface Vec2 { x: number; y: number }
interface Vec3 { x: number; y: number; z: number }

function sub2(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y } }
function sub3(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } }
function mag2(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y) }
function mag3(v: Vec3): number { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) }
function dot2(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y }
function dot3(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z }

/**
 * Angle at vertex B between rays B→A and B→C, in 2-D image space.
 */
export function angleBetweenThreePoints(a: Vec2, b: Vec2, c: Vec2): number {
  const ba = sub2(a, b)
  const bc = sub2(c, b)
  const denom = mag2(ba) * mag2(bc)
  if (denom === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot2(ba, bc) / denom))) * 180) / Math.PI
}

/**
 * Angle between two 3-D vectors (used for rotation).
 */
function angleBetweenVectors3D(a: Vec3, b: Vec3): number {
  const denom = mag3(a) * mag3(b)
  if (denom === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot3(a, b) / denom))) * 180) / Math.PI
}

// ─── Visibility guard ─────────────────────────────────────────────────────────

function visible(...lms: Landmark[]): boolean {
  return lms.every(lm => (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD)
}

// ─── Abduction (frontal plane) ────────────────────────────────────────────────
/**
 * Hip → Shoulder → Elbow angle in the image (x,y) plane.
 * Patient faces camera. Measures arm raising out to the side.
 * Normal ROM: 0–180°.
 */
export function calculateAbductionAngle(
  hip: Landmark,
  shoulder: Landmark,
  elbow: Landmark,
): number | null {
  if (!visible(hip, shoulder, elbow)) return null
  return angleBetweenThreePoints(hip, shoulder, elbow)
}

// ─── Flexion (sagittal plane) ─────────────────────────────────────────────────
/**
 * Hip → Shoulder → Elbow angle, but measured from a side-on camera.
 * The maths is identical to abduction; what differs is the *camera position*
 * (patient viewed from the side). The instruction in the MovementConfig
 * guides the user to reposition.
 *
 * The function is a named alias to make intent explicit in calling code
 * and to allow future divergence (e.g. adding a forward-tilt correction).
 * Normal ROM: 0–180°.
 */
export function calculateFlexionAngle(
  hip: Landmark,
  shoulder: Landmark,
  elbow: Landmark,
): number | null {
  if (!visible(hip, shoulder, elbow)) return null
  return angleBetweenThreePoints(hip, shoulder, elbow)
}

// ─── Internal / External Rotation ────────────────────────────────────────────
/**
 * Measures the angle of the forearm relative to vertical with the upper arm
 * held at 90° abduction and elbow bent to 90°.
 *
 * Method:
 *   1. Compute the upper-arm vector: shoulder → elbow
 *   2. Compute the forearm vector:   elbow    → wrist
 *   3. Project the forearm vector onto the plane perpendicular to the
 *      upper-arm vector.
 *   4. Measure the angle of that projected vector against a gravity reference
 *      (straight down = 0°). Positive = external, negative = internal.
 *
 * Limitation: MediaPipe's Z (depth) axis is estimated, not measured, so
 * results are less reliable than abduction/flexion. Confidence is highest
 * when the camera is directly in front and the patient's elbow is clearly
 * visible. This limitation should be noted in your dissertation evaluation.
 *
 * Returns degrees from –90 (full internal) to +90 (full external), or null.
 * Normal ROM: internal ~70°, external ~90°.
 */
export function calculateRotationAngle(
  shoulder: Landmark,
  elbow: Landmark,
  wrist: Landmark,
): number | null {
  if (!visible(shoulder, elbow, wrist)) return null

  // Upper-arm axis (3-D)
  const upperArm: Vec3 = sub3(elbow, shoulder)

  // Forearm vector (3-D)
  const forearm: Vec3 = sub3(wrist, elbow)

  // Project forearm onto the plane perpendicular to upperArm
  // proj = forearm - (forearm·upperArm / |upperArm|²) * upperArm
  const uaMag2 = upperArm.x ** 2 + upperArm.y ** 2 + upperArm.z ** 2
  if (uaMag2 === 0) return null

  const scalar = dot3(forearm, upperArm) / uaMag2
  const projected: Vec3 = {
    x: forearm.x - scalar * upperArm.x,
    y: forearm.y - scalar * upperArm.y,
    z: forearm.z - scalar * upperArm.z,
  }

  // Reference vector: straight down in image space (positive Y = down in MediaPipe)
  const down: Vec3 = { x: 0, y: 1, z: 0 }

  // Raw angle between projected forearm and down
  const rawAngle = angleBetweenVectors3D(projected, down)

  // Determine sign: if the projected forearm points toward the body midline
  // (positive Z for left side, negative for right) it's internal rotation.
  // We use the Z component of projected as a sign indicator.
  const sign = projected.z >= 0 ? 1 : -1

  return sign * rawAngle
}

// ─── Smoothing ────────────────────────────────────────────────────────────────
/**
 * Exponential moving average — reduces frame-to-frame jitter.
 * alpha 0.3 balances responsiveness vs smoothness well for 30fps input.
 */
export function smoothAngle(
  previous: number | null,
  current:  number | null,
  alpha = 0.3,
): number | null {
  if (current  === null) return previous
  if (previous === null) return current
  return previous + alpha * (current - previous)
}

// ─── Formatting ───────────────────────────────────────────────────────────────
export function formatDegrees(angle: number | null): string {
  if (angle === null) return '—'
  return `${Math.round(angle)}°`
}