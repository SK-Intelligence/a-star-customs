# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- UK motorists browsing automotive upgrades for a specific vehicle or a universal installation.
- Customers who want to compare fitted upgrades, DIY kits and bespoke workshop services before purchasing or enquiring.
- Customers configuring a main product with optional extras and expecting fitment to be confirmed before installation.

## Product Purpose

A Star Customs is an automotive customisation storefront. It helps customers discover a suitable product, understand vehicle fitment and pricing, configure compatible extras, add a catalogue-backed build to the bag, and pay through Stripe. Quote-only work instead provides a clear enquiry route.

Success means customers can distinguish main products, add-ons, upgrades and quote-only work without having to infer the product type from its title. The complete product, bag and checkout journey must remain clear and usable from 320px mobile screens through wide desktop layouts.

## Positioning

The storefront connects product discovery, vehicle-specific fitment guidance, configurable per-build extras and professionally fitted workshop services in one purchase journey. Product accuracy and confirmed suitability take priority over generic recommendations or unsupported comparisons.

## Operating Context

- Customers browse service, gallery, shop and product pages before configuring a purchase or making an enquiry.
- Main products may include catalogue-backed optional extras; those selections remain attached to the same configured build through the bag and checkout.
- Products classified as add-ons are attachment-only. Products classified as upgrades remain standalone listings and do not contain nested upsells.
- Vehicle-specific recommendations stay within the same make/model context. Unrelated standalone services may appear under “If you’re interested.”
- Installation suitability is confirmed before fitting when it is not already verified by the catalogue.
- Successful checkout confirmation tells customers that A Star Customs will email their receipt shortly and to get ready for five-star service.

## Capabilities and Constraints

- Prices and availability come from the server-synchronised catalogue; the browser never supplies authoritative prices.
- Every purchasable main product may attach every active catalogue-backed add-on, subject to final fitment confirmation.
- Quote-only work cannot be added to the bag.
- Product imagery must represent the named service and, for vehicle-specific listings, the named make/model. Otherwise the listing must clearly state that fitment requires confirmation.
- Frontend and backend catalogue, media and add-on configuration must remain synchronised.
- Preserve the React/Vite frontend, FastAPI backend, Stripe checkout, Railway deployment and Cloudflare domain architecture.
- Preserve the existing checkout request shape and server-side price validation.
- Avoid new runtime dependencies unless a task explicitly requires and approves one.

## Brand Commitments

- Product name: A Star Customs.
- Use plain UK English and direct purchase language.
- Preserve the established dark workshop identity, purple action colour, Bebas Neue display type and Manrope body type.
- Never call one product “higher spec” than another unless catalogue comparison metadata confirms that relationship for the same vehicle fitment.
- Use “Optional extra” for attachable add-ons and “If you’re interested” for unrelated standalone discovery.
- State fitment positively only when verified; otherwise say it must be confirmed before ordering or fitting.

## Evidence on Hand

- Authoritative mirrored catalogues: `frontend/src/data/catalog.json` and `backend/app/catalog.json`.
- Mirrored add-on configuration: `frontend/src/data/add-ons.json` and `backend/app/add-ons.json`.
- Product and service imagery: `frontend/public/images/products/` and `frontend/public/images/site/`.
- Media classification review: `scripts/media-review.json`.
- Catalogue synchronisation check: `scripts/check_catalog_sync.py`.
- Checkout, order and review behaviour: `backend/app/main.py`, `backend/app/orders.py` and `backend/app/reviews.py`.
- Automated customer-journey coverage: `frontend/e2e/storefront.spec.ts` and `backend/tests/`.
- Do not fabricate testimonials, performance claims, compatibility claims or vehicle-specific proof beyond this repository evidence.

## Product Principles

1. Show the right product and imagery for the customer’s vehicle or state uncertainty clearly.
2. Keep catalogue data, pricing and checkout validation authoritative on the server.
3. Make product types and optional extras explicit throughout configuration, bag and checkout.
4. Keep the complete purchase journey accessible, touch-safe and free from horizontal overflow.
5. Prefer honest fitment confirmation over speculative upselling.

## Accessibility & Inclusion

- Support keyboard navigation, visible focus states, logical heading and focus order, and screen-reader names for interactive controls.
- Maintain at least 44px touch targets for primary controls.
- Do not communicate selection, availability or fitment through colour alone.
- Keep drawers, disclosures and lightboxes operable and dismissible without a pointer.
- Support viewports from 320px upward without clipped content, hover-only actions or horizontal page overflow.
