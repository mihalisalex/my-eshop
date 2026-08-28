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
  {
    // This file was not checked until 2026-08-28, and a demo disclaimer sat in the shared
    // email footer for the whole of launch — every real order confirmation told the customer
    // no order had been charged. Nothing in the repo pointed at it because the audit only ever
    // looked at data/*.json, and an email is the one surface nobody re-reads after shipping it.
    file: "lib/email/templates.ts",
    markers: [
      { marker: "demo store", why: "Demo disclaimer would be sent to real customers on every transactional email." },
      { marker: "no real order was charged", why: "Tells a paying customer their order was not charged." },
    ],
  },
];

const findings: Finding[] = [];

/**
 * Not every launch blocker is a string in a file. The ΓΕΜΗ number is simply absent rather
 * than wrong, so it needs its own check — a grep would never find it.
 *
 * The state that must fail is "unknown", not "missing". A missing number is correct when the
 * trader isn't registered; what is never safe is deploying a Greek commercial site without
 * anyone having decided which of those is true, because the two look identical in the data.
 */
if (COMPANY.gemiRegistration === "unknown") {
  findings.push({
    file: "constants/company.ts",
    marker: "COMPANY.gemiRegistration is \"unknown\"",
    count: 1,
    why: "Nobody has recorded whether this trader is ΓΕΜΗ-registered. The number is legally required on a Greek commercial website when one exists, so this has to be answered before launch — set it to \"registered\" with a gemiNumber, or \"not-registered\".",
  });
} else if (COMPANY.gemiRegistration === "registered" && !COMPANY.gemiNumber) {
  findings.push({
    file: "constants/company.ts",
    marker: "gemiRegistration is \"registered\" but gemiNumber is null",
    count: 1,
    why: "The two fields disagree: the trader is recorded as ΓΕΜΗ-registered but there is no number to print, so the identity line silently omits a number the law requires it to show.",
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

/**
 * Printed on the way past rather than as a failure. A recorded decision to launch without a
 * ΓΕΜΗ number is allowed, but it should be restated at every deploy instead of going quiet
 * the moment it stops failing — that is how a provisional answer becomes a permanent one.
 */
if (COMPANY.gemiRegistration === "not-registered") {
  console.log(
    "NOTE: recorded as not ΓΕΜΗ-registered, so no registry number is published.\n" +
      "      Re-confirm with an accountant — a Greek trader selling at distance is normally\n" +
      "      required to register, and the number must then appear on the site.\n",
  );
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
