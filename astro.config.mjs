// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Astro replaces the old `vite build && compose.mjs` pipeline. The settings
// below reproduce the EXACT deploy contract the Cloudflare Workers static-asset
// site depends on (see plan + _headers/_redirects):
//
//   build.format:'preserve' -> mirrors the source tree exactly, like the old Vite
//                             multi-entry build: contact.astro => dist/contact.html,
//                             notes/index.astro => dist/notes/index.html (NOT
//                             dist/notes.html, which 'file' would collapse it to).
//                             Cloudflare serves the clean URL /contact at 200 and
//                             307-redirects /contact.html; every _redirects .html
//                             target and the /notes/ directory URL stay valid.
//   build.assets: 'static' -> hashed JS/CSS land in dist/static/ (Astro default is
//                             _astro/), so the existing `/static/* immutable` rule in
//                             _headers keeps covering them with zero change. Same
//                             namespace Vite used (assetsDir was 'static').
//   inlineStylesheets:'never' -> keep CSS external like Vite did, for clean parity.
//   trailingSlash:'ignore' -> never emit redirect stubs that would change URLs.
//
// publicDir defaults to ./public (re-enabled; old Vite had publicDir:false because
// compose.mjs did the copying). outDir/srcDir keep their ./dist and ./src defaults.
export default defineConfig({
  site: 'https://saadm.dev',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react()],
  build: {
    format: 'preserve',
    assets: 'static',
    inlineStylesheets: 'never',
  },
});
