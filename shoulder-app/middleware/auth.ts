import { useAuth } from '~/composables/useAuth'

// Route → required role mapping
const routeRoles: Record<string, string[]> = {
  '/practitioner': ['practitioner', 'admin'],
  '/capture': ['patient', 'practitioner', 'admin'],   // practitioners can preview
  '/dashboard': ['patient', 'practitioner', 'admin'],
  '/admin': ['admin'],
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, role, isLoading } = useAuth()

  // Wait for auth state to resolve before making any decision
  if (isLoading.value) {
    await until(isLoading).toBe(false)
  }

  // Not logged in → send to login, preserving intended destination
  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // Check route-level role requirement
  const allowed = routeRoles[to.path]
  if (allowed && role.value && !allowed.includes(role.value)) {
    // Logged in but wrong role — redirect to their home
    const roleHome: Record<string, string> = {
      practitioner: '/practitioner',
      patient: '/capture',
      admin: '/admin',
    }
    return navigateTo(roleHome[role.value] ?? '/login')
  }
})