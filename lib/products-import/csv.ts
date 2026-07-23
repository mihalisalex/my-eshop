import "server-only";
import Papa from "papaparse";

export type RawCsvRow = Record<string, string>;

/**
 * Thin papaparse wrapper (header mode) — added specifically because a naive
 * `.split(",")` mis-parses any product description/name containing a comma or an
 * embedded newline inside a quoted cell. `errors` here are file-level parse problems
 * (e.g. inconsistent column counts), not product-field validation, which happens later
 * via productFormSchema against the mapped row.
 */
export function parseProductsCsv(csvText: string): { rows: RawCsvRow[]; parseErrors: string[] } {
  const result = Papa.parse<RawCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  const parseErrors = result.errors.map((error) => `Row ${error.row ?? "?"}: ${error.message}`);
  return { rows: result.data, parseErrors };
}
