/**
 * Edge helper: decide whether `?code=` is a stray OAuth PKCE reply to forward
 * to the auth callback - not a Community tournament join code.
 *
 * Invite shares mint `/?view=tournaments&source=community&code={code}` (and
 * legacy `view=events`). OAuth PKCE replies include `state`.
 */
export function shouldForwardStrayOAuthCode(
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (!searchParams.has("code")) return false;

  const view = (searchParams.get("view") || "").trim().toLowerCase();
  if (view === "tournaments" || view === "events") return false;

  const path = pathname || "/";
  if (
    path === "/events/public" ||
    path.startsWith("/events/public/") ||
    path === "/events/join" ||
    path.startsWith("/events/join/")
  ) {
    return false;
  }

  // PKCE OAuth returns code+state; cup join codes never include state.
  return searchParams.has("state");
}
