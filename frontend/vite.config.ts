import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    sourcemap: true,   // enable source maps for prod to debug the error
    target: 'es2019'   // broad browser compatibility
  }
})
