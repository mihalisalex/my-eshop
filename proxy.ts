import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/auth";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession } from "@/lib/customer-auth";

/** Next only supports one proxy/middleware export per project — both the admin and customer-account branches live in this single function. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/account")) {
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
  matcher: ["/admin/:path*", "/account/:path*"],
};
