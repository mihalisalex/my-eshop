import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/auth";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

/**
 * Renamed category URLs are redirected HERE rather than in the page, and it has to be here.
 * `/category/[slug]` streams, and Next emits a client-side `<meta http-equiv="refresh">`
 * instead of a 308 when `permanentRedirect` is called in a streaming context — a soft
 * redirect, which defeats the purpose of preserving the old URL's ranking. The proxy runs
 * before any response begins, so it can return a real 308. (Proxy is Node runtime by
 * default in Next 16, so Prisma is available here.)
 *
 * Costs one indexed lookup on category pageviews. The common case — a slug that was never
 * renamed — is a single index miss.
 */
async function renamedCategoryRedirect(request: NextRequest): Promise<NextResponse | null> {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (!slug) return null;

  // A live category always wins, so a slug that was retired and later reissued serves the
  // new category instead of redirecting away from it.
  const live = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (live) return null;

  const history = await prisma.categorySlugHistory.findUnique({
    where: { slug },
    select: { category: { select: { slug: true, isVisible: true } } },
  });
  if (!history || !history.category.isVisible || history.category.slug === slug) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/category/${history.category.slug}`;
  return NextResponse.redirect(url, 308);
}

/**
 * The same treatment for products, and for the same reasons — `/products/[slug]` streams
 * too, so a `permanentRedirect` inside the page degrades to a client-side meta refresh
 * rather than a 308, which is a soft redirect and passes no ranking on.
 *
 * A product URL is the most linked-to page a shop has, and the slug is an editable field
 * on the admin form, so this is the redirect that matters most.
 */
async function renamedProductRedirect(request: NextRequest): Promise<NextResponse | null> {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (!slug) return null;

  // A live product always wins — a retired slug later reissued to a different product
  // serves that product rather than redirecting away from it. Checked without filtering on
  // status: a draft occupying the slug still owns it, and should 404 rather than redirect
  // a customer to some other product that once had the name.
  const live = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (live) return null;

  const history = await prisma.productSlugHistory.findUnique({
    where: { slug },
    select: { product: { select: { slug: true, status: true } } },
  });
  if (!history || history.product.status !== "active" || history.product.slug === slug) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/products/${history.product.slug}`;
  return NextResponse.redirect(url, 308);
}

/** Next only supports one proxy/middleware export per project — the admin, customer-account and category-redirect branches all live in this single function. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/category/")) {
    const redirectResponse = await renamedCategoryRedirect(request);
    if (redirectResponse) return redirectResponse;
    return NextResponse.next();
  }

  if (pathname.startsWith("/products/")) {
    const redirectResponse = await renamedProductRedirect(request);
    if (redirectResponse) return redirectResponse;
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const isLoginRoute = pathname === "/admin/login";
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSession(token) : null;

    if (!isLoginRoute && !session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (token) response.cookies.delete(ADMIN_SESSION_COOKIE);
      return response;
    }

    if (isLoginRoute && session) {
      // A validly-signed token whose user no longer exists is not a session. Without this
      // check the two halves of the system disagree and bounce forever: the dashboard's DAL
      // finds no user and redirects /admin -> /admin/login, while this branch sees an intact
      // signature and redirects /admin/login -> /admin. The browser is then locked out of
      // signing in as anyone until the cookie expires a day later. Deleting an admin account
      // (or restoring a database) is enough to trigger it, so clear the stale cookie and let
      // the login form render. One indexed lookup, and only on the login route.
      const stillExists = await prisma.adminUser.findUnique({
        where: { id: session.sub },
        select: { id: true },
      });
      if (!stillExists) {
        const response = NextResponse.next();
        response.cookies.delete(ADMIN_SESSION_COOKIE);
        return response;
      }
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
    // Reachable in BOTH states, which is why it isn't simply "public": signed out, it's
    // the page an emailed reset link lands on (gating it behind a session made the whole
    // forgot-password flow unreachable — the link bounced straight to /account/login);
    // signed in, someone who requested a reset before logging in elsewhere must still be
    // able to finish it rather than be bounced to /account with their token discarded.
    if (pathname === "/account/reset-password") return NextResponse.next();

    const isPublicRoute = pathname === "/account/login" || pathname === "/account/register";
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const session = token ? await verifyCustomerSession(token) : null;

    if (!isPublicRoute && !session) {
      const loginUrl = new URL("/account/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (token) response.cookies.delete(CUSTOMER_SESSION_COOKIE);
      return response;
    }

    if (isPublicRoute && session) {
      return NextResponse.redirect(new URL("/account", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/category/:path*", "/products/:path*"],
};
