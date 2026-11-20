/** Player Tournament discovery source (Official = platform, Community = hosted). */

export type CompetitionCupSource = "all" | "official" | "community";

export function parseCompetitionCupSource(raw: string | null | undefined): CompetitionCupSource {
  const v = (raw || "").trim().toLowerCase();
  if (v === "official" || v === "platform") return "official";
  if (v === "community" || v === "hosted" || v === "events") return "community";
  if (v === "all") return "all";
  return "all";
}

/** Legacy `/?view=events` → unified tournaments Community tab (preserve id/code). */
export function tournamentsHrefFromEventsView(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("view");
  params.set("view", "tournaments");
  params.set("source", "community");
  const q = params.toString();
  return q ? `/?${q}` : "/?view=tournaments&source=community";
}

/**
 * Legacy standalone `/tournaments` (Official-only page) → unified home hub.
 * Preserves id/source/q/skip so deep links and filters keep working.
 */
export function tournamentsHrefFromLegacyTournamentsPath(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("view", "tournaments");
  const q = params.toString();
  return q ? `/?${q}` : "/?view=tournaments";
}

/**
 * Player notification / deep-link href → unified Tournament discovery.
 * Remaps legacy `/?view=events`, `/events/public`, and guest/invite `/events/join`
 * (no second Event sport). Hosting nav still links bare `/events/join` for signed-in
 * organizers via resolvePlayerNavHref (not this helper).
 */
export function playerTournamentDiscoveryHref(href: string): string {
  const raw = (href || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return raw;
  let u: URL;
  try {
    u = new URL(raw, "http://local.invalid");
  } catch {
    return raw;
  }
  const path = u.pathname || "/";
  if (
    path === "/events/public" ||
    path.startsWith("/events/public/") ||
    path === "/events/join" ||
    path.startsWith("/events/join/")
  ) {
    const params = new URLSearchParams(u.search);
    params.set("view", "tournaments");
    params.set("source", "community");
    const q = params.toString();
    return q ? `/?${q}` : "/?view=tournaments&source=community";
  }
  if (path === "/" || path === "") {
    const view = (u.searchParams.get("view") || "").trim().toLowerCase();
    if (view === "events") {
      return tournamentsHrefFromEventsView(u.searchParams.toString());
    }
    // Invite join codes on tournaments hub without source → Community (Flutter parity).
    if (view === "tournaments") {
      const code = (u.searchParams.get("code") || "").trim();
      const source = (u.searchParams.get("source") || "").trim().toLowerCase();
      if (code && source !== "community" && source !== "official" && source !== "all") {
        const params = new URLSearchParams(u.searchParams);
        params.set("view", "tournaments");
        params.set("source", "community");
        const q = params.toString();
        return q ? `/?${q}` : "/?view=tournaments&source=community";
      }
    }
  }
  return raw;
}
