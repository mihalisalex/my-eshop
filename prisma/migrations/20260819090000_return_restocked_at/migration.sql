-- Additive and nullable, so code running without it is unaffected: an older deployment
-- simply never reads or writes the column. (A drop or rename would NOT be safe here --
-- this project shares one database between local and production.)
--
-- Existing returns are left NULL, which reads as "never restocked". That is the honest
-- state: returns completed before this column existed did not credit their stock back, and
-- backfilling a timestamp would claim work that never happened. Any such return can be
-- corrected by adjusting the size quantity in /admin/inventory.
ALTER TABLE "returns" ADD COLUMN "restockedAt" TIMESTAMP(3);
