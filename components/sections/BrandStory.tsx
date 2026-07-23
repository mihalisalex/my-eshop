"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/constants/animation";
import type { BrandStorySection } from "@/types";

interface BrandStoryProps {
  data: BrandStorySection["data"];
}

export function BrandStory({ data }: BrandStoryProps) {
  return (
    <section className="container-luxe py-24 md:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="mx-auto max-w-2xl text-center"
      >
        {data.eyebrow ? <p className="text-eyebrow">{data.eyebrow}</p> : null}
        <h2 className="font-heading mt-4 text-4xl leading-tight md:text-6xl">{data.headline}</h2>
        <p className="mt-6 text-lg text-luxe-gray-dark">{data.body}</p>
        {data.cta ? (
          <Link
            href={data.cta.href}
            className="mt-8 inline-block border-b border-luxe-black pb-1 text-xs font-medium tracking-[0.1em] uppercase transition-opacity hover:opacity-60"
          >
            {data.cta.label}
          </Link>
        ) : null}
      </motion.div>
    </section>
  );
}
