import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-session";
import { commerceErrorResponse, invalidInputResponse } from "@/lib/commerce/http-errors";
import { productFormSchema } from "@/lib/validation/product";
import { writeProductRow } from "@/lib/products-import/write";
import type { CommitRowResult } from "@/lib/products-import/types";

interface CommitRequestRow {
  rowNumber: number;
  values: unknown;
}

/**
 * Re-validates every row server-side again — the preview payload round-tripped through
 * the browser and must never be trusted blindly — then writes each row independently
 * via the shared writeProductRow (app/admin/(dashboard)/products/actions.ts uses the
 * same function for the single-product form). Rows are isolated: one bad row doesn't
 * roll back the rest, and the per-row result list lets the admin see exactly what
 * happened to each one.
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await request.json();
    const rows = body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return invalidInputResponse("No rows to import.");

    const results: CommitRowResult[] = [];
    for (const row of rows as CommitRequestRow[]) {
      const parsed = productFormSchema.safeParse(row.values);
      if (!parsed.success) {
        results.push({ rowNumber: row.rowNumber, ok: false, error: parsed.error.issues[0]?.message ?? "Invalid row." });
        continue;
      }

      try {
        // Re-checked at commit time (not just trusted from preview) since the DB may
        // have changed in between — slug is the unique key that decides create vs update.
        const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
        await writeProductRow(parsed.data, existing?.id);
        results.push({ rowNumber: row.rowNumber, ok: true });
      } catch (error) {
        results.push({ rowNumber: row.rowNumber, ok: false, error: error instanceof Error ? error.message : "Failed to write row." });
      }
    }

    revalidatePath("/", "layout");
    return NextResponse.json({ results });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
