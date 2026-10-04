// Forbidden-text guard (AGENTS.md): fails when anything that can reach a customer's browser
// contains a provider secret or depends on Hostinger at runtime.
// Usage: node scripts/check-forbidden-text.mjs [dir ...]
// Default: the storefront source (frontend/src, frontend/public, frontend/index.html). The
// Quality gate also runs it on the built bundle (frontend/dist). Tests are exempt.
//
// - Stripe secret, restricted and webhook-signing keys live only in the backend's environment.
// - The Web3Forms access key is server-side only (backend/app/config.py, WEB3FORMS_ACCESS_KEY):
//   the browser posts to /api/contact and never talks to Web3Forms or holds a key. Naming
//   Web3Forms and linking its privacy page (PrivacyPage, ContactPage) is fine.
// - The catalogue and media are served from this repository; Hostinger's store API and its
//   Zyro-based site builder CDNs must not appear (scripts/import_hostinger_catalog.py is a
//   migration utility outside the bundle).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const RULES = [
  { name: "Stripe secret or restricted key", pattern: /\b[sr]k_(?:live|test)_/ },
  { name: "Stripe webhook signing secret", pattern: /\bwhsec_/ },
  { name: "Web3Forms submit API (must go through /api/contact)", pattern: /api\.web3forms\.com/i },
  { name: "Web3Forms access key field", pattern: /\baccess_key\b/ },
  { name: "Hostinger runtime URL", pattern: /hostinger\.|hostingersite\.|zyrosite\.|zyrocdn\.|hstgr\./i },
];
const TEXT = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".md", ".txt", ".xml", ".svg", ".map", ".webmanifest"]);
const SKIP_DIR = new Set(["node_modules", ".git"]);
const exempt = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

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
  if (!TEXT.has(extname(path)) || exempt(path) || stat.size > 5_000_000) return;
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
