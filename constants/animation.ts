import type { Variants } from "framer-motion";

/** Shared Framer Motion presets — keeps every section's "subtle only" animation in sync. */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.9, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

export const imageZoom: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.05, transition: { duration: 0.8, ease: EASE } },
};

export const viewportOnce = { once: true, margin: "-80px" };
