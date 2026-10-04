// Fails on any high or critical npm advisory except those listed in AUDIT_ALLOW (see ci.yml).
import { readFileSync } from "node:fs";

const allow = new Set((process.env.AUDIT_ALLOW ?? "").split(/\s+/).filter(Boolean));
const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!report.vulnerabilities) throw new Error(`npm audit did not return a report: ${JSON.stringify(report).slice(0, 300)}`);

const blocking = new Set();
const allowedSeen = new Set();
for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || !["high", "critical"].includes(via.severity)) continue;
    const id = via.url?.split("/").pop();
    if (allow.has(id)) allowedSeen.add(id);
    else blocking.add(`${via.severity}: ${name} - ${via.title} (${via.url})`);
  }
}

for (const id of allowedSeen) console.log(`Allowed (see ci.yml): ${id}`);
for (const id of allow) if (!allowedSeen.has(id)) console.log(`::warning::${id} is no longer reported; remove it from AUDIT_ALLOW.`);
if (blocking.size) {
  console.error([...blocking].join("\n"));
  process.exit(1);
}
console.log("npm audit: no high or critical advisories outside the allowlist.");
