# A Star Customs Design System

## 1. Design Direction

Preserve the incumbent high-contrast workshop aesthetic: dark carbon-like surfaces, crisp white type, restrained purple emphasis, large automotive photography and direct purchase language. Refinement should feel confident and practical, not decorative or luxury-generic. Product accuracy and clear purchasing hierarchy outrank visual novelty.

## 2. Color System

- `--ink: #080808`: page background.
- `--panel: #17151a`: raised controls and dense content surfaces.
- `--line` / `--line-strong`: quiet and emphasized separators.
- `--text: #f8f7fb`: primary copy.
- `--muted: #aaa5b0`: secondary copy; do not use below accessible contrast.
- `--purple: #a342ff`: primary action and selected state.
- `--purple-bright: #bf73ff`: focus, hover and compact emphasis.
- `--green: #23d366`: confirmed or successful status only.
- `--danger: #ff6f7f`: destructive/error state only.

## 3. Typography

- Bebas Neue is the display voice for page and section headings.
- Manrope is used for body, controls, labels and prices.
- Headings use a tight line height with balanced wrapping; body copy is kept near 65–75 characters where practical.
- Uppercase tracking is reserved for compact labels and controls. Product titles remain readable and descriptive.

## 4. Spacing & Layout

- Use the existing container capped at 1420px with responsive side gutters.
- Apply tight spacing inside a product option and generous spacing between purchase, detail and discovery regions.
- Desktop product detail uses a media/buy-box split. Mobile becomes a single reading order: media, identity/fitment, choices, extras, purchase action, detail and discovery.
- Supported minimum viewport is 320px. No control or content may force horizontal page overflow.

## 5. Component Design

- Buttons have clear action labels, at least 44px touch height, visible focus and active/disabled states.
- Product cards use one media surface and one content surface; avoid nested decorative cards.
- Product imagery uses stable aspect ratios, responsive object positioning and truthful alt text.
- Add-on selectors are explicit toggles labelled “Optional extra,” show their per-build cost and state, and remain removable in the bag.
- The discovery area is inline. It is expanded on desktop and represented by a native, keyboard-operable disclosure on small screens.
- Upgrade cards are standalone navigation/purchase offers; add-on and upgrade product pages contain no further upsell areas.

## 6. Interaction Patterns

- Primary purchase actions are always visible in the natural document flow and never rely on hover.
- Selected variants and extras expose `aria-pressed`; disclosure uses native `details/summary` semantics.
- Image thumbnails identify their target image, while decorative repeated thumbnails use empty alt text.
- Focus rings use the bright purple token with clear offset. Motion is short, interruptible and disabled for reduced-motion preferences.

## 7. Responsive Behavior

- At 320–430px, use compact gutters, full-width purchase actions, scroll-safe thumbnail rows and single-column offer lists.
- At tablet widths, navigation remains reachable through the mobile menu and product content does not create clipped fixed overlays.
- At desktop widths, the buy box may remain visually adjacent to the gallery while maintaining normal document flow.
- Long product names, prices and vehicle-fitment notes must wrap without truncating essential meaning.

## 8. Accessibility

- Meet WCAG AA contrast for normal text and controls.
- Maintain logical heading order, keyboard focus order, screen-reader names and 44px pointer targets.
- Do not communicate selection, availability or fitment through colour alone.
- Use native controls where available and keep all drawers/lightboxes dismissible without a pointer.

## 9. Content Guidelines

- Use plain UK English and sentence case.
- Never call an item “higher spec” unless explicit catalogue comparison metadata establishes that relationship for the same fitment.
- Use “Optional extra” for attachable add-ons and “If you’re interested” for unrelated standalone discovery.
- State fitment positively only when verified; otherwise say that fitment must be confirmed before ordering or fitting.
- Quote-only products say “Contact us before ordering.”

## 10. Do / Don’t Examples

- Do: “Mercedes C-Class W205/C205 OEM Ambient Lighting.”
- Do: “Fits the Mercedes C-Class W205 saloon and C205 coupé; confirm model year before fitting.”
- Do: “Optional extra — +£39.99 per build.”
- Don’t: infer that a GLA product is a premium version of an Audi product because it costs more.
- Don’t: show steering-wheel photos under a dashcam heading or mixed vehicle imagery on a model-specific listing.
- Don’t: put nested upsells on products already classified as an add-on or upgrade.
