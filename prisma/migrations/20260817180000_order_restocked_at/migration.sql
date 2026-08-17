-- Additive and nullable, so code running without it is unaffected: an older deployment
-- simply never reads or writes the column. (A drop or rename would NOT be safe here --
-- this project shares one database between local and production.)
ALTER TABLE "orders" ADD COLUMN "restockedAt" TIMESTAMP(3);
