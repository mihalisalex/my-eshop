import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANY } from "@/constants/company";

/**
 * Fails if content that must be replaced before launch is still in the repo.
 *
 * The pre-launch audit found placeholder text live on the storefront — a Privacy Policy
 * section headed "This Is a Demo", and a contact address on a reserved
 * <code>.example</code> domain that can never receive mail. Both had been there long
 * enough to stop being noticed. A check that fails loudly is the only reliable defence
 * against that, since the whole failure mode is that nobody looks.
 *
 * Run it as a pre-deploy step: `npx tsx scripts/check-launch-placeholders.ts`
 */
interface Finding {
  file: string;
  marker: string;
  count: number;
  why: string;
}

const CHECKS: { file: string; markers: { marker: string; why: string }[] }[] = [
  {
    file: "data/legal.json",
    markers: [
      { marker: "COMPANY_DETAILS_PENDING", why: "Trader identity placeholder — should have been replaced from constants/company.ts." },
      { marker: "This Is a Demo", why: "Demo disclaimer must not appear in a live legal document." },
      { marker: "demo storefront", why: "Demo disclaimer must not appear in a live legal document." },
    ],
  },
  {
    file: "data/settings.json",
    markers: [{ marker: "alexandris-demo.example", why: "Reserved .example domain — this address can never receive mail." }],
  },
  {
    file: "data/seo.json",
    markers: [{ marker: "alexandris-demo.example", why: "Canonical URLs, OG tags and the sitemap would all point at a domain that does not exist." }],
  },
  {
    file: "data/faq.json",
    markers: [{ marker: "alexandris-demo.example", why: "Customers are told to write to an address that cannot receive mail." }],
  },
  {
    file: "data/careers.json",
    markers: [{ marker: "alexandris-demo.example", why: "Applicants are told to write to an address that cannot receive mail." }],
  },
];

const findings: Finding[] = [];

/**
 * Not every launch blocker is a string in a file. The ΓΕΜΗ number is mandatory on a
 * Greek commercial site and is simply absent rather than wrong, so it needs its own
 * check — a grep would never find it.
 */
if (!COMPANY.gemiNumber) {
  findings.push({
    file: "constants/company.ts",
    marker: "COMPANY.gemiNumber is null",
    count: 1,
    why: "The ΓΕΜΗ registry number is legally required on a Greek commercial website. It is omitted from the trader identity line until set.",
  });
}

for (const check of CHECKS) {
  let contents: string;
  try {
    contents = readFileSync(resolve(process.cwd(), check.file), "utf8");
  } catch {
    continue; // A file that no longer exists cannot hold a placeholder.
  }
  for (const { marker, why } of check.markers) {
    const count = contents.split(marker).length - 1;
    if (count > 0) findings.push({ file: check.file, marker, count, why });
  }
}

if (findings.length === 0) {
  console.log("No launch placeholders found.");
  process.exit(0);
}

console.error("Launch placeholders still present:\n");
for (const finding of findings) {
  console.error(`  ${finding.file}`);
  console.error(`    ${finding.count}x "${finding.marker}"`);
  console.error(`    ${finding.why}\n`);
}
console.error("Replace these before deploying to a public domain.");
process.exit(1);
