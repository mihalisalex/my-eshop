import { describe, expect, it } from "vitest";
import { toInstagramPost } from "@/services/instagram";

/**
 * The mapper is the only part of the Instagram integration with real branching, and it sits
 * on the boundary with an API this codebase does not control. Every case here is a shape
 * Meta actually returns — a video whose `media_url` is an .mp4, a carousel, a photo with no
 * caption — and getting any of them wrong shows up as a blank tile on the homepage rather
 * than as an error anyone would see.
 */
describe("toInstagramPost", () => {
  const photo = {
    id: "1",
    media_type: "IMAGE",
    media_url: "https://scontent.cdninstagram.com/v/t51/photo.jpg",
    permalink: "https://www.instagram.com/p/ABC/",
    caption: "Νέες αφίξεις\n#alexandrisstores",
    timestamp: "2026-08-20T09:00:00+0000",
  };

  it("maps a photo", () => {
    expect(toInstagramPost(photo)).toEqual({
      id: "1",
      imageUrl: "https://scontent.cdninstagram.com/v/t51/photo.jpg",
      permalink: "https://www.instagram.com/p/ABC/",
      caption: "Νέες αφίξεις\n#alexandrisstores",
      timestamp: "2026-08-20T09:00:00+0000",
      isVideo: false,
    });
  });

  it("uses the thumbnail for a video, never the mp4 in media_url", () => {
    // The whole reason this function exists: an <img> pointed at an .mp4 renders nothing,
    // and nothing is exactly what a broken grid tile looks like.
    const post = toInstagramPost({
      ...photo,
      media_type: "VIDEO",
      media_url: "https://scontent.cdninstagram.com/v/t50/reel.mp4",
      thumbnail_url: "https://scontent.cdninstagram.com/v/t51/still.jpg",
    });
    expect(post?.imageUrl).toBe("https://scontent.cdninstagram.com/v/t51/still.jpg");
    expect(post?.isVideo).toBe(true);
  });

  it("drops a video that has no thumbnail rather than rendering an empty tile", () => {
    expect(toInstagramPost({ ...photo, media_type: "VIDEO", media_url: "https://x.test/reel.mp4" })).toBeNull();
  });

  it("treats a carousel like a photo — media_url is its cover image", () => {
    const post = toInstagramPost({ ...photo, media_type: "CAROUSEL_ALBUM" });
    expect(post?.imageUrl).toBe(photo.media_url);
    expect(post?.isVideo).toBe(false);
  });

  it("keeps a post with no caption", () => {
    const post = toInstagramPost({ ...photo, caption: undefined });
    expect(post?.caption).toBeUndefined();
    expect(post?.id).toBe("1");
  });

  it("drops anything missing the fields a tile cannot be built without", () => {
    expect(toInstagramPost({ ...photo, id: undefined })).toBeNull();
    expect(toInstagramPost({ ...photo, permalink: undefined })).toBeNull();
    expect(toInstagramPost({ ...photo, media_url: undefined })).toBeNull();
    expect(toInstagramPost({})).toBeNull();
  });

  it("ignores non-string values instead of trusting the response's shape", () => {
    // Unvalidated JSON from a third party: a number where a string was promised must not
    // become `imageUrl: 42` and reach next/image.
    expect(toInstagramPost({ ...photo, media_url: 42 })).toBeNull();
    expect(toInstagramPost({ ...photo, id: null })).toBeNull();
    expect(toInstagramPost({ ...photo, caption: {} })?.caption).toBeUndefined();
  });
});
