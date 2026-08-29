"use client";
import { useTranslations } from "next-intl";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { fadeUp, viewportOnce } from "@/constants/animation";
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

/**
 * The section splits into a row per gender because one shared carousel could not serve
 * both: whichever gender happened to sort first filled every visible card, and with this
 * catalogue that was women — a man landing on the homepage saw a "Νέες αφίξεις" row with
 * no men's shoes in it at all.
 *
 * Each row scrolls independently, which is why the scroller lives in its own component
 * rather than in an array of refs on the parent.
 */
function NewArrivalsRow({ row, showHeader }: { row: NewArrivalsRowContent; showHeader: boolean }) {
  const tA11y = useTranslations("A11y");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-carousel-item]")?.clientWidth ?? 320;
    el.scrollBy({ left: direction * (cardWidth + 24), behavior: "smooth" });
  };

  // A row with nothing in it renders nothing — no empty heading, no arrows that scroll a
  // void. With the fallback in getNewArrivals this needs the whole catalogue to be empty,
  // but a heading over blank space is a worse homepage than one row instead of two.
  if (row.products.length === 0) return null;

  const arrows = (
    <div className="hidden gap-2 sm:flex">
      <button
        type="button"
        aria-label={tA11y("scrollLeft")}
        onClick={() => scrollByCard(-1)}
        className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={tA11y("scrollRight")}
        onClick={() => scrollByCard(1)}
        className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
      >
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );

  return (
    <div className={showHeader ? "mt-12 first:mt-0 md:mt-16" : undefined}>
      {showHeader ? (
        <div className="container-luxe mb-6 flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-4">
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
          {arrows}
        </div>
      ) : null}

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        ref={scrollerRef}
        className="container-luxe flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {row.products.map((product) => (
          <div
            key={product.id}
            data-carousel-item
            className="w-[75%] shrink-0 snap-start sm:w-[45%] lg:w-[23%]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function NewArrivals({ title, subtitle, rows }: NewArrivalsProps) {
  const tA11y = useTranslations("A11y");
  const soleRef = useRef<HTMLDivElement>(null);

  /**
   * One untitled row is the old single-carousel section (a pinned product list, still used
   * by landing pages). Its arrows belong beside the section heading, where they have always
   * been — rendering an otherwise-empty row header under the h2 just to hold them would be
   * a regression dressed up as consistency.
   */
  const isSoleRow = rows.length === 1 && !rows[0].title;

  const scrollSole = (direction: 1 | -1) => {
    const el = soleRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-carousel-item]")?.clientWidth ?? 320;
    el.scrollBy({ left: direction * (cardWidth + 24), behavior: "smooth" });
  };

  return (
    <section className="py-20 md:py-28">
      <div className="container-luxe mb-10 flex items-end justify-between md:mb-14">
        <div>
          <h2 className="font-heading text-3xl md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-2 text-luxe-gray-dark">{subtitle}</p> : null}
        </div>
        {isSoleRow ? (
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              aria-label={tA11y("scrollLeft")}
              onClick={() => scrollSole(-1)}
              className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
            >
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label={tA11y("scrollRight")}
              onClick={() => scrollSole(1)}
              className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
            >
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : null}
      </div>

      {isSoleRow ? (
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          ref={soleRef}
          className="container-luxe flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rows[0].products.map((product) => (
            <div
              key={product.id}
              data-carousel-item
              className="w-[75%] shrink-0 snap-start sm:w-[45%] lg:w-[23%]"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </motion.div>
      ) : (
        rows.map((row) => <NewArrivalsRow key={row.key} row={row} showHeader />)
      )}
    </section>
  );
}
