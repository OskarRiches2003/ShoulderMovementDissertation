<template>
  <!-- pages/dashboard.vue -->
  <div class="dashboard">
    <!-- Header -->
    <header class="dash-header">
      <div class="dash-header__inner">
        <h1 class="dash-title">My Progress</h1>
        <p class="dash-subtitle" v-if="user">Logged in as {{ user.email }}</p>
      </div>
    </header>

    <!-- Loading / error states -->
    <div v-if="loading" class="state-screen">
      <span class="spinner" />
      <p>Loading your sessions…</p>
    </div>

    <div v-else-if="error" class="state-screen state-screen--error">
      <p>{{ error }}</p>
      <button class="btn btn--secondary" @click="reload">Retry</button>
    </div>

    <!-- Main content -->
    <main v-else class="dash-main">
      <!-- Top-level tabs -->
      <nav class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-bar__item"
          :class="{ 'tab-bar__item--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'history'" class="tab-badge">{{ sessions.length }}</span>
        </button>
      </nav>

      <!-- ── Tab 1: Session History ─────────────────────────────────────── -->
      <section v-show="activeTab === 'history'" class="tab-panel">
        <div v-if="sessions.length === 0" class="empty-state">
          <p>No sessions recorded yet. Complete a capture session to see your history here.</p>
        </div>

        <div v-else class="session-list">
          <article
            v-for="session in sessions"
            :key="session.id"
            class="session-card"
          >
            <!-- Card header -->
            <div class="session-card__header">
              <div>
                <span class="session-card__date">{{ formatDate(session.date) }}</span>
                <span class="session-card__time">{{ formatTime(session.date) }}</span>
              </div>
              <span class="session-card__badge">{{ session.movements.length }} movement{{ session.movements.length !== 1 ? 's' : '' }}</span>
            </div>

            <!-- Movement rows -->
            <div class="session-card__movements">
              <div
                v-for="m in session.movements"
                :key="m.movement"
                class="movement-row"
              >
                <span class="movement-row__label">{{ m.label }}</span>
                <div class="movement-row__angles">
                  <span v-if="m.leftAngle !== null" class="angle-chip angle-chip--left">
                    L {{ m.leftAngle }}°
                  </span>
                  <span v-if="m.rightAngle !== null" class="angle-chip angle-chip--right">
                    R {{ m.rightAngle }}°
                  </span>
                  <span v-if="m.leftAngle === null && m.rightAngle === null" class="angle-chip angle-chip--na">
                    —
                  </span>
                </div>
              </div>
            </div>

            <!-- Notes (if any) -->
            <p v-if="session.notes" class="session-card__notes">
              <em>Practitioner note:</em> {{ session.notes }}
            </p>
          </article>
        </div>
      </section>

      <!-- ── Tab 2: Movement Progress ──────────────────────────────────── -->
      <section v-show="activeTab === 'progress'" class="tab-panel">
        <div v-if="movementKeys.length === 0" class="empty-state">
          <p>Complete at least one session to see progress graphs.</p>
        </div>

        <template v-else>
          <!-- Movement sub-tabs -->
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

          <!-- Graph panel -->
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { useCurrentUser } from 'vuefire'   // or your auth composable
import { useSessions } from '~/composables/useSessions'

// ─── Auth ──────────────────────────────────────────────────────────────────
const user = useCurrentUser()

// ─── Data ──────────────────────────────────────────────────────────────────
const { sessions, loading, error, movementKeys, fetchSessions, getMovementSeries } = useSessions()

async function reload() {
  if (user.value) await fetchSessions(user.value.uid)
}

watchEffect(() => {
  if (user.value) fetchSessions(user.value.uid)
})

// ─── Tabs ──────────────────────────────────────────────────────────────────
const tabs = [
  { key: 'history', label: 'Session History' },
  { key: 'progress', label: 'Movement Progress' },
] as const

type TabKey = (typeof tabs)[number]['key']
const activeTab = ref<TabKey>('history')

// ─── Movement sub-tab ──────────────────────────────────────────────────────
const activeMovement = ref<string>('')

watch(movementKeys, (keys) => {
  if (keys.length && !activeMovement.value) {
    activeMovement.value = keys[0]
  }
})

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Derive a human-readable label from a movement key. Falls back gracefully. */
function movementLabel(key: string): string {
  // Pull label from the first session that contains this movement
  for (const s of sessions.value) {
    const m = s.movements.find((m) => m.movement === key)
    if (m?.label) return m.label
  }
  // Fallback: capitalise the key
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* ─── Layout ─────────────────────────────────────────────────────────────── */

.dashboard {
  min-height: 100vh;
  background: var(--color-bg, #f5f7fa);
  font-family: var(--font-body, system-ui, sans-serif);
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

.dash-header {
  background: var(--color-primary, #1a56db);
  color: #fff;
  padding: 1.75rem 1.5rem 1.5rem;
}

.dash-header__inner {
  max-width: 900px;
  margin: 0 auto;
}

.dash-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}

.dash-subtitle {
  font-size: 0.85rem;
  opacity: 0.8;
  margin: 0;
}

/* ─── Loading / error ────────────────────────────────────────────────────── */

.state-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 1rem;
  color: var(--color-text-muted, #666);
}

.state-screen--error {
  color: var(--color-error, #c00);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary, #1a56db);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

.dash-main {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

/* ─── Top-level tab bar ──────────────────────────────────────────────────── */

.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid var(--color-border, #e0e6f0);
  margin-bottom: 1.75rem;
}

.tab-bar__item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.1rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-muted, #666);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-bar__item--active {
  color: var(--color-primary, #1a56db);
  border-bottom-color: var(--color-primary, #1a56db);
}

.tab-badge {
  background: var(--color-primary, #1a56db);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0 0.45rem;
  line-height: 1.5;
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted, #888);
  font-size: 0.95rem;
}

/* ─── Session list ───────────────────────────────────────────────────────── */

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e0e6f0);
  border-radius: 12px;
  padding: 1.1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.session-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.9rem;
}

.session-card__date {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text, #1a1a2e);
  margin-right: 0.5rem;
}

.session-card__time {
  font-size: 0.82rem;
  color: var(--color-text-muted, #888);
}

.session-card__badge {
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-bg, #f0f4ff);
  color: var(--color-primary, #1a56db);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
}

/* ─── Movement rows ──────────────────────────────────────────────────────── */

.session-card__movements {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
  background: var(--color-bg, #f8fafc);
  border-radius: 8px;
}

.movement-row__label {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text, #1a1a2e);
}

.movement-row__angles {
  display: flex;
  gap: 0.4rem;
}

.angle-chip {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.angle-chip--left {
  background: rgba(74, 158, 255, 0.12);
  color: #1a56db;
}

.angle-chip--right {
  background: rgba(255, 124, 74, 0.12);
  color: #c0430a;
}

.angle-chip--na {
  background: #f0f0f0;
  color: #aaa;
}

.session-card__notes {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  color: var(--color-text-muted, #777);
  padding-top: 0.6rem;
  border-top: 1px solid var(--color-border, #eef0f5);
}

/* ─── Sub-tab bar (movements) ────────────────────────────────────────────── */

.sub-tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
}

.sub-tab-bar__item {
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted, #666);
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #dde2ef);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.sub-tab-bar__item--active {
  background: var(--color-primary, #1a56db);
  color: #fff;
  border-color: var(--color-primary, #1a56db);
}

/* ─── Graph panel ────────────────────────────────────────────────────────── */

.graph-panel {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e0e6f0);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.graph-panel__title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text, #1a1a2e);
  margin: 0 0 0.2rem;
}

.graph-panel__meta {
  font-size: 0.82rem;
  color: var(--color-text-muted, #888);
  margin: 0 0 1.25rem;
}

/* ─── Shared button ──────────────────────────────────────────────────────── */

.btn {
  padding: 0.55rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.btn--secondary {
  background: var(--color-surface, #fff);
  color: var(--color-primary, #1a56db);
  border: 1px solid var(--color-primary, #1a56db);
}
</style>