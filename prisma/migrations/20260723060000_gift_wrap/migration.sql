-- AlterTable
ALTER TABLE "checkouts" ADD COLUMN     "giftWrap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "giftMessage" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "giftWrap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "giftMessage" TEXT;
