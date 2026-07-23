"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, staggerContainer, viewportOnce } from "@/constants/animation";
import type { Collection } from "@/types";

interface FeaturedCollectionsProps {
  title: string;
  subtitle?: string;
  collections: Collection[];
}

export function FeaturedCollections({ title, subtitle, collections }: FeaturedCollectionsProps) {
  return (
    <section className="container-luxe py-20 md:py-28">
      <div className="mb-10 md:mb-14">
        <h2 className="font-heading text-3xl md:text-4xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-luxe-gray-dark">{subtitle}</p> : null}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:auto-rows-[300px]"
      >
        {collections.map((collection, index) => (
          <motion.div
            key={collection.id}
            variants={fadeUp}
            className={index === 0 ? "md:col-span-2 md:row-span-2" : ""}
          >
            <Link
              href={collection.cta?.href ?? "#"}
              className="group relative block h-full min-h-[320px] overflow-hidden bg-luxe-gray-light"
            >
              <Image
                src={collection.image.src}
                alt={collection.image.alt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-black/50 p-5">
                <div>
                  <p className="font-heading text-xl text-luxe-white">{collection.title}</p>
                  {collection.subtitle ? (
                    <p className="mt-1 text-xs tracking-[0.05em] text-luxe-white/80 uppercase">
                      {collection.subtitle}
                    </p>
                  ) : null}
                </div>
                <ArrowRight
                  className="size-5 shrink-0 text-luxe-white transition-transform group-hover:translate-x-1"
                  strokeWidth={1.5}
                />
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
