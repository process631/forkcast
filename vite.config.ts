/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env* before the config runs. An empty prefix includes PORT (not only VITE_*).
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.PORT || process.env.PORT) || 5173;
  return {
    plugins: [react()],
    // Relative asset paths, so the built site also works from a sub-folder like GitHub Pages' /forkcast/.
    base: './',
    server: { port },
    test: {
      environment: 'jsdom',
    },
  };
});
