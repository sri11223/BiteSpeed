import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/identify': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/api-docs': 'http://localhost:3000',
    },
  },
})
