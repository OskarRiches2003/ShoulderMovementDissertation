/**
 * useMeasurement.ts
 *
 * Sustained-peak measurement state machine.
 *
 * Core behaviour:
 *   - Track a running peak angle per side
 *   - Hold timer only starts when the angle is AT or ABOVE the current peak
 *     (within a small tolerance for smoothing noise)
 *   - If the user pushes HIGHER than the current peak, the peak updates and
 *     the hold timer RESETS — they must hold the new higher angle
 *   - Lock-in only triggers after holding at the true peak for HOLD_DURATION_MS
 *
 * This prevents early lock-in mid-movement and rewards the patient reaching
 * their genuine maximum range.
 *
 * States:
 *   watching → arm below START_THRESHOLD, waiting to begin
 *   tracking → arm is up, peak is being tracked, not yet in hold window
 *   holding  → at peak, hold timer counting down
 *   locked   → confirmed measurement
 */

import { ref, computed } from 'vue'

const START_THRESHOLD_DEG = 5    // minimum angle before tracking starts
const HOLD_DURATION_MS    = 1500  // must hold at peak for this long to lock in
const PEAK_TOLERANCE_DEG  = 4     // within this of peak = "at peak" (smoothing noise margin)
const EXCEED_TOLERANCE_DEG = 2    // more than this above peak = new peak, reset timer

export type MeasurementState = 'watching' | 'tracking' | 'holding' | 'locked'

export interface MeasurementResult {
  side:    'left' | 'right'
  degrees: number
}

interface SideState {
  peak:      number | null
  locked:    number | null
  holdStart: number | null
  progress:  number
}

function freshSide(): SideState {
  return { peak: null, locked: null, holdStart: null, progress: 0 }
}

export function useMeasurement() {
  const state = ref<MeasurementState>('watching')

  const leftState  = ref<SideState>(freshSide())
  const rightState = ref<SideState>(freshSide())

  // Expose reactive values the UI needs directly
  const peakLeft    = computed(() => leftState.value.peak)
  const peakRight   = computed(() => rightState.value.peak)
  const lockedLeft  = computed(() => leftState.value.locked)
  const lockedRight = computed(() => rightState.value.locked)
  const holdProgressLeft  = computed(() => leftState.value.progress)
  const holdProgressRight = computed(() => rightState.value.progress)

  const isLocked = computed(() => state.value === 'locked')

  const results = computed<MeasurementResult[]>(() => {
    const out: MeasurementResult[] = []
    if (leftState.value.locked  !== null) out.push({ side: 'left',  degrees: leftState.value.locked })
    if (rightState.value.locked !== null) out.push({ side: 'right', degrees: rightState.value.locked })
    return out
  })

  // ── Per-side processing ────────────────────────────────────────────────────
  function processSide(s: SideState, angle: number | null, now: number): SideState {
    // Already locked — nothing to do
    if (s.locked !== null) return s

    // No signal or below threshold — reset hold timer, keep any existing peak
    if (angle === null || angle < START_THRESHOLD_DEG) {
      return { ...s, holdStart: null, progress: 0 }
    }

    const currentPeak = s.peak ?? angle

    // User has pushed ABOVE current peak (beyond noise tolerance) — new peak, reset timer
    if (angle > currentPeak + EXCEED_TOLERANCE_DEG) {
      return { ...s, peak: angle, holdStart: null, progress: 0 }
    }

    // User is AT or NEAR their peak — start/continue hold timer
    if (angle >= currentPeak - PEAK_TOLERANCE_DEG) {
      const holdStart = s.holdStart ?? now
      const elapsed   = now - holdStart
      const progress  = Math.min(1, elapsed / HOLD_DURATION_MS)

      if (elapsed >= HOLD_DURATION_MS) {
        // Held long enough at peak — lock it in
        return { peak: currentPeak, locked: currentPeak, holdStart, progress: 1 }
      }

      return { ...s, peak: currentPeak, holdStart, progress }
    }

    // Below peak tolerance but above threshold — still tracking, timer reset
    return { ...s, peak: currentPeak, holdStart: null, progress: 0 }
  }

  // ── Main update — called every frame ──────────────────────────────────────
  function update(
    leftAngle:   number | null,
    rightAngle:  number | null,
    activeSides: ('left' | 'right')[],
    now = Date.now(),
  ) {
    if (state.value === 'locked') return

    if (activeSides.includes('left'))  leftState.value  = processSide(leftState.value,  leftAngle,  now)
    if (activeSides.includes('right')) rightState.value = processSide(rightState.value, rightAngle, now)

    // Derive overall state
    const leftDone  = !activeSides.includes('left')  || leftState.value.locked  !== null
    const rightDone = !activeSides.includes('right') || rightState.value.locked !== null

    if (leftDone && rightDone) {
      state.value = 'locked'
      return
    }

    const leftHolding  = activeSides.includes('left')  && leftState.value.holdStart  !== null
    const rightHolding = activeSides.includes('right') && rightState.value.holdStart !== null

    if (leftHolding || rightHolding) {
      state.value = 'holding'
    } else if (
      (activeSides.includes('left')  && (leftAngle  ?? 0) >= START_THRESHOLD_DEG) ||
      (activeSides.includes('right') && (rightAngle ?? 0) >= START_THRESHOLD_DEG)
    ) {
      state.value = 'tracking'
    } else {
      state.value = 'watching'
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function reset() {
    state.value      = 'watching'
    leftState.value  = freshSide()
    rightState.value = freshSide()
  }

  return {
    state, isLocked, results,
    peakLeft, peakRight,
    lockedLeft, lockedRight,
    holdProgressLeft, holdProgressRight,
    update, reset,
  }
}