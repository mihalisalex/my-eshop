"use client";

import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import { CarouselScroller } from "@/components/sections/CarouselScroller";
import type { Product } from "@/types";

export interface NewArrivalsRowContent {
  key: string;
  /** Empty for the single, ungendered carousel — see the header logic below. */
  title?: string;
  products: Product[];
  viewAllHref?: string;
  viewAllLabel?: string;
}

interface NewArrivalsProps {
  title: string;
  subtitle?: string;
  rows: NewArrivalsRowContent[];
}

/** The cards themselves, shared by both layouts below. */
function ProductRow({ products }: { products: Product[] }) {
  return (
    <>
      {products.map((product) => (
        <div key={product.id} data-carousel-item className="w-[75%] shrink-0 snap-start sm:w-[45%] lg:w-[23%]">
          <ProductCard product={product} />
        </div>
      ))}
    </>
  );
}

/**
 * The section splits into a row per gender because one shared carousel could not serve
 * both: whichever gender happened to sort first filled every visible card, and with this
 * catalogue that was women — a man landing on the homepage saw a "Νέες αφίξεις" row with
 * no men's shoes in it at all.
 *
 * Each row scrolls independently, which is why the scroller lives in its own component
 * rather than in an array of refs on the parent.
 */
function NewArrivalsRow({ row }: { row: NewArrivalsRowContent }) {
  // A row with nothing in it renders nothing — no empty heading, no arrows that scroll a
  // void. With the fallback in getNewArrivals this needs the whole catalogue to be empty,
  // but a heading over blank space is a worse homepage than one row instead of two.
  if (row.products.length === 0) return null;

  return (
    <div className="mt-12 first:mt-0 md:mt-16">
      <div className="container-luxe mb-6 flex items-baseline gap-4">
        <h3 className="font-heading text-xl md:text-2xl">{row.title}</h3>
        {row.viewAllHref && row.viewAllLabel ? (
          <Link
            href={row.viewAllHref}
            className="text-xs tracking-[0.05em] text-luxe-gray-dark underline-offset-4 uppercase transition-colors hover:text-luxe-black hover:underline"
          >
            {row.viewAllLabel}
          </Link>
        ) : null}
      </div>

      <CarouselScroller label={row.title}>
        <ProductRow products={row.products} />
      </CarouselScroller>
    </div>
  );
}

export function NewArrivals({ title, subtitle, rows }: NewArrivalsProps) {
  /**
   * One untitled row is the old single-carousel section (a pinned product list, still used
   * by landing pages). It renders without a per-row heading; the arrows now live on the row
   * itself in both cases, so the two layouts differ only in whether they have a subheading.
   */
  const isSoleRow = rows.length === 1 && !rows[0].title;

  return (
    <section className="py-20 md:py-28">
      <div className="container-luxe mb-10 md:mb-14">
        <h2 className="font-heading text-3xl md:text-4xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-luxe-gray-dark">{subtitle}</p> : null}
      </div>

      {isSoleRow ? (
        <CarouselScroller label={title}>
          <ProductRow products={rows[0].products} />
        </CarouselScroller>
      ) : (
        rows.map((row) => <NewArrivalsRow key={row.key} row={row} />)
      )}
    </section>
  );
}
