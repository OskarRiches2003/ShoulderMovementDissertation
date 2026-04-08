<template>
  <div class="capture-page">

    <header class="header">
      <div class="header-inner">
        <span class="logo">PLACEHOLDER<span class="logo-accent">LOGO</span></span>
        <nav class="nav">
          <NuxtLink to="/" class="nav-link active">Capture</NuxtLink>
          <NuxtLink to="/dashboard" class="nav-link">Dashboard</NuxtLink>
          <NuxtLink to="/practitioner" class="nav-link">Practitioner</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="main">

      <!-- Camera panel -->
      <section class="camera-panel">
        <div class="camera-wrap" :class="{ running: isRunning }">
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
            <div class="spinner" />
            <p>Loading model…</p>
          </div>

          <div v-if="isRunning" class="orientation-badge">
            {{ activeConfig.cameraView === 'frontal' ? 'Face camera' : 'Side-on to camera' }}
          </div>

          <div v-if="isRecording" class="rec-badge">
            <span class="rec-dot" /> REC
          </div>
        </div>

        <div class="controls">
          <button v-if="!isRunning" class="btn btn-primary" :disabled="isLoading" @click="start">
            {{ isLoading ? 'Loading…' : 'Start Camera' }}
          </button>
          <template v-else>
            <button
              class="btn"
              :class="isRecording ? 'btn-danger' : 'btn-record'"
              @click="toggleRecording"
            >
              {{ isRecording ? 'Stop Recording' : 'Record Session' }}
            </button>
            <button class="btn btn-ghost" @click="stop">Stop Camera</button>
          </template>
        </div>

        <p v-if="error" class="error-msg">⚠ {{ error }}</p>
      </section>

      <!-- Readout panel -->
      <aside class="readout-panel">

        <!-- Patient notes banner (directed mode only) -->
        <div v-if="sessionConfig && sessionConfig.notes" class="notes-banner">
          <span class="notes-icon">📋</span>
          <p class="notes-text">{{ sessionConfig.notes }}</p>
        </div>

        <!-- Directed mode: step indicator -->
        <div v-if="isDirectedMode" class="step-indicator">
          <span class="step-label">Movement</span>
          <span class="step-count">{{ currentStepIndex + 1 }} / {{ directedSteps.length }}</span>
        </div>

        <!-- Movement selector: tabs (free mode) or read-only label (directed mode) -->
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

        <!-- Gauges -->
        <h2 class="panel-title">Live Measurements</h2>
        <div class="gauge-grid">
          <AngleGauge
            v-if="showLeft"
            label="Left"
            :angle="angles.left"
            :normalRange="activeConfig.normalRange"
          />
          <AngleGauge
            v-if="showRight"
            label="Right"
            :angle="angles.right"
            :normalRange="activeConfig.normalRange"
          />
        </div>

        <!-- Symmetry (only when both sides are shown) -->
        <div v-if="showLeft && showRight && bothVisible" class="symmetry-row">
          <span class="sym-label">Asymmetry</span>
          <span class="sym-value" :class="symmetryClass">{{ symmetryDiff }}°</span>
        </div>

        <!-- Directed mode: next step button -->
        <div v-if="isDirectedMode" class="directed-controls">
          <button
            v-if="!isLastStep"
            class="btn btn-primary"
            @click="nextStep"
          >
            Next Movement →
          </button>
          <button
            v-else
            class="btn btn-finish"
            @click="finishSession"
          >
            Finish Session ✓
          </button>
        </div>

      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute }                  from 'vue-router'
import { usePoseLandmarker }         from '~/composables/usePoseLandmarker'
import { MOVEMENT_CONFIGS, MOVEMENT_CONFIG_MAP, DEFAULT_MOVEMENT } from '~/utils/movementConfigs'
import { decodeSessionConfig }       from '~/types/pose'
import type { MovementConfig, SessionConfig } from '~/types/pose'

const route    = useRoute()
const videoEl  = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

// ── Session config (present only when launched from practitioner app) ─────────
const sessionConfig = ref<SessionConfig | null>(null)

// Directed mode: ordered list of configs for this session
const directedSteps    = ref<{ config: MovementConfig; side: string }[]>([])
const currentStepIndex = ref(0)
const isDirectedMode   = computed(() => directedSteps.value.length > 0)
const isLastStep       = computed(() => currentStepIndex.value === directedSteps.value.length - 1)

// ── Active movement ───────────────────────────────────────────────────────────
const activeConfig = ref<MovementConfig>(DEFAULT_MOVEMENT)

// Which sides to display gauges for in the current step
const activeSide = ref<'left' | 'right' | 'both'>('both')
const showLeft   = computed(() => activeSide.value === 'left'  || activeSide.value === 'both')
const showRight  = computed(() => activeSide.value === 'right' || activeSide.value === 'both')

const {
  isLoading, isRunning, isRecording,
  angles, error,
  start, stop,
  startRecording, stopRecording,
  resetSmoothing,
} = usePoseLandmarker(videoEl, canvasEl, activeConfig)

// ── Read URL params on mount ──────────────────────────────────────────────────
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const decoded = decodeSessionConfig(params)

  if (decoded && decoded.movements.length > 0) {
    sessionConfig.value = decoded

    // Build the ordered step list from the prescribed movements
    directedSteps.value = decoded.movements.flatMap(pm => {
      const config = MOVEMENT_CONFIG_MAP.get(pm.movementType)
      if (!config) return []
      return [{ config, side: pm.side }]
    })

    applyStep(0)
  }
})

function applyStep(index: number) {
  const step = directedSteps.value[index]
  if (!step) return
  activeConfig.value = step.config
  activeSide.value   = step.side as 'left' | 'right' | 'both'
  resetSmoothing()
}

function nextStep() {
  if (!isLastStep.value) {
    currentStepIndex.value++
    applyStep(currentStepIndex.value)
  }
}

function finishSession() {
  // TODO: send results back / show summary
  alert('Session complete! Results will be sent to the practitioner in a future step.')
}

// ── Free mode movement selection ──────────────────────────────────────────────
function selectMovement(config: MovementConfig) {
  activeConfig.value = config
  activeSide.value   = 'both'
  resetSmoothing()
}

// ── Recording ─────────────────────────────────────────────────────────────────
function toggleRecording() {
  if (isRecording.value) {
    const frames = stopRecording()
    console.log(`Recorded ${frames.length} frames for ${activeConfig.value.label}`)
  } else {
    startRecording()
  }
}

// ── Symmetry ──────────────────────────────────────────────────────────────────
const bothVisible  = computed(() => angles.value.left !== null && angles.value.right !== null)
const symmetryDiff = computed(() =>
  bothVisible.value
    ? Math.abs(Math.round(angles.value.left!) - Math.round(angles.value.right!))
    : 0
)
const symmetryClass = computed(() => {
  if (symmetryDiff.value <= 5)  return 'sym-good'
  if (symmetryDiff.value <= 15) return 'sym-warn'
  return 'sym-bad'
})
</script>

<style scoped>
.capture-page {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: var(--font-body); display: flex; flex-direction: column;
}

/* Header */
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

/* Layout */
.main {
  flex: 1; max-width: 1200px; margin: 0 auto; width: 100%; padding: 2rem;
  display: grid; grid-template-columns: 1fr 340px; gap: 2rem; align-items: start;
}

/* Camera */
.camera-panel  { display: flex; flex-direction: column; gap: 1rem; }
.camera-wrap   {
  position: relative; background: var(--surface);
  border: 1px solid var(--border); border-radius: 12px;
  overflow: hidden; aspect-ratio: 4/3; width: 100%; transition: border-color 0.3s;
}
.camera-wrap.running { border-color: var(--accent); }
.video-hidden  { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.canvas-output { width: 100%; height: 100%; object-fit: cover; display: block; }

.camera-placeholder {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted);
}
.placeholder-icon svg { width: 56px; height: 56px; opacity: 0.4; }
.spinner {
  width: 36px; height: 36px; border: 3px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.orientation-badge {
  position: absolute; top: 12px; right: 12px;
  background: rgba(0,0,0,0.65); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 0.72rem; letter-spacing: 0.06em;
  padding: 4px 10px; border-radius: 4px;
}
.rec-badge {
  position: absolute; top: 12px; left: 12px;
  background: rgba(220,38,38,0.85); color: #fff;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em;
  padding: 4px 10px; border-radius: 4px; display: flex; align-items: center; gap: 6px;
}
.rec-dot { width: 8px; height: 8px; background: #fff; border-radius: 50%; animation: blink 1s step-start infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* Buttons */
.controls { display: flex; gap: 0.75rem; }
.btn {
  padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 0.875rem;
  font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
  border: 1px solid transparent; transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary  { background: var(--accent); color: #000; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-record   { background: transparent; color: var(--accent); border-color: var(--accent); }
.btn-record:hover { background: rgba(0,229,255,0.08); }
.btn-danger   { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-ghost    { background: transparent; color: var(--text-muted); border-color: var(--border); }
.btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }
.btn-finish   { background: #4ade80; color: #000; width: 100%; padding: 0.75rem; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; }
.btn-finish:hover { background: #86efac; }
.error-msg { color: #f87171; font-size: 0.875rem; }

/* Readout panel */
.readout-panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}

/* Notes banner */
.notes-banner {
  display: flex; gap: 0.75rem; align-items: flex-start;
  background: rgba(0,229,255,0.06); border: 1px solid rgba(0,229,255,0.2);
  border-radius: 8px; padding: 0.75rem 1rem;
}
.notes-icon { font-size: 1rem; flex-shrink: 0; }
.notes-text { font-size: 0.82rem; color: var(--text); margin: 0; line-height: 1.5; }

/* Step indicator */
.step-indicator {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0.75rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px;
}
.step-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.step-count { font-family: var(--font-mono); font-size: 0.9rem; font-weight: 700; color: var(--accent); }

/* Movement selector (free mode) */
.selector-label { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 0.5rem; }
.selector-tabs  { display: flex; gap: 0.5rem; }
.tab-btn {
  flex: 1; padding: 0.45rem 0.5rem; border-radius: 6px; font-size: 0.78rem;
  font-weight: 600; cursor: pointer; border: 1px solid var(--border);
  background: var(--bg); color: var(--text-muted); transition: all 0.2s;
}
.tab-btn:hover  { color: var(--text); border-color: var(--text-muted); }
.tab-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

/* Movement info */
.movement-info       { display: flex; flex-direction: column; gap: 0.3rem; }
.movement-label      { font-family: var(--font-display); font-size: 1rem; font-weight: 700; margin: 0; }
.movement-plane      { font-size: 0.72rem; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
.movement-instruction { font-size: 0.82rem; color: var(--text-muted); margin: 0; line-height: 1.5; }

/* Gauges */
.panel-title { font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.06em; margin: 0; }
.gauge-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

/* Symmetry */
.symmetry-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem; background: var(--bg);
  border-radius: 8px; border: 1px solid var(--border);
}
.sym-label { font-size: 0.8rem; color: var(--text-muted); }
.sym-value { font-family: monospace; font-size: 1.1rem; font-weight: 700; }
.sym-good  { color: #4ade80; }
.sym-warn  { color: #facc15; }
.sym-bad   { color: #f87171; }

/* Directed controls */
.directed-controls .btn { width: 100%; justify-content: center; }
.directed-controls .btn-primary { padding: 0.75rem; }
</style>