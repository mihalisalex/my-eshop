-- DropIndex
DROP INDEX "checkouts_cartId_key";

-- CreateIndex
CREATE INDEX "checkouts_cartId_idx" ON "checkouts"("cartId");
