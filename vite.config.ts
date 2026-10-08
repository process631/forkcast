/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the built site also works from a sub-folder like GitHub Pages' /forkcast/.
  base: './',
  // PORT lets tools run a second copy on another port; 5173 is the default.
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    environment: 'jsdom',
  },
});
