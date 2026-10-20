import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const project = fileURLToPath(new URL('.', import.meta.url));

// The map is a client application. Netlify serves this build from its CDN,
// with the same server-side providers behind Netlify Functions.
export default defineConfig({
  root: resolve(project, 'netlify/client'),
  publicDir: resolve(project, 'public'),
  resolve: { alias: { '@': project } },
  plugins: [react()],
  build: { outDir: resolve(project, 'dist-netlify'), emptyOutDir: true },
});
