"use client";

import { motion } from "framer-motion";
import { NewsletterForm } from "@/components/shared/NewsletterForm";
import { fadeUp, viewportOnce } from "@/constants/animation";
import type { NewsletterSection } from "@/types";

interface NewsletterProps {
  data: NewsletterSection["data"];
}

export function Newsletter({ data }: NewsletterProps) {
  return (
    <section className="bg-luxe-black py-24 text-luxe-white md:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        className="container-luxe mx-auto max-w-xl text-center"
      >
        <h2 className="font-heading text-3xl md:text-4xl">{data.headline}</h2>
        {data.subheadline ? <p className="mt-4 text-luxe-white/70">{data.subheadline}</p> : null}
        <div className="mt-8 mx-auto max-w-sm text-left">
          <NewsletterForm ctaLabel={data.ctaLabel} onDark source="homepage" />
        </div>
      </motion.div>
    </section>
  );
}
