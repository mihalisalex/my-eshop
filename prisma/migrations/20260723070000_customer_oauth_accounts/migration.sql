-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "customer_oauth_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_oauth_accounts_provider_providerUserId_key" ON "customer_oauth_accounts"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "customer_oauth_accounts_customerId_idx" ON "customer_oauth_accounts"("customerId");

-- AddForeignKey
ALTER TABLE "customer_oauth_accounts" ADD CONSTRAINT "customer_oauth_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
