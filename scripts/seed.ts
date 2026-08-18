import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import {
  productImagesSchema,
  productVideosSchema,
  productSeoOverrideSchema,
} from "@/lib/validation/product";
import { imageSchema } from "@/lib/validation/product";
import type { Product } from "@/types/product";
import type { Collection } from "@/types/collection";
import productsData from "@/data/products.json";
import collectionsData from "@/data/collections.json";
import discountsData from "@/data/discounts.json";
import giftCardsData from "@/data/gift-cards.json";
import homepageData from "@/data/homepage.json";
import navigationData from "@/data/navigation.json";
import seoData from "@/data/seo.json";
import settingsData from "@/data/settings.json";
import blogData from "@/data/blog.json";
import type { BlogPost } from "@/types/blog";

interface SeedDiscount {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  active: boolean;
  expiresAt?: string;
}

interface SeedGiftCard {
  code: string;
  balance: { amount: number; currencyCode: string };
  active: boolean;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** The JSON fixture predates both the Category table and the product lifecycle fields
 * (see prisma/schema.prisma) — it still carries the old flat `category` slug string and no
 * `status`. seedCategories() resolves the category before seedProducts() runs; `status`
 * falls back to "active" below, since the fixture represents a live demo catalog. */
type SeedProduct = Omit<Product, "categoryId" | "status"> & { status?: Product["status"] };

/** Deterministic ids (not @default(cuid())) so re-running the seed against the same DB
 * upserts instead of duplicating — same convention as every id below in this file. */
async function seedCategories(products: SeedProduct[]): Promise<Map<string, string>> {
  const slugs = [...new Set(products.map((p) => p.category))];
  const idBySlug = new Map<string, string>();
  for (const slug of slugs) {
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    const category = await prisma.category.upsert({
      where: { slug },
      create: { id: `cat-${slug}`, slug, name },
      update: {},
    });
    idBySlug.set(slug, category.id);
  }
  console.log(`Seeded ${idBySlug.size} categories.`);
  return idBySlug;
}

async function seedProducts(products: SeedProduct[], categoryIdBySlug: Map<string, string>) {
  for (const product of products) {
    const categoryId = categoryIdBySlug.get(product.category);
    if (!categoryId) throw new Error(`seedCategories didn't resolve a category for "${product.category}" (product ${product.slug})`);

    const images = productImagesSchema.parse(product.images);
    const videos = product.videos ? productVideosSchema.parse(product.videos) : undefined;
    const seo = product.seo ? productSeoOverrideSchema.parse(product.seo) : undefined;

    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceAmount: product.price.amount,
        compareAtPriceAmount: product.compareAtPrice?.amount,
        salePriceAmount: product.salePrice?.amount,
        currencyCode: product.price.currencyCode,
        images,
        videos,
        categoryId,
        tags: product.tags,
        gender: product.gender,
        season: product.season,
        materials: product.materials,
        careInstructions: product.careInstructions,
        relatedProductIds: product.relatedProductIds ?? [],
        isNew: product.isNew ?? false,
        isSale: product.isSale ?? false,
        isPreorder: product.isPreorder ?? false,
        isBackorder: product.isBackorder ?? false,
        fulfillmentNote: product.fulfillmentNote,
        rating: product.rating,
        reviewCount: product.reviewCount,
        sku: product.sku,
        barcode: product.barcode,
        inventoryPolicy: product.inventoryPolicy,
        shippingWeightGrams: product.shippingWeightGrams,
        availableForSale: product.availableForSale,
        status: product.status ?? "active",
        seo,
        colors: {
          create: product.colors.map((color, position) => ({
            position,
            name: color.name,
            hex: color.hex,
            imageSrc: color.image?.src,
            imageAlt: color.image?.alt,
          })),
        },
        sizes: {
          create: product.sizes.map((size, position) => ({
            position,
            name: size.name,
            inStock: size.inStock,
            quantity: size.quantity,
            sku: size.sku,
            barcode: size.barcode,
          })),
        },
      },
      update: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceAmount: product.price.amount,
        compareAtPriceAmount: product.compareAtPrice?.amount,
        salePriceAmount: product.salePrice?.amount,
        currencyCode: product.price.currencyCode,
        images,
        videos,
        categoryId,
        tags: product.tags,
        gender: product.gender,
        season: product.season,
        materials: product.materials,
        careInstructions: product.careInstructions,
        relatedProductIds: product.relatedProductIds ?? [],
        isNew: product.isNew ?? false,
        isSale: product.isSale ?? false,
        isPreorder: product.isPreorder ?? false,
        isBackorder: product.isBackorder ?? false,
        fulfillmentNote: product.fulfillmentNote,
        rating: product.rating,
        reviewCount: product.reviewCount,
        sku: product.sku,
        barcode: product.barcode,
        inventoryPolicy: product.inventoryPolicy,
        shippingWeightGrams: product.shippingWeightGrams,
        availableForSale: product.availableForSale,
        status: product.status ?? "active",
        seo,
      },
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

async function seedCollections(collections: Collection[]) {
  for (const collection of collections) {
    const image = imageSchema.parse(collection.image);

    await prisma.collection.upsert({
      where: { id: collection.id },
      create: {
        id: collection.id,
        slug: collection.slug,
        title: collection.title,
        subtitle: collection.subtitle,
        description: collection.description,
        image,
        ctaLabel: collection.cta?.label,
        ctaHref: collection.cta?.href,
        ctaVariant: collection.cta?.variant,
      },
      update: {
        slug: collection.slug,
        title: collection.title,
        subtitle: collection.subtitle,
        description: collection.description,
        image,
        ctaLabel: collection.cta?.label,
        ctaHref: collection.cta?.href,
        ctaVariant: collection.cta?.variant,
      },
    });
  }
  console.log(`Seeded ${collections.length} collections.`);
}

/** collections.json's productIds is treated as the canonical side of the relation. */
async function seedProductCollections(collections: Collection[]) {
  let count = 0;
  for (const collection of collections) {
    const productIds = collection.productIds ?? [];
    for (const [index, productId] of productIds.entries()) {
      await prisma.productCollection.upsert({
        where: { productId_collectionId: { productId, collectionId: collection.id } },
        create: { productId, collectionId: collection.id, position: index },
        update: { position: index },
      });
      count += 1;
    }
  }
  console.log(`Seeded ${count} product-collection links.`);
}

async function seedDiscounts(discounts: SeedDiscount[]) {
  for (const discount of discounts) {
    const code = discount.code.toUpperCase();
    await prisma.discount.upsert({
      where: { code },
      create: {
        code,
        type: discount.type,
        value: discount.value,
        active: discount.active,
        expiresAt: discount.expiresAt ? new Date(discount.expiresAt) : null,
      },
      // Intentionally doesn't reset anything a real admin edit may have changed since
      // seeding — only active/expiresAt/value/type track the JSON source on update.
      update: {
        type: discount.type,
        value: discount.value,
        active: discount.active,
        expiresAt: discount.expiresAt ? new Date(discount.expiresAt) : null,
      },
    });
  }
  console.log(`Seeded ${discounts.length} discounts.`);
}

async function seedGiftCards(giftCards: SeedGiftCard[]) {
  for (const giftCard of giftCards) {
    const code = giftCard.code.toUpperCase();
    await prisma.giftCard.upsert({
      where: { code },
      create: {
        code,
        balanceAmount: giftCard.balance.amount,
        currencyCode: giftCard.balance.currencyCode,
        active: giftCard.active,
      },
      // Deliberately doesn't reset balanceAmount on update — a real checkout may have
      // already decremented it since the last seed run; only `active` re-syncs from JSON.
      update: { active: giftCard.active },
    });
  }
  console.log(`Seeded ${giftCards.length} gift cards.`);
}

/**
 * Creates the first admin, and only the first — `update: {}` means re-running this never
 * touches an existing account's password or role.
 *
 * The credentials are NOT constants. They used to be ("admin@alexandris-demo.example" /
 * "admin123", exported from lib/auth.ts and published in README.md), which in a public
 * repository is a working password for the account that can edit prices, read customer
 * addresses and delete orders. It only had to be seeded once against a real database to
 * become real.
 *
 * With no env vars set this generates a random password and prints it once, so the
 * bootstrap path stays a single command without a known password ever existing.
 */
async function seedAdminUser() {
  const configuredEmail = process.env.SEED_ADMIN_EMAIL;

  // Bootstrap only. Re-running the seed against a database that already has admins must not
  // quietly add another one under a default address — on the live shop that is a new account
  // with admin rights that nobody asked for. With SEED_ADMIN_EMAIL set the intent is explicit,
  // so that case is still allowed through to the per-email check below.
  if (!configuredEmail) {
    const adminCount = await prisma.adminUser.count();
    if (adminCount > 0) {
      console.log(`Skipped admin seeding — ${adminCount} admin user(s) already exist.`);
      console.log("Set SEED_ADMIN_EMAIL to add a specific one, or use /admin/users.");
      return;
    }
  }

  const email = (configuredEmail ?? "admin@example.com").toLowerCase();
  const suppliedPassword = process.env.SEED_ADMIN_PASSWORD;
  // 24 bytes of CSPRNG, base64url — not Math.random(), which is not seeded for secrecy and
  // would make every "random" password reproducible from the process start time.
  const password = suppliedPassword ?? randomBytes(24).toString("base64url");

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — left untouched.`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: "Alexandris Admin",
      role: "admin",
    },
  });

  console.log(`Created admin user ${email}.`);
  if (suppliedPassword) {
    console.log("Password: taken from SEED_ADMIN_PASSWORD.");
  } else {
    console.log(`Password: ${password}`);
    console.log("This is shown ONCE and is not stored anywhere in plaintext. Save it now, then change it at /admin/users.");
  }
}

/**
 * Seeds the CMS singleton documents only if they don't already exist — unlike
 * products/discounts/gift-cards (which re-sync from JSON on every run), an admin
 * publishing real homepage/navigation/SEO/settings edits should never be silently
 * clobbered by re-running this script.
 */
async function seedSiteContentIfMissing(key: string, data: unknown) {
  const existing = await prisma.siteContent.findUnique({ where: { key } });
  if (existing) return;
  await prisma.siteContent.create({ data: { key, data: data as Prisma.InputJsonValue } });
  console.log(`Seeded SiteContent "${key}".`);
}

async function seedBlogPosts(posts: BlogPost[]) {
  for (const post of posts) {
    const coverImage = imageSchema.parse(post.coverImage);
    await prisma.blogPost.upsert({
      where: { id: post.id },
      create: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImage,
        author: post.author,
        tags: post.tags,
        publishedAt: new Date(post.publishedAt),
      },
      update: {},
    });
  }
  console.log(`Seeded ${posts.length} blog posts.`);
}

async function main() {
  const products = productsData as SeedProduct[];
  const collections = collectionsData as Collection[];

  const categoryIdBySlug = await seedCategories(products);
  await seedProducts(products, categoryIdBySlug);
  await seedCollections(collections);
  await seedProductCollections(collections);
  await seedDiscounts(discountsData as SeedDiscount[]);
  await seedGiftCards(giftCardsData as SeedGiftCard[]);
  await seedAdminUser();
  await seedSiteContentIfMissing("homepage", homepageData);
  await seedSiteContentIfMissing("navigation", navigationData);
  await seedSiteContentIfMissing("seo", seoData);
  await seedSiteContentIfMissing("settings", settingsData);
  await seedBlogPosts(blogData as BlogPost[]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
