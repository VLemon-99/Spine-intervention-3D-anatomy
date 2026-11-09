import { defineConfig } from 'vite';

// Dev server: always http://localhost:5173. strictPort makes Vite stop with an
// error instead of silently moving to another port (screen tests rely on 5173).
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
});
