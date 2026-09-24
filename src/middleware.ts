import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, authPassword, tokenFor } from "@/lib/auth";

// Paths reachable without a session: the login screen, its API, and the external
// webhooks (they authenticate with their own secrets and are called by Cal.com /
// the CRM, not a logged-in browser).
const PUBLIC_PAGES = ["/login"];
const PUBLIC_API = ["/api/login", "/api/logout", "/api/cal-hook", "/api/crm-hook"];

export async function middleware(req: NextRequest) {
  const pw = authPassword();
  if (!pw) return NextResponse.next(); // auth disabled until AUTH_PASSWORD is set

  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PAGES.includes(pathname) ||
    PUBLIC_API.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await tokenFor(pw);
  if (cookie && cookie === expected) return NextResponse.next();

  // API calls get a 401; page loads get bounced to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.ico$).*)"],
};
