<template>
  <!-- components/PatientDashboard.vue -->
  <div class="patient-dashboard">
    <!-- Loading -->
    <div v-if="loading" class="dash-loading">
      <span class="spinner" />
    </div>

    <template v-else>
      <!-- Tab bar -->
      <nav class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-bar__item"
          :class="{ 'tab-bar__item--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'history'" class="tab-badge">{{ completedSessions.length }}</span>
        </button>
      </nav>

      <!-- ── Session History ──────────────────────────────────────────────── -->
      <section v-show="activeTab === 'history'">
        <div v-if="completedSessions.length === 0" class="empty-state">
          <p>No completed sessions yet. Your history will appear here after you finish a session.</p>
        </div>

        <div v-else class="session-list">
          <article
            v-for="session in completedSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="session-card__header">
              <div>
                <span class="session-card__date">{{ formatDate(toDate(session.createdAt)) }}</span>
                <span class="session-card__time">{{ formatTime(toDate(session.createdAt)) }}</span>
              </div>
              <span class="session-card__badge">
                {{ session.results?.length ?? 0 }} movement{{ (session.results?.length ?? 0) !== 1 ? 's' : '' }}
              </span>
            </div>

            <div class="session-card__movements">
              <div
                v-for="result in session.results"
                :key="result.movementType"
                class="movement-row"
              >
                <span class="movement-row__label">{{ result.label }}</span>
                <div class="movement-row__angles">
                  <span v-if="result.leftAngle != null" class="angle-chip angle-chip--left">L {{ result.leftAngle }}°</span>
                  <span v-if="result.rightAngle != null" class="angle-chip angle-chip--right">R {{ result.rightAngle }}°</span>
                  <span v-if="result.leftAngle == null && result.rightAngle == null" class="angle-chip angle-chip--na">—</span>
                </div>
              </div>
            </div>

            <p v-if="session.notes" class="session-card__notes">
              <em>Practitioner note:</em> {{ session.notes }}
            </p>
          </article>
        </div>
      </section>

      <!-- ── Movement Progress ───────────────────────────────────────────── -->
      <section v-show="activeTab === 'progress'">
        <div v-if="movementKeys.length === 0" class="empty-state">
          <p>Complete at least one session to see your progress graphs.</p>
        </div>

        <template v-else>
          <nav class="sub-tab-bar">
            <button
              v-for="key in movementKeys"
              :key="key"
              class="sub-tab-bar__item"
              :class="{ 'sub-tab-bar__item--active': activeMovement === key }"
              @click="activeMovement = key"
            >
              {{ movementLabel(key) }}
            </button>
          </nav>

          <div class="graph-panel" v-if="activeMovement">
            <h2 class="graph-panel__title">{{ movementLabel(activeMovement) }}</h2>
            <p class="graph-panel__meta">
              {{ getMovementSeries(activeMovement).length }} session{{ getMovementSeries(activeMovement).length !== 1 ? 's' : '' }} recorded
            </p>
            <MovementGraph
              :series="getMovementSeries(activeMovement)"
              :movement-label="movementLabel(activeMovement)"
            />
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Timestamp } from 'firebase/firestore'
import type { Session, MovementResult } from '~/types/auth'
import { MOVEMENT_CONFIG_MAP } from '~/utils/movementConfigs'

const props = defineProps<{ patientId: string }>()

const { watchSessionsForPatient } = useSessions()

// ─── Data ──────────────────────────────────────────────────────────────────
const allSessions = ref<Session[]>([])
const loading = ref(true)
let unsubscribe: (() => void) | null = null

watch(
  () => props.patientId,
  (id) => {
    if (!id) return
    unsubscribe?.()
    loading.value = true
    unsubscribe = watchSessionsForPatient(id, (sessions) => {
      allSessions.value = sessions
      loading.value = false
    })
  },
  { immediate: true }
)

onUnmounted(() => unsubscribe?.())

// Each session in Firestore has one MovementResult per (movementType, side).
// The UI wants one row per movementType with left/right peak angles populated.
interface GroupedMovement {
  movementType: string
  label: string
  leftAngle: number | null
  rightAngle: number | null
}

function groupResults(results: MovementResult[] | undefined): GroupedMovement[] {
  const map = new Map<string, GroupedMovement>()
  for (const r of results ?? []) {
    const key = r.movementType
    if (!key) continue
    const entry = map.get(key) ?? {
      movementType: key,
      label: MOVEMENT_CONFIG_MAP.get(key)?.label ?? prettifyKey(key),
      leftAngle: null,
      rightAngle: null,
    }
    if (r.side === 'left') entry.leftAngle = r.peakAngle
    else if (r.side === 'right') entry.rightAngle = r.peakAngle
    else if (r.side === 'both') {
      entry.leftAngle = r.peakAngle
      entry.rightAngle = r.peakAngle
    }
    map.set(key, entry)
  }
  return [...map.values()]
}

const completedSessions = computed(() =>
  allSessions.value
    .filter((s) => ['complete', 'awaiting-review'].includes(s.status) && s.results?.length)
    .map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      notes: s.notes,
      results: groupResults(s.results),
    }))
)

// ─── Tabs ──────────────────────────────────────────────────────────────────
const tabs = [
  { key: 'history', label: 'Session History' },
  { key: 'progress', label: 'Progress' },
] as const
type TabKey = (typeof tabs)[number]['key']
const activeTab = ref<TabKey>('history')

// ─── Movement sub-tabs ─────────────────────────────────────────────────────
const movementKeys = computed<string[]>(() => {
  const keys = new Set<string>()
  completedSessions.value.forEach((s) => s.results.forEach((r) => keys.add(r.movementType)))
  return [...keys]
})

const activeMovement = ref('')
watch(movementKeys, (keys) => {
  if (keys.length && !activeMovement.value) activeMovement.value = keys[0]
})

// ─── Chart series ──────────────────────────────────────────────────────────
function getMovementSeries(movementKey: string) {
  return [...completedSessions.value]
    .filter((s) => s.results.some((r) => r.movementType === movementKey))
    .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
    .map((s) => {
      const r = s.results.find((r) => r.movementType === movementKey)!
      return { date: toDate(s.createdAt), leftAngle: r.leftAngle, rightAngle: r.rightAngle }
    })
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function toDate(value: Timestamp | Date | string | undefined): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  return (value as Timestamp).toDate()
}

function prettifyKey(key: string): string {
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function movementLabel(key: string): string {
  if (!key) return ''
  return MOVEMENT_CONFIG_MAP.get(key)?.label ?? prettifyKey(key)
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.patient-dashboard { margin-top: 2rem; }

.dash-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0,229,255,0.15);
  border-top-color: var(--accent, #00e5ff);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Tab bar ─────────────────────────────────────────────────────────────── */

.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}

.tab-bar__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: var(--font-body);
}

.tab-bar__item--active {
  color: var(--accent, #00e5ff);
  border-bottom-color: var(--accent, #00e5ff);
}

.tab-badge {
  background: var(--accent, #00e5ff);
  color: #000;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0 0.4rem;
  line-height: 1.5;
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

.empty-state {
  text-align: center;
  padding: 2.5rem 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* ─── Session list ────────────────────────────────────────────────────────── */

.session-list { display: flex; flex-direction: column; gap: 0.75rem; }

.session-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.15rem;
}

.session-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.session-card__date { font-weight: 600; font-size: 0.9rem; color: var(--text); margin-right: 0.5rem; }
.session-card__time { font-size: 0.78rem; color: var(--text-muted); }

.session-card__badge {
  font-size: 0.72rem;
  font-weight: 600;
  background: rgba(0,229,255,0.08);
  color: var(--accent, #00e5ff);
  border: 1px solid rgba(0,229,255,0.2);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
}

.session-card__movements { display: flex; flex-direction: column; gap: 0.4rem; }

.movement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.movement-row__label { font-size: 0.83rem; font-weight: 500; color: var(--text); }
.movement-row__angles { display: flex; gap: 0.35rem; }

.angle-chip { font-size: 0.76rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 5px; }
.angle-chip--left  { background: rgba(74,158,255,0.15); color: #4a9eff; }
.angle-chip--right { background: rgba(255,124,74,0.15);  color: #ff7c4a; }
.angle-chip--na    { background: rgba(255,255,255,0.05); color: var(--text-muted); }

.session-card__notes {
  margin-top: 0.65rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  padding-top: 0.55rem;
  border-top: 1px solid var(--border);
}

/* ─── Sub-tab bar ─────────────────────────────────────────────────────────── */

.sub-tab-bar { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1.25rem; }

.sub-tab-bar__item {
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.sub-tab-bar__item--active {
  background: rgba(0,229,255,0.1);
  color: var(--accent, #00e5ff);
  border-color: rgba(0,229,255,0.3);
}

/* ─── Graph panel ─────────────────────────────────────────────────────────── */

.graph-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.25rem;
}

.graph-panel__title { font-size: 1rem; font-weight: 600; color: var(--text); margin: 0 0 0.2rem; font-family: var(--font-display); }
.graph-panel__meta  { font-size: 0.78rem; color: var(--text-muted); margin: 0 0 1rem; }
</style>