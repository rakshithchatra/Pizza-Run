import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5183, strictPort: true },
  build: { rollupOptions: { input: ['index.html', 'design.html'] } },
});
