import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

export default defineConfig({
  plugins: [react(), mkcert()],
  base: '/', // keep this
  server: {
    port: 5173,
    https: false
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});