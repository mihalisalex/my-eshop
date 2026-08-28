import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Reports English-looking strings in the `SiteContent` rows — the editable content that
 * lives in the database rather than in the repository.
 *
 *   npx tsx scripts/scan-content-english.ts
 *
 * The code-side sweep (messages/*.json plus every hardcoded string in app/ and components/)
 * cannot see any of this. Homepage copy, the announcement bar, SEO titles and site settings
 * are rows the owner edits from the admin, so they are invisible to grep over the source and
 * they survive every translation pass. That is exactly how the announcement bar sat in
 * English above the header on every page for months after the storefront was "fully Greek",
 * and how the homepage brand story did the same.
 *
 * The test is deliberately crude — a value with Latin letters and no Greek ones — because the
 * alternative is a language model and the failure mode that matters is silence. It over-reports
 * (URLs, slugs, hex colours, section ids) rather than under-reporting, and the noise is
 * separated out below so the real copy stands on its own.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const LATIN_WORD = /[A-Za-z]{3}/;

/** Keys whose values are never customer-facing prose. */
const STRUCTURAL_KEY = /^(id|type|order|href|src|slug|url|image|icon|hex|colou?r|handle|key|name|alt|variant|align|ratio|tone)$/i;
/** Values that are plainly not copy even under a prose key. */
const NOT_COPY = /^(https?:\/\/|\/|#[0-9a-f]{3,8}$|[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$)/i;

interface Hit {
  row: string;
  path: string;
  value: string;
  likelyCopy: boolean;
}

const hits: Hit[] = [];

function walk(row: string, node: unknown, pathParts: string[]): void {
  if (typeof node === "string") {
    if (GREEK.test(node) || !LATIN_WORD.test(node)) return;
    const key = pathParts[pathParts.length - 1] ?? "";
    const structural = STRUCTURAL_KEY.test(key.replace(/\[\d+\]$/, "")) || NOT_COPY.test(node);
    hits.push({ row, path: pathParts.join("."), value: node, likelyCopy: !structural });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, i) => walk(row, child, [...pathParts.slice(0, -1), `${pathParts[pathParts.length - 1] ?? ""}[${i}]`]));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(row, v, [...pathParts, k]);
  }
}

async function main() {
  const rows = await prisma.siteContent.findMany({ orderBy: { key: "asc" } });
  console.log(`Scanned ${rows.length} SiteContent rows: ${rows.map((r) => r.key).join(", ")}\n`);

  for (const row of rows) walk(row.key, row.data, []);

  const copy = hits.filter((h) => h.likelyCopy);
  const noise = hits.filter((h) => !h.likelyCopy);

  if (copy.length === 0) {
    console.log("No English-looking copy found.");
  } else {
    console.log(`${copy.length} string(s) that look like customer-facing English:\n`);
    let current = "";
    for (const h of copy) {
      if (h.row !== current) { console.log(`  [${h.row}]`); current = h.row; }
      console.log(`    ${h.path}`);
      console.log(`      ${JSON.stringify(h.value)}`);
    }
  }

  console.log(`\n${noise.length} structural value(s) ignored (ids, slugs, URLs, colours, image names).`);
  console.log("Re-run after editing content from the admin — these rows are invisible to a source grep.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
