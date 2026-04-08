<template>
  <div class="prac-page">

    <header class="header">
      <div class="header-inner">
        <span class="logo">PLACEHOLDER<span class="logo-accent">LOGO</span></span>
        <span class="role-badge">Practitioner</span>
      </div>
    </header>

    <main class="main">
      <div class="builder">

        <!-- Left col: movement picker -->
        <section class="card">
          <h2 class="card-title">Select Movements</h2>
          <p class="card-sub">Add the movements you want this patient to perform.</p>

          <div class="movement-list">
            <div
              v-for="config in MOVEMENT_CONFIGS"
              :key="config.type"
              class="movement-row"
            >
              <div class="movement-meta">
                <span class="movement-name">{{ config.label }}</span>
                <span class="movement-plane">{{ config.plane }}</span>
              </div>

              <!-- Side selector -->
              <div class="side-btns">
                <button
                  v-for="side in config.availableSides"
                  :key="side"
                  class="side-btn"
                  :class="{ active: isPrescribed(config.type, side) }"
                  @click="toggleMovement(config.type, side)"
                >
                  {{ sideLabel(side) }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Right col: notes + session summary -->
        <section class="card">
          <h2 class="card-title">Session Details</h2>

          <div class="field">
            <label class="field-label" for="notes">Patient notes</label>
            <textarea
              id="notes"
              v-model="notes"
              class="field-textarea"
              rows="4"
              placeholder="e.g. Focus on left shoulder, patient reports pain above 90°…"
            />
          </div>

          <!-- Summary -->
          <div class="summary">
            <h3 class="summary-title">Session summary</h3>

            <div v-if="prescribed.length === 0" class="summary-empty">
              No movements selected yet.
            </div>

            <ol v-else class="summary-list">
              <li
                v-for="(item, i) in prescribed"
                :key="i"
                class="summary-item"
              >
                <span class="summary-movement">{{ labelFor(item.movementType) }}</span>
                <span class="summary-side">{{ item.side }}</span>
                <button class="summary-remove" @click="removeMovement(i)" title="Remove">✕</button>
              </li>
            </ol>

            <div v-if="notes" class="summary-notes">
              <span class="summary-notes-label">Notes:</span> {{ notes }}
            </div>
          </div>

          <!-- Launch button -->
          <button
            class="btn btn-launch"
            :disabled="prescribed.length === 0"
            @click="launchSession"
          >
            Launch Patient Session →
          </button>

          <p v-if="prescribed.length === 0" class="launch-hint">
            Select at least one movement to continue.
          </p>
        </section>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MOVEMENT_CONFIGS }        from '~/utils/movementConfigs'
import { encodeSessionConfig }     from '~/types/pose'
import type { PrescribedMovement } from '~/types/pose'
import type { MovementType, Side } from '~/types/pose'

const prescribed = ref<PrescribedMovement[]>([])
const notes      = ref('')

// ── Helpers ───────────────────────────────────────────────────────────────────
function sideLabel(side: Side): string {
  return side === 'both' ? 'Both' : side === 'left' ? 'Left' : 'Right'
}

function labelFor(type: MovementType): string {
  return MOVEMENT_CONFIGS.find(c => c.type === type)?.label ?? type
}

function isPrescribed(type: MovementType, side: Side): boolean {
  return prescribed.value.some(p => p.movementType === type && p.side === side)
}

function toggleMovement(type: MovementType, side: Side) {
  const idx = prescribed.value.findIndex(p => p.movementType === type && p.side === side)
  if (idx >= 0) {
    prescribed.value.splice(idx, 1)
  } else {
    prescribed.value.push({ movementType: type, side })
  }
}

function removeMovement(index: number) {
  prescribed.value.splice(index, 1)
}

// ── Launch ────────────────────────────────────────────────────────────────────
function launchSession() {
  const params = encodeSessionConfig({
    movements: prescribed.value,
    notes:     notes.value,
  })
  // Open the capture page with the session config encoded in the URL
  const url = `${window.location.origin}/capture?${params.toString()}`
  window.open(url, '_blank')
}
</script>

<style scoped>
.prac-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
}

/* Header */
.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner {
  max-width: 1100px; margin: 0 auto; height: 60px;
  display: flex; align-items: center; gap: 1rem;
}
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.role-badge {
  font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(0,229,255,0.1); color: var(--accent);
  border: 1px solid rgba(0,229,255,0.25); border-radius: 4px;
  padding: 2px 8px;
}

/* Layout */
.main { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: 2rem; }
.builder { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }

/* Card */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 1.75rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}
.card-title { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.05em; margin: 0; }
.card-sub   { font-size: 0.85rem; color: var(--text-muted); margin: -0.75rem 0 0; }

/* Movement list */
.movement-list  { display: flex; flex-direction: column; gap: 0.75rem; }
.movement-row   {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px; gap: 1rem;
}
.movement-meta  { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.movement-name  { font-size: 0.9rem; font-weight: 600; }
.movement-plane { font-size: 0.72rem; color: var(--text-muted); }
.side-btns      { display: flex; gap: 0.4rem; flex-shrink: 0; }
.side-btn {
  padding: 0.3rem 0.7rem; border-radius: 5px; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); transition: all 0.15s;
}
.side-btn:hover  { border-color: var(--accent); color: var(--text); }
.side-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

/* Notes field */
.field        { display: flex; flex-direction: column; gap: 0.5rem; }
.field-label  { font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.field-textarea {
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-family: var(--font-body); font-size: 0.875rem;
  padding: 0.75rem; resize: vertical; transition: border-color 0.2s;
}
.field-textarea:focus { outline: none; border-color: var(--accent); }
.field-textarea::placeholder { color: var(--text-muted); }

/* Summary */
.summary        { display: flex; flex-direction: column; gap: 0.75rem; }
.summary-title  {
  font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--text-muted); margin: 0;
}
.summary-empty  { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
.summary-list   { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.summary-item   {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.75rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem;
}
.summary-movement { flex: 1; font-weight: 600; }
.summary-side     {
  font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--accent); background: rgba(0,229,255,0.08);
  border: 1px solid rgba(0,229,255,0.2); border-radius: 4px; padding: 1px 6px;
}
.summary-remove {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 0.75rem; padding: 2px 4px; border-radius: 3px; transition: color 0.15s;
}
.summary-remove:hover { color: #f87171; }
.summary-notes       { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }
.summary-notes-label { color: var(--text); font-style: normal; font-weight: 600; }

/* Launch */
.btn-launch {
  width: 100%; padding: 0.75rem; border-radius: 8px;
  background: var(--accent); color: #000;
  font-size: 0.9rem; font-weight: 700; letter-spacing: 0.04em;
  border: none; cursor: pointer; transition: background 0.2s;
}
.btn-launch:hover:not(:disabled)  { background: var(--accent-hover); }
.btn-launch:disabled               { opacity: 0.4; cursor: not-allowed; }
.launch-hint { font-size: 0.78rem; color: var(--text-muted); text-align: center; margin: -0.5rem 0 0; }
</style>