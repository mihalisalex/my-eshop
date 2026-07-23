import type { Image, SlugEntity } from "./common";

export interface BlogPost extends SlugEntity {
  title: string;
  excerpt: string;
  content?: string;
  coverImage: Image;
  author: string;
  publishedAt: string;
  tags: string[];
}
