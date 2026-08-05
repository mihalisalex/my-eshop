import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-session";
import { backInStockRequestSchema } from "@/lib/validation/back-in-stock";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const key = `back-in-stock:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 20, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const body = await request.json();
  const parsed = backInStockRequestSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

  const { productId, sizeName } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return invalidInputResponse("Unknown product.");

  const session = await getCustomerSession();

  // Upsert on the unique (productId, sizeName, email) constraint — a repeat request
  // for the same size is a silent no-op, not an error; nothing here reveals whether
  // this is a new or pre-existing request.
  await prisma.backInStockRequest.upsert({
    where: { productId_sizeName_email: { productId, sizeName, email } },
    update: {},
    create: { productId, sizeName, email, customerId: session?.sub ?? null },
  });

  return NextResponse.json({ ok: true });
}
