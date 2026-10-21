import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const project = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: resolve(project, 'netlify/client'),
  publicDir: resolve(project, 'public'),
  resolve: { alias: { '@': project } },
  plugins: [react()],
  build: { outDir: resolve(project, 'dist-mobile'), emptyOutDir: true },
});
