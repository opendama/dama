import { envPathAuthCallback } from "@/lib/app-paths";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge: never gate /auth/callback; forward stray OAuth PKCE (?code=&state=)
 * to callback. Require state so non-OAuth ?code= query values are not stolen.
 * Paths from NEXT_PUBLIC_APP_PATH_* (aligned with auth_providers.site; no invent).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const callbackPath = envPathAuthCallback();

  if (
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    (callbackPath && (pathname === callbackPath || pathname.startsWith(`${callbackPath}/`)))
  ) {
    return NextResponse.next();
  }

  const params = request.nextUrl.searchParams;
  if (callbackPath && pathname !== callbackPath && params.has("code") && params.has("state")) {
    const dest = request.nextUrl.clone();
    dest.pathname = callbackPath;
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
