<template>
  <div class="gauge" :class="`gauge--${side}`">
    <svg class="gauge-svg" viewBox="0 0 120 90">
      <!-- Track arc (0° to 180°) -->
      <path
        class="gauge-track"
        :d="arcPath(0, 180)"
        fill="none"
        stroke-width="8"
        stroke-linecap="round"
      />
      <!-- Value arc -->
      <path
        v-if="displayAngle !== null"
        class="gauge-fill"
        :d="arcPath(0, displayAngle)"
        fill="none"
        stroke-width="8"
        stroke-linecap="round"
      />
      <!-- Centre text -->
      <text x="60" y="72" text-anchor="middle" class="gauge-value">
        {{ displayAngle !== null ? Math.round(displayAngle) : '—' }}
      </text>
      <text x="60" y="84" text-anchor="middle" class="gauge-unit">
        {{ displayAngle !== null ? 'degrees' : 'no signal' }}
      </text>
    </svg>
    <p class="gauge-label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { smoothAngle } from '~/utils/angleCalculations'

const props = defineProps<{
  label: string
  side: 'left' | 'right'
  angle: number | null
}>()

// Use the passed angle directly (already smoothed in composable)
const displayAngle = computed(() => props.angle)

// ── Arc geometry ──────────────────────────────────────────────────────────
// The arc sits in the top half of a 120×90 viewBox.
// 0° maps to left end, 180° to right end.
const CX = 60
const CY = 76
const R = 52

function polarToXY(deg: number) {
  const rad = (Math.PI * (180 - deg)) / 180
  return {
    x: CX + R * Math.cos(rad),
    y: CY - R * Math.sin(rad),
  }
}

function arcPath(startDeg: number, endDeg: number): string {
  const clamped = Math.max(0, Math.min(180, endDeg))
  const start = polarToXY(startDeg)
  const end = polarToXY(clamped)
  const largeArc = clamped - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
</script>

<style scoped>
.gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.gauge-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.gauge-track {
  stroke: var(--border);
}

.gauge-fill {
  stroke: var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
  transition: d 0.1s ease;
}

.gauge-value {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  fill: var(--text);
}
.gauge-unit {
  font-size: 8px;
  fill: var(--text-muted);
}

.gauge-label {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
  text-align: center;
}
</style>