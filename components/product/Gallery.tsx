"use client";
import { useTranslations } from "next-intl";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/constants/animation";
import type { ProductVideo, Image as ImageType } from "@/types";

type GalleryMedia = { kind: "image"; image: ImageType } | { kind: "video"; video: ProductVideo };

interface GalleryProps {
  images: ImageType[];
  videos?: ProductVideo[];
  productName: string;
}

export function Gallery({ images, videos = [], productName }: GalleryProps) {
  const tA11y = useTranslations("A11y");
  const media: GalleryMedia[] = [
    ...images.map((image) => ({ kind: "image" as const, image })),
    ...videos.map((video) => ({ kind: "video" as const, video })),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const imageRef = useRef<HTMLDivElement>(null);

  const active = media[activeIndex];

  const goTo = (index: number) => setActiveIndex((index + media.length) % media.length);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr]">
      {/* Thumbnail rail */}
      <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
        {media.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`View media ${index + 1}`}
            className={cn(
              "relative aspect-3/4 w-16 shrink-0 overflow-hidden border bg-luxe-gray-light sm:w-full",
              index === activeIndex ? "border-luxe-black" : "border-transparent"
            )}
          >
            {item.kind === "image" ? (
              <Image src={item.image.src} alt={item.image.alt} fill sizes="80px" className="object-cover" />
            ) : (
              <>
                <Image src={item.video.poster} alt={item.video.alt} fill sizes="80px" className="object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="size-4 fill-white text-white" />
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Main viewer */}
      <div className="relative order-1 aspect-3/4 overflow-hidden bg-luxe-gray-light sm:order-2">
        {active.kind === "image" ? (
          <div
            ref={imageRef}
            className="relative size-full cursor-zoom-in overflow-hidden"
            onMouseEnter={() => setZoomActive(true)}
            onMouseLeave={() => setZoomActive(false)}
            onMouseMove={handleMouseMove}
            onClick={() => setLightboxOpen(true)}
          >
            <Image
              src={active.image.src}
              alt={active.image.alt}
              fill
              priority
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="object-cover transition-transform duration-200 ease-out"
              style={{
                transformOrigin: zoomOrigin,
                transform: zoomActive ? "scale(1.8)" : "scale(1)",
              }}
            />
          </div>
        ) : (
          <video
            key={active.video.src}
            controls
            poster={active.video.poster}
            className="size-full object-cover"
            aria-label={active.video.alt}
          >
            <source src={active.video.src} />
          </video>
        )}

        <button
          type="button"
          aria-label={tA11y("openGallery")}
          onClick={() => setLightboxOpen(true)}
          className="absolute top-3 right-3 flex size-9 items-center justify-center bg-luxe-white/90"
        >
          <ZoomIn className="size-4" strokeWidth={1.5} />
        </button>

        {media.length > 1 ? (
          <>
            <button
              type="button"
              aria-label={tA11y("previous")}
              onClick={() => goTo(activeIndex - 1)}
              className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center bg-luxe-white/90"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center bg-luxe-white/90"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {lightboxOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-label={`${productName} — fullscreen gallery`}
            className="fixed inset-0 z-100 flex items-center justify-center bg-luxe-black/95"
          >
            <button
              type="button"
              aria-label={tA11y("closeGallery")}
              onClick={() => setLightboxOpen(false)}
              className="absolute top-6 right-6 text-luxe-white"
            >
              <X className="size-6" strokeWidth={1.5} />
            </button>
            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={tA11y("previous")}
                  onClick={() => goTo(activeIndex - 1)}
                  className="absolute left-4 flex size-11 items-center justify-center text-luxe-white sm:left-8"
                >
                  <ChevronLeft className="size-6" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => goTo(activeIndex + 1)}
                  className="absolute right-4 flex size-11 items-center justify-center text-luxe-white sm:right-8"
                >
                  <ChevronRight className="size-6" strokeWidth={1.5} />
                </button>
              </>
            ) : null}

            <div className="relative h-[85vh] w-[90vw] max-w-3xl">
              {active.kind === "image" ? (
                <Image src={active.image.src} alt={active.image.alt} fill sizes="90vw" className="object-contain" />
              ) : (
                <video controls autoPlay poster={active.video.poster} className="size-full object-contain">
                  <source src={active.video.src} />
                </video>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
