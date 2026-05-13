# Muhammad Saad — Portfolio

Personal portfolio for **Muhammad Saad**, Electrical & Automation Engineer / MES-ERP Developer based in Dubai, UAE.

- **Live URL:** _set after Cloudflare Pages deployment_
- **Contact:** [saad@saadm.dev](mailto:saad@saadm.dev)
- **LinkedIn:** [linkedin.com/in/muhammadsaad435](https://www.linkedin.com/in/muhammadsaad435/)

## What's in this repo

| Path | Purpose |
|------|---------|
| `index.html` | Homepage (React 18 via CDN, no build step). View toggle: All / Engineering / Coding. |
| `home.css` | Modern dark theme + animations for the homepage. |
| `contact.html` | Contact form. Posts to [Formsubmit.co](https://formsubmit.co) — relays to my inbox. |
| `contact.js`, `contact form styles in styles.css` | Form validation + AJAX submit. |
| `demo.html` | Static, fast-loading walkthrough of the MES/ERP project (fabricated data only). |
| `demo.css`, `demo.js` | Styles + sidebar nav for the static demo. |
| `app/` | Disconnected live demo of the MES/ERP system. Sanitised frontend running entirely in-browser; every fetch intercepted and answered with placeholder data. Auto-logs in as admin. |
| `styles.css`, `script.js` | Shared styles + interactions for `contact.html` / `demo.html` / `app/` (the homepage uses `home.css` only). |
| `run.bat` | Local dev convenience: serves the site on `http://127.0.0.1:8000/` via `python -m http.server`. Not used in production. |
| `_headers` | Cloudflare Pages — sets cache + security headers. |
| `_redirects` | Cloudflare Pages — handles SPA-style routes and aliases. |

## Tech stack

- HTML / CSS / vanilla JS for the static pages.
- React 18 (CDN) + Babel-standalone for the homepage. No build step.
- Tailwind CDN + custom CSS for the `app/` live demo.
- Custom CSS animations: scroll-triggered reveals, count-up stats, magnetic CTAs, cursor-tilt code window, gradient orbs.
- Contact form delivered via [Formsubmit.co](https://formsubmit.co) — no backend required.

## Running locally

Requires Python 3 on PATH. From this directory:

```bat
run.bat
```

Then open <http://127.0.0.1:8000/>.

Or any equivalent: `python -m http.server 8000`.

## Deploying to Cloudflare Pages

Push this folder to GitHub, then in the Cloudflare dashboard:

1. **Pages → Create a project → Connect to Git**.
2. Select the repo.
3. **Build settings**:
   - Framework preset: **None**
   - Build command: _(leave blank)_
   - Build output directory: _(leave blank — the repo root is the site)_
4. Deploy.

The portfolio is fully static — Cloudflare's CDN serves every file directly.

## License

All code in this repo is © Muhammad Saad. The portfolio content (writing, identity) is personal.
