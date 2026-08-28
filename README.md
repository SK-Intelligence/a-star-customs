# A Star Customs

An independently owned rebuild of [astarcustoms.com](https://www.astarcustoms.com/) with no Hostinger dependency at runtime.

The repository contains the complete public storefront, all 37 migrated products and local media, a persistent multi-item cart, configurable package add-ons, cookie-controlled third-party embeds, contact and review workflows, and server-authoritative Stripe Checkout.

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
| `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID` | Payments | Stripe payment-method configuration (`pmc_…`) used by hosted Checkout. |
| `STRIPE_WEBHOOK_SECRET` | Payment confirmation | Signing secret for `/api/stripe/webhook` (`whsec_…`). Checkout stays disabled until this, the Stripe secret, and the payment-method configuration are all set. |
| `WEB3FORMS_ACCESS_KEY` | Contact form delivery | Server-side Web3Forms access key. |
| `CHECKOUT_SUCCESS_URL` | Direct backend deployment | Must retain `?session_id={CHECKOUT_SESSION_ID}` so the result can be verified server-side. Docker Compose derives this from `PUBLIC_BASE_URL`. |
| `CHECKOUT_CANCEL_URL` | Direct backend deployment | Returns customers to the checkout page. Docker Compose derives this from `PUBLIC_BASE_URL`. |
| `CORS_ORIGINS` | Direct backend deployment | Comma-separated, exact frontend origins. Docker Compose derives this from `PUBLIC_BASE_URL`. |
| `ORDERS_DATABASE_PATH` | Orders | Use a persistent mounted path in production. |
| `REVIEWS_DATABASE_PATH` | Reviews | Use a persistent mounted path in production. |
| `VITE_API_BASE_URL` | Split-origin deployment | Public API origin only; leave blank behind the included same-origin proxy. |
| `PUBLIC_BASE_URL` | Docker Compose | The exact public site origin; drives checkout redirects and CORS in the included Compose stack. |

### Activating Stripe

1. Add `STRIPE_SECRET_KEY` to the backend environment.
2. In Stripe Dashboard, create an active Dynamic Payment Methods configuration for this storefront. Enable card, Apple Pay, Google Pay, Link, Klarna, Afterpay/Clearpay, PayPal, Amazon Pay, Revolut Pay, Pay by Bank, and any additional mobile wallets Stripe offers to the A Star account for GBP payments. Connect the required provider account for methods such as PayPal. Add the configuration's `pmc_…` ID as `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`.
3. Register the production domain and every checkout subdomain under Stripe's payment-method domains. Complete the equivalent test-mode registration when validating wallets before launch; local wallet testing requires an HTTPS domain or tunnel. Stripe handles Apple merchant validation, so this integration does not need a separate Apple Merchant ID or certificate.
4. In Stripe Workbench, create a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook`.
5. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
6. Add the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.
7. Set production `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`, and `CORS_ORIGINS`, or set `PUBLIC_BASE_URL` when using the included Docker Compose stack.
8. Complete test-mode payments on compatible iPhone/Safari and Android/Chrome devices, plus the other methods Stripe makes available to the test customer. Verify the order status before switching to live keys, then repeat a live-mode wallet check after domain registration and payment-method activation are complete.

Checkout will not create a Stripe session until the secret key, payment-method configuration, and webhook signing secret are all present. This prevents the site from accepting delayed payments without a verified status-update path.

Checkout prices are always loaded from the backend catalog. The browser cannot submit a price. Payment details are collected on Stripe's hosted page. The backend passes the selected Payment Method Configuration and intentionally omits `payment_method_types`, allowing Stripe to decide which enabled methods to show for each customer, device, currency, basket, and account eligibility. The site does not promise every method on every order. Wallet domains, Klarna/Afterpay-Clearpay merchant approval, and PayPal connection are completed in Stripe rather than in this repository.

A paid return removes only the quantities captured for that exact order, so items added later or from another build stay in the bag. Delayed payment methods remain in a processing state until Stripe sends an asynchronous success or failure event. Instalment terms, limits, eligibility, and repayment schedules are shown by the payment provider; the storefront does not calculate or advertise a fixed plan.

For the initial single-server launch, **Stripe Dashboard is the operational source of truth** for customer contact and shipping details, receipts, refunds, payment disputes, and fulfilment lookup. The local SQLite order table is a reconciliation/status ledger, not a replacement order-management dashboard. Give the workshop team appropriate Stripe access, enable Stripe receipt emails, and use the `order_reference` metadata when matching enquiries to Checkout sessions.

### Activating contact delivery

Create a Web3Forms access key for the company inbox and add it as `WEB3FORMS_ACCESS_KEY`. Until then, the public form presents WhatsApp and email as working fallbacks.

## Verification

```bash
npm run verify
npm audit --omit=dev
npm run test:e2e
```

`npm run verify:full` runs the build, catalog and backend gates followed by the browser suite. The current coverage includes contact-provider failures, trusted catalog pricing, multi-item/add-on checkout, shipping, durable orders, delayed and out-of-order payment events, signed/idempotent webhooks, cart snapshot safety, session verification, responsive navigation, cookie gates, and review moderation privacy.

## Production with Docker

```bash
cp .env.example .env
# Fill the server-side keys and replace localhost URLs.
docker compose up --build -d
```

The frontend is served at port `8080` by default. Nginx supplies SPA history fallback, proxies `/api`, applies baseline security headers, and throttles public contact, checkout, checkout-status, and review traffic. The Stripe webhook is deliberately not rate-limited. The named `astar-data` volume persists orders and reviews across container restarts.

This SQLite deployment supports **one backend replica**. Back up and test-restore the `astar-data` volume before launch and on a schedule; move the ledgers to a managed database before horizontal scaling or serverless deployment.

Terminate TLS at the host or load balancer and keep the application behind the included proxy or equivalent edge controls. Nginx rate limits use its direct client address. If another proxy sits in front, configure `real_ip_header` and `set_real_ip_from` for that proxy's exact trusted network so visitors do not share one limiter key. Do not trust arbitrary forwarded-for headers from the public internet.

## Catalog and media

The production app reads only local JSON and local image/font files. It does not call Hostinger.

- `frontend/src/data/catalog.json` drives the storefront.
- `backend/app/catalog.json` is the server-authoritative pricing copy.
- `frontend/src/data/add-ons.json` and `backend/app/add-ons.json` mirror the add-on availability rules used by the product builder and checkout validation.
- `python scripts/check_catalog_sync.py` proves both catalog and add-on copies are in sync, validates explicit classification and fitment metadata, and verifies every image against the reviewed SHA-256 media manifest in `scripts/media-review.json`.
- `python scripts/import_hostinger_catalog.py --refresh-assets` refreshes the final source snapshot before Hostinger is retired. This is a migration utility, not a runtime dependency.

Catalogue behavior is controlled by the explicit `kind` field, never title wording. `addon` products are attachment-only, `upgrade` products are standalone and contain no nested upsells, and purchasable `main` products expose every active stackable add-on. The backend independently verifies the product kinds, base/add-on grouping, matching quantity and trusted prices. Disabled add-on definitions stay unavailable until a trusted catalog product, variant and price are supplied.

After cutover, edit the catalogue and add-on rules deliberately in source control and keep both frontend/backend copies identical. Any approved image or fitment change must update `scripts/media-review.json` in the same reviewed change. Both production Docker builds run the catalogue check automatically; run `npm run check:catalog` locally before every release as well.

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
