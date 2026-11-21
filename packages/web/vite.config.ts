import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ccn/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    terserOptions: {
      keep_fnames: true,
      mangle: {
        reserved: ['w', '_', 'require', 'exports', 'module', 'describe', 'it', 'beforeAll', 'afterAll', 'beforeEach', 'afterEach'],
      },
      compress: {},
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['lodash'],
        },
      },
    },
  },
  define: {
    global: 'globalThis',
  },
});