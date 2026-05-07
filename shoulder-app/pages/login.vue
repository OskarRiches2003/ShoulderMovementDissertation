<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1>ShoulderTrack</h1>
        <p>Sign in to continue</p>
      </div>

      <form @submit.prevent="handleSignIn" class="login-form">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          <span v-if="loading">Signing in…</span>
          <span v-else>Sign in</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const { signIn } = useAuth()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleSignIn() {
  errorMessage.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    // useAuth.signIn handles redirect based on role
    const redirect = route.query.redirect as string
    if (redirect) await navigateTo(redirect)
  } catch (err: any) {
    errorMessage.value = friendlyError(err.code)
  } finally {
    loading.value = false
  }
}

function friendlyError(code: string): string {
  const messages: Record<string, string> = {
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  }
  return messages[code] ?? 'Sign in failed. Please try again.'
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg, #f4f6f9);
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-primary, #2563eb);
  margin-bottom: 0.25rem;
}

.login-header p {
  color: #6b7280;
  font-size: 0.95rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.field input {
  padding: 0.65rem 0.875rem;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.15s;
  outline: none;
}

.field input:focus {
  border-color: var(--color-primary, #2563eb);
}

.error {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0;
}

.btn-primary {
  padding: 0.75rem;
  background: var(--color-primary, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>