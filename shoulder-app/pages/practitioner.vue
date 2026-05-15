<template>
  <div class="prac-page">
    <header class="header">
      <div class="header-inner">
        <span class="logo">PLACEHOLDER<span class="logo-accent">LOGO</span></span>
        <div class="header-right">
          <span class="practitioner-name">{{ profile?.displayName }}</span>
          <span class="role-badge">Practitioner</span>
          <button class="btn-signout" @click="signOut">Sign out</button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="workspace">

        <!-- ── Left column: Patient management ──────────────────────────── -->
        <aside class="panel panel-patients">
          <div class="panel-header">
            <h2 class="panel-title">Patients</h2>
            <button class="btn-new" @click="showNewPatient = true">+ New</button>
          </div>

          <div v-if="isLoadingPatients" class="state-msg">Loading patients…</div>

          <div v-else-if="patients.length === 0" class="state-msg state-empty">
            No patients yet. Create one to get started.
          </div>

          <ul v-else class="patient-list">
            <li
              v-for="p in patients"
              :key="p.id"
              class="patient-item"
              :class="{ active: selectedPatient?.id === p.id }"
              @click="selectedPatient = p"
            >
              <div class="patient-avatar">{{ initials(p.displayName) }}</div>
              <div class="patient-info">
                <span class="patient-name">{{ p.displayName }}</span>
                <span class="patient-email">{{ p.email }}</span>
              </div>
              <span v-if="selectedPatient?.id === p.id" class="patient-check">✓</span>
            </li>
          </ul>
        </aside>

        <!-- ── Right column: Session builder ────────────────────────────── -->
       <section class="panel panel-builder">
          <div class="panel-header">
            <div class="panel-tabs">
              <button
                class="panel-tab"
                :class="{ 'panel-tab--active': rightTab === 'builder' }"
                @click="rightTab = 'builder'"
              >Session Builder</button>
              <button
                class="panel-tab"
                :class="{ 'panel-tab--active': rightTab === 'history' }"
                :disabled="!selectedPatient"
                @click="rightTab = 'history'"
              >Patient History</button>
            </div>
            <span v-if="selectedPatient" class="selected-patient-badge">
              {{ selectedPatient.displayName }}
            </span>
          </div>
          
          <div v-show="rightTab === 'builder'">
            <!-- Movement picker -->
            <div class="card">
              <h3 class="card-title">Select Movements</h3>
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
            </div>

            <!-- Notes + summary -->
            <div class="card">
              <h3 class="card-title">Session Details</h3>

              <div class="field">
                <label class="field-label" for="notes">Session notes</label>
                <textarea
                  id="notes"
                  v-model="notes"
                  class="field-textarea"
                  rows="3"
                  placeholder="e.g. Focus on left shoulder, patient reports pain above 90°…"
                />
              </div>

              <div class="summary">
                <h4 class="summary-title">Summary</h4>
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
                  ℹ Flexion (Both) splits into two recordings — left first, then right.
                </p>
                <div v-if="notes" class="summary-notes">
                  <span class="summary-notes-label">Notes:</span> {{ notes }}
                </div>
              </div>

              <div class="launch-area">
                <p v-if="!selectedPatient" class="launch-warning">
                  ⚠ Select a patient before launching.
                </p>
                  <button
                    class="btn-launch"
                    :disabled="prescribedSteps.length === 0 || !selectedPatient || isLaunching"
                    @click="launchSession"
                  >
                    <span v-if="isLaunching">Sending…</span>
                    <span v-else>Send Session to Patient →</span>
                  </button>
                  <p v-if="launchError" class="form-error">{{ launchError }}</p>
              </div>
            </div>
          </div>

          <div v-show="rightTab === 'history'" class="history-panel">
            <div v-if="!selectedPatient" class="state-msg state-empty">
              Select a patient to view their history.
            </div>
            <PatientDashboard v-else :patient-id="selectedPatient.id" />
          </div>
        </section>

      </div>
    </main>

    <!-- ── New Patient Modal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showNewPatient" class="modal-backdrop" @click.self="showNewPatient = false">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">New Patient</h2>
            <button class="modal-close" @click="showNewPatient = false">✕</button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label">Full name</label>
              <input v-model="newPatient.displayName" class="field-input" placeholder="Jane Smith" />
            </div>
            <div class="field">
              <label class="field-label">Email</label>
              <input v-model="newPatient.email" type="email" class="field-input" placeholder="jane@example.com" />
            </div>
            <div class="field">
              <label class="field-label">Temporary password</label>
              <input v-model="newPatient.temporaryPassword" type="password" class="field-input" placeholder="Min. 6 characters" />
            </div>
            <div class="field">
              <label class="field-label">Date of birth <span class="field-optional">(optional)</span></label>
              <input v-model="newPatient.dateOfBirth" type="date" class="field-input" />
            </div>
            <div class="field">
              <label class="field-label">Clinical notes <span class="field-optional">(optional)</span></label>
              <textarea v-model="newPatient.notes" class="field-textarea" rows="3" placeholder="Relevant history, conditions…" />
            </div>

            <p v-if="createError" class="form-error">{{ createError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showNewPatient = false">Cancel</button>
            <button class="btn-create" :disabled="isCreating" @click="handleCreatePatient">
              <span v-if="isCreating">Creating…</span>
              <span v-else>Create Patient</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { MovementType, encodeSessionConfig } from '~/types/pose'
import type { Side } from '~/types/pose'
import type { Patient } from '~/types/auth'

definePageMeta({ middleware: ['auth'] })

const { signOut, profile } = useAuth()
const { patients, isLoading: isLoadingPatients, createPatient } = usePatients()
const { createSessionForPatient } = useSessions()

const isLaunching = ref(false)
const launchError = ref('')

// ── Patient selection ──────────────────────────────────────────────────────────
// replace the existing selectedPatient ref line
const selectedPatient = ref<Patient | null>(null)

watch(selectedPatient, () => {
  rightTab.value = 'builder'
})

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const rightTab = ref<'builder' | 'history'>('builder')

// ── New patient modal ──────────────────────────────────────────────────────────
const showNewPatient = ref(false)
const isCreating = ref(false)
const createError = ref('')

const newPatient = ref({
  displayName: '',
  email: '',
  temporaryPassword: '',
  dateOfBirth: '',
  notes: '',
})

function resetNewPatient() {
  newPatient.value = { displayName: '', email: '', temporaryPassword: '', dateOfBirth: '', notes: '' }
  createError.value = ''
}

async function handleCreatePatient() {
  createError.value = ''
  if (!newPatient.value.displayName || !newPatient.value.email || !newPatient.value.temporaryPassword) {
    createError.value = 'Name, email, and password are required.'
    return
  }
  if (newPatient.value.temporaryPassword.length < 6) {
    createError.value = 'Password must be at least 6 characters.'
    return
  }
  isCreating.value = true
  try {
    await createPatient(newPatient.value)
    showNewPatient.value = false
    resetNewPatient()
  } catch (err: any) {
    createError.value = err.message ?? 'Failed to create patient. Please try again.'
  } finally {
    isCreating.value = false
  }
}

// ── Movement builder ───────────────────────────────────────────────────────────
interface PractitionerRow {
  id: string
  label: string
  plane: string
  sides: Side[]
}

const PRACTITIONER_ROWS: PractitionerRow[] = [
  { id: 'abduction', label: 'Abduction', plane: 'Frontal (coronal) plane',        sides: ['left', 'right', 'both'] },
  { id: 'flexion',   label: 'Flexion',   plane: 'Sagittal plane',                 sides: ['left', 'right', 'both'] },
  { id: 'rotation',  label: 'Rotation',  plane: 'Transverse plane (approximated)', sides: ['left', 'right', 'both'] },
]

const selections = ref<Record<string, Side | null>>({ abduction: null, flexion: null, rotation: null })
const notes = ref('')

function selectionFor(id: string): Side | null { return selections.value[id] ?? null }
function selectSide(id: string, side: Side) {
  selections.value[id] = selections.value[id] === side ? null : side
}
function sideLabel(side: Side): string {
  return side === 'both' ? 'Both' : side === 'left' ? 'Left' : 'Right'
}

interface SummaryStep {
  label: string
  sideLabel: string
  movementType: MovementType
  side: Side
}

const prescribedSteps = computed<SummaryStep[]>(() => {
  const steps: SummaryStep[] = []
  for (const id of ['abduction', 'flexion', 'rotation']) {
    const side = selections.value[id]
    if (!side) continue
    if (id === 'abduction') steps.push({ label: 'Abduction', sideLabel: sideLabel(side), movementType: MovementType.ABDUCTION, side })
    if (id === 'flexion') {
      if (side === 'left'  || side === 'both') steps.push({ label: 'Flexion', sideLabel: 'Left',  movementType: MovementType.FLEXION_LEFT,  side: 'left' })
      if (side === 'right' || side === 'both') steps.push({ label: 'Flexion', sideLabel: 'Right', movementType: MovementType.FLEXION_RIGHT, side: 'right' })
    }
    if (id === 'rotation') steps.push({ label: 'Rotation', sideLabel: sideLabel(side), movementType: MovementType.ROTATION, side })
  }
  return steps
})

const hasBothFlexion = computed(() => selections.value.flexion === 'both')

// ── Launch ─────────────────────────────────────────────────────────────────────
async function launchSession() {
  if (!selectedPatient.value) return
  launchError.value = ''
  isLaunching.value = true
  try {
    await createSessionForPatient({
      patientId: selectedPatient.value.id,
      movements: prescribedSteps.value.map(s => ({ movementType: s.movementType, side: s.side })),
      notes: notes.value,
    })
    // Reset the builder after a successful launch
    selections.value = { abduction: null, flexion: null, rotation: null }
    notes.value = ''
  } catch (err: any) {
    launchError.value = err.message ?? 'Failed to send session.'
  } finally {
    isLaunching.value = false
  }
}
</script>

<style scoped>
.prac-page {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: var(--font-body); display: flex; flex-direction: column;
}

.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner {
  max-width: 1300px; margin: 0 auto; height: 60px;
  display: flex; align-items: center; justify-content: space-between;
}
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.header-right { display: flex; align-items: center; gap: 1rem; }
.practitioner-name { font-size: 0.875rem; color: var(--text); font-weight: 500; }
.role-badge {
  font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
  background: rgba(0,229,255,0.1); color: var(--accent);
  border: 1px solid rgba(0,229,255,0.25); border-radius: 4px; padding: 2px 8px;
}
.btn-signout {
  font-size: 0.8rem; color: var(--text-muted); background: transparent;
  border: 1px solid var(--border); border-radius: 6px; padding: 4px 12px;
  cursor: pointer; transition: all 0.15s;
}
.btn-signout:hover { color: var(--text); border-color: var(--text-muted); }

.main { flex: 1; max-width: 1300px; margin: 0 auto; width: 100%; padding: 2rem; }
.workspace { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: start; }

.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
}
.panel-title { font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.05em; margin: 0; }

.btn-new {
  font-size: 0.78rem; font-weight: 600; padding: 4px 10px;
  background: var(--accent); color: #000; border: none;
  border-radius: 5px; cursor: pointer; transition: background 0.15s;
}
.btn-new:hover { background: var(--accent-hover); }

.state-msg { padding: 2rem 1.5rem; font-size: 0.85rem; color: var(--text-muted); text-align: center; }
.state-empty { font-style: italic; }

.patient-list { list-style: none; margin: 0; padding: 0.5rem; display: flex; flex-direction: column; gap: 2px; }
.patient-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.75rem; border-radius: 8px; cursor: pointer;
  transition: background 0.15s; border: 1px solid transparent;
}
.patient-item:hover  { background: rgba(255,255,255,0.04); }
.patient-item.active { background: rgba(0,229,255,0.07); border-color: rgba(0,229,255,0.2); }
.patient-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: rgba(0,229,255,0.15); color: var(--accent);
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;
  display: flex; align-items: center; justify-content: center;
}
.patient-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.patient-name  { font-size: 0.875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.patient-email { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.patient-check { color: var(--accent); font-size: 0.85rem; flex-shrink: 0; }

.selected-patient-badge {
  font-size: 0.75rem; padding: 2px 10px; border-radius: 4px;
  background: rgba(0,229,255,0.1); color: var(--accent);
  border: 1px solid rgba(0,229,255,0.25);
}

.panel-builder { display: flex; flex-direction: column; }
.card { padding: 1.5rem; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem; }
.card-title { font-family: var(--font-display); font-size: 0.95rem; letter-spacing: 0.05em; margin: 0; }
.card-sub   { font-size: 0.82rem; color: var(--text-muted); margin: -0.5rem 0 0; }

.movement-list { display: flex; flex-direction: column; gap: 0.6rem; }
.movement-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 0.875rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px; gap: 1rem; transition: border-color 0.2s;
}
.movement-row.selected { border-color: rgba(0,229,255,0.35); }
.movement-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.movement-name  { font-size: 0.875rem; font-weight: 600; }
.movement-plane { font-size: 0.7rem; color: var(--text-muted); }
.side-btns { display: flex; gap: 0.35rem; flex-shrink: 0; }
.side-btn {
  padding: 0.25rem 0.65rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; border: 1px solid var(--border);
  background: transparent; color: var(--text-muted); transition: all 0.15s;
}
.side-btn:hover  { border-color: var(--accent); color: var(--text); }
.side-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
.field-optional { text-transform: none; font-size: 0.7rem; opacity: 0.6; }
.field-input, .field-textarea {
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-family: var(--font-body); font-size: 0.875rem;
  padding: 0.65rem 0.875rem; transition: border-color 0.2s; width: 100%; box-sizing: border-box;
}
.field-input:focus, .field-textarea:focus { outline: none; border-color: var(--accent); }
.field-textarea { resize: vertical; }

.summary       { display: flex; flex-direction: column; gap: 0.6rem; }
.summary-title { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin: 0; }
.summary-empty { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }
.summary-list  { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.summary-item  {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.45rem 0.75rem; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px; font-size: 0.82rem;
}
.summary-index    { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); min-width: 16px; }
.summary-movement { flex: 1; font-weight: 600; }
.summary-side {
  font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--accent); background: rgba(0,229,255,0.08);
  border: 1px solid rgba(0,229,255,0.2); border-radius: 4px; padding: 1px 6px;
}
.summary-hint  { font-size: 0.75rem; color: var(--text-muted); background: rgba(0,229,255,0.04); border: 1px solid rgba(0,229,255,0.15); border-radius: 6px; padding: 0.45rem 0.75rem; margin: 0; }
.summary-notes { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }
.summary-notes-label { color: var(--text); font-style: normal; font-weight: 600; }

.launch-area   { display: flex; flex-direction: column; gap: 0.5rem; }
.launch-warning { font-size: 0.8rem; color: #f59e0b; margin: 0; }
.btn-launch {
  width: 100%; padding: 0.75rem; border-radius: 8px; background: var(--accent); color: #000;
  font-size: 0.9rem; font-weight: 700; letter-spacing: 0.04em;
  border: none; cursor: pointer; transition: background 0.2s;
}
.btn-launch:hover:not(:disabled) { background: var(--accent-hover); }
.btn-launch:disabled { opacity: 0.4; cursor: not-allowed; }
.launch-hint { font-size: 0.75rem; color: var(--text-muted); text-align: center; margin: 0; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  width: 100%; max-width: 460px; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
}
.modal-title { font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.05em; margin: 0; }
.modal-close {
  background: transparent; border: none; color: var(--text-muted);
  font-size: 1rem; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: color 0.15s;
}
.modal-close:hover { color: var(--text); }
.modal-body   { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.5rem; border-top: 1px solid var(--border);
}
.form-error { font-size: 0.82rem; color: #f87171; margin: 0; }
.btn-cancel {
  padding: 0.5rem 1.25rem; border-radius: 7px; background: transparent;
  color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; font-size: 0.875rem;
  transition: all 0.15s;
}
.btn-cancel:hover { border-color: var(--text-muted); color: var(--text); }
.btn-create {
  padding: 0.5rem 1.25rem; border-radius: 7px; background: var(--accent);
  color: #000; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600;
  transition: background 0.15s;
}
.btn-create:hover:not(:disabled) { background: var(--accent-hover); }
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

.panel-tabs {
  display: flex;
  gap: 0.25rem;
}

.panel-tab {
  padding: 0.3rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  transition: all 0.15s;
}

.panel-tab--active {
  background: rgba(0,229,255,0.1);
  color: var(--accent);
  border-color: rgba(0,229,255,0.3);
}

.panel-tab:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.history-panel {
  padding: 0 1.5rem 1.5rem;
}
</style>