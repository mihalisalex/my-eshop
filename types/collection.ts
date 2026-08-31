import type { CallToAction, Image, SlugEntity } from "./common";

export interface Collection extends SlugEntity {
  title: string;
  subtitle?: string;
  description?: string;
  /** Greek translations — see lib/localize.ts. Undefined for anything not yet translated. */
  titleEl?: string;
  subtitleEl?: string;
  descriptionEl?: string;
  image: Image;
  productIds?: string[];
  cta?: CallToAction;
  /** ISO timestamp of the last edit — see Product.updatedAt. */
  updatedAt?: string;
}
