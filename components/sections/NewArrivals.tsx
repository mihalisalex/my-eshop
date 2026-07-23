"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { fadeUp, viewportOnce } from "@/constants/animation";
import type { Product } from "@/types";

interface NewArrivalsProps {
  title: string;
  subtitle?: string;
  products: Product[];
}

export function NewArrivals({ title, subtitle, products }: NewArrivalsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollerRef.current;
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
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByCard(-1)}
            className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByCard(1)}
            className="flex size-10 items-center justify-center border border-border transition-colors hover:border-luxe-black"
          >
            <ArrowRight className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        ref={scrollerRef}
        className="container-luxe flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div
            key={product.id}
            data-carousel-item
            className="w-[75%] shrink-0 snap-start sm:w-[45%] lg:w-[23%]"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </motion.div>
    </section>
  );
}
