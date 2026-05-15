# Security Policy

## Reporting a vulnerability

If you find a security issue with this site (XSS in any rendered content, leaked
secrets, broken auth flow on the demo app, exposed private files, etc.):

**Do not open a public GitHub issue.** Email instead:

📧 **saad@saadm.dev**

Expected response time: within 48 hours.

If the issue is sensitive enough to need encryption, request my PGP public key
at the same address and I'll send it.

## Scope

In-scope:
- `saadm.dev` and any subdomain
- Anything served from this repository
- The live demo at `/app/` (note: it's a disconnected demo with auto-admin
  login and mocked API responses - no real backend or data exists there, but
  if you find a way to make it phone home or load real data, please report)

Out of scope:
- Third-party services (Cloudflare, Formsubmit, GitHub, fonts.googleapis.com)
  - Report those directly to the vendor.
- Anything in `_kingsley_private_DO_NOT_PUBLISH/` (intentionally excluded
  from this repo).

## What you'll get

- Acknowledgement within 48 hours.
- A timeline for the fix.
- Public credit in the repo's CHANGELOG once patched (if you want it).
