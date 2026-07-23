"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { fadeUp, staggerContainer, viewportOnce } from "@/constants/animation";
import type { CallToAction, Product } from "@/types";

interface BestSellersProps {
  title: string;
  subtitle?: string;
  products: Product[];
  viewAllCta?: CallToAction;
}

export function BestSellers({ title, subtitle, products, viewAllCta }: BestSellersProps) {
  return (
    <section className="container-luxe py-20 md:py-28">
      <div className="mb-10 flex items-end justify-between md:mb-14">
        <div>
          <h2 className="font-heading text-3xl md:text-4xl">{title}</h2>
          {subtitle ? <p className="mt-2 text-luxe-gray-dark">{subtitle}</p> : null}
        </div>
        {viewAllCta ? (
          <Link
            href={viewAllCta.href}
            className="hidden items-center gap-1 text-xs font-medium tracking-[0.08em] uppercase transition-opacity hover:opacity-60 sm:flex"
          >
            {viewAllCta.label}
            <ArrowRight className="size-4" strokeWidth={1.5} />
          </Link>
        ) : null}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6"
      >
        {products.map((product) => (
          <motion.div key={product.id} variants={fadeUp}>
            <ProductCard product={product} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
