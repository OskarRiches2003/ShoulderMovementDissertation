<template>
  <div class="gauge">
    <svg class="gauge-svg" viewBox="0 0 120 90">
      <!-- Track -->
      <path class="gauge-track" :d="arcPath(0, 180)" fill="none" stroke-width="8" stroke-linecap="round" />
      <!-- Normal range highlight -->
      <path
        v-if="normalRange"
        class="gauge-normal"
        :d="arcPath(normalRange[0], normalRange[1])"
        fill="none" stroke-width="8" stroke-linecap="round"
      />
      <!-- Value arc -->
      <path
        v-if="displayAngle !== null"
        class="gauge-fill"
        :class="rangeClass"
        :d="arcPath(0, Math.abs(displayAngle))"
        fill="none" stroke-width="8" stroke-linecap="round"
      />
      <!-- Value text -->
      <text x="60" y="70" text-anchor="middle" class="gauge-value">
        {{ displayAngle !== null ? formatValue(displayAngle) : '—' }}
      </text>
      <text x="60" y="82" text-anchor="middle" class="gauge-unit">
        {{ displayAngle !== null ? unitLabel : 'no signal' }}
      </text>
    </svg>
    <p class="gauge-label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label:        string
  angle:        number | null
  normalRange?: [number, number]  // e.g. [170, 180] for abduction/flexion, [60, 90] for rotation
}>()

const displayAngle = computed(() => props.angle)

// Rotation returns signed values (–90 to +90), others are 0–180
const isRotation = computed(() => (props.normalRange?.[1] ?? 180) <= 90)

function formatValue(v: number): string {
  if (isRotation.value) {
    const abs = Math.abs(Math.round(v))
    return `${abs}`
  }
  return `${Math.round(v)}`
}

const unitLabel = computed(() => {
  if (!isRotation.value) return 'degrees'
  const v = displayAngle.value
  if (v === null) return ''
  return v >= 0 ? 'ext rot °' : 'int rot °'
})

// Colour the arc based on whether angle is in normal clinical range
const rangeClass = computed(() => {
  const v = displayAngle.value
  if (v === null || !props.normalRange) return 'range-default'
  const abs = Math.abs(v)
  if (abs >= props.normalRange[0]) return 'range-good'
  if (abs >= props.normalRange[0] * 0.6) return 'range-warn'
  return 'range-low'
})

// ── Arc geometry ──────────────────────────────────────────────────────────────
const CX = 60, CY = 76, R = 50

function polarToXY(deg: number) {
  const rad = (Math.PI * (180 - Math.min(180, Math.max(0, deg)))) / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

function arcPath(startDeg: number, endDeg: number): string {
  const s   = polarToXY(startDeg)
  const e   = polarToXY(endDeg)
  const lg  = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${lg} 0 ${e.x} ${e.y}`
}
</script>

<style scoped>
.gauge { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.gauge-svg { width: 100%; height: auto; overflow: visible; }

.gauge-track  { stroke: var(--border); }
.gauge-normal { stroke: rgba(74,222,128,0.15); }

.gauge-fill { transition: d 0.08s ease; filter: drop-shadow(0 0 3px currentColor); }
.range-default { stroke: var(--accent); color: var(--accent); }
.range-good    { stroke: #4ade80; color: #4ade80; }
.range-warn    { stroke: #facc15; color: #facc15; }
.range-low     { stroke: #f87171; color: #f87171; }

.gauge-value { font-family: var(--font-display); font-size: 20px; font-weight: 700; fill: var(--text); }
.gauge-unit  { font-size: 7.5px; fill: var(--text-muted); }
.gauge-label {
  font-size: 0.7rem; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--text-muted); margin: 0; text-align: center;
}
</style>