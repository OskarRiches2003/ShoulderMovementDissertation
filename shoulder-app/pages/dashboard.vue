<template>
  <div class="dash-page">
    <header class="header">
      <div class="header-inner">
        <span class="logo">PLACEHOLDER<span class="logo-accent">LOGO</span></span>
        <nav class="nav">
          <NuxtLink to="/" class="nav-link">Capture</NuxtLink>
          <NuxtLink to="/dashboard" class="nav-link active">Dashboard</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="empty-state">
      <p class="empty-icon">📊</p>
      <h1>Session Dashboard</h1>
      <p>Complete a recorded session on the Capture page and your data will appear here.</p>
      <NuxtLink to="/" class="btn btn-primary">Go to Capture</NuxtLink>
    </main>
  </div>
</template>

<style scoped>
.dash-page { min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font-body); display: flex; flex-direction: column; }
.header { border-bottom: 1px solid var(--border); padding: 0 2rem; }
.header-inner { max-width: 1200px; margin: 0 auto; height: 60px; display: flex; align-items: center; justify-content: space-between; }
.logo { font-family: var(--font-display); font-size: 1.2rem; letter-spacing: 0.12em; font-weight: 700; }
.logo-accent { color: var(--accent); }
.nav { display: flex; gap: 1.5rem; }
.nav-link { font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; transition: color 0.2s; }
.nav-link:hover, .nav-link.active { color: var(--accent); }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; text-align: center; padding: 2rem; }
.empty-icon { font-size: 3rem; margin: 0; }
h1 { font-family: var(--font-display); font-size: 1.8rem; margin: 0; }
p { color: var(--text-muted); max-width: 400px; }
.btn { padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; border: 1px solid transparent; text-decoration: none; }
.btn-primary { background: var(--accent); color: #000; border-color: var(--accent); }
</style>