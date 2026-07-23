import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { productFormSchema } from "@/lib/validation/product";
import { parseProductsCsv } from "@/lib/products-import/csv";
import { mapCsvRowToProductForm } from "@/lib/products-import/mapper";
import { uploadImageToBlob } from "@/lib/blob";
import type { ImportRowResult } from "@/lib/products-import/types";

/**
 * Parses the CSV, uploads any accompanying image files to Blob, validates every row
 * against the same productFormSchema the single-product admin form uses, and checks
 * slug collisions — but writes nothing to the database yet. The confirmed row list
 * (including already-uploaded Blob URLs, so nothing re-uploads) comes back to the
 * browser and is re-submitted verbatim to the commit route.
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const form = await request.formData();
    const csvFile = form.get("csv");
    if (!(csvFile instanceof File)) return invalidInputResponse("No CSV file was provided.");

    const imageFiles = form.getAll("images").filter((value): value is File => value instanceof File);
    const resolvedImageUrls = new Map<string, string>();
    for (const file of imageFiles) {
      const { url } = await uploadImageToBlob(file);
      resolvedImageUrls.set(file.name.toLowerCase(), url);
    }

    const csvText = await csvFile.text();
    const { rows, parseErrors } = parseProductsCsv(csvText);
    if (rows.length === 0) {
      return invalidInputResponse(parseErrors[0] ?? "The CSV file has no data rows.");
    }

    const results: ImportRowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +1 for 1-indexing, +1 for the header row
      const rowParseErrors = index === 0 ? parseErrors : [];
      const { values: mapped, errors: mapErrors } = mapCsvRowToProductForm(row, resolvedImageUrls);

      const parsed = productFormSchema.safeParse(mapped);
      const schemaErrors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      const errors = [...rowParseErrors, ...mapErrors, ...schemaErrors];

      if (errors.length > 0 || !parsed.success) {
        results.push({ rowNumber, values: null, errors });
        continue;
      }

      const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
      results.push({
        rowNumber,
        values: parsed.data,
        errors: [],
        warning: existing ? "A product with this slug already exists — this row will update it." : undefined,
        existingId: existing?.id,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
