<template>
  <div class="capture-page">

    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <span class="logo">SHOULDER<span class="logo-accent">TRACK</span></span>
        <nav class="nav">
          <NuxtLink to="/" class="nav-link active">Capture</NuxtLink>
          <NuxtLink to="/dashboard" class="nav-link">Dashboard</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="main">

      <!-- Camera panel -->
      <section class="camera-panel">
        <div class="camera-wrap" :class="{ running: isRunning }">
          <!-- Hidden video feed (source for MediaPipe) -->
          <video ref="videoEl" class="video-hidden" playsinline muted />

          <!-- Canvas receives the drawn output -->
          <canvas ref="canvasEl" class="canvas-output" />

          <!-- Overlay shown before camera starts -->
          <div v-if="!isRunning && !isLoading" class="camera-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </div>
            <p>Camera not started</p>
          </div>

          <div v-if="isLoading" class="camera-placeholder">
            <div class="spinner"></div>
            <p>Loading model…</p>
          </div>

          <!-- Live recording indicator -->
          <div v-if="isRecording" class="rec-badge">
            <span class="rec-dot"></span> REC
          </div>
        </div>

        <!-- Camera controls -->
        <div class="controls">
          <button
            v-if="!isRunning"
            class="btn btn-primary"
            :disabled="isLoading"
            @click="start"
          >
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

        <!-- Error message -->
        <p v-if="error" class="error-msg">⚠ {{ error }}</p>
      </section>

      <!-- Angle readout panel -->
      <aside class="readout-panel">
        <h2 class="panel-title">Live Measurements</h2>
        <p class="panel-subtitle">Frontal-plane abduction · degrees</p>

        <div class="gauge-grid">
          <AngleGauge
            label="Left Shoulder"
            side="left"
            :angle="angles.leftAbduction"
          />
          <AngleGauge
            label="Right Shoulder"
            side="right"
            :angle="angles.rightAbduction"
          />
        </div>

        <!-- Symmetry indicator -->
        <div v-if="bothVisible" class="symmetry-row">
          <span class="sym-label">Symmetry difference</span>
          <span class="sym-value" :class="symmetryClass">{{ symmetryDiff }}°</span>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h3>Instructions</h3>
          <ol>
            <li>Stand facing the camera, arms at your sides.</li>
            <li>Raise one or both arms out to the side (abduction).</li>
            <li>Keep your full torso visible in the frame.</li>
            <li>Hit <strong>Record Session</strong> to capture data.</li>
          </ol>
        </div>
      </aside>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePoseLandmarker } from '~/composables/usePoseLandmarker'

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const {
  isLoading,
  isRunning,
  isRecording,
  angles,
  error,
  start,
  stop,
  startRecording,
  stopRecording,
} = usePoseLandmarker(videoEl, canvasEl)

function toggleRecording() {
  if (isRecording.value) {
    const frames = stopRecording()
    // TODO: persist frames to session store / dashboard
    console.log(`Recorded ${frames.length} frames`)
  } else {
    startRecording()
  }
}

const bothVisible = computed(
  () => angles.value.leftAbduction !== null && angles.value.rightAbduction !== null
)

const symmetryDiff = computed(() => {
  if (!bothVisible.value) return 0
  return Math.abs(
    Math.round(angles.value.leftAbduction!) - Math.round(angles.value.rightAbduction!)
  )
})

const symmetryClass = computed(() => {
  if (symmetryDiff.value <= 5) return 'sym-good'
  if (symmetryDiff.value <= 15) return 'sym-warn'
  return 'sym-bad'
})
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.capture-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
}

.header {
  border-bottom: 1px solid var(--border);
  padding: 0 2rem;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  font-family: var(--font-display);
  font-size: 1.2rem;
  letter-spacing: 0.12em;
  font-weight: 700;
}
.logo-accent { color: var(--accent); }

.nav { display: flex; gap: 1.5rem; }
.nav-link {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}
.nav-link:hover, .nav-link.active { color: var(--accent); }

.main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 2rem;
  align-items: start;
}

/* ── Camera panel ────────────────────────────────────────────────────────── */
.camera-panel { display: flex; flex-direction: column; gap: 1rem; }

.camera-wrap {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4/3;
  width: 100%;
}
.camera-wrap.running { border-color: var(--accent); }

.video-hidden {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.canvas-output {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.camera-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
}
.placeholder-icon svg {
  width: 56px;
  height: 56px;
  opacity: 0.4;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.rec-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(220, 38, 38, 0.85);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 4px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rec-dot {
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  animation: blink 1s step-start infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.controls { display: flex; gap: 0.75rem; }

.btn {
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

.btn-record {
  background: transparent;
  color: var(--accent);
  border-color: var(--accent);
}
.btn-record:hover { background: rgba(0, 229, 255, 0.08); }

.btn-danger {
  background: #dc2626;
  color: #fff;
}
.btn-danger:hover { background: #b91c1c; }

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border);
}
.btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }

.error-msg {
  color: #f87171;
  font-size: 0.875rem;
}

/* ── Readout panel ───────────────────────────────────────────────────────── */
.readout-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.panel-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  margin: 0;
}
.panel-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: -0.75rem 0 0;
}

.gauge-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* ── Symmetry row ────────────────────────────────────────────────────────── */
.symmetry-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.sym-label { font-size: 0.8rem; color: var(--text-muted); }
.sym-value { font-family: monospace; font-size: 1.1rem; font-weight: 700; }
.sym-good { color: #4ade80; }
.sym-warn { color: #facc15; }
.sym-bad  { color: #f87171; }

/* ── Instructions ────────────────────────────────────────────────────────── */
.instructions {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
.instructions h3 {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 0.75rem;
}
.instructions ol {
  padding-left: 1.25rem;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0;
}
.instructions li + li { margin-top: 0.25rem; }
.instructions strong { color: var(--text); }
</style>