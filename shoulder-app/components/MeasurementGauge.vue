<template>
  <div class="gauge" :class="{ locked: isLocked }">
    <svg class="gauge-svg" viewBox="0 0 120 96">

      <!-- Track -->
      <path class="track" :d="arc(0, 180)" fill="none" stroke-width="8" stroke-linecap="round" />

      <!-- Hold progress ring (amber, animates 0→1 over 1.5s) -->
      <path
        v-if="holdProgress > 0 && !isLocked"
        class="hold-ring"
        :d="arc(0, holdProgress * 180)"
        fill="none" stroke-width="8" stroke-linecap="round"
      />

      <!-- Live angle arc -->
      <path
        v-if="displayAngle !== null && !isLocked"
        class="live-arc"
        :class="rangeClass"
        :d="arc(0, Math.min(180, Math.abs(displayAngle)))"
        fill="none" stroke-width="8" stroke-linecap="round"
      />

      <!-- Locked arc (solid green) -->
      <path
        v-if="isLocked && lockedAngle !== null"
        class="locked-arc"
        :d="arc(0, Math.min(180, Math.abs(lockedAngle)))"
        fill="none" stroke-width="8" stroke-linecap="round"
      />

      <!-- Centre: live value or locked value -->
      <text x="60" y="70" text-anchor="middle" class="val-text" :class="{ 'val-locked': isLocked }">
        {{ displayText }}
      </text>
      <text x="60" y="83" text-anchor="middle" class="unit-text">
        {{ isLocked ? 'locked' : (displayAngle !== null ? 'degrees' : 'no signal') }}
      </text>

    </svg>

    <p class="gauge-label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label:        string
  liveAngle:    number | null
  lockedAngle:  number | null
  holdProgress: number          // 0–1
  normalRange:  [number, number]
}>()

const isLocked     = computed(() => props.lockedAngle !== null)
const displayAngle = computed(() => isLocked.value ? props.lockedAngle : props.liveAngle)

const displayText  = computed(() => {
  const v = displayAngle.value
  return v !== null ? `${Math.round(Math.abs(v))}` : '—'
})

const rangeClass = computed(() => {
  const v = props.liveAngle
  if (v === null) return ''
  const abs = Math.abs(v)
  if (abs >= props.normalRange[0]) return 'good'
  if (abs >= props.normalRange[0] * 0.6) return 'warn'
  return 'low'
})

// ── Arc geometry ──────────────────────────────────────────────────────────────
const CX = 60, CY = 78, R = 52

function polarToXY(deg: number) {
  const clamped = Math.max(0.5, Math.min(179.5, deg))
  const rad = (Math.PI * (180 - clamped)) / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

function arc(startDeg: number, endDeg: number): string {
  const s  = polarToXY(startDeg)
  const e  = polarToXY(endDeg)
  const lg = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${lg} 0 ${e.x} ${e.y}`
}
</script>

<style scoped>
.gauge { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.gauge-svg { width: 100%; height: auto; overflow: visible; }

.track      { stroke: var(--border); }
.hold-ring  { stroke: #facc15; opacity: 0.9; filter: drop-shadow(0 0 3px #facc15); }

.live-arc            { transition: d 0.08s ease; }
.live-arc.good       { stroke: #4ade80; filter: drop-shadow(0 0 3px #4ade80); }
.live-arc.warn       { stroke: #facc15; filter: drop-shadow(0 0 3px #facc15); }
.live-arc.low        { stroke: #f87171; filter: drop-shadow(0 0 3px #f87171); }

.locked-arc { stroke: #4ade80; filter: drop-shadow(0 0 5px #4ade80); }

.val-text   { font-family: var(--font-display); font-size: 22px; font-weight: 700; fill: var(--text); }
.val-locked { fill: #4ade80; }
.unit-text  { font-size: 8px; fill: var(--text-muted); }

.gauge-label {
  font-size: 0.7rem; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--text-muted); margin: 0; text-align: center;
}

.gauge.locked .gauge-label { color: #4ade80; }
</style>