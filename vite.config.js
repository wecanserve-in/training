import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api calls go to a local PHP server (php -S 127.0.0.1:8080 -t public).
    proxy: {
      '/api': process.env.LMS_API_PROXY || 'http://127.0.0.1:8080',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep big libraries in their own cacheable files.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database'],
        },
      },
    },
  },
})
