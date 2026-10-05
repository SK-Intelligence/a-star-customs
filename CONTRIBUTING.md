# Contributing to A Star Customs

Everything reaches customers the same way. Nothing is pushed straight to `main`.

1. **Branch** from `main`: `git switch -c short-description main`.
2. **Check locally** (from the repository root): `npm run ci:fast` (ESLint, `tsc -b`, Ruff lint and format, forbidden text, backend tests, `check_catalog_sync.py --ci` and its self-tests). For UI, cart or checkout changes also `npm run build`, then `cd frontend && E2E_TARGET=prod npx playwright test` (the E2E and accessibility suites against the production build).
3. **Open a pull request** into `main`. The **Quality gate** workflow (`.github/workflows/ci.yml`) runs every check below. All jobs must be green; a red job means the change is not ready.
4. **Merge** the pull request into `main`. The GitHub ruleset below blocks the merge until all 10 Quality gate checks pass, and Railway also waits for the commit's check suites before deploying it ("Wait for CI").

First-time setup is in `README.md` (`npm install`, and `backend/.venv` from the hashed lock with `pip install --require-hashes -r backend/requirements.txt`). Enable the pre-push hook once per clone with `npm run setup:hooks`: pushing `main` then runs `npm run ci:fast` first and is refused if it fails.

## The Quality gate

| Job | What fails it |
|---|---|
| Lint, types, forbidden text | an ESLint error or warning (`frontend/eslint.config.js`), a `tsc -b` error, a Ruff finding or unformatted Python (`ruff check` / `ruff format --check`, `ruff.toml`), or a Stripe/Web3Forms secret or Hostinger URL in the storefront source (`scripts/check-forbidden-text.mjs`) |
| Unit tests + coverage, catalog sync | a failing responsive-image unit test (`npm run test:unit`, `frontend/test/`), a failing backend test, backend coverage below `fail_under` in `backend/.coveragerc` (92: at least 0.5 points under the measured 93.00%), `scripts/check_catalog_sync.py --ci` (copies in sync, metadata, media SHA-256s, fitment guards, and the text-against-fitment and duplicate-listing heuristics), or its self-tests in `scripts/tests/` |
| Production build | `npm run build` failing, or forbidden text in the built bundle (`frontend/dist`: every non-binary file, test-named files included; a text file over 5 MB fails) |
| E2E | the Playwright suite (desktop, and a 390 x 844 phone) against the production build served by `vite preview` with the FastAPI backend, including the fitment parity checks in `frontend/e2e/fitment.spec.ts` |
| Accessibility | a serious or critical axe violation on `/`, the C-Class product page, `/shop`, `/contact-us` or `/checkout` at 390px and 1440px (`frontend/e2e/accessibility.spec.ts`) |
| Lighthouse | on `/` and the C-Class product page (mobile, median of 3), a score under the budgets in `frontend/lighthouserc.json` (accessibility 0.95, best practices 0.9, performance 0.8; local medians 0.93 and 0.95 with the responsive WebP photos). `@lhci/cli` comes from the lockfile |
| Docker images | `docker build` of `backend/Dockerfile` or `frontend/Dockerfile` from the repository root, exactly as Railway builds them: base images pinned by digest, the backend installed with `--require-hashes`, and the structural catalogue check (no `--ci` heuristics) |
| Ops scripts | a ShellCheck finding in `ops/smoke-test.sh` or `.githooks/pre-push` |
| Security | an `npm audit` high or critical advisory outside `AUDIT_ALLOW` (each entry justified in `ci.yml`), any `pip-audit` finding in the locked `backend/requirements-runtime.txt` or `backend/requirements.txt`, a gitleaks secret anywhere in the history (`.gitleaks.toml`), or a Semgrep ERROR finding (`p/typescript`, `p/react`, `p/python`, `p/owasp-top-ten`). pip-audit and Semgrep install from the hashed `.github/ci-tools.txt` |
| SonarQube | the "A-Star" quality gate (security A, maintainability A, reliability C or better, duplication 5% or less) in a throwaway SonarQube Community container (image pinned by digest) |

Every job runs on `ubuntu-24.04`, with `contents: read` and no persisted checkout credentials.

After a release, **Actions → Live site smoke check → Run workflow** runs `ops/smoke-test.sh` against the live site (read-only: it never creates a Stripe session, an order, a review or an enquiry). It also runs by hand: `sh ops/smoke-test.sh https://astarcustoms.com`.

## Deploys

Railway builds each service as described by Infrastructure as Code in `.railway/railway.ts`: the frontend (nginx + the built storefront, `frontend/Dockerfile`) and the backend (FastAPI, `backend/Dockerfile`, health check `/api/health`, rebuilt only when `backend/**` changes, persistent volume at `/data`). Both services deploy `main` of `SK-Intelligence/a-star-customs` with check suites ("Wait for CI") on. Variables and secrets are not in the file; they stay in Railway. The deprecated `railway.json` files are gone. Restart policy is left to each service's Railway settings. Both Docker builds run the structural catalogue check first, so a catalogue that is out of sync cannot deploy. A backend release that fails its health check never goes live and the previous one keeps serving; the frontend has no Railway health check, so run the live smoke check after a release.

**Branch protection.** The GitHub ruleset "Protect main: Quality gate" guards `main`. It requires a pull request and all 10 Quality gate checks to pass, blocks force-pushes and deletion of `main`, and lets organisation admins bypass it through a pull request only (never by pushing directly). Railway's Wait for CI is a second, deploy-time gate, not the only one.

**Required Railway setup** (once, by the project owner):

1. Connect **both** services (frontend and backend) to this GitHub repository, deploying `main`.
2. Preview the Infrastructure as Code with the Railway CLI (`railway link`, then `railway config plan` from the repository root) and check that only intended changes are listed.
3. Apply it with `railway config apply`, which asks for confirmation. Planning is read-only; applying changes the live project, so review the plan first.
4. Leave each service's old "Config file path" setting empty; the `railway.json` files no longer exist.

Until the services are connected, a push to `main` is not deployed at all; the ruleset keeps unreviewed changes off `main` either way.

## Dependency updates (Dependabot)

Dependabot opens a pull request when a security advisory affects a dependency (npm, the backend's pip locks, a Docker base image, or a GitHub Action). The Python locks are compiled with pip-compile from the `.in` files; edit those and recompile with the command at the top of each. Routine version updates are off (`open-pull-requests-limit: 0` in `.github/dependabot.yml`); raise the limits to turn them back on. Security pull requests run the full Quality gate like any other. **Merge when green**; a red one needs a look (for a major version, read its changelog first).

## Rules that fail the build

The project rules in `AGENTS.md` are checks: the catalogue and media stay independent from Hostinger and identical in both copies (`scripts/check_catalog_sync.py`, `scripts/check-forbidden-text.mjs`), prices are server-authoritative (`backend/tests/`), no payment, webhook or contact provider secret reaches the browser (`scripts/check-forbidden-text.mjs` on the source and the built bundle), and API errors never echo client input (`backend/tests/test_api.py`). FastAPI's `/docs`, `/redoc` and `/openapi.json` are off unless `ENABLE_API_DOCS=true` (local work only).

Fitment compares make, model and chassis code only; model years are not compared until the catalogue has a year field.

## Commits

Plain, descriptive messages. No AI or tool attribution trailers.
