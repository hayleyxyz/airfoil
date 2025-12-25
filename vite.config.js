import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
      allowedHosts: true,
    },
    build: { 
      target: 'esnext',
      rollupOptions: {
        input: {
          main: resolve(__dirname, './index.html'),
        },
      }, 
    },
  });