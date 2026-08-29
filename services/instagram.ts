import "server-only";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { InstagramPost } from "@/types";

/**
 * The shop's own Instagram feed, via the Instagram API with Instagram Login.
 *
 * The Basic Display API this would once have used was shut down in December 2024, so this
 * talks to graph.instagram.com with a token belonging to an Instagram *Business or Creator*
 * account. INSTAGRAM.md is the setup guide; nothing here can be made to work without a
 * human completing an OAuth consent screen first.
 *
 * The whole module is built around one rule: **the homepage must render when Meta does
 * not.** Every failure path returns an empty array and the caller falls back to the curated
 * tiles already in the homepage document. A third party being down, rate limiting us, or
 * handing back a shape we did not expect is not a reason for a shoe shop to serve a 500.
 */

const GRAPH_HOST = "https://graph.instagram.com";

/**
 * Pinned rather than left unversioned. An unversioned call silently follows whatever Meta
 * has most recently shipped, which is how a working feed turns into an empty one on a
 * morning nobody deployed anything. Meta supports each version for about two years — when
 * this one is retired the fetch starts failing and the curated tiles take over, which is a
 * visible-but-harmless degradation rather than an outage.
 */
const API_VERSION = "v23.0";

/** Hourly. Posts are not urgent, and this keeps us far under any rate limit. */
const REVALIDATE_SECONDS = 60 * 60;

/**
 * A homepage render must not wait on Meta. Only the one request an hour that actually
 * misses the cache can block at all, but that one still needs a ceiling. Next strips this
 * signal when it revalidates in the background, so it costs nothing there.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/** Enough for the six-tile grid with margin for posts we cannot render. */
const FETCH_LIMIT = 12;

/**
 * Where the live token lives.
 *
 * Not simply `process.env.INSTAGRAM_ACCESS_TOKEN`, because a long-lived Instagram token
 * expires after 60 days and the refresh call returns a NEW string that has to be kept.
 * Environment variables are read-only at runtime, so an env-only design would mean the feed
 * silently dying every two months until someone noticed and pasted a fresh token — exactly
 * the kind of thing nobody notices. This row is written by the refresh cron.
 *
 * The env var is still honoured, as the seed: set it once and the first refresh moves the
 * token into the database and keeps it alive from then on.
 */
const TOKEN_KEY = "instagram-token";

interface StoredToken {
  accessToken: string;
  /** ISO 8601. Informational — Meta is the authority on whether a token still works. */
  refreshedAt?: string;
  expiresAt?: string;
}

interface GraphMedia {
  id?: unknown;
  caption?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  permalink?: unknown;
  thumbnail_url?: unknown;
  timestamp?: unknown;
}

function envToken(): string | null {
  const raw = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  return raw ? raw : null;
}

/**
 * The stored token wins over the env var, because after the first refresh the env var holds
 * a string that is 60 days out of date. To point the shop at a different account, rewrite
 * the row (scripts/set-instagram-token.ts) rather than editing the variable.
 */
export async function getInstagramToken(): Promise<string | null> {
  const stored = await getSiteContent<StoredToken | null>(TOKEN_KEY, null);
  return stored?.accessToken?.trim() || envToken();
}

export async function saveInstagramToken(token: StoredToken): Promise<void> {
  await setSiteContent<StoredToken>(TOKEN_KEY, token);
}

/** Whether an account has been connected at all. */
export async function isInstagramConnected(): Promise<boolean> {
  return (await getInstagramToken()) !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Graph media -> tile, dropping anything we cannot honestly render.
 *
 * Exported for its own test: this is the only part with real branching, and the part that
 * breaks when Meta changes a field.
 */
export function toInstagramPost(media: GraphMedia): InstagramPost | null {
  const id = asString(media.id);
  const permalink = asString(media.permalink);
  if (!id || !permalink) return null;

  const isVideo = asString(media.media_type) === "VIDEO";

  // A video's `media_url` is an .mp4, and an <img> pointed at one renders nothing at all —
  // so a video without a thumbnail is dropped rather than shown as a blank tile.
  const imageUrl = isVideo ? asString(media.thumbnail_url) : asString(media.media_url);
  if (!imageUrl) return null;

  return {
    id,
    imageUrl,
    permalink,
    caption: asString(media.caption),
    timestamp: asString(media.timestamp) ?? "",
    isVideo,
  };
}

/**
 * The most recent posts, newest first — or `[]` when no account is connected, the request
 * fails, or nothing in the response is renderable. Never throws; see the module comment.
 *
 * The URLs it returns are signed CDN links that expire within days, which is why this is a
 * live read on an hourly revalidate rather than something imported once into the media
 * library: a feed of Instagram images stored permanently is a feed of broken images later.
 */
export async function getInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  const token = await getInstagramToken();
  if (!token) return [];

  const url = new URL(`${GRAPH_HOST}/${API_VERSION}/me/media`);
  url.searchParams.set("fields", "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp");
  url.searchParams.set("limit", String(FETCH_LIMIT));
  url.searchParams.set("access_token", token);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // `next.revalidate` is what opts this into the data cache at all — in Next 16 a bare
      // fetch is not cached, so leaving it off would call Meta on every render.
      next: { revalidate: REVALIDATE_SECONDS, tags: ["instagram"] },
    });

    if (!response.ok) {
      // The token expiring is the expected long-run failure and arrives here as a 400.
      // Logged rather than thrown, so it surfaces in the runtime logs while the page keeps
      // serving the curated tiles.
      console.warn(`[instagram] ${response.status} from Meta — falling back to the curated grid.`);
      return [];
    }

    const body = (await response.json()) as { data?: unknown };
    if (!Array.isArray(body.data)) return [];

    return body.data
      .map((media) => toInstagramPost(media as GraphMedia))
      .filter((post): post is InstagramPost => post !== null)
      .slice(0, limit);
  } catch (error) {
    console.warn("[instagram] feed request failed — falling back to the curated grid.", error);
    return [];
  }
}

/**
 * Extends the long-lived token by another 60 days and stores the result.
 *
 * Meta requires the token to be at least 24 hours old and not yet expired, so this has to
 * run on a schedule comfortably inside that window — weekly, from vercel.json. Once a token
 * has actually expired there is no refreshing it; someone has to redo the consent screen.
 */
export async function refreshInstagramToken(): Promise<{ refreshed: boolean; reason?: string }> {
  const token = await getInstagramToken();
  if (!token) return { refreshed: false, reason: "no token configured" };

  const url = new URL(`${GRAPH_HOST}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    return { refreshed: false, reason: `Meta returned ${response.status}` };
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  const accessToken = body.access_token?.trim();
  // Writing an empty token would take a working feed offline, so an unexpected shape is
  // left alone: the token we already hold has up to 60 days left and is the safer keep.
  if (!accessToken) return { refreshed: false, reason: "response contained no access_token" };

  const now = Date.now();
  await saveInstagramToken({
    accessToken,
    refreshedAt: new Date(now).toISOString(),
    expiresAt: body.expires_in ? new Date(now + body.expires_in * 1000).toISOString() : undefined,
  });

  return { refreshed: true };
}
