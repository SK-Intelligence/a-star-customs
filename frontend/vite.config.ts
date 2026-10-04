import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    proxy: {
      // `vite preview` reuses this proxy. The browser suites serve the production build that way
      // and point API_PROXY_TARGET at their own backend port.
      '/api': loadEnv(mode, '.', 'API_PROXY_').API_PROXY_TARGET || 'http://localhost:8000',
    },
  },
}));

