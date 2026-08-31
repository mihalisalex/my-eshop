-- CreateTable
CREATE TABLE "product_slug_history" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_history_slug_key" ON "product_slug_history"("slug");

-- CreateIndex
CREATE INDEX "product_slug_history_productId_idx" ON "product_slug_history"("productId");

-- AddForeignKey
ALTER TABLE "product_slug_history" ADD CONSTRAINT "product_slug_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clamp any stock that is already negative, so the constraint below can be added.
--
-- Negative stock is not a state this application has ever modelled: services/restock.ts
-- credits units back on the assumption the shelf never went below zero, and the storefront
-- treats anything <= 0 as out of stock either way. Any negative row is therefore damage
-- from the read-then-decrement race this migration's companion change removes, and zero is
-- the honest value for it. Expected to affect zero rows on a shop that has not oversold.
UPDATE "product_sizes" SET "quantity" = 0 WHERE "quantity" < 0;

-- The database-level backstop for stock. The real guarantee is the conditional UPDATE in
-- services/checkout.ts; this is what makes the NEXT bug in that area fail loudly instead of
-- quietly selling stock that does not exist.
--
-- Prisma does not model CHECK constraints, so this will not round-trip into schema.prisma
-- and `prisma migrate dev` will not report it as drift. It is documented on ProductSize.
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_quantity_non_negative" CHECK ("quantity" >= 0);
