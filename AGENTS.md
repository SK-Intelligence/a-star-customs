# A Star Customs — Project Instructions

- Frontend: React, Vite, TypeScript strict mode, Tailwind CSS v4, Zustand.
- Backend: FastAPI with typed Python and pytest coverage.
- Keep the public catalog and media independent from Hostinger at runtime.
- Render photos under `/images` with `ResponsiveImage` (WebP variants made at build time by `frontend/responsive-images.ts`), not a bare `<img>` or CSS background; only the page's LCP image gets `priority`.
- Never expose payment, webhook, or contact provider secrets to the browser.
- Preserve the established black, white, and purple automotive identity while improving accessibility and responsive polish.
- Commands:
  - `cd frontend && npm run build`
  - `cd backend && pytest`

