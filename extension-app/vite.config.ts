import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest/manifest';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        workbench: resolve(__dirname, 'src/workbench/index.html'),
      },
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
