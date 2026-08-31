import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { runSeoAudit } from "@/services/seo-audit";
import type { SeoIssue, SeoIssueSeverity } from "@/lib/seo/audit-rules";

/**
 * The SEO audit, run against the catalogue on every page view.
 *
 * No cache and no stored results on purpose. The audit is a few hundred rows and a pass of
 * pure functions, so it is cheap enough to be live — and a stored score is a score that can
 * be out of date the moment someone edits a product, which is exactly when an owner would
 * open this page to check their work.
 */

interface AuditPageProps {
  searchParams: Promise<{ severity?: string; type?: string; rule?: string }>;
}

const SEVERITY_STYLE: Record<SeoIssueSeverity, string> = {
  critical: "border-destructive text-destructive",
  high: "border-amber-600 text-amber-700",
  medium: "border-luxe-gray-dark text-luxe-gray-dark",
  low: "border-border text-luxe-gray-dark",
};

const SEVERITIES: SeoIssueSeverity[] = ["critical", "high", "medium", "low"];

/** Groups issues by rule so the page reports "23 products have X" rather than 23 rows of X. */
function groupByRule(issues: SeoIssue[]) {
  const groups = new Map<string, { rule: string; severity: SeoIssueSeverity; title: string; detail: string; issues: SeoIssue[] }>();
  for (const issue of issues) {
    const existing = groups.get(issue.rule);
    if (existing) existing.issues.push(issue);
    else groups.set(issue.rule, { rule: issue.rule, severity: issue.severity, title: issue.title, detail: issue.detail, issues: [issue] });
  }
  return [...groups.values()].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || b.issues.length - a.issues.length
  );
}

export default async function SeoAuditPage({ searchParams }: AuditPageProps) {
  await requireCapabilityOrRedirect("admin:settings");
  const [params, result] = await Promise.all([searchParams, runSeoAudit()]);

  const severityFilter = SEVERITIES.includes(params.severity as SeoIssueSeverity)
    ? (params.severity as SeoIssueSeverity)
    : undefined;
  const typeFilter = ["product", "category", "collection"].includes(params.type ?? "") ? params.type : undefined;

  const filtered = result.issues.filter(
    (issue) =>
      (!severityFilter || issue.severity === severityFilter) &&
      (!typeFilter || issue.page.type === typeFilter)
  );
  const groups = groupByRule(filtered);

  return (
    <div>
      <AdminPageHeader
        title="SEO Audit"
        description={`${result.pagesAudited} pages checked against your own catalogue data. No external services involved.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="border border-border bg-luxe-white p-4">
          <p className="text-eyebrow">Score</p>
          <p className="mt-1 text-3xl tabular-nums">{result.score}</p>
          <p className="mt-1 text-xs text-luxe-gray-dark">
            Progress against what you can fill in — not a ranking prediction.
          </p>
        </div>
        {SEVERITIES.map((severity) => (
          <Link
            key={severity}
            href={severityFilter === severity ? "/admin/seo/audit" : `/admin/seo/audit?severity=${severity}`}
            className={`border bg-luxe-white p-4 transition-colors hover:border-luxe-black ${
              severityFilter === severity ? "border-luxe-black" : "border-border"
            }`}
          >
            <p className="text-eyebrow capitalize">{severity}</p>
            <p className="mt-1 text-3xl tabular-nums">{result.countsBySeverity[severity]}</p>
            <p className="mt-1 text-xs text-luxe-gray-dark">
              {severityFilter === severity ? "Filtering — click to clear" : "Click to filter"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["product", "category", "collection"] as const).map((type) => {
          const href = new URLSearchParams({
            ...(severityFilter ? { severity: severityFilter } : {}),
            ...(typeFilter === type ? {} : { type }),
          }).toString();
          return (
            <Link
              key={type}
              href={`/admin/seo/audit${href ? `?${href}` : ""}`}
              className={`border px-3 py-1.5 text-xs font-medium tracking-[0.05em] uppercase ${
                typeFilter === type ? "border-luxe-black" : "border-border text-luxe-gray-dark"
              }`}
            >
              {type}s
            </Link>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="border border-border bg-luxe-white p-10 text-center">
          <p className="text-sm">
            {result.issues.length === 0
              ? "Nothing to fix. Every published page has a title, a description, an image and enough content to rank."
              : "No issues match these filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.rule} className="border border-border bg-luxe-white">
              <div className="flex flex-wrap items-baseline gap-3 border-b border-border p-4">
                <span
                  className={`border px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] uppercase ${SEVERITY_STYLE[group.severity]}`}
                >
                  {group.severity}
                </span>
                <h2 className="text-sm font-medium">{group.title}</h2>
                <span className="text-xs text-luxe-gray-dark">
                  {group.issues.length} page{group.issues.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="border-b border-border px-4 py-3 text-sm text-luxe-gray-dark">{group.detail}</p>
              <ul className="divide-y divide-border">
                {/* Capped, with the remainder counted rather than silently dropped — a list
                    that quietly stops reads as "that is all of them". */}
                {group.issues.slice(0, 25).map((issue) => (
                  <li key={`${issue.rule}:${issue.page.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="text-xs text-luxe-gray-dark capitalize">{issue.page.type}</span>
                    <Link href={issue.page.editPath} className="hover:underline">
                      {issue.page.name}
                    </Link>
                    <Link
                      href={issue.page.path}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-xs text-luxe-gray-dark hover:text-luxe-black"
                    >
                      View page
                    </Link>
                  </li>
                ))}
              </ul>
              {group.issues.length > 25 ? (
                <p className="border-t border-border px-4 py-2.5 text-xs text-luxe-gray-dark">
                  and {group.issues.length - 25} more
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
