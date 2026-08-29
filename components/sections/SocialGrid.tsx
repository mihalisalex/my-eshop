"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/constants/animation";
import type { InstagramPost, SocialGridSection } from "@/types";

interface SocialGridProps {
  data: SocialGridSection["data"];
  /** The store's Instagram profile. Omitted when none is configured — see below. */
  profileUrl?: string;
  /**
   * The live feed. Empty whenever no account is connected or Meta could not be reached, in
   * which case the curated `data.images` are shown instead — see `tiles` below.
   */
  posts?: InstagramPost[];
}

interface Tile {
  key: string;
  src: string;
  alt: string;
  /** Where this specific tile goes. A live post links to itself; a curated one to the profile. */
  href?: string;
}

/**
 * Instagram captions are marketing copy, not descriptions, so this is a compromise rather
 * than a win: the first line of a caption at least says something about the photo a
 * screen-reader user cannot see, where "Styled look, social grid 4" says nothing at all.
 * Truncated because captions run to paragraphs, hashtags and emoji.
 */
function altFor(post: InstagramPost, fallback: string): string {
  const firstLine = post.caption?.split("\n").find((line) => line.trim().length > 0)?.trim();
  if (!firstLine) return fallback;
  return firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine;
}

export function SocialGrid({ data, profileUrl, posts }: SocialGridProps) {
  /**
   * Live posts when there are any, the curated images when there are not.
   *
   * The fallback is the point: this section is the shop's own photography either way, and a
   * Meta outage, an expired token or an account that was never connected all land here
   * rather than on a homepage with a hole in it. It also means the grid is never empty
   * during setup, which is when it would otherwise look broken.
   */
  const tiles: Tile[] =
    posts && posts.length > 0
      ? posts.map((post) => ({
          key: post.id,
          src: post.imageUrl,
          alt: altFor(post, data.title),
          // Its own post, not the profile — someone who taps a photo wants that photo.
          href: post.permalink,
        }))
      : data.images.map((image) => ({
          key: image.src,
          src: image.src,
          alt: image.alt,
          href: profileUrl,
        }));

  return (
    <section className="py-20 md:py-28">
      <div className="container-luxe mb-10 flex items-end justify-between md:mb-14">
        <h2 className="font-heading text-3xl md:text-4xl">{data.title}</h2>
        {data.handle ? (
          profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-luxe-gray-dark underline-offset-4 transition-colors hover:text-luxe-black hover:underline"
            >
              {data.handle}
            </a>
          ) : (
            <p className="text-luxe-gray-dark">{data.handle}</p>
          )
        ) : null}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-6"
      >
        {tiles.map((tile) => {
          const content = (
            <>
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes="(min-width: 768px) 16vw, 50vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
            </>
          );
          const className = "group relative block aspect-square overflow-hidden bg-luxe-gray-light";

          // A tile with nowhere real to go is rendered as an image, not as a link. The
          // previous `href="#"` was worse than no link at all: it looked interactive,
          // took keyboard focus, and scrolled the visitor back to the top of the page.
          return tile.href ? (
            <motion.a
              key={tile.key}
              href={tile.href}
              target="_blank"
              rel="noreferrer noopener"
              variants={fadeUp}
              className={className}
            >
              {content}
            </motion.a>
          ) : (
            <motion.div key={tile.key} variants={fadeUp} className={className}>
              {content}
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
