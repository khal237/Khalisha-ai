import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Standalone SPA build for Netlify static hosting.
// Does NOT use @lovable.dev/vite-tanstack-config or Cloudflare Workers.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: 'dist/netlify',
    emptyOutDir: true,
  },
});
