/**
 * movementConfigs.ts
 *
 * A single config object per movement type.  Adding a new movement in future
 * only requires adding an entry here — no changes needed in the composable
 * or the UI component.
 */

import type { MovementConfig, Landmark } from '~/types/pose'
import { MovementType, PoseLandmark } from '~/types/pose'
import {
  calculateAbductionAngle,
  calculateFlexionAngle,
  calculateRotationAngle,
} from '~/utils/angleCalculations'

function lm(landmarks: Landmark[], idx: number): Landmark {
  return landmarks[idx]
}

export const MOVEMENT_CONFIGS: MovementConfig[] = [
  {
    type:        MovementType.ABDUCTION,
    label:       'Abduction',
    shortLabel:  'Abduction',
    plane:       'Frontal (coronal) plane',
    cameraView:  'frontal',
    normalRange: [170, 180],
    instruction: 'Stand facing the camera with arms at your sides. Raise one or both arms straight out to the side, keeping your elbow straight. Your full torso must remain visible.',
    calculate(landmarks, side) {
      const hip      = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_HIP      : PoseLandmark.RIGHT_HIP)
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      return calculateAbductionAngle(hip, shoulder, elbow)
    },
  },

  {
    type:        MovementType.FLEXION,
    label:       'Flexion',
    shortLabel:  'Flexion',
    plane:       'Sagittal plane',
    cameraView:  'side',
    normalRange: [170, 180],
    instruction: 'Stand sideways to the camera (left or right side facing the lens). Raise your arm forward and upward, keeping your elbow straight. Your full torso and arm must remain in frame.',
    calculate(landmarks, side) {
      const hip      = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_HIP      : PoseLandmark.RIGHT_HIP)
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      return calculateFlexionAngle(hip, shoulder, elbow)
    },
  },

  {
    type:        MovementType.ROTATION,
    label:       'Rotation',
    shortLabel:  'Rotation',
    plane:       'Transverse plane (approximated)',
    cameraView:  'frontal',
    normalRange: [60, 90],
    instruction: 'Stand facing the camera. Hold your upper arm at 90° abduction with your elbow bent to 90°, so your forearm points forward. Rotate your forearm up (external) or down (internal) while keeping your upper arm still.',
    calculate(landmarks, side) {
      const shoulder = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_SHOULDER : PoseLandmark.RIGHT_SHOULDER)
      const elbow    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_ELBOW    : PoseLandmark.RIGHT_ELBOW)
      const wrist    = lm(landmarks, side === 'left' ? PoseLandmark.LEFT_WRIST    : PoseLandmark.RIGHT_WRIST)
      return calculateRotationAngle(shoulder, elbow, wrist)
    },
  },
]

export const DEFAULT_MOVEMENT = MOVEMENT_CONFIGS[0]