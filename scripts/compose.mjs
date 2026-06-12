// Compose the deployable asset directory (dist/) from an explicit allowlist.
// Fail-loud: a missing source is a build failure, never a silent omission.
// `vite build` runs first (and empties dist/), producing index.html,
// contact.html, demo.html, 404.html, notes/*.html and static/*; compose then
// layers everything Vite does not own (demo apps, platform config, images)
// on top. Never wipe dist/ here.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const DIRS = [
  'app', 'ask', 'assets', 'b2b', 'b2c', 'hft-book', 'lahza', 'marsad',
  'nabta', 'pos', 'property', 'sanad', 'vacation', 'watad',
  '.well-known',
];

const FILES = [
  // kept at root FOREVER: ~78 demo pages (marsad, nabta, b2b, ...) load these
  // as plain /home.fx.js + /home.fx.css + /tokens.css tags - never delete them.
  'home.fx.js', 'home.fx.css', 'tokens.css',
  // platform config + SEO files
  '_headers', '_redirects', 'robots.txt', 'sitemap.xml', 'humans.txt',
  'BingSiteAuth.xml',
  // images
  'og.png', 'saad.png', 'saad.webp',
  // public docs (served today; harmless and honest)
  'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE',
];

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
