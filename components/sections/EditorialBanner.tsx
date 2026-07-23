"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, viewportOnce } from "@/constants/animation";
import type { EditorialBannerSection } from "@/types";

interface EditorialBannerProps {
  data: EditorialBannerSection["data"];
}

export function EditorialBanner({ data }: EditorialBannerProps) {
  const imageRight = (data.imagePosition ?? "right") === "right";

  return (
    <section className="grid grid-cols-1 md:grid-cols-2">
      <div className={cn("relative aspect-4/5 md:aspect-auto", imageRight ? "md:order-2" : "md:order-1")}>
        <Image
          src={data.image.src}
          alt={data.image.alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className={cn(
          "flex flex-col items-start justify-center bg-luxe-gray-light px-8 py-16 md:px-16 md:py-0",
          imageRight ? "md:order-1" : "md:order-2"
        )}
      >
        {data.eyebrow ? <p className="text-eyebrow">{data.eyebrow}</p> : null}
        <h2 className="font-heading mt-4 max-w-md text-4xl leading-tight md:text-5xl">{data.headline}</h2>
        {data.body ? <p className="mt-6 max-w-md text-luxe-gray-dark">{data.body}</p> : null}
        {data.cta ? (
          <Link
            href={data.cta.href}
            className="mt-8 border-b border-luxe-black pb-1 text-xs font-medium tracking-[0.1em] uppercase transition-opacity hover:opacity-60"
          >
            {data.cta.label}
          </Link>
        ) : null}
      </motion.div>
    </section>
  );
}
