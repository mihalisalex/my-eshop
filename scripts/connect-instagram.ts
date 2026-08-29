import "dotenv/config";
import { getInstagramPosts, getInstagramToken, refreshInstagramToken, saveInstagramToken } from "@/services/instagram";
import { prisma } from "@/lib/prisma";

/**
 * Connects the shop's Instagram account, or reports on the one already connected.
 *
 *   npm run instagram:status     what is connected right now, and can we read the feed
 *   npm run instagram:connect    exchange the token in INSTAGRAM_ACCESS_TOKEN and store it
 *   npm run instagram:refresh    extend the stored token by another 60 days
 *
 * The `--conditions=react-server` in those scripts is not decoration: services/instagram.ts
 * imports `server-only`, which throws outside a React server runtime, and without the flag
 * this file cannot import the very functions it is meant to exercise. Duplicating them here
 * instead would mean a script that tests something other than what the site runs.
 *
 * What this deliberately does NOT do is the OAuth step. Getting the first token means
 * signing into Instagram and approving a consent screen, and that is the account owner's to
 * do — see INSTAGRAM.md. This script starts from the code they come back with.
 */

const GRAPH_HOST = "https://graph.instagram.com";

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exitCode = 1;
  // Thrown rather than process.exit(): an open HTTP handle plus an immediate exit is how
  // this script would otherwise die on a libuv assertion instead of printing the reason.
  throw new Error(message);
}

/** The last four characters only. A token in a terminal scrollback is a token that leaked. */
function fingerprint(token: string): string {
  return `…${token.slice(-4)} (${token.length} chars)`;
}

async function status(): Promise<void> {
  const token = await getInstagramToken();
  if (!token) {
    console.log("\n  Not connected. No token in the database and none in INSTAGRAM_ACCESS_TOKEN.");
    console.log("  The homepage grid is showing its curated images, which is the intended fallback.\n");
    return;
  }

  console.log(`\n  Token present: ${fingerprint(token)}`);

  // The only test that means anything is whether the feed actually comes back.
  const posts = await getInstagramPosts(6);
  if (posts.length === 0) {
    console.log("  But the feed returned nothing — the token may have expired, or the account may have no posts.");
    console.log("  The homepage is falling back to its curated images.\n");
    return;
  }

  console.log(`  Feed OK — ${posts.length} post(s):\n`);
  for (const post of posts) {
    const caption = post.caption?.split("\n")[0]?.slice(0, 60) ?? "(no caption)";
    console.log(`    ${post.timestamp.slice(0, 10)}  ${post.isVideo ? "video" : "photo"}  ${caption}`);
  }
  console.log();
}

/** Which account a token actually belongs to. The one check that catches connecting the wrong one. */
async function whoami(token: string): Promise<string | null> {
  const url = new URL(`${GRAPH_HOST}/me`);
  url.searchParams.set("fields", "username");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as { username?: string };
  return body.username ?? null;
}

/**
 * Stores a token, upgrading it to a 60-day one first if it is not already.
 *
 * There are two ways to end up holding a token and they hand you different things. Meta's
 * "Generate token" button in the app dashboard gives a long-lived one directly; completing
 * the OAuth redirect yourself gives one that lasts an hour. Storing the second as-is would
 * "work" until lunchtime and then look exactly like a misconfiguration, so the exchange is
 * attempted whenever it can be — and a refusal is taken to mean the token was already
 * long-lived rather than treated as fatal.
 */
async function connect(): Promise<void> {
  const provided = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();

  if (!provided) fail("Set INSTAGRAM_ACCESS_TOKEN in .env first — see INSTAGRAM.md step 4.");

  // Before anything is stored. A token for the wrong account is the one mistake here that
  // produces a working feed of somebody else's photos.
  const username = await whoami(provided!);
  if (!username) fail("Meta would not accept that token at all. Generate a fresh one — INSTAGRAM.md step 4.");
  console.log(`\n  Token belongs to @${username}.`);

  let accessToken = provided!;
  let expiresAt: Date | undefined;

  if (appSecret) {
    const url = new URL(`${GRAPH_HOST}/access_token`);
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("access_token", provided!);

    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };

    if (response.ok && body.access_token) {
      accessToken = body.access_token;
      if (body.expires_in) expiresAt = new Date(Date.now() + body.expires_in * 1000);
      console.log("  Exchanged for a 60-day token.");
    } else {
      console.log(`  Not exchanged (${body.error?.message ?? response.status}) — assuming it is already long-lived.`);
    }
  } else {
    console.log("  No INSTAGRAM_APP_SECRET set, so storing the token as given.");
    console.log("  That is correct for a token from Meta's \"Generate token\" button, which is already long-lived.");
  }

  await saveInstagramToken({
    accessToken,
    refreshedAt: new Date().toISOString(),
    expiresAt: expiresAt?.toISOString(),
  });

  console.log(`  Stored: ${fingerprint(accessToken)}`);
  if (expiresAt) console.log(`  Expires ${expiresAt.toDateString()} — the daily cron extends it well before then.`);
  console.log("\n  Verifying by reading the feed…");
  await status();
}

async function refresh(): Promise<void> {
  const result = await refreshInstagramToken();
  if (!result.refreshed) fail(`Not refreshed: ${result.reason}`);
  console.log("\n  Token refreshed — another 60 days.\n");
}

const MODES: Record<string, () => Promise<void>> = { status, connect, refresh };

async function main() {
  const mode = process.argv[2] ?? "status";
  const run = MODES[mode];
  if (!run) fail(`Unknown mode "${mode}". Expected one of: ${Object.keys(MODES).join(", ")}`);
  await run();
}

main()
  .catch((error) => {
    if (!process.exitCode) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  })
  .finally(() => prisma.$disconnect());
