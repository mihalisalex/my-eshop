# Connecting Instagram

The **Από το κατάστημα** grid on the homepage shows the six most recent posts from
[@alexandrisstores](https://www.instagram.com/alexandrisstores/).

The shop already links to the account — the handle under the heading and every tile go to
the profile. What the steps below add is the **photos themselves**, pulled live so the grid
updates whenever you post, with no admin work.

Until they are done the grid shows its curated images. That is a supported state, not a
broken one, and it is also what the grid falls back to if Instagram is ever unreachable.

---

## Why this needs any setup at all

Instagram has no public "show me this account's photos" URL. The old Basic Display API was
shut down in **December 2024**, and its replacement only talks to an app you own, holding a
token you generated. So the shop needs its own Meta app — free, five minutes, one-time.

Two things follow from that, and both are handled for you:

- **Tokens expire after 60 days.** A daily cron (`/api/cron/instagram-token`) extends the
  token before it can lapse, and stores the new one in the database. This is why the token
  does not simply live in an environment variable — refreshing produces a *new* string, and
  Vercel's environment cannot be written to at runtime.
- **The image URLs expire too.** Meta signs them and they die within days, so the feed is
  read live on an hourly cache rather than copied into the media library once.

---

## Step 1 — Make the account a Business or Creator account

Free, in the Instagram app, and reversible.

**Settings → Account type and tools → Switch to professional account.** Choose *Business*.

The API will not talk to a personal account, so nothing below works until this is done.

## Step 2 — Create the Meta app

1. Go to <https://developers.facebook.com/apps> and sign in with the Facebook account that
   administers the business. **Create app**.
2. App name: anything (`Alexandris Stores Site`). Use `alexandrisstores@gmail.com` as the
   contact email.
3. For the use case, pick **Other** → **Business**.
4. In the new app: **Add product → Instagram → Set up**, then open **API setup with
   Instagram login**.

That page shows an **Instagram app ID** and **Instagram app secret**. You need the secret
only if you take the manual OAuth route in step 4b — the shortcut in 4a skips it.

## Step 3 — Add the redirect URI

Still under *API setup with Instagram login*, find **Business login settings** and add this
as an **OAuth redirect URI**:

```
https://shopalexandris.vercel.app/
```

Meta refuses to issue a token without one on file, even though the shortcut below never
redirects anywhere.

## Step 4a — Generate the token (the easy way)

On the same page, section **Generate access tokens**:

1. **Add account** → sign in as `alexandrisstores` → approve the permissions.
2. Click **Generate token** next to the account. Copy it — it is shown once.

This gives a **60-day token** directly, and no app secret is involved.

> ### Step 4b — the manual route, only if 4a is unavailable
>
> Visit this URL in a browser (substituting your Instagram app ID), approve, and copy the
> `code` parameter Meta puts in the address bar — it is valid for one hour and one use:
>
> ```
> https://www.instagram.com/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=https://shopalexandris.vercel.app/&response_type=code&scope=instagram_business_basic
> ```
>
> Then set `INSTAGRAM_APP_SECRET` in `.env` as well, and exchange the code at
> `https://api.instagram.com/oauth/access_token`. The token this produces lasts one hour;
> `npm run instagram:connect` upgrades it to 60 days for you.

## Step 5 — Store it

Put the token in `.env` locally:

```
INSTAGRAM_ACCESS_TOKEN="IGQWRP..."
```

Then:

```bash
npm run instagram:connect
```

It prints which account the token belongs to **before** storing anything — check it says
`@alexandrisstores` — upgrades the token to 60 days if it needs it, saves it, and reads the
feed back so you can see the connection working.

## Step 6 — Production

The token now lives in the database, which production shares, so **the live site picks it up
without a deploy**. Within the hour the homepage grid switches to real posts.

One variable does need to be set in Vercel for the refresh cron:

- `CRON_SECRET` — already set if the abandoned-cart emails are running.

`INSTAGRAM_ACCESS_TOKEN` does **not** need to go into Vercel. It is only the seed, and the
database now holds the live value.

---

## Checking on it later

```bash
npm run instagram:status
```

Prints whether a token is stored, which posts come back, and — if the feed is empty — says
so plainly rather than leaving you to guess from a homepage that looks fine either way.

```bash
npm run instagram:refresh
```

Extends the token by 60 days by hand. The daily cron does this already; the command exists
for when you want to confirm it works.

## When it breaks

| What you see | What it means |
| --- | --- |
| Grid shows the curated stock photos again | The feed returned nothing. Run `npm run instagram:status`. |
| `status` says the token is present but the feed is empty | Token expired, or the account has no posts. Redo steps 4–5. |
| `[instagram] 400 from Meta` in the Vercel logs | Expired token. The cron should have prevented this — check it is running. |
| Images do not load, console shows a CSP violation | A Meta CDN host not covered by `lib/image-hosts.ts`. Add it there; `img-src` is derived from that list. |

Nothing in that table takes the homepage down. Every failure path ends at the curated grid.

## Disconnecting

Delete the `instagram-token` row from `SiteContent` and clear `INSTAGRAM_ACCESS_TOKEN`. The
grid returns to its curated images and the tiles go back to linking to the profile.
