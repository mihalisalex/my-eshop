/**
 * One post from the shop's Instagram feed, reduced to what a grid tile needs.
 *
 * Deliberately not the Graph API's own shape: that returns `media_url` for a photo but
 * leaves it holding an .mp4 for a video, where the still lives in `thumbnail_url` instead.
 * Resolving that once, at the edge of the app, means nothing downstream has to know which
 * kind of post it is holding before it can render an image.
 */
export interface InstagramPost {
  id: string;
  /** Always a still image — a video's thumbnail rather than the video file. */
  imageUrl: string;
  /** The post's own page on instagram.com. Each tile links to its own post, not the profile. */
  permalink: string;
  caption?: string;
  /** ISO 8601, as returned by the API. */
  timestamp: string;
  isVideo: boolean;
}
