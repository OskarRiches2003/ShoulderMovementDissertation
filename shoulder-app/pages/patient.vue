<template>
  <div class="patient-page">
    <header class="header">
      <div class="header-inner">
        <span class="logo">SHOULDER<span class="logo-accent">TRACK</span></span>
        <div class="header-right">
          <span class="patient-name">{{ profile?.displayName }}</span>
          <span class="role-badge">Patient</span>
          <button class="btn-signout" @click="signOut">Sign out</button>
        </div>
      </div>
    </header>

    <main class="main">
      <h1 class="page-title">Welcome back, {{ firstName }}</h1>

      <!-- Pending session banner — auto-starts after a short delay -->
      <section v-if="activeSession && !redirecting" class="banner">
        <p class="banner-text">
          New movement request from your practitioner. Starting your session…
        </p>
      </section>

      <!-- No pending session -->
      <section v-else-if="!activeSession" class="empty-state">
        <div class="empty-icon">✓</div>
        <h2 class="empty-title">All caught up</h2>
        <p class="empty-sub">You don't have any pending sessions right now. Your practitioner will let you know when there's something new to record.</p>
      </section>

      <!-- Dashboard placeholder -->
      <PatientDashboard v-if="user" :patient-id="user.uid" />
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Session } from '~/types/auth'

definePageMeta({ middleware: ['auth'] })

const { profile, user, signOut } = useAuth()
const { watchActiveSessionForPatient } = useSessions()
const router = useRouter()

const activeSession = ref<Session | null>(null)
const redirecting = ref(false)
let unsubscribe: (() => void) | null = null
let redirectTimer: ReturnType<typeof setTimeout> | null = null

const firstName = computed(() => profile.value?.displayName?.split(' ')[0] ?? '')

watch(() => user.value, (newUser) => {
  if (!newUser) return
  unsubscribe?.()
  unsubscribe = watchActiveSessionForPatient(newUser.uid, (session) => {
    activeSession.value = session

    // Auto-redirect to capture when a pending session is found
    if (session && !redirecting.value) {
      redirecting.value = true
      redirectTimer = setTimeout(() => {
        router.push(`/capture?sessionId=${session.id}`)
      }, 1500)
    }
  })
}, { immediate: true })

onUnmounted(() => {
  unsubscribe?.()
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<style scoped>
.patient-page {
  min-height: 100vh; background: var(--bg); color: var(--text);
  font-family: var(--font-body); display: flex; flex-direction: column;
}

.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner {
  max-width: 900px; margin: 0 auto; height: 60px;
  display: flex; align-items: center; justify-content: space-between;
}
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.header-right { display: flex; align-items: center; gap: 1rem; }
.patient-name { font-size: 0.875rem; color: var(--text); font-weight: 500; }
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

.main { flex: 1; max-width: 900px; margin: 0 auto; width: 100%; padding: 2.5rem 2rem; }
.page-title { font-family: var(--font-display); font-size: 1.5rem; margin: 0 0 1.5rem; }

.banner {
  padding: 1.25rem 1.5rem;
  background: var(--surface); border: 1px solid rgba(0,229,255,0.3);
  border-radius: 10px;
  box-shadow: 0 0 24px rgba(0,229,255,0.06);
}
.banner-text { font-size: 0.95rem; color: var(--text); margin: 0; }

.empty-state {
  text-align: center; padding: 3rem 2rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px;
}
.empty-icon {
  width: 56px; height: 56px; margin: 0 auto 1rem;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,229,255,0.1); border-radius: 50%;
  color: var(--accent); font-size: 1.5rem; font-weight: 700;
}
.empty-title { font-family: var(--font-display); font-size: 1.15rem; margin: 0 0 0.5rem; }
.empty-sub { font-size: 0.9rem; color: var(--text-muted); margin: 0; max-width: 400px; margin-inline: auto; }

.dashboard-placeholder {
  margin-top: 2rem; padding: 1.5rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; opacity: 0.6;
}
.placeholder-title { font-family: var(--font-display); font-size: 1rem; margin: 0 0 0.4rem; }
.placeholder-sub { font-size: 0.85rem; color: var(--text-muted); margin: 0; }
</style>