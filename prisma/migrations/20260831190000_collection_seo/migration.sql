-- Collections were the only customer-facing landing page with no SEO overrides at all:
-- no title, no description, no canonical, no way to hold one out of the index. Same Json
-- shape as Category.seo, so the resolver treats the two identically.
--
-- Nullable with no default, so every existing row keeps generating its SEO from the
-- collection's own title and description exactly as it does today.
ALTER TABLE "collections" ADD COLUMN "seo" JSONB;
