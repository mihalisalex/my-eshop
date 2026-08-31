-- The counterpart of product_sizes_quantity_non_negative, for money.
--
-- A backstop, not the mechanism: the real guarantee is the conditional UPDATE in
-- services/checkout.ts, which only decrements a card that still holds the amount being
-- redeemed. This is what makes the next bug in that path fail loudly instead of quietly
-- paying out more than a card was ever worth.
--
-- No clamping step, unlike the stock migration: every existing balance was checked and
-- none is negative, and silently rewriting a money value is not something a migration
-- should do unasked. If this ever fails to apply, that is the correct outcome — it means
-- a real negative balance exists and needs a human to decide what it should be.
--
-- Prisma does not model CHECK constraints, so this will not round-trip into
-- schema.prisma and `prisma migrate dev` will not report it as drift. It is documented
-- on the GiftCard model.
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_balance_non_negative" CHECK ("balanceAmount" >= 0);
