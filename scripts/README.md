# scripts/

One-shot generators and setup helpers for `saadm.dev`. None of these run in CI
— invoke manually when you need to regenerate an asset.

| Script | Purpose | Run |
|---|---|---|
| `build-og.py` | Render the OpenGraph card (`../og.png`, 1200×630). | `python scripts/build-og.py` |
| `build-cv-stubs.py` | Render the three placeholder CV PDFs into `../cv/`. | `python scripts/build-cv-stubs.py` |
| `setup-github-repo.ps1` | Apply the GitHub **repo** About/topics/website via `gh`. | `pwsh -File scripts/setup-github-repo.ps1` |
| `setup-github-profile.ps1` | Patch your GitHub **user profile** — bio, URL, company, location, hireable, social accounts — via `gh`. | `pwsh -File scripts/setup-github-profile.ps1` |
| `setup-profile-readme.ps1` | Create / refresh the `saad-mughal435/saad-mughal435` profile-README repo from `profile-readme/README.md`. | `pwsh -File scripts/setup-profile-readme.ps1` |
| `setup-demo-repos.ps1` | Create / refresh four standalone demo repos (kingsley-mes-demo, pebble-storefront, anvil-wholesale, manzil-marketplace) using `git subtree split` from `site/{app,b2c,b2b,property}/`. Re-runnable to sync updates. | `pwsh -File scripts/setup-demo-repos.ps1` |
| `setup-demo-projects.ps1` | Create four GitHub Projects (v2) boards under your profile, one per demo. Pre-populated with realistic Done / In Progress / Todo items so the Projects tab reads like ongoing engineering work. Requires `gh auth refresh -s project`. | `pwsh -File scripts/setup-demo-projects.ps1` |

Prereqs for the `.ps1` scripts: `winget install GitHub.cli` then `gh auth login`.

> All paths above are relative to the repo root (`site/`). Run from there.

## profile-readme/

Source of truth for the README that appears at the top of
[github.com/saad-mughal435](https://github.com/saad-mughal435). Edit
`profile-readme/README.md` here, then run `setup-profile-readme.ps1` to push it
to the magic same-name repo.

## Requirements

- Python 3.10+ with `Pillow` (already vendored in modern Python on Windows; otherwise `pip install Pillow`).
- PowerShell 7+ for the setup script.
- GitHub CLI for `setup-github-repo.ps1`.

## Replacing the placeholders

Both Python scripts are **generators**, not the source of truth — drop your real
PDFs into `site/cv/` (same filenames) and they'll override what these scripts
produced. Same for `site/og.png` — replace with a designed card any time.
