import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Inline so DO will always serve them with the bundle
    sourcemap: 'inline',
    // Better stack names in minified code
    target: 'es2019',
    cssMinify: true
  },
  esbuild: {
    keepNames: true
  }
})
