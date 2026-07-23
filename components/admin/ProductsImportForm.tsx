"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportRowResult, CommitRowResult } from "@/lib/products-import/types";

const inputClass = "block w-full text-sm";
const sectionClass = "border border-border p-6";

type Stage = "idle" | "previewing" | "previewed" | "committing" | "committed";

export function ProductsImportForm() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [rows, setRows] = useState<ImportRowResult[]>([]);
  const [commitResults, setCommitResults] = useState<CommitRowResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const hasBlockingErrors = rows.some((row) => row.errors.length > 0);

  async function handlePreview() {
    setFormError(null);
    const csvFile = csvInputRef.current?.files?.[0];
    if (!csvFile) {
      setFormError("Choose a CSV file first.");
      return;
    }

    setStage("previewing");
    try {
      const form = new FormData();
      form.append("csv", csvFile);
      for (const file of Array.from(imagesInputRef.current?.files ?? [])) form.append("images", file);

      const res = await fetch("/api/admin/products/import/preview", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Preview failed.");

      setRows(body.results as ImportRowResult[]);
      setStage("previewed");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Preview failed.");
      setStage("idle");
    }
  }

  async function handleCommit() {
    setStage("committing");
    setFormError(null);
    try {
      const payload = {
        rows: rows.filter((row) => row.values).map((row) => ({ rowNumber: row.rowNumber, values: row.values })),
      };
      const res = await fetch("/api/admin/products/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Import failed.");

      setCommitResults(body.results as CommitRowResult[]);
      setStage("committed");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Import failed.");
      setStage("previewed");
    }
  }

  function reset() {
    setStage("idle");
    setRows([]);
    setCommitResults([]);
    setFormError(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (imagesInputRef.current) imagesInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className={sectionClass}>
        <h3 className="text-sm font-medium">1. Choose files</h3>
        <p className="mt-1 text-sm text-luxe-gray-dark">
          A CSV of products, plus (optionally) the image files it references by filename in an <code>imageFilenames</code>{" "}
          column. Products can also just reference already-hosted image URLs directly in an <code>images</code> column.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-eyebrow">CSV file</label>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className={inputClass} disabled={stage !== "idle"} />
          </div>
          <div>
            <label className="mb-1 block text-eyebrow">Image files (optional)</label>
            <input ref={imagesInputRef} type="file" accept="image/*" multiple className={inputClass} disabled={stage !== "idle"} />
          </div>
        </div>
        {stage === "idle" ? (
          <button
            type="button"
            onClick={handlePreview}
            className="mt-4 h-10 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            Preview
          </button>
        ) : null}
        {stage === "previewing" ? <p className="mt-4 text-sm text-luxe-gray-dark">Parsing and validating…</p> : null}
        {formError ? <p className="mt-3 text-sm text-destructive">{formError}</p> : null}
      </div>

      {rows.length > 0 ? (
        <div className={sectionClass}>
          <h3 className="text-sm font-medium">2. Review</h3>
          <p className="mt-1 text-sm text-luxe-gray-dark">
            {rows.filter((r) => r.errors.length === 0).length} of {rows.length} rows are ready to import.
            {hasBlockingErrors ? " Fix the CSV and preview again to clear the errors below." : ""}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-eyebrow">
                  <th className="py-2 pr-4">Row</th>
                  <th className="py-2 pr-4">Slug</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-4">{row.rowNumber}</td>
                    <td className="py-2 pr-4">{row.values?.slug ?? "—"}</td>
                    <td className="py-2 pr-4">{row.values?.name ?? "—"}</td>
                    <td className="py-2">
                      {row.errors.length > 0 ? (
                        <ul className="text-destructive">
                          {row.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      ) : row.warning ? (
                        <span className="text-amber-700">{row.warning}</span>
                      ) : (
                        <span className="text-green-700">Ready — will create</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stage === "previewed" ? (
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleCommit}
                disabled={hasBlockingErrors}
                className="h-10 bg-luxe-black px-5 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase disabled:opacity-50"
              >
                Confirm Import
              </button>
              <button type="button" onClick={reset} className="h-10 px-5 text-xs font-medium tracking-[0.05em] uppercase underline">
                Start Over
              </button>
            </div>
          ) : null}
          {stage === "committing" ? <p className="mt-4 text-sm text-luxe-gray-dark">Importing…</p> : null}
        </div>
      ) : null}

      {stage === "committed" ? (
        <div className={sectionClass}>
          <h3 className="text-sm font-medium">3. Done</h3>
          <p className="mt-1 text-sm text-luxe-gray-dark">
            {commitResults.filter((r) => r.ok).length} of {commitResults.length} rows imported successfully.
          </p>
          <ul className="mt-3 text-sm">
            {commitResults.map((result) => (
              <li key={result.rowNumber} className={result.ok ? "text-green-700" : "text-destructive"}>
                Row {result.rowNumber}: {result.ok ? "Imported" : result.error}
              </li>
            ))}
          </ul>
          <button type="button" onClick={reset} className="mt-4 h-10 px-5 text-xs font-medium tracking-[0.05em] uppercase underline">
            Import More
          </button>
        </div>
      ) : null}
    </div>
  );
}
