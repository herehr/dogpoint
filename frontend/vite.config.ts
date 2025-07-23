// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],
  base: '/', // ✅ ADD THIS LINE
  server: {
    port: 5173,
    https: false,
  },
  preview: {
    port: 8080,
    host: true,
    allowedHosts: ['.ondigitalocean.app'],
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});