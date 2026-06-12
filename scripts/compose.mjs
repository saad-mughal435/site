// Compose the deployable asset directory (dist/) from an explicit allowlist.
// Fail-loud: a missing source is a build failure, never a silent omission.
// Phase 1 of the v6 migration: dist/ mirrors exactly what the root served,
// so flipping wrangler's assets.directory to ./dist changes nothing visible.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const DIRS = [
  'app', 'ask', 'assets', 'b2b', 'b2c', 'hft-book', 'lahza', 'marsad',
  'nabta', 'notes', 'pos', 'property', 'sanad', 'vacation', 'watad',
  'vendor', '.well-known',
];

const FILES = [
  // shell pages
  'index.html', 'contact.html', 'demo.html', '404.html',
  // shell css/js (until Phase 2 moves these into src/)
  'home.css', 'home.fx.css', 'home.fx.js', 'home.app.js',
  'styles.css', 'tokens.css', 'script.js', 'demo.css', 'demo.js', 'contact.js',
  // platform config + SEO files
  '_headers', '_redirects', 'robots.txt', 'sitemap.xml', 'humans.txt',
  'BingSiteAuth.xml',
  // images
  'og.png', 'saad.png', 'saad.webp',
  // public docs (served today; harmless and honest)
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE',
];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

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
console.log(`compose: ${copied} entries -> dist/`);
