import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { reviewSubmissionSchema } from "@/lib/validation/review";
import { createReview, hasReviewed } from "@/services/reviews";
import { prisma } from "@/lib/prisma";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

/**
 * Public, unauthenticated by design — requiring an account would exclude most real buyers,
 * since checkout does not require one either.
 *
 * Rate limited per IP, the same way the newsletter signup is. Three an hour is well above
 * what an honest shopper needs and well below what makes a spam run worthwhile. The real
 * defence is that an unverified review is not published until a human approves it; this
 * just keeps the queue from being flooded.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const key = `review:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 3, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const body = await request.json().catch(() => null);
  const parsed = reviewSubmissionSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Μη έγκυρα στοιχεία.");

  const { productId, authorEmail } = parsed.data;

  /**
   * The product is checked rather than assumed: productId arrives from the browser, and a
   * review pointing at a product that does not exist would be a row nobody can moderate,
   * since the admin queue joins through that relation.
   */
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return invalidInputResponse("Το προϊόν δεν βρέθηκε.");

  if (await hasReviewed(productId, authorEmail)) {
    return invalidInputResponse("Έχετε ήδη αφήσει κριτική για αυτό το προϊόν.");
  }

  const result = await createReview(parsed.data);

  /**
   * Only when it actually went live. A pending review changes nothing a visitor can see, so
   * busting the cache for it would be a page rebuild that renders identical HTML.
   */
  if (result.published) revalidatePath(`/products/${product.slug}`);

  return NextResponse.json(result);
}
