-- AlterTable
ALTER TABLE "products" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "costPriceAmount" DECIMAL(10,2),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "vendor" TEXT;
