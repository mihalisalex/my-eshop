import type { CallToAction, Image, SlugEntity } from "./common";

export interface Collection extends SlugEntity {
  title: string;
  subtitle?: string;
  description?: string;
  image: Image;
  productIds?: string[];
  cta?: CallToAction;
}
