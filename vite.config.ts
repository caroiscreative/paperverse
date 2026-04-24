import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Explicámelo now calls Pollinations.ai directly from the browser (see
// src/lib/explain.ts), so there is no local `/api` server to proxy anymore.
// If you bring back a Vercel function under /api/, re-add the proxy block.
export default defineConfig({
 plugins: [react()],
 server: {
 port: 5173,
 },
 build: {
 target: 'es2020',
 outDir: 'dist',
 sourcemap: false,
 },
});
