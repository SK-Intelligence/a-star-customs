# A Star Customs Product Contract

## Product truth

A Star Customs is a UK automotive customisation storefront for customers browsing fitted upgrades, DIY kits and bespoke workshop services. The primary journey is discover a suitable product, understand vehicle fitment and price, optionally attach extras, add a trusted catalogue-backed build to the bag, and pay through Stripe or enquire for quote-only work.

## Customer promises

- Product imagery must represent the named service and, where a vehicle is named, the named make/model or clearly state that fitment must be confirmed.
- Prices and availability come from the server-synchronised catalogue; the browser never supplies authoritative prices.
- Products classified as add-ons are attachment-only. Products classified as upgrades remain standalone listings and never contain nested upsells.
- Every purchasable main product may attach every active catalogue-backed add-on. Fitment is confirmed before fitting.
- Quote-only work has a clear enquiry route and cannot be added to the bag.
- Checkout confirmation says A Star Customs will email the receipt shortly and prepares the customer for five-star service.

## Success criteria

- A customer can distinguish main products, add-ons, upgrades and quote-only work without interpreting title wording.
- Vehicle-specific listings never present media known to show a different vehicle.
- The product, add-on, bag and checkout paths work at 320px through wide desktop without horizontal overflow or hover-only controls.
- Catalogue, media and add-on configuration remain identical between frontend and backend snapshots.

## Constraints

- Preserve the existing React/Vite, FastAPI, Stripe, Railway and Cloudflare architecture.
- Preserve the current dark workshop identity, purple action colour, Bebas Neue display type and Manrope body type.
- Add no new runtime dependency for this work.
- Keep the existing checkout wire shape and server-side price validation.
