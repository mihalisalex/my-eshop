-- Shopper reviews, written by the form on the product page.
--
-- Additive only: one new enum, one new table, one foreign key onto products. Nothing
-- existing is altered, so this is safe to apply to a live catalogue.

CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- The rating is the one field a bug could make nonsense of — a 0 or a 7 would drag the
-- average somewhere no visitor could account for. Prisma cannot express CHECK constraints
-- in schema.prisma, so this lives here and will not appear in the model. It is a backstop:
-- the real guard is the Zod schema on the API boundary.
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- The storefront asks for one product's approved reviews, newest first.
CREATE INDEX "product_reviews_productId_status_createdAt_idx" ON "product_reviews"("productId", "status", "createdAt");
-- The admin queue asks for everything pending, oldest first, across all products.
CREATE INDEX "product_reviews_status_createdAt_idx" ON "product_reviews"("status", "createdAt");

-- Deleting a product takes its reviews with it; they describe that product and nothing else.
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
