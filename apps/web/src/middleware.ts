import { envPathAuthCallback } from "@/lib/app-paths";
import { shouldForwardStrayOAuthCode } from "@/lib/oauth-stray-code";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge: never gate /auth/callback; forward stray OAuth PKCE (?code=&state=)
 * to callback. Never steal Community invite ?code= join links.
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

  if (
    callbackPath &&
    pathname !== callbackPath &&
    shouldForwardStrayOAuthCode(pathname, request.nextUrl.searchParams)
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = callbackPath;
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip static assets and Chrome DevTools `/.well-known/` probes (those abort
     * streaming early and can surface Node TransformStream race noise in logs).
     */
    "/((?!_next/static|_next/image|favicon.ico|site\\.webmanifest|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
