-- Additive, nullable: older code that never reads or writes this column is unaffected.
ALTER TABLE "orders" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);
