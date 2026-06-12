import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Output paths must equal today's URLs exactly: contact.html, demo.html,
// 404.html and notes/*.html at the same locations they are served from.
// assetsDir is 'static' (NOT 'assets') - /assets/ is occupied by the
// portfolio banner and carries a conflicting cache rule in _headers.
const entry = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: 'src',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'static',
    rollupOptions: {
      input: {
        contact: entry('src/contact.html'),
        demo: entry('src/demo.html'),
        notfound: entry('src/404.html'),
        'notes-index': entry('src/notes/index.html'),
        'notes-itch': entry('src/notes/itch-orderbook-reconstruction.html'),
        'notes-shopfloor': entry('src/notes/shopfloor-oee-engine.html'),
        'notes-krones': entry('src/notes/krones-operations-software.html'),
      },
    },
  },
});
