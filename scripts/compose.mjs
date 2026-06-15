// Compose the deployable dist/ from an explicit allowlist of things Astro does
// NOT own yet: the (still-static) demo apps + the repo-root docs that must also
// live at the repo root for GitHub. `astro build` runs first (and empties dist/),
// producing the shell pages, /static/* hashed assets, and everything in public/
// (home.fx.*, tokens.css, _headers, _redirects, SEO files, images, .well-known).
// compose then layers the demos + docs on top. Fail-loud: a missing source is a
// build failure, never a silent omission. It also asserts the public/ passthrough
// actually landed, so a broken Astro public copy can't ship a site with no
// _headers / _redirects. Never wipe dist/ here.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Demo apps - still hand-written static, copied verbatim. Each migrates to Astro
// in a later phase; remove it from this list as its rebuild reaches parity.
const DIRS = [
  'app', 'ask', 'assets', 'b2b', 'b2c', 'hft-book', 'lahza', 'marsad',
  'nabta', 'pos', 'property', 'sanad', 'vacation', 'watad',
];

// Repo-root docs: kept at root so GitHub renders them; also served verbatim.
const FILES = [
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE',
];

// Provided by public/ via `astro build`. Assert they reached dist/ so a broken
// public copy fails the build loudly instead of deploying a headless site.
const PUBLIC_REQUIRED = [
  '_headers', '_redirects', 'tokens.css', 'home.fx.js', 'home.fx.css',
  'robots.txt', 'sitemap.xml', 'og.png', 'saad.webp', '.well-known/security.txt',
];

mkdirSync(DIST, { recursive: true });

for (const f of PUBLIC_REQUIRED) {
  if (!existsSync(join(DIST, f))) {
    throw new Error(`compose: public/ asset missing from dist/: ${f} (did astro public copy fail?)`);
  }
}

let copied = 0;
for (const d of DIRS) {
  const src = join(ROOT, d);
  if (!existsSync(src)) throw new Error(`compose: missing directory ${d}`);
  cpSync(src, join(DIST, d), { recursive: true });
  copied++;
}
for (const f of FILES) {
  const src = join(ROOT, f);
  if (!existsSync(src)) throw new Error(`compose: missing file ${f}`);
  cpSync(src, join(DIST, f));
  copied++;
}
console.log(`compose: ${copied} entries + ${PUBLIC_REQUIRED.length} public assets verified -> dist/`);
