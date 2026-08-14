"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
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
        {/* These four use the CSS `hero-rise` animation rather than Framer Motion. Framer
            writes its `initial` state into the server-rendered HTML, which meant the headline
            below shipped as opacity:0 and stayed invisible — and therefore did not count as
            the Largest Contentful Paint — until React had hydrated. See app/globals.css. */}
        <p className="hero-rise text-xs tracking-[0.25em] text-luxe-white uppercase">{data.eyebrow}</p>
        <h1
          // The LCP element, so it uses `hero-lift` (movement only) rather than `hero-rise`
          // (movement + fade): a headline that fades in from transparent is not counted as
          // painted until the fade progresses, which measured as ~800ms of LCP for nothing
          // but the animation. It rises fully opaque instead. Zero delay for the same reason
          // — every ms here is charged straight to the metric.
          style={{ "--hero-rise-delay": "0s", "--hero-rise-duration": "0.9s", "--hero-rise-from": "24px" } as CSSProperties}
          className="hero-lift font-heading mt-4 max-w-2xl text-5xl leading-[1.05] whitespace-pre-line text-luxe-white md:text-7xl"
        >
          {data.headline}
        </h1>
        {data.subheadline ? (
          <p
            style={{ "--hero-rise-delay": "0.3s" } as CSSProperties}
            className="hero-rise mt-6 max-w-md text-base text-luxe-white/90"
          >
            {data.subheadline}
          </p>
        ) : null}

        <div
          style={{ "--hero-rise-delay": "0.45s" } as CSSProperties}
          className="hero-rise mt-8 flex flex-wrap items-center gap-4"
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
        </div>
      </div>
    </section>
  );
}
