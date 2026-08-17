"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/constants/animation";
import type { SocialGridSection } from "@/types";

interface SocialGridProps {
  data: SocialGridSection["data"];
  /** The store's Instagram profile. Omitted when none is configured — see below. */
  profileUrl?: string;
}

export function SocialGrid({ data, profileUrl }: SocialGridProps) {
  return (
    <section className="py-20 md:py-28">
      <div className="container-luxe mb-10 flex items-end justify-between md:mb-14">
        <h2 className="font-heading text-3xl md:text-4xl">{data.title}</h2>
        {data.handle ? <p className="text-luxe-gray-dark">{data.handle}</p> : null}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-6"
      >
        {data.images.map((image) => {
          const tile = (
            <>
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 768px) 16vw, 50vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
            </>
          );
          const className = "group relative block aspect-square overflow-hidden bg-luxe-gray-light";

          // A tile with nowhere real to go is rendered as an image, not as a link. The
          // previous `href="#"` was worse than no link at all: it looked interactive,
          // took keyboard focus, and scrolled the visitor back to the top of the page.
          return profileUrl ? (
            <motion.a
              key={image.src}
              href={profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              variants={fadeUp}
              className={className}
            >
              {tile}
            </motion.a>
          ) : (
            <motion.div key={image.src} variants={fadeUp} className={className}>
              {tile}
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
