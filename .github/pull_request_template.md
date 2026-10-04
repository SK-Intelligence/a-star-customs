## What and why

<!-- One or two sentences. Link the request or issue. -->

## Checklist

- [ ] Branched from `main`; this PR targets `main`
- [ ] **Quality gate** is green (all jobs: lint/types/forbidden text, unit + coverage + catalog sync, build, E2E, accessibility, Lighthouse, Docker images, ops scripts, security, SonarQube)
- [ ] Catalogue or add-on changes made in **both** copies (`frontend/src/data/` and `backend/app/`), with `scripts/media-review.json` updated for any image or fitment change; `npm run check:catalog` passes
- [ ] Prices stay server-authoritative: the browser never sends a price, and checkout totals come from `backend/app/catalog.json`
- [ ] UI changes checked at 390px and 1440px (screenshots below)
- [ ] No secrets (Stripe, webhook, Web3Forms) in the code, the bundle or this PR; nothing loads from Hostinger

## Screenshots / notes for release
