# A Star Customs

An independently owned rebuild of [astarcustoms.com](https://www.astarcustoms.com/) with no Hostinger dependency at runtime.

The repository contains the complete public storefront, all 37 migrated products and local media, a persistent cart, cookie-controlled third-party embeds, contact and review workflows, and server-authoritative Stripe Checkout.

## Stack

- React 18, React Router 7, strict TypeScript, Vite, Zustand
- FastAPI, Pydantic, Stripe's Python SDK, SQLite
- Nginx for production static hosting, API proxying, SPA route fallback, headers, and request throttling

## Local development

Requirements: Node.js 20+, npm, Python 3.12+.

```bash
npm install

python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt

cp .env.example backend/.env
```

Run the API and frontend in separate terminals:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Vite proxies `/api` to `http://localhost:8000`, so `VITE_API_BASE_URL` can remain blank locally. Set it only when the frontend and API use different origins.

## Configuration

Copy `.env.example` to `backend/.env` for local work or to `.env` for Docker Compose. Never commit either file.

| Variable | Required for | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Payments | Stripe server secret (`sk_test_…` in staging, `sk_live_…` in production). Never expose it as a `VITE_` variable. |
| `STRIPE_WEBHOOK_SECRET` | Payment confirmation | Signing secret for `/api/stripe/webhook` (`whsec_…`). |
| `WEB3FORMS_ACCESS_KEY` | Contact form delivery | Server-side Web3Forms access key. |
| `CHECKOUT_SUCCESS_URL` | Payments | Must retain `?session_id={CHECKOUT_SESSION_ID}` so the result can be verified server-side. |
| `CHECKOUT_CANCEL_URL` | Payments | Returns customers to the local checkout page. |
| `CORS_ORIGINS` | API access | Comma-separated, exact frontend origins. |
| `ORDERS_DATABASE_PATH` | Orders | Use a persistent mounted path in production. |
| `REVIEWS_DATABASE_PATH` | Reviews | Use a persistent mounted path in production. |
| `VITE_API_BASE_URL` | Split-origin deployment | Public API origin only; leave blank behind the included same-origin proxy. |

### Activating Stripe

1. Add `STRIPE_SECRET_KEY` to the backend environment.
2. In Stripe Workbench, create a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook`.
3. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Add the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Set production `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`, and `CORS_ORIGINS`.
6. Complete a Stripe test-mode payment and verify the order status before switching to live keys.

Checkout prices are always loaded from the backend catalog. The browser cannot submit a price. Payment details are collected on Stripe's hosted page, and the cart is cleared only after a server-verified paid session.

### Activating contact delivery

Create a Web3Forms access key for the company inbox and add it as `WEB3FORMS_ACCESS_KEY`. Until then, the public form presents WhatsApp and email as working fallbacks.

## Verification

```bash
npm run verify
npm audit --omit=dev
```

This runs the strict frontend production build, catalog integrity checks, and backend tests. The current backend suite covers contact validation, trusted catalog pricing, multi-item checkout, shipping, durable orders, signed/idempotent webhooks, session verification, and review moderation privacy.

## Production with Docker

```bash
cp .env.example .env
# Fill the server-side keys and replace localhost URLs.
docker compose up --build -d
```

The frontend is served at port `8080` by default. Nginx supplies SPA history fallback, proxies `/api`, applies baseline security headers, and throttles public write endpoints. The named `astar-data` volume persists orders and reviews across container restarts.

For production, back up that volume, terminate TLS at the host or load balancer, and keep the application behind the included proxy or equivalent edge controls.

## Catalog and media

The production app reads only local JSON and local image/font files. It does not call Hostinger.

- `frontend/src/data/catalog.json` drives the storefront.
- `backend/app/catalog.json` is the server-authoritative pricing copy.
- `python scripts/check_catalog_sync.py` proves both copies and all referenced product images are in sync.
- `python scripts/import_hostinger_catalog.py --refresh-assets` refreshes the final source snapshot before Hostinger is retired. This is a migration utility, not a runtime dependency.

After cutover, edit the catalog deliberately in source control and keep both copies identical. Run `npm run check:catalog` before every release.

## Review moderation

Public submissions are stored as `pending` and never appear automatically. Moderate them from the server:

```bash
python scripts/moderate_reviews.py list
python scripts/moderate_reviews.py approve 12
python scripts/moderate_reviews.py reject 13
```

Use `--database /persistent/path/reviews.db` when the database is outside the default backend data directory.

## Cutover checklist

- Run the final catalog/media import and `npm run verify`.
- Configure live Stripe and Web3Forms keys in the deployment secret store.
- Register and test the production Stripe webhook.
- Confirm the persistent data volume and backup schedule.
- Test all navigation, cart, contact, review, checkout/cancel/success, cookie, map, and mobile flows on the production domain.
- Point DNS only after the new domain passes those checks.
- Keep the old Hostinger site available briefly for rollback, then remove it after order and analytics verification.
