-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "abandonedCartEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "back_in_stock_requests" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "back_in_stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "back_in_stock_requests_productId_sizeName_email_key" ON "back_in_stock_requests"("productId", "sizeName", "email");

-- CreateIndex
CREATE INDEX "back_in_stock_requests_productId_sizeName_notifiedAt_idx" ON "back_in_stock_requests"("productId", "sizeName", "notifiedAt");

-- AddForeignKey
ALTER TABLE "back_in_stock_requests" ADD CONSTRAINT "back_in_stock_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "back_in_stock_requests" ADD CONSTRAINT "back_in_stock_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
