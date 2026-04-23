import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  // Tauri expects a fixed port; clearScreen keeps Tauri's output readable
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: isTauri ? '127.0.0.1' : true,
    watch: {
      // Avoid triggering Vite HMR on Rust recompilation
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  // Let Tauri set environment-specific base URL
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
