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

        <!-- Movement picker -->
        <section class="card">
          <h2 class="card-title">Select Movements</h2>
          <p class="card-sub">Choose a side for each movement to include in this session.</p>

          <div class="movement-list">
            <div
              v-for="row in PRACTITIONER_ROWS"
              :key="row.id"
              class="movement-row"
              :class="{ selected: selectionFor(row.id) !== null }"
            >
              <div class="movement-meta">
                <span class="movement-name">{{ row.label }}</span>
                <span class="movement-plane">{{ row.plane }}</span>
              </div>

              <!-- Radio-style side buttons: clicking active one deselects -->
              <div class="side-btns">
                <button
                  v-for="side in row.sides"
                  :key="side"
                  class="side-btn"
                  :class="{ active: selectionFor(row.id) === side }"
                  @click="selectSide(row.id, side)"
                >
                  {{ sideLabel(side) }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Notes + summary -->
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

          <div class="summary">
            <h3 class="summary-title">Session summary</h3>

            <div v-if="prescribedSteps.length === 0" class="summary-empty">
              No movements selected yet.
            </div>

            <ol v-else class="summary-list">
              <li v-for="(step, i) in prescribedSteps" :key="i" class="summary-item">
                <span class="summary-index">{{ i + 1 }}</span>
                <span class="summary-movement">{{ step.label }}</span>
                <span class="summary-side">{{ step.sideLabel }}</span>
              </li>
            </ol>

            <p v-if="hasBothFlexion" class="summary-hint">
              ℹ Flexion (Both) is split into two separate recordings — left side first, then right.
            </p>

            <div v-if="notes" class="summary-notes">
              <span class="summary-notes-label">Notes:</span> {{ notes }}
            </div>
          </div>

          <button
            class="btn-launch"
            :disabled="prescribedSteps.length === 0"
            @click="launchSession"
          >
            Launch Patient Session →
          </button>

          <p v-if="prescribedSteps.length === 0" class="launch-hint">
            Select at least one movement to continue.
          </p>
        </section>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MovementType }        from '~/types/pose'
import { encodeSessionConfig } from '~/types/pose'
import type { Side }           from '~/types/pose'

// ── Practitioner-facing movement rows ─────────────────────────────────────────
// Flexion is presented as one row here. "Both" internally expands to two steps.
interface PractitionerRow {
  id:    string
  label: string
  plane: string
  sides: Side[]
}

const PRACTITIONER_ROWS: PractitionerRow[] = [
  {
    id:    'abduction',
    label: 'Abduction',
    plane: 'Frontal (coronal) plane',
    sides: ['left', 'right', 'both'],
  },
  {
    id:    'flexion',
    label: 'Flexion',
    plane: 'Sagittal plane',
    sides: ['left', 'right', 'both'],
  },
  {
    id:    'rotation',
    label: 'Rotation',
    plane: 'Transverse plane (approximated)',
    sides: ['left', 'right', 'both'],
  },
]

// ── Selection state: one side (or null) per row ────────────────────────────────
const selections = ref<Record<string, Side | null>>({
  abduction: null,
  flexion:   null,
  rotation:  null,
})
const notes = ref('')

function selectionFor(id: string): Side | null {
  return selections.value[id] ?? null
}

// Radio behaviour: clicking the active option deselects it
function selectSide(id: string, side: Side) {
  selections.value[id] = selections.value[id] === side ? null : side
}

function sideLabel(side: Side): string {
  return side === 'both' ? 'Both' : side === 'left' ? 'Left' : 'Right'
}

// ── Expand selections into ordered capture steps ───────────────────────────────
interface SummaryStep {
  label:     string
  sideLabel: string
  // What gets encoded in the URL
  movementType: MovementType
  side:         Side
}

const prescribedSteps = computed<SummaryStep[]>(() => {
  const steps: SummaryStep[] = []

  const rowOrder = ['abduction', 'flexion', 'rotation']
  for (const id of rowOrder) {
    const side = selections.value[id]
    if (!side) continue

    if (id === 'abduction') {
      steps.push({ label: 'Abduction', sideLabel: sideLabel(side), movementType: MovementType.ABDUCTION, side })
    }

    if (id === 'flexion') {
      if (side === 'left' || side === 'both') {
        steps.push({ label: 'Flexion', sideLabel: 'Left', movementType: MovementType.FLEXION_LEFT, side: 'left' })
      }
      if (side === 'right' || side === 'both') {
        steps.push({ label: 'Flexion', sideLabel: 'Right', movementType: MovementType.FLEXION_RIGHT, side: 'right' })
      }
    }

    if (id === 'rotation') {
      steps.push({ label: 'Rotation', sideLabel: sideLabel(side), movementType: MovementType.ROTATION, side })
    }
  }

  return steps
})

const hasBothFlexion = computed(() => selections.value.flexion === 'both')

// ── Launch ─────────────────────────────────────────────────────────────────────
function launchSession() {
  const params = encodeSessionConfig({
    movements: prescribedSteps.value.map(s => ({ movementType: s.movementType, side: s.side })),
    notes:     notes.value,
  })
  window.open(`${window.location.origin}/capture?${params.toString()}`, '_blank')
}
</script>

<style scoped>
.prac-page {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: var(--font-body); display: flex; flex-direction: column;
}

.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner { max-width: 1100px; margin: 0 auto; height: 60px; display: flex; align-items: center; gap: 1rem; }
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.role-badge {
  font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(0,229,255,0.1); color: var(--accent);
  border: 1px solid rgba(0,229,255,0.25); border-radius: 4px; padding: 2px 8px;
}

.main { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: 2rem; }
.builder { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }

.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 1.75rem; display: flex; flex-direction: column; gap: 1.25rem;
}
.card-title { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.05em; margin: 0; }
.card-sub   { font-size: 0.85rem; color: var(--text-muted); margin: -0.75rem 0 0; }

.movement-list { display: flex; flex-direction: column; gap: 0.75rem; }
.movement-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px; gap: 1rem;
  transition: border-color 0.2s;
}
.movement-row.selected { border-color: rgba(0,229,255,0.35); }
.movement-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.movement-name  { font-size: 0.9rem; font-weight: 600; }
.movement-plane { font-size: 0.72rem; color: var(--text-muted); }

.side-btns { display: flex; gap: 0.4rem; flex-shrink: 0; }
.side-btn {
  padding: 0.3rem 0.7rem; border-radius: 5px; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); transition: all 0.15s;
}
.side-btn:hover  { border-color: var(--accent); color: var(--text); }
.side-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

.field { display: flex; flex-direction: column; gap: 0.5rem; }
.field-label { font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.field-textarea {
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-family: var(--font-body); font-size: 0.875rem;
  padding: 0.75rem; resize: vertical; transition: border-color 0.2s;
}
.field-textarea:focus { outline: none; border-color: var(--accent); }
.field-textarea::placeholder { color: var(--text-muted); }

.summary       { display: flex; flex-direction: column; gap: 0.75rem; }
.summary-title { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin: 0; }
.summary-empty { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }
.summary-list  { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.summary-item  {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.75rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem;
}
.summary-index    { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); min-width: 16px; }
.summary-movement { flex: 1; font-weight: 600; }
.summary-side {
  font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--accent); background: rgba(0,229,255,0.08);
  border: 1px solid rgba(0,229,255,0.2); border-radius: 4px; padding: 1px 6px;
}
.summary-hint {
  font-size: 0.78rem; color: var(--text-muted); background: rgba(0,229,255,0.04);
  border: 1px solid rgba(0,229,255,0.15); border-radius: 6px; padding: 0.5rem 0.75rem; margin: 0;
}
.summary-notes       { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }
.summary-notes-label { color: var(--text); font-style: normal; font-weight: 600; }

.btn-launch {
  width: 100%; padding: 0.75rem; border-radius: 8px; background: var(--accent); color: #000;
  font-size: 0.9rem; font-weight: 700; letter-spacing: 0.04em;
  border: none; cursor: pointer; transition: background 0.2s;
}
.btn-launch:hover:not(:disabled) { background: var(--accent-hover); }
.btn-launch:disabled { opacity: 0.4; cursor: not-allowed; }
.launch-hint { font-size: 0.78rem; color: var(--text-muted); text-align: center; margin: -0.5rem 0 0; }
</style>