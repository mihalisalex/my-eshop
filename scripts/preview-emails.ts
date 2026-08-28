import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { EMAIL_SAMPLES, SAMPLE_NAMES } from "@/scripts/email-samples";

/**
 * Renders every email template to `.preview/emails/*.html`, so the design can be looked
 * at in a browser instead of guessed at.
 *
 *   npx tsx scripts/preview-emails.ts
 *
 * Email HTML cannot be iterated on the way page CSS can — there is no dev server, no hot
 * reload, and the only honest feedback loop is "send it and look". Sending eleven real
 * emails to inspect a padding change is slow, and on an unverified Resend domain it is
 * impossible for any address but the account's own. This writes the same HTML those
 * sends would carry.
 *
 * The sample data lives in `scripts/email-samples.ts` and is shared with
 * `scripts/send-test-email.ts`, so what you inspect here is byte-for-byte what that
 * script posts to an inbox.
 */
const outDir = resolve(".preview/emails");
mkdirSync(outDir, { recursive: true });

const index: string[] = [];
for (const name of SAMPLE_NAMES) {
  const rendered = EMAIL_SAMPLES[name];
  writeFileSync(resolve(outDir, `${name}.html`), rendered.html, "utf8");
  index.push(`<li><a href="./${name}.html">${name}</a> <span>${rendered.subject}</span></li>`);
}

writeFileSync(
  resolve(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title>
<style>body{font:14px/1.7 -apple-system,system-ui,sans-serif;max-width:760px;margin:60px auto;padding:0 20px;color:#111}
h1{font-weight:400;letter-spacing:3px;text-transform:uppercase;font-size:16px;margin-bottom:32px}
li{margin:0 0 10px;list-style:none}a{color:#111;font-weight:600}span{color:#888;margin-left:10px}</style>
<h1>Email previews</h1><ul>${index.join("")}</ul>`,
  "utf8"
);

console.log(`Rendered ${SAMPLE_NAMES.length} templates to ${outDir}`);
console.log("Open .preview/emails/index.html");
console.log(`\nTo post one to a real inbox:\n  npx tsx scripts/send-test-email.ts <email> <${SAMPLE_NAMES[0]}|…>`);
