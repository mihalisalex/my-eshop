"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fadeUp, viewportOnce } from "@/constants/animation";

/**
 * A horizontally scrolling row with its own next/previous controls.
 *
 * The controls sit ON the row, vertically over the product images, rather than in the
 * section header. In the header they were a long way from the thing they moved — a shopper
 * looking at a card cut off by the right edge had to find two small outlined squares in the
 * opposite corner to do anything about it. Over the edge they are next to the cut-off card,
 * which is where the eye already is.
 *
 * They also disappear when they cannot do anything. Previously both arrows rendered
 * permanently, so at the start of a row the left one was a button that did nothing when
 * clicked — the most common complaint about a control like this, and the reason it reads as
 * decoration rather than something worth pressing.
 *
 * The scroller and its arrows used to be written out twice in NewArrivals (once per gender
 * row, once for the ungendered variant). This is that markup, once.
 */

interface CarouselScrollerProps {
  children: ReactNode;
  /** Announced by the arrow buttons, so several rows on one page stay distinguishable. */
  label?: string;
}

/** Matches the `gap-6` between cards, so one press advances by exactly one card. */
const CARD_GAP = 24;

export function CarouselScroller({ children, label }: CarouselScrollerProps) {
  const tA11y = useTranslations("A11y");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  /**
   * Measured from where the first and last cards actually sit, NOT from `scrollLeft`.
   *
   * Was written when `scrollLeft === 0` genuinely wasn't the start of this row: with
   * ordinary padding instead of `scroll-padding` (see the className below), the browser
   * rested the container scrolled PAST its own padding on load, so a `scrollLeft <= 1`
   * test reported "not at the start" on a row nobody had touched, leaving a back arrow on
   * screen that could do nothing. `scroll-padding` fixed the rest position itself, but this
   * stayed rectangle-based rather than reintroducing a `scrollLeft` check narrow enough to
   * trust — it is correct regardless of what the container's own scroll offset happens to
   * be at either edge.
   */
  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const items = el.querySelectorAll("[data-carousel-item]");
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      setAtStart(true);
      setAtEnd(true);
      return;
    }
    const bounds = el.getBoundingClientRect();
    // A pixel of slack, because fractional layout means these rarely land exactly equal.
    setAtStart(first.getBoundingClientRect().left >= bounds.left - 1);
    setAtEnd(last.getBoundingClientRect().right <= bounds.right + 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });
    // A row that fits entirely on screen has no scrolling to do, and a resize can make
    // that true or false — without this, both arrows would linger on a row of three cards
    // on a wide display.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("[data-carousel-item]")?.clientWidth ?? 320;
    el.scrollBy({ left: direction * (cardWidth + CARD_GAP), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeUp}
        ref={scrollerRef}
        // `scroll-p*`, not just `p*` — a snap container with `container-luxe`'s ordinary
        // padding rendered the first card flush against the browser's edge. CSS scroll
        // snap aligns a `snap-start` child to the start of the SCROLLPORT, which by
        // default ignores the container's own padding entirely; the browser was jumping
        // scrollLeft straight to 64 on load specifically to line the first card up with
        // that padding-less edge, which is what hid the padding from the very first
        // paint rather than merely after a scroll. `scroll-padding` is the property CSS
        // Scroll Snap actually defines for this — it teaches the snapport itself to
        // reserve the inset, so the browser rests at scrollLeft 0 with the gutter intact
        // instead of scrolling past it. Same 24/40/64 scale as `container-luxe`, so this
        // row still lines up with the section heading above it.
        className="container-luxe flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-pl-6 scroll-pr-6 pb-4 md:scroll-pl-10 md:scroll-pr-10 lg:scroll-pl-16 lg:scroll-pr-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </motion.div>

      {/*
        `container-luxe` on the overlay too, so its content box is exactly the scroller's and
        the arrows line up with the first and last card rather than the viewport edge.

        Hidden below `sm`, where the row is swiped rather than clicked, and
        `pointer-events-none` so the overlay never blocks that swipe — only the buttons
        themselves take pointer events.
      */}
      <div className="container-luxe pointer-events-none absolute inset-0 hidden items-center justify-between sm:flex">
        <ArrowButton
          direction="left"
          hidden={atStart}
          label={label ? `${tA11y("scrollLeft")} — ${label}` : tA11y("scrollLeft")}
          onClick={() => scrollByCard(-1)}
        />
        <ArrowButton
          direction="right"
          hidden={atEnd}
          label={label ? `${tA11y("scrollRight")} — ${label}` : tA11y("scrollRight")}
          onClick={() => scrollByCard(1)}
        />
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  hidden,
  label,
  onClick,
}: {
  direction: "left" | "right";
  hidden: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // Disabled as well as faded: an invisible control must not be reachable by keyboard
      // or announced to a screen reader as something worth pressing.
      disabled={hidden}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`pointer-events-auto flex size-12 -translate-y-9 items-center justify-center rounded-full bg-luxe-white text-luxe-black shadow-[0_2px_12px_rgba(0,0,0,0.14)] ring-1 ring-black/5 transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_18px_rgba(0,0,0,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-luxe-black motion-reduce:transition-none motion-reduce:hover:scale-100 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/*
        The -translate-y-9 above lifts the button off the row's true vertical centre and onto
        the middle of the product image: a card is a 3:4 image plus roughly 72px of name and
        price, so centring on the whole card would sit the arrow over the text.
      */}
      <Icon className="size-5" strokeWidth={1.75} />
    </button>
  );
}
