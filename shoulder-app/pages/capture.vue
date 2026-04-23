<template>
  <div class="capture-page">
    <header class="header">
      <div class="header-inner">
        <span class="logo">PLACEHOLDER<span class="logo-accent">LOGO</span></span>
        <nav class="nav">
          <NuxtLink to="/capture" class="nav-link active">Capture</NuxtLink>
          <NuxtLink to="/dashboard" class="nav-link">Dashboard</NuxtLink>
          <NuxtLink to="/practitioner" class="nav-link">Practitioner</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="main">
      <section class="camera-panel">
        <div class="camera-wrap" :class="{ running: isRunning, locked: measurement.isLocked.value }">
          <video ref="videoEl" class="video-hidden" playsinline muted />
          <canvas ref="canvasEl" class="canvas-output" />

          <div v-if="!isRunning && !isLoading" class="camera-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </div>
            <p>Camera not started</p>
          </div>
          <div v-if="isLoading" class="camera-placeholder">
            <div class="spinner" /><p>Loading model…</p>
          </div>

          <!-- Camera orientation badge -->
          <div v-if="isRunning" class="orientation-badge">
            {{ activeConfig.cameraView === 'frontal' ? 'Face camera' : 'Side-on to camera' }}
          </div>

          <!-- Locked overlay -->
          <div v-if="measurement.isLocked.value" class="locked-overlay">
            <div class="locked-icon">✓</div>
            <p class="locked-text">Measurement captured</p>
          </div>
        </div>

        <!-- Active arm indicator — shown whenever camera is running -->
        <div v-if="isRunning" class="arm-indicator">
          <div class="arm-chip" :class="{ active: showLeft, inactive: !showLeft }">
            <span class="arm-dot" />
            Left arm
          </div>
          <div class="arm-divider" />
          <div class="arm-chip" :class="{ active: showRight, inactive: !showRight }">
            <span class="arm-dot" />
            Right arm
          </div>
        </div>

        <div class="controls">
          <button v-if="!isRunning" class="btn btn-primary" :disabled="isLoading" @click="start">
            {{ isLoading ? 'Loading…' : 'Start Camera' }}
          </button>
          <template v-else>
            <button class="btn btn-reset-sm" @click="handleReset">↺ Reset</button>
            <button class="btn btn-ghost" @click="stop">Stop Camera</button>
          </template>
        </div>
        <p v-if="error" class="error-msg">⚠ {{ error }}</p>
      </section>

      <!-- Readout panel -->
      <aside class="readout-panel">

        <!-- Patient notes (directed mode) -->
        <div v-if="sessionConfig?.notes" class="notes-banner">
          <span class="notes-icon">📋</span>
          <p class="notes-text">{{ sessionConfig.notes }}</p>
        </div>

        <!-- Step indicator (directed mode) -->
        <div v-if="isDirectedMode" class="step-indicator">
          <span class="step-label">Step</span>
          <span class="step-count">{{ currentStepIndex + 1 }} / {{ directedSteps.length }}</span>
        </div>

        <!-- Movement tabs (free mode only) -->
        <div v-if="!isDirectedMode" class="movement-selector">
          <p class="selector-label">Movement</p>
          <div class="selector-tabs">
            <button
              v-for="config in MOVEMENT_CONFIGS"
              :key="config.type"
              class="tab-btn"
              :class="{ active: activeConfig.type === config.type }"
              @click="selectMovement(config)"
            >
              {{ config.shortLabel }}
            </button>
          </div>
        </div>

        <!-- Movement info -->
        <div class="movement-info">
          <p class="movement-label">{{ activeConfig.label }}</p>
          <p class="movement-plane">{{ activeConfig.plane }}</p>
          <p class="movement-instruction">{{ activeConfig.instruction }}</p>
        </div>

        <!-- Measurement -->
        <div class="measurement-section">
          <h2 class="panel-title">Measurement</h2>

          <div class="status-pill" :class="measurement.state.value">
            {{ statusLabel }}
          </div>

          <div class="gauge-grid">
            <MeasurementGauge
              v-if="showLeft"
              label="Left"
              :liveAngle="angles.left"
              :lockedAngle="measurement.lockedLeft.value"
              :holdProgress="measurement.holdProgressLeft.value"
              :normalRange="activeConfig.normalRange"
            />
            <MeasurementGauge
              v-if="showRight"
              label="Right"
              :liveAngle="angles.right"
              :lockedAngle="measurement.lockedRight.value"
              :holdProgress="measurement.holdProgressRight.value"
              :normalRange="activeConfig.normalRange"
            />
          </div>
        </div>

        <!-- Post-lock actions -->
        <div v-if="measurement.isLocked.value" class="locked-actions">
          <div class="locked-summary">
            <div v-for="r in measurement.results.value" :key="r.side" class="locked-result">
              <span class="locked-result-side">{{ r.side }}</span>
              <span class="locked-result-value">{{ Math.round(r.degrees) }}°</span>
            </div>
          </div>
          <button v-if="isDirectedMode && !isLastStep" class="btn btn-primary btn-full" @click="nextStep">
            Next Movement →
          </button>
          <button v-else-if="isDirectedMode && isLastStep" class="btn btn-finish btn-full" @click="finishSession">
            Finish Session ✓
          </button>
        </div>

      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePoseLandmarker }        from '~/composables/usePoseLandmarker'
import { useMeasurement }           from '~/composables/useMeasurement'
import { MOVEMENT_CONFIGS, MOVEMENT_CONFIG_MAP, DEFAULT_MOVEMENT } from '~/utils/movementConfigs'
import { decodeSessionConfig }      from '~/types/pose'
import type { MovementConfig, SessionConfig } from '~/types/pose'

const videoEl  = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const sessionConfig    = ref<SessionConfig | null>(null)
const directedSteps    = ref<{ config: MovementConfig; side: string }[]>([])
const currentStepIndex = ref(0)
const isDirectedMode   = computed(() => directedSteps.value.length > 0)
const isLastStep       = computed(() => currentStepIndex.value === directedSteps.value.length - 1)

const activeConfig = ref<MovementConfig>(DEFAULT_MOVEMENT)

// Which sides to show gauges for — driven by activeSides on the config
const showLeft  = computed(() => activeConfig.value.activeSides.includes('left'))
const showRight = computed(() => activeConfig.value.activeSides.includes('right'))

const measurement = useMeasurement()

const { isLoading, isRunning, angles, error, start, stop, resetSmoothing } =
  usePoseLandmarker(videoEl, canvasEl, activeConfig, measurement)

onMounted(() => {
  const decoded = decodeSessionConfig(new URLSearchParams(window.location.search))
  if (decoded?.movements.length) {
    sessionConfig.value = decoded
    directedSteps.value = decoded.movements.flatMap(pm => {
      const config = MOVEMENT_CONFIG_MAP.get(pm.movementType)
      return config ? [{ config, side: pm.side }] : []
    })
    applyStep(0)
  }
})

function applyStep(index: number) {
  const step = directedSteps.value[index]
  if (!step) return
  activeConfig.value = step.config
  resetSmoothing()
  measurement.reset()
}

function nextStep() {
  currentStepIndex.value++
  applyStep(currentStepIndex.value)
}

function finishSession() {
  alert('Session complete! Results wiring coming in the next step.')
}

function selectMovement(config: MovementConfig) {
  activeConfig.value = config
  resetSmoothing()
  measurement.reset()
}

function handleReset() {
  resetSmoothing()
  measurement.reset()
}

const statusLabel = computed(() => {
  if (!isRunning.value) return 'Camera off'
  switch (measurement.state.value) {
    case 'watching': return 'Raise your arm to begin'
    case 'tracking': return 'Tracking — push to your maximum'
    case 'holding':  return 'Hold still…'
    case 'locked':   return 'Measurement locked ✓'
  }
})
</script>

<style scoped>
.capture-page {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: var(--font-body); display: flex; flex-direction: column;
}

.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner {
  max-width: 1200px; margin: 0 auto; height: 60px;
  display: flex; align-items: center; justify-content: space-between;
}
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.nav { display: flex; gap: 1.5rem; }
.nav-link {
  font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--text-muted); text-decoration: none; transition: color 0.2s;
}
.nav-link:hover, .nav-link.active { color: var(--accent); }

.main {
  flex: 1; max-width: 1200px; margin: 0 auto; width: 100%; padding: 2rem;
  display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;
}

/* Camera */
.camera-panel  { display: flex; flex-direction: column; gap: 0.75rem; }
.camera-wrap {
  position: relative; background: var(--surface);
  border: 2px solid var(--border); border-radius: 12px;
  overflow: hidden; aspect-ratio: 4/3; transition: border-color 0.3s;
}
.camera-wrap.running { border-color: var(--accent); }
.camera-wrap.locked  { border-color: #4ade80; }
.video-hidden  { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.canvas-output { width: 100%; height: 100%; object-fit: cover; display: block; }

.camera-placeholder {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted);
}
.placeholder-icon svg { width: 56px; height: 56px; opacity: 0.4; }
.spinner {
  width: 36px; height: 36px; border: 3px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.orientation-badge {
  position: absolute; top: 12px; right: 12px;
  background: rgba(0,0,0,0.65); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 0.72rem; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 4px;
}
.locked-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.75rem; background: rgba(0,0,0,0.45);
}
.locked-icon {
  width: 64px; height: 64px; border-radius: 50%; background: #4ade80; color: #000;
  font-size: 2rem; display: flex; align-items: center; justify-content: center; font-weight: 700;
}
.locked-text { color: #fff; font-weight: 600; font-size: 1rem; }

/* Active arm indicator */
.arm-indicator {
  display: flex; align-items: center; gap: 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden;
}
.arm-chip {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.55rem 0.75rem; font-size: 0.82rem; font-weight: 600;
  transition: all 0.2s;
}
.arm-chip.active   { background: rgba(0,229,255,0.1); color: var(--accent); }
.arm-chip.inactive { color: var(--text-muted); opacity: 0.4; }
.arm-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: currentColor; flex-shrink: 0;
}
.arm-divider { width: 1px; background: var(--border); align-self: stretch; }

/* Controls */
.controls { display: flex; gap: 0.75rem; }
.btn {
  padding: 0.55rem 1.2rem; border-radius: 8px; font-size: 0.875rem;
  font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
  border: 1px solid transparent; transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary  { background: var(--accent); color: #000; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-ghost    { background: transparent; color: var(--text-muted); border-color: var(--border); }
.btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }
.btn-reset-sm { background: transparent; color: var(--text-muted); border-color: var(--border); }
.btn-reset-sm:hover { color: var(--text); border-color: var(--text-muted); }
.btn-finish   { background: #4ade80; color: #000; font-weight: 700; border: none; cursor: pointer; }
.btn-finish:hover { background: #86efac; }
.btn-full     { width: 100%; padding: 0.75rem; border-radius: 8px; }
.error-msg    { color: #f87171; font-size: 0.875rem; }

/* Readout panel */
.readout-panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;
}

.notes-banner {
  display: flex; gap: 0.75rem; align-items: flex-start;
  background: rgba(0,229,255,0.06); border: 1px solid rgba(0,229,255,0.2);
  border-radius: 8px; padding: 0.75rem 1rem;
}
.notes-icon { font-size: 1rem; flex-shrink: 0; }
.notes-text { font-size: 0.82rem; margin: 0; line-height: 1.5; }

.step-indicator {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0.75rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px;
}
.step-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.step-count { font-family: var(--font-mono); font-size: 0.9rem; font-weight: 700; color: var(--accent); }

.selector-label { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.5rem; }
.selector-tabs  { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tab-btn {
  flex: 1; padding: 0.45rem 0.5rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border); background: var(--bg); color: var(--text-muted); transition: all 0.2s;
}
.tab-btn:hover  { color: var(--text); border-color: var(--text-muted); }
.tab-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

.movement-info        { display: flex; flex-direction: column; gap: 0.3rem; }
.movement-label       { font-family: var(--font-display); font-size: 1rem; font-weight: 700; margin: 0; }
.movement-plane       { font-size: 0.72rem; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
.movement-instruction { font-size: 0.82rem; color: var(--text-muted); margin: 0; line-height: 1.5; }

.measurement-section { display: flex; flex-direction: column; gap: 0.75rem; }
.panel-title { font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.06em; margin: 0; }

.status-pill {
  font-size: 0.78rem; font-weight: 600; letter-spacing: 0.05em;
  padding: 0.35rem 0.75rem; border-radius: 20px; text-align: center;
  border: 1px solid var(--border); color: var(--text-muted); background: var(--bg); transition: all 0.3s;
}
.status-pill.tracking { border-color: var(--accent); color: var(--accent); background: rgba(0,229,255,0.06); }
.status-pill.holding  { border-color: #facc15; color: #facc15; background: rgba(250,204,21,0.08); }
.status-pill.locked   { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,0.08); }

.gauge-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.locked-actions  { display: flex; flex-direction: column; gap: 1rem; }
.locked-summary  { display: flex; gap: 0.75rem; }
.locked-result   {
  flex: 1; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25);
  border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
}
.locked-result-side  { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #4ade80; }
.locked-result-value { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: #fff; }
</style>