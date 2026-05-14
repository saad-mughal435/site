# scripts/

One-shot generators and setup helpers for `saadm.dev`. None of these run in CI
— invoke manually when you need to regenerate an asset.

| Script | Purpose | Run |
|---|---|---|
| `build-og.py` | Render the OpenGraph card (`../og.png`, 1200×630). | `python scripts/build-og.py` |
| `build-cv-stubs.py` | Render the three placeholder CV PDFs into `../cv/`. | `python scripts/build-cv-stubs.py` |
| `setup-github-repo.ps1` | Apply the GitHub repo About/topics/website via `gh`. Requires `winget install GitHub.cli` then `gh auth login`. | `pwsh -File scripts/setup-github-repo.ps1` |

> All paths above are relative to the repo root (`site/`). Run from there.

## Requirements

- Python 3.10+ with `Pillow` (already vendored in modern Python on Windows; otherwise `pip install Pillow`).
- PowerShell 7+ for the setup script.
- GitHub CLI for `setup-github-repo.ps1`.

## Replacing the placeholders

Both Python scripts are **generators**, not the source of truth — drop your real
PDFs into `site/cv/` (same filenames) and they'll override what these scripts
produced. Same for `site/og.png` — replace with a designed card any time.
