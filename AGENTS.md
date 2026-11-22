# A Star Customs — Project Instructions

- Frontend: React, Vite, TypeScript strict mode, Tailwind CSS v4, Zustand.
- Backend: FastAPI with typed Python and pytest coverage.
- Keep the public catalog and media independent from Hostinger at runtime.
- Render photos under `/images` with `ResponsiveImage` (WebP variants made at build time by `frontend/responsive-images.ts` for every image `src/` references), not a bare `<img>` or CSS background; the image lightbox is the one exception (it shows the full-size original). Give it a `sizes` that matches the box at each breakpoint and `priority` only on the page's LCP image; `npm run test:unit` covers the pipeline.
- Product photos are never cropped: they render whole with `object-fit: contain` in fixed 3:4 boxes (the main gallery box follows the active photo's own ratio, clamped). Pass `matte` so the photo's backdrop colour, sampled at build time, fills the spare space; `sizes` is simply the box width, since a contained photo never renders wider than its box.
- Never expose payment, webhook, or contact provider secrets to the browser.
- Preserve the established black, white, and purple automotive identity while improving accessibility and responsive polish.
- Commands:
  - `cd frontend && npm run build`
  - `cd backend && pytest`

