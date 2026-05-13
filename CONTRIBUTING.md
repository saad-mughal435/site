# Contributing

This is a personal portfolio, but if you spot a bug, broken link, typo, or
accessibility issue, contributions are welcome.

## Quick start

```bash
git clone https://github.com/saad-mughal435/site.git
cd site
npm run dev          # serves on http://127.0.0.1:8000
```

No build step — edit files, refresh the browser.

## Commit message convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

Types:
- **feat:** new feature or content
- **fix:** bug fix
- **docs:** documentation only
- **style:** formatting, no behaviour change
- **refactor:** code restructure, no behaviour change
- **perf:** performance improvement
- **chore:** tooling, dependencies, config
- **ci:** GitHub Actions / deploy pipeline

Examples:
- `feat: add FAQ section with FAQPage schema`
- `fix: horizontal scroll on mobile in code window`
- `docs: update README with screenshots`

## Code style

- 2-space indent (enforced by `.editorconfig`).
- LF line endings (auto on commit).
- Run `npm run format` before pushing.

## Pull requests

1. Fork → branch from `main`.
2. Make changes locally.
3. Test in `npm run dev`.
4. Push and open a PR using the template.
5. CI will lint your changes.

## Reporting issues

Open a GitHub issue using the bug or feature template. Include:
- Browser + OS
- Screenshot (if visual)
- Steps to reproduce
