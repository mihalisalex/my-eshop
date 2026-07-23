"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { EASE } from "@/constants/animation";
import { getExperimentVisitorId, getVariant, type Variant } from "@/lib/experiments";
import { getCommerceProvider } from "@/lib/commerce";
import type { HeroSection } from "@/types";

interface HeroProps {
  data: HeroSection["data"];
}

/** Proof-of-concept for lib/experiments.ts — a real, live test, not just a declared seam (same bar the feature-flags rollout set for itself). */
const VARIANT_PRIMARY_CTA_LABEL = "Shop New Arrivals";

export function Hero({ data }: HeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const [variant, setVariant] = useState<Variant>("control");

  useEffect(() => {
    const visitorId = getExperimentVisitorId();
    const assigned = getVariant("homepage-hero-cta", visitorId);
    // Assignment is deterministic per visitor (see lib/experiments.ts) — this just
    // surfaces the already-decided bucket into render state on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariant(assigned);
    getCommerceProvider().analytics.track({
      name: "experiment_exposure",
      properties: { experiment: "homepage-hero-cta", variant: assigned },
    });
  }, []);

  const primaryCtaLabel = variant === "variant" ? VARIANT_PRIMARY_CTA_LABEL : data.primaryCta?.label;

  return (
    <section ref={ref} className="relative h-[100dvh] min-h-[640px] w-full overflow-hidden bg-luxe-black">
      <motion.div style={{ y }} className="absolute inset-0">
        <Image
          src={data.image.src}
          alt={data.image.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/25" />
      </motion.div>

      <div className="container-luxe relative flex h-full flex-col items-start justify-end pb-24 md:pb-32">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="text-xs tracking-[0.25em] text-luxe-white uppercase"
        >
          {data.eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
          className="font-heading mt-4 max-w-2xl text-5xl leading-[1.05] whitespace-pre-line text-luxe-white md:text-7xl"
        >
          {data.headline}
        </motion.h1>
        {data.subheadline ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
            className="mt-6 max-w-md text-base text-luxe-white/90"
          >
            {data.subheadline}
          </motion.p>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          {data.primaryCta ? (
            <Link
              href={data.primaryCta.href}
              className="flex h-12 items-center justify-center bg-luxe-white px-8 text-xs font-medium tracking-[0.1em] text-luxe-black uppercase transition-opacity hover:opacity-85"
            >
              {primaryCtaLabel}
            </Link>
          ) : null}
          {data.secondaryCta ? (
            <Link
              href={data.secondaryCta.href}
              className="flex h-12 items-center justify-center border border-luxe-white px-8 text-xs font-medium tracking-[0.1em] text-luxe-white uppercase transition-colors hover:bg-luxe-white hover:text-luxe-black"
            >
              {data.secondaryCta.label}
            </Link>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
