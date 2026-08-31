import "server-only";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "@/lib/email";
import { backInStockEmail } from "@/lib/email/templates";
import { getSiteSettings } from "@/services/settings";
import { getSiteUrl } from "@/lib/site-url";
import type { ProductFormValues } from "@/lib/validation/product";

export interface OldProductStockState {
  inventoryPolicy: string;
  sizes: { name: string; quantity: number }[];
}

/** Mirrors lib/product.ts's isSizePurchasable exactly (quantity>0, or inventoryPolicy allows continued selling). */
function isPurchasable(inventoryPolicy: string, quantity: number): boolean {
  return quantity > 0 || inventoryPolicy === "continue";
}

/**
 * Diffs old vs. new per-size purchasability and emails anyone with a pending
 * (unnotified) BackInStockRequest for a size that just flipped from unavailable to
 * available. Best-effort throughout — a failed email must never fail the product
 * write that triggered this, and one bad recipient must not stop the rest of the batch.
 */
export async function notifyBackInStockIfNeeded(
  productId: string,
  oldState: OldProductStockState,
  newData: ProductFormValues,
  /**
   * The quantities actually WRITTEN, which is no longer the same thing as the quantities
   * submitted: an admin-form save applies stock as a delta against the current shelf
   * (see resolveSizeQuantity), so the submitted number can be stale. Diffing against the
   * submitted value would email "back in stock" for a size that is still empty.
   */
  writtenSizes: { name: string; quantity: number }[]
): Promise<void> {
  const newlyPurchasableSizeNames = writtenSizes
    .filter((size) => {
      const oldSize = oldState.sizes.find((old) => old.name === size.name);
      const wasPurchasable = oldSize ? isPurchasable(oldState.inventoryPolicy, oldSize.quantity) : false;
      const isNowPurchasable = isPurchasable(newData.inventoryPolicy, size.quantity);
      return isNowPurchasable && !wasPurchasable;
    })
    .map((size) => size.name);

  if (newlyPurchasableSizeNames.length === 0) return;

  const pendingRequests = await prisma.backInStockRequest.findMany({
    where: { productId, sizeName: { in: newlyPurchasableSizeNames }, notifiedAt: null },
  });
  if (pendingRequests.length === 0) return;

  const settings = await getSiteSettings();
  const provider = getEmailProvider();
  const productUrl = `${getSiteUrl()}/products/${newData.slug}`;
  const notifiedIds: string[] = [];

  for (const request of pendingRequests) {
    try {
      const message = backInStockEmail({
        siteName: settings.siteName,
        productName: newData.name,
        sizeName: request.sizeName,
        productUrl,
      });
      await provider.send({ to: request.email, template: "back-in-stock", ...message });
      notifiedIds.push(request.id);
    } catch (error) {
      console.error("Failed to send back-in-stock email", error);
    }
  }

  if (notifiedIds.length > 0) {
    await prisma.backInStockRequest.updateMany({ where: { id: { in: notifiedIds } }, data: { notifiedAt: new Date() } });
  }
}
