import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',                              // important for correct asset paths on DO
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    // Inline so DO will always serve them with the bundle (optional)
    sourcemap: 'inline',
    // Better stack names in minified code
    target: 'es2019',
    cssMinify: true,
    // Keep empty to avoid externalizing MUI icons etc.
    rollupOptions: {}
  },
  esbuild: {
    legalComments: 'none'
  }
});