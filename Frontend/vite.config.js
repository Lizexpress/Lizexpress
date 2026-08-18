import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        /**
         * Only react and the router are split by hand — both are genuine static
         * dependencies of the entry, so naming them keeps their hashes stable
         * across deploys and lets browsers reuse the cached copies.
         *
         * Everything else is left to Vite. Manually chunking a lazy-only
         * dependency (recharts) is counter-productive: forcing it into a named
         * chunk pulled it into the entry's preload graph, so every shopper
         * downloaded 380KB of charting for an admin screen they never open.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'router';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
        },
      },
    },
  },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } },
});
