// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE:
// - Do NOT externalize MUI packages. Leaving rollupOptions empty avoids
//   unresolved imports like '@mui/icons-material/Pets'.

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Inline so DO will always serve them with the bundle
    sourcemap: 'inline',
    // Better stack names in minified code
    target: 'es2019',
    cssMinify: true,
    rollupOptions: {}
  },
  esbuild: {
    keepNames: true
  }
})