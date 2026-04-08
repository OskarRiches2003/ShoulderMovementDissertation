/**
 * movementConfigs.ts
 *
 * One config object per movement. Flexion is split into two entries
 * (left-facing and right-facing) because MediaPipe landmark quality drops
 * significantly for the far shoulder in a side-on view — only the near
 * shoulder should be measured for each variant.
 *
 * To add a new movement: add one entry here. Nothing else needs changing.
 */

import type { MovementConfig, Landmark } from '~/types/pose'
import { MovementType, PoseLandmark }    from '~/types/pose'
import {
  calculateAbductionAngle,
  calculateFlexionAngle,
  calculateRotationAngle,
} from '~/utils/angleCalculations'

function lm(landmarks: Landmark[], idx: number): Landmark {
  return landmarks[idx]
}

export const MOVEMENT_CONFIGS: MovementConfig[] = [
  // ── Abduction ───────────────────────────────────────────────────────────────
  {
    type:           MovementType.ABDUCTION,
    label:          'Abduction',
    shortLabel:     'Abduction',
    plane:          'Frontal (coronal) plane',
    cameraView:     'frontal',
    normalRange:    [170, 180],
    availableSides: ['left', 'right', 'both'],
    instruction:    'Stand facing the camera with arms at your sides. Raise one or both arms straight out to the side, keeping your elbow straight. Your full torso must remain visible.',
    calculate(landmarks, side) {
      const hip      = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_HIP      : PoseLandmark.RIGHT_HIP)
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      return calculateAbductionAngle(hip, shoulder, elbow)
    },
  },

  // ── Flexion — left shoulder  ──────────────────────────────────────────────────
  {
    type:           MovementType.FLEXION_LEFT,
    label:          'Flexion (Left)',
    shortLabel:     'Flexion L',
    plane:          'Sagittal plane',
    cameraView:     'side',
    normalRange:    [170, 180],
    availableSides: ['left'],
    instruction:    'Stand with your LEFT side facing the camera. Raise your left arm forward and upward, keeping your elbow straight. Your full torso and arm must remain in frame.',
    calculate(landmarks) {
      // Only the near (left) shoulder is reliable in this camera orientation
      const hip      = lm(landmarks, PoseLandmark.LEFT_HIP)
      const shoulder = lm(landmarks, PoseLandmark.LEFT_SHOULDER)
      const elbow    = lm(landmarks, PoseLandmark.LEFT_ELBOW)
      return calculateFlexionAngle(hip, shoulder, elbow)
    },
  },

  // ── Flexion — right shoulder ──────────────────────────────────────────────────
  {
    type:           MovementType.FLEXION_RIGHT,
    label:          'Flexion (Right)',
    shortLabel:     'Flexion R',
    plane:          'Sagittal plane',
    cameraView:     'side',
    normalRange:    [170, 180],
    availableSides: ['right'],
    instruction:    'Stand with your RIGHT side facing the camera. Raise your right arm forward and upward, keeping your elbow straight. Your full torso and arm must remain in frame.',
    calculate(landmarks) {
      // Only the near (right) shoulder is reliable in this camera orientation
      const hip      = lm(landmarks, PoseLandmark.RIGHT_HIP)
      const shoulder = lm(landmarks, PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, PoseLandmark.RIGHT_ELBOW)
      return calculateFlexionAngle(hip, shoulder, elbow)
    },
  },

  // ── Rotation ─────────────────────────────────────────────────────────────────
  {
    type:           MovementType.ROTATION,
    label:          'Rotation',
    shortLabel:     'Rotation',
    plane:          'Transverse plane (approximated)',
    cameraView:     'frontal',
    normalRange:    [60, 90],
    availableSides: ['left', 'right', 'both'],
    instruction:    'Stand facing the camera. Hold your upper arm at 90° abduction with your elbow bent to 90°, so your forearm points forward. Rotate your forearm up (external) or down (internal) while keeping your upper arm still.',
    calculate(landmarks, side) {
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      const wrist    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_WRIST    : PoseLandmark.RIGHT_WRIST)
      return calculateRotationAngle(shoulder, elbow, wrist)
    },
  },
]

// Lookup by MovementType — used when decoding a session URL
export const MOVEMENT_CONFIG_MAP = new Map(
  MOVEMENT_CONFIGS.map(c => [c.type, c])
)

export const DEFAULT_MOVEMENT = MOVEMENT_CONFIGS[0]