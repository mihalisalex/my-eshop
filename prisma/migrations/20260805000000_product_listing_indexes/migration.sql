-- CreateIndex
CREATE INDEX "products_gender_category_idx" ON "products"("gender", "category");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");
