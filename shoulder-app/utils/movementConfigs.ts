/**
 * movementConfigs.ts
 *
 * One config object per movement. Two key side fields:
 *
 *   availableSides — which sides the practitioner can prescribe (UI only)
 *   activeSides    — which sides the composable actually calculates each frame.
 *                    For side-on movements this is intentionally restricted to
 *                    the near shoulder only, because MediaPipe frequently
 *                    misidentifies left/right landmarks on an occluded far side.
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

  // ── Abduction (frontal, both arms) ─────────────────────────────────────────
  {
    type:           MovementType.ABDUCTION,
    label:          'Abduction',
    shortLabel:     'Abduction',
    plane:          'Frontal (coronal) plane',
    cameraView:     'frontal',
    normalRange:    [170, 180],
    availableSides: ['left', 'right', 'both'],
    activeSides:    ['left', 'right'],   // both sides always calculated
    instruction:    'Stand facing the camera with arms at your sides. Raise one or both arms straight out to the side, keeping your elbow straight. Your full torso must remain visible.',
    calculate(landmarks, side) {
      const hip      = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_HIP      : PoseLandmark.RIGHT_HIP)
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      return calculateAbductionAngle(hip, shoulder, elbow)
    },
  },

  // ── Flexion left (patient's LEFT side faces camera) ─────────────────────────
  {
    type:           MovementType.FLEXION_LEFT,
    label:          'Flexion (Left)',
    shortLabel:     'Flexion L',
    plane:          'Sagittal plane',
    cameraView:     'side',
    normalRange:    [170, 180],
    availableSides: ['left'],
    activeSides:    ['left'],            // right shoulder occluded — never calculate it
    instruction:    'Stand with your LEFT side facing the camera. Raise your left arm forward and upward, keeping your elbow straight. Your full torso and arm must remain in frame.',
    calculate(landmarks, _side) {
      return calculateFlexionAngle(
        lm(landmarks, PoseLandmark.LEFT_HIP),
        lm(landmarks, PoseLandmark.LEFT_SHOULDER),
        lm(landmarks, PoseLandmark.LEFT_ELBOW),
      )
    },
  },

  // ── Flexion right (patient's RIGHT side faces camera) ───────────────────────
  {
    type:           MovementType.FLEXION_RIGHT,
    label:          'Flexion (Right)',
    shortLabel:     'Flexion R',
    plane:          'Sagittal plane',
    cameraView:     'side',
    normalRange:    [170, 180],
    availableSides: ['right'],
    activeSides:    ['right'],           // left shoulder occluded — never calculate it
    instruction:    'Stand with your RIGHT side facing the camera. Raise your right arm forward and upward, keeping your elbow straight. Your full torso and arm must remain in frame.',
    calculate(landmarks, _side) {
      return calculateFlexionAngle(
        lm(landmarks, PoseLandmark.RIGHT_HIP),
        lm(landmarks, PoseLandmark.RIGHT_SHOULDER),
        lm(landmarks, PoseLandmark.RIGHT_ELBOW),
      )
    },
  },

  // ── Rotation (frontal, elbow at 90°) ───────────────────────────────────────
  {
    type:           MovementType.ROTATION,
    label:          'Rotation',
    shortLabel:     'Rotation',
    plane:          'Transverse plane (approximated)',
    cameraView:     'frontal',
    normalRange:    [60, 90],
    availableSides: ['left', 'right', 'both'],
    activeSides:    ['left', 'right'],
    instruction:    'Stand facing the camera. Hold your upper arm at 90° abduction with your elbow bent to 90°, so your forearm points forward. Rotate your forearm up (external) or down (internal) while keeping your upper arm still.',
    calculate(landmarks, side) {
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      const wrist    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_WRIST    : PoseLandmark.RIGHT_WRIST)
      return calculateRotationAngle(shoulder, elbow, wrist)
    },
  },
]

export const MOVEMENT_CONFIG_MAP = new Map(MOVEMENT_CONFIGS.map(c => [c.type, c]))
export const DEFAULT_MOVEMENT    = MOVEMENT_CONFIGS[0]