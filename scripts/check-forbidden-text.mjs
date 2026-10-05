// Forbidden-text guard (AGENTS.md): fails when anything that can reach a customer's browser
// contains a provider secret or depends on Hostinger at runtime.
// Usage: node scripts/check-forbidden-text.mjs [dir-or-file ...]
// Default: the storefront source (frontend/src, frontend/public, frontend/index.html). The
// Quality gate also runs it on the built bundle (frontend/dist). Every file is scanned, test
// files included, except known binary formats; a text file too large to scan fails the check.
//
// - Stripe secret, restricted and webhook-signing keys live only in the backend's environment.
//   The patterns need a key body and accept any non-alphanumeric character before the prefix,
//   so STRIPE_sk_live_... or "whsec_..." inside a minified string still match.
// - The Web3Forms access key is server-side only (backend/app/config.py, WEB3FORMS_ACCESS_KEY):
//   the browser posts to /api/contact and never talks to Web3Forms or holds a key. Naming
//   Web3Forms and linking its privacy page (PrivacyPage, ContactPage) is fine.
// - The catalogue and media are served from this repository; Hostinger's store API and its
//   Zyro-based site builder CDNs must not appear (scripts/import_hostinger_catalog.py is a
//   migration utility outside the bundle).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const RULES = [
  { name: "Stripe secret or restricted key", pattern: /(?<![A-Za-z0-9])[sr]k_(?:live|test)_[A-Za-z0-9]/ },
  { name: "Stripe webhook signing secret", pattern: /(?<![A-Za-z0-9])whsec_[A-Za-z0-9]/ },
  { name: "Web3Forms submit API (must go through /api/contact)", pattern: /api\.web3forms\.com/i },
  { name: "Web3Forms access key field", pattern: /(?<![A-Za-z0-9])access_key(?![A-Za-z0-9])/ },
  { name: "Hostinger runtime URL", pattern: /hostinger\.|hostingersite\.|zyrosite\.|zyrocdn\.|hstgr\./i },
];
// Formats that cannot carry these strings as text. Everything else is read as UTF-8.
const BINARY = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".pdf", ".zip", ".gz", ".br",
]);
const SKIP_DIR = new Set(["node_modules", ".git"]);
const MAX_BYTES = 5_000_000;

const roots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["frontend/src", "frontend/public", "frontend/index.html"];
const failures = [];
let scanned = 0;
function walk(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) if (!SKIP_DIR.has(entry)) walk(join(path, entry));
    return;
  }
  if (BINARY.has(extname(path).toLowerCase())) return;
  if (stat.size > MAX_BYTES) {
    failures.push(`${relative(process.cwd(), path)}  too large to scan (${stat.size} bytes > ${MAX_BYTES})`);
    return;
  }
  scanned += 1;
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of RULES) if (rule.pattern.test(line)) failures.push(`${relative(process.cwd(), path)}:${index + 1}  ${rule.name}`);
  });
}
for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })) {
    console.error(`Forbidden-text guard: ${root} does not exist.`);
    process.exit(2);
  }
  walk(root);
}
if (failures.length) {
  console.error(`Forbidden text found (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Forbidden-text guard: clean (${scanned} files in ${roots.join(", ")}).`);
