# Contributing to A Star Customs

Everything reaches customers the same way. Nothing is pushed straight to `main`.

1. **Branch** from `main`: `git switch -c short-description main`.
2. **Check locally** (from the repository root): `npm run ci:fast` (ESLint, types, Ruff lint and format, forbidden text, backend tests, catalog sync). For UI, cart or checkout changes also `npm run build`, then `cd frontend && E2E_TARGET=prod npx playwright test` (the E2E and accessibility suites against the production build).
3. **Open a pull request** into `main`. The **Quality gate** workflow (`.github/workflows/ci.yml`) runs every check below. All jobs must be green; a red job means the change is not ready.
4. **Merge** the pull request into `main`. Railway deploys `main` only after the commit's checks pass ("Wait for CI").

First-time setup is in `README.md` (npm install, `backend/.venv`). Enable the pre-push hook once per clone with `npm run setup:hooks`: pushing `main` then runs `npm run ci:fast` first and is refused if it fails.

## The Quality gate

| Job | What fails it |
|---|---|
| Lint, types, forbidden text | an ESLint error or warning (`frontend/eslint.config.js`), a `tsc -b` error, a Ruff finding or unformatted Python (`ruff check` / `ruff format --check`, `ruff.toml`), or a Stripe/Web3Forms secret or Hostinger URL in the storefront source (`scripts/check-forbidden-text.mjs`) |
| Unit tests + coverage, catalog sync | a failing backend test, backend coverage below `fail_under` in `backend/.coveragerc` (92: at least 0.5 points under the measured 93.00%), or `scripts/check_catalog_sync.py` |
| Production build | `npm run build` failing, or forbidden text in the built bundle (`frontend/dist`) |
| E2E | the Playwright suite (desktop, and a 390 x 844 phone) against the production build served by `vite preview` with the FastAPI backend, including the fitment parity checks in `frontend/e2e/fitment.spec.ts` |
| Accessibility | a serious or critical axe violation on `/`, the C-Class product page, `/shop`, `/contact-us` or `/checkout` at 390px and 1440px (`frontend/e2e/accessibility.spec.ts`) |
| Lighthouse | on `/` and the C-Class product page (mobile, median of 3): accessibility below 0.95, best practices below 0.9, performance below 0.75 (`frontend/lighthouserc.json`; the measured level, to be raised to 0.8 once the photos are responsive) |
| Docker images | `docker build` of `backend/Dockerfile` or `frontend/Dockerfile` from the repository root, exactly as Railway builds them |
| Ops scripts | a ShellCheck finding in `ops/smoke-test.sh` or `.githooks/pre-push` |
| Security | an `npm audit` high or critical advisory outside `AUDIT_ALLOW`, any `pip-audit` finding in `backend/requirements.txt`, a gitleaks secret (`.gitleaks.toml`), or a Semgrep ERROR finding |
| SonarQube | the "A-Star" quality gate (security A, maintainability A, reliability C or better, duplication 5% or less) in a throwaway SonarQube Community container |

After a release, **Actions → Live site smoke check → Run workflow** runs `ops/smoke-test.sh` against the live site (read-only: it never creates a Stripe session, an order, a review or an enquiry). It also runs by hand: `sh ops/smoke-test.sh https://astarcustoms.com`.

## Deploys

Railway builds each service from its config-as-code file: `frontend/railway.json` (nginx + the built storefront, `frontend/Dockerfile`) and `backend/railway.json` (FastAPI, `backend/Dockerfile`, health check `/api/health`). Both Docker builds run the catalog check first, so a catalogue that is out of sync cannot deploy. With **Wait for CI** on, Railway skips a commit whose Quality gate fails; a backend release that fails its health check never goes live and the previous one keeps serving.

## Dependency updates (Dependabot)

Dependabot opens a pull request when a security advisory affects a dependency (npm, the backend's pip requirements, or a GitHub Action). Routine version updates are off (`open-pull-requests-limit: 0` in `.github/dependabot.yml`); raise the limits to turn them back on. Security pull requests run the full Quality gate like any other. **Merge when green**; a red one needs a look (for a major version, read its changelog first).

## Rules that fail the build

The project rules in `AGENTS.md` are checks: the catalogue and media stay independent from Hostinger and identical in both copies (`scripts/check_catalog_sync.py`, `scripts/check-forbidden-text.mjs`), prices are server-authoritative (`backend/tests/`), and no payment, webhook or contact provider secret reaches the browser (`scripts/check-forbidden-text.mjs` on the source and the built bundle).

## Commits

Plain, descriptive messages. No AI or tool attribution trailers.
