"use server";

import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { capabilityDenied } from "@/lib/admin-session";
import { isBlobConfigured } from "@/lib/blob";
import { alignToBaseline, analyseShape, targetFor } from "@/lib/images/align";

/**
 * Aligning a product's photographs from the product form.
 *
 * The bulk pass (`scripts/align-product-images.ts`) put the existing catalogue on a shared
 * baseline; without this, the next photograph uploaded lands wherever the photographer framed
 * it and the grid drifts apart again one product at a time. Both call the same
 * `lib/images/align` — the whole point is that a photograph aligned here is indistinguishable
 * from one aligned in the batch.
 *
 * Only side-on photographs are touched, and only when no reflection is detected. Everything
 * else is returned unchanged with the reason, because a merchandiser who presses a button and
 * sees nothing happen deserves to be told why rather than left wondering if it worked.
 */

export interface AlignedImage {
  src: string;
  /** The new URL when it moved, otherwise the original. */
  nextSrc: string;
  moved: boolean;
  reason?: string;
}

export interface AlignImagesState {
  error?: string;
  results?: AlignedImage[];
  summary?: string;
}

const REASONS: Record<string, string> = {
  "not-footwear": "not a footwear category",
  "not-side-on": "not a side-on photograph",
  reflection: "has a reflection",
  cropped: "cropped to the frame edge",
  "already-aligned": "already on the baseline",
  "no-room": "no margin left to move it into",
  unreadable: "could not be read",
};

export async function alignProductImages(sources: string[], category: string): Promise<AlignImagesState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };
  if (!isBlobConfigured()) return { error: "Image uploads aren't configured — connect a Blob store first." };
  if (sources.length === 0) return { error: "There are no images to align yet." };

  // The form holds whichever of the two the category picker put there, so accept both rather
  // than depending on which one it happens to be today.
  const record = await prisma.category.findFirst({
    where: { OR: [{ id: category }, { slug: category }] },
    select: { slug: true },
  });
  const target = record ? targetFor(record.slug) : null;

  const results: AlignedImage[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (!target) {
      results.push({ src, nextSrc: src, moved: false, reason: REASONS["not-footwear"] });
      continue;
    }
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const original = Buffer.from(await response.arrayBuffer());

      const shape = await analyseShape(original);
      const blocker = shape.reflection ? "reflection" : shape.touchesEdge ? "cropped" : !shape.sideProfile ? "not-side-on" : null;
      if (blocker) {
        results.push({ src, nextSrc: src, moved: false, reason: REASONS[blocker] });
        continue;
      }

      // Asked again with the measurement: a knee-high boot and an ankle boot share a category
      // and do not share a baseline, and only the photograph can tell them apart.
      const aligned = await alignToBaseline(original, shape, targetFor(record!.slug, shape) ?? target);
      if (aligned.reason) {
        results.push({ src, nextSrc: src, moved: false, reason: REASONS[aligned.reason] });
        continue;
      }

      // A new object rather than an overwrite: the original URL may still be referenced by a
      // draft revision, the media library, or a page a customer has open, and this action is
      // reachable before the product is ever saved.
      const name = (src.split("/").pop() ?? "image").replace(/\.[a-z]+$/i, "").slice(0, 60);
      const blob = await put(`products/aligned/${crypto.randomUUID()}-${name}.webp`, aligned.buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/webp",
      });
      results.push({ src, nextSrc: blob.url, moved: true });
    } catch {
      results.push({ src, nextSrc: src, moved: false, reason: REASONS.unreadable });
    }
  }

  const moved = results.filter((r) => r.moved).length;
  const summary =
    moved === 0
      ? "Nothing to align — see the notes on each photo."
      : `Aligned ${moved} of ${results.length} photo${results.length === 1 ? "" : "s"}. Save to keep it.`;

  return { results, summary };
}
