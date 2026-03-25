// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false, // Camera access requires client-side only

  vite: {
    optimizeDeps: {
      exclude: ['@mediapipe/tasks-vision'],
    },
  },

  app: {
    head: {
      title: 'Shoulder Motion Analyser',
      meta: [
        { name: 'description', content: 'Multi-dimensional shoulder motion analysis using MediaPipe Pose' }
      ]
    }
  }
})