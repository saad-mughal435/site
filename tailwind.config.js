/* Tailwind build for the /app/ MES demo ONLY.
 * The app used the Play CDN (runtime JIT), which forces 'unsafe-eval' into
 * the site CSP; this precompiles the same default-config utilities into
 * app/css/tailwind.css instead. The app's .dark theming lives in the
 * hand-written dark.css (no dark: variants are used), so default config
 * is correct. Build: npm run build:appcss
 */
module.exports = {
  content: [
    './app/**/*.html',
    './app/js/**/*.js',
  ],
  theme: { extend: {} },
  plugins: [],
};
