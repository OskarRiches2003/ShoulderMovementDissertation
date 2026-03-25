/**
 * angleCalculations.ts
 *
 * Pure functions for computing joint angles from MediaPipe landmarks.
 * All functions operate in 2D (x, y) normalised image space for frontal-view
 * measurements. Z is intentionally ignored for abduction so that the
 * calculation remains stable against depth noise.
 *
 * Convention: angles are returned in degrees, 0–180.
 */

import type { Landmark } from '~/types/pose'

// ─── Vector helpers ───────────────────────────────────────────────────────────

interface Vec2 { x: number; y: number }

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

function magnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}

/**
 * Returns the angle (degrees) at vertex B formed by the ray B→A and B→C.
 * Uses the dot-product formula: cos θ = (BA · BC) / (|BA| |BC|)
 */
export function angleBetweenThreePoints(
  a: Vec2,
  b: Vec2, // vertex
  c: Vec2
): number {
  const ba = subtract(a, b)
  const bc = subtract(c, b)
  const magBA = magnitude(ba)
  const magBC = magnitude(bc)

  if (magBA === 0 || magBC === 0) return 0

  // Clamp to [-1, 1] to guard against floating-point drift past acos domain
  const cosTheta = Math.max(-1, Math.min(1, dot(ba, bc) / (magBA * magBC)))
  return (Math.acos(cosTheta) * 180) / Math.PI
}

// ─── Shoulder Abduction (frontal view) ───────────────────────────────────────

/**
 * Calculates shoulder abduction angle from three landmarks:
 *   hip → shoulder → elbow
 *
 * In anatomical terms this is the angle the upper arm makes with the trunk
 * in the frontal (coronal) plane.
 *
 * Returns null if any landmark has visibility below the threshold.
 */
export function calculateAbductionAngle(
  hip: Landmark,
  shoulder: Landmark,
  elbow: Landmark,
  visibilityThreshold = 0.5
): number | null {
  // Reject low-confidence landmarks to avoid junk readings
  if (
    (hip.visibility ?? 1) < visibilityThreshold ||
    (shoulder.visibility ?? 1) < visibilityThreshold ||
    (elbow.visibility ?? 1) < visibilityThreshold
  ) {
    return null
  }

  return angleBetweenThreePoints(hip, shoulder, elbow)
}

// ─── Smoothing ────────────────────────────────────────────────────────────────

/**
 * Simple exponential moving average to reduce frame-to-frame jitter.
 * alpha closer to 1 = more responsive; closer to 0 = smoother.
 */
export function smoothAngle(
  previous: number | null,
  current: number | null,
  alpha = 0.3
): number | null {
  if (current === null) return previous
  if (previous === null) return current
  return previous + alpha * (current - previous)
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatDegrees(angle: number | null): string {
  if (angle === null) return '—'
  return `${Math.round(angle)}°`
}