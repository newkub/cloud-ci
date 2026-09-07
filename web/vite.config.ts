import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import UnoCSS from 'unocss/vite';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [
    solid(),
    UnoCSS({ configFile: fileURLToPath(new URL('./uno.config.ts', import.meta.url)) }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5199,
    proxy: {
      '/rpc': 'http://localhost:8787',
      '/health': 'http://localhost:8787',
    },
  },
});
