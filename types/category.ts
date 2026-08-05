import type { Image, SlugEntity } from "./common";
import type { ProductSeoOverride } from "./product";

export interface Category extends SlugEntity {
  name: string;
  /** Greek translation — see lib/localize.ts. Undefined for anything not yet translated. */
  nameEl?: string;
  description?: string;
  descriptionEl?: string;
  parentId?: string;
  /** Stable display order among siblings — see ProductColor.position's convention. */
  position: number;
  image?: Image;
  /** Wide banner shown on the category's own storefront page. */
  bannerImage?: Image;
  isFeatured: boolean;
  isVisible: boolean;
  seo?: ProductSeoOverride;
  /** Populated by services/categories.ts's list/tree helpers; absent on a bare single-row read. */
  productCount?: number;
}

/** A Category with its immediate children attached — what the admin tree view and storefront nav render from. */
export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

/** Flat row annotated with tree depth — what a `<select>` (parent picker, product-form category picker) renders from. */
export interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  depth: number;
}
