-- CreateTable
CREATE TABLE "category_slug_history" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_slug_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_history_slug_key" ON "category_slug_history"("slug");

-- CreateIndex
CREATE INDEX "category_slug_history_categoryId_idx" ON "category_slug_history"("categoryId");

-- AddForeignKey
ALTER TABLE "category_slug_history" ADD CONSTRAINT "category_slug_history_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
