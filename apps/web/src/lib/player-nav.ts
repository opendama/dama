import type { ClientNavLink, ClientNavPayload } from "@/types/platform";
import {
  playerTournamentDiscoveryHref,
  tournamentsHrefFromEventsView,
} from "./competition-cup-source";
import { softCommunityJoinTitle, softTournamentsPageTitle } from "./community-player-chrome-soft";
import { softHostingAnalyticsTitle, softHostingBrandName } from "./hosting-organizer-chrome-soft";

/** Ops routes - signed-in only (hamburger Account / user menu / portal rail), never bottom tabs. */
const OPS_ROUTE_KEYS = new Set([
  "dashboard",
  "overview",
  "wallet",
  "profile",
  "ads",
  "ads_dashboard",
  // Organizer portal only - player browse remaps public route_key `events` → tournaments Community.
  "events_dashboard",
  "avatar",
  "receipts",
  "transactions",
  "transfer",
  "settings",
  "history",
  "matches",
]);

/**
 * Canonical player-portal rail order (route_key only).
 * Titles and hrefs must come from DB client_nav; never invent paths or English labels.
 */
const PORTAL_RAIL_CANONICAL: { route_key: string }[] = [
  { route_key: "dashboard" },
  { route_key: "profile" },
  { route_key: "wallet" },
  { route_key: "transactions" },
  { route_key: "receipts" },
  { route_key: "transfer" },
  { route_key: "ads" },
  { route_key: "events_dashboard" },
  { route_key: "settings" },
];

/** Paths that use the player-portal sidebar (ops only - no public Play menus). */
export function isPlayerPortalPath(pathname: string): boolean {
  const p = (pathname || "").trim();
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return true;
  if (p === "/wallet" || p.startsWith("/wallet/")) return true;
  if (p === "/profile" || p.startsWith("/profile/")) return true;
  if (p === "/avatar" || p.startsWith("/avatar/")) return true;
  if (p === "/settings" || p.startsWith("/settings/")) return true;
  if (p === "/receipts" || p.startsWith("/receipts/")) return true;
  if (p === "/transactions" || p.startsWith("/transactions/")) return true;
  if (p === "/transfer" || p.startsWith("/transfer/")) return true;
  return false;
}

/** Thumb-primary loop (Chess.com-style). Leaderboard lives in hamburger overflow. */
/** One cup discovery tab: tournaments (Official|Community). Events browse → Community. */
const PRIMARY_BOTTOM_KEYS = ["play", "matchmaking", "tournaments", "spectate"] as const;

/** Public routes that belong in hamburger “More”, not the thumb bar. */
const HAMBURGER_OVERFLOW_KEYS = new Set(["leaderboard", "status"]);

export function isPlayerOpsRouteKey(routeKey: string): boolean {
  return OPS_ROUTE_KEYS.has((routeKey || "").trim());
}

function dedupeByRouteKey(links: ClientNavLink[]): ClientNavLink[] {
  const seen = new Set<string>();
  const out: ClientNavLink[] = [];
  for (const link of links) {
    const key = (link.route_key || link.href || "").trim();
    if (!key || seen.has(key)) continue;
    if (!(link.href || "").trim() || !(link.title || "").trim()) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

/** True when a Hosting nav row is legacy public browse (not manage/roster/money). */
export function isHostingPublicBrowseNavLink(link: ClientNavLink): boolean {
  const key = (link.route_key || "").trim();
  if (key === "events_public" || key === "events") return true;
  const href = (link.href || "").trim();
  if (!href) return false;
  const path = href.split("?")[0] || href;
  return path === "/events/public" || path.startsWith("/events/public/");
}

/**
 * Hosting organizer nav: manage/roster/money only.
 * Drop legacy public browse (`/events/public`) - Community lives under Tournaments.
 */
export function filterHostingNavLinks(links: ClientNavLink[]): ClientNavLink[] {
  return dedupeByRouteKey(links).filter((l) => !isHostingPublicBrowseNavLink(l));
}

/**
 * Soft-replace known Event-sport Hosting nav titles (mig 378 / events_brand_name parity).
 * Never invents new English - only restores migration soft-fill strings or brand.
 */
export function mapHostingNavDisplayTitles(
  links: ClientNavLink[],
  eventsBrandName?: string,
): ClientNavLink[] {
  const brand = (eventsBrandName || "").trim();
  const brandOk = Boolean(brand) && !/\bevents?\b/i.test(brand);
  return links.map((l) => {
    const key = (l.route_key || "").trim();
    const title = (l.title || "").trim();
    if (!title) return l;
    if (key === "events_dashboard" && brandOk && /\bevents?\b/i.test(title)) {
      return { ...l, title: brand };
    }
    if (key === "events_list" && /^(My events|Events|Event)$/i.test(title)) {
      return { ...l, title: "My hosted tournaments" };
    }
    if (key === "events_join") {
      // softCommunityJoinTitle: Join / Join event / Events → Join with code (panel parity).
      const next = softCommunityJoinTitle(title);
      if (next && next !== title) return { ...l, title: next };
    }
    if (key === "events_analytics") {
      const next = softHostingAnalyticsTitle(title);
      if (next && next !== title) return { ...l, title: next };
    }
    return l;
  });
}

/** Hosting rail/bottom: drop public browse, then soft-fix Event-sport titles. */
export function pickHostingNavLinks(
  links: ClientNavLink[],
  eventsBrandName?: string,
): ClientNavLink[] {
  return mapHostingNavDisplayTitles(filterHostingNavLinks(links), eventsBrandName);
}

/**
 * Player rail: public discovery on `/` (+ view=). Play hub is `/`.
 * Legacy `/play`, `/tournaments`, etc. remap into home views.
 */
export function resolvePlayerNavHref(link: ClientNavLink): string {
  const key = (link.route_key || "").trim();
  if (key === "home" || key === "play") return "/";
  if (key === "tournaments") return "/?view=tournaments";
  if (key === "tournaments_mine") return "/?view=tournaments&mine=1";
  if (key === "host_tournament") {
    const href = (link.href || "").trim();
    return href || "/events/events?create=1";
  }
  if (key === "ads_publisher") {
    const href = (link.href || "").trim();
    return href || "/ads/dashboard";
  }
  if (key === "matchmaking" || key === "match") return "/?view=match";
  if (key === "leaderboard") return "/?view=leaderboard";
  if (key === "status" || key === "platform_stats") return "/?view=status";
  if (key === "spectate") return "/?view=spectate";
  // Legacy player Events browse → unified Tournaments Community tab.
  if (key === "events" || key === "events_public") {
    return "/?view=tournaments&source=community";
  }

  const href = (link.href || "").trim();
  if (href === "/play" || href.startsWith("/play?")) {
    const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    return q ? `/?${q}` : "/";
  }
  if (href === "/tournaments" || href.startsWith("/tournaments?")) {
    const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    // Preserve id/source/q - do not drop deep-link / filter query onto bare hub.
    const params = new URLSearchParams(q);
    params.set("view", "tournaments");
    const out = params.toString();
    return out ? `/?${out}` : "/?view=tournaments";
  }
  if (href === "/matchmaking" || href.startsWith("/matchmaking?")) return "/?view=match";
  if (href === "/leaderboard" || href.startsWith("/leaderboard?")) return "/?view=leaderboard";
  if (href === "/status" || href.startsWith("/status?")) return "/?view=status";
  if (href === "/spectate" || href.startsWith("/spectate?")) return "/?view=spectate";
  if (href === "/?view=play") return "/";
  // Preserve code/id on legacy Events browse → Community (same as notif/OAuth remap).
  if (href === "/?view=events" || href.startsWith("/?view=events")) {
    const q = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    return tournamentsHrefFromEventsView(q);
  }
  if (
    href === "/events/public" ||
    href.startsWith("/events/public?") ||
    href.startsWith("/events/public/")
  ) {
    return playerTournamentDiscoveryHref(href);
  }
  return href;
}

/** Legacy player Events browse tab - second cup menu; Community lives under Tournaments. */
export function isPlayerEventsBrowseNavLink(link: ClientNavLink): boolean {
  const key = (link.route_key || "").trim();
  if (key === "events" || key === "events_public") return true;
  return isHostingPublicBrowseNavLink(link);
}

/** Public-only: drop Home duplicate + ops + legacy Events browse (one Tournament word). */
export function filterPlayerNavLinks(links: ClientNavLink[]): ClientNavLink[] {
  const hasPlay = links.some((l) => (l.route_key || "").trim() === "play");
  return links.filter((l) => {
    const key = (l.route_key || "").trim();
    if (OPS_ROUTE_KEYS.has(key)) return false;
    if (hasPlay && key === "home") return false;
    if (isPlayerEventsBrowseNavLink(l)) return false;
    return true;
  });
}

/**
 * Soft-replace known Event-sport player discovery titles (Tournaments tab fail-open).
 * Hosting parity: mapHostingNavDisplayTitles.
 */
export function mapPlayerNavDisplayTitles(links: ClientNavLink[]): ClientNavLink[] {
  return links.map((l) => {
    const key = (l.route_key || "").trim();
    const title = (l.title || "").trim();
    if (!title) return l;
    if (key === "tournaments") {
      const next = softTournamentsPageTitle(title);
      if (next && next !== title) return { ...l, title: next };
    }
    return l;
  });
}

/** Thumb bottom bar - primary play loop only (Play / Match / Tournaments / Spectate). */
export function pickBottomNavLinks(nav: ClientNavPayload): ClientNavLink[] {
  const raw = filterPlayerNavLinks(dedupeByRouteKey(nav.bottom_nav?.player ?? []));
  const byKey = new Map(raw.map((l) => [(l.route_key || "").trim(), l]));
  const primary = PRIMARY_BOTTOM_KEYS.map((k) => byKey.get(k)).filter((l): l is ClientNavLink =>
    Boolean(l),
  );
  // Prefer the 4-tab loop when those keys exist (works even if DB still mirrors old 5-tab list).
  // Fallback still excludes Events browse (Flutter player_shell parity).
  if (primary.length >= 3) return mapPlayerNavDisplayTitles(primary);
  return mapPlayerNavDisplayTitles(raw);
}

/** Desktop left rail - full public discovery from `player` (not the short bottom list). */
export function pickDesktopRailLinks(nav: ClientNavPayload): ClientNavLink[] {
  const fromPlayer = filterPlayerNavLinks(dedupeByRouteKey(nav.player ?? []));
  if (fromPlayer.length > 0) return mapPlayerNavDisplayTitles(fromPlayer);
  return mapPlayerNavDisplayTitles(
    filterPlayerNavLinks(dedupeByRouteKey(nav.bottom_nav?.player ?? [])),
  );
}

/**
 * Hamburger “More”: public links not on the bottom bar (e.g. Leaderboard).
 * Stale DB fallback: if bottom still mirrors player, still surface overflow keys.
 */
export function pickHamburgerOverflowLinks(nav: ClientNavPayload): ClientNavLink[] {
  const bottomKeys = new Set(
    pickBottomNavLinks(nav)
      .map((l) => (l.route_key || "").trim())
      .filter(Boolean),
  );
  const rail = pickDesktopRailLinks(nav);
  let overflow = rail.filter((l) => !bottomKeys.has((l.route_key || "").trim()));

  if (overflow.length === 0) {
    overflow = rail.filter((l) => HAMBURGER_OVERFLOW_KEYS.has((l.route_key || "").trim()));
  }

  if (overflow.length === 0) {
    const fromBottom = (nav.bottom_nav?.player ?? []).find(
      (l) => (l.route_key || "").trim() === "leaderboard",
    );
    const title = (fromBottom?.title || "").trim();
    // Fail closed: no synthetic Leaderboard row when DB title is missing.
    if (title) {
      overflow = [{ title, href: "/?view=leaderboard", route_key: "leaderboard" }];
    }
  }

  return dedupeByRouteKey(overflow);
}

/**
 * Signed-in Account / portal rail: canonical ops menus, labeled from DB when present.
 * Never includes public Play / Matchmaking / Tournaments links.
 */
export function pickOpsPlayerNavLinks(nav: ClientNavPayload): ClientNavLink[] {
  const fromNav = dedupeByRouteKey([...(nav.player ?? []), ...(nav.mobile ?? [])]).filter((l) =>
    isPlayerOpsRouteKey((l.route_key || "").trim()),
  );
  const fromDashboard = dedupeByRouteKey(nav.dashboard ?? [])
    .filter((l) => isPlayerOpsRouteKey((l.route_key || "").trim()))
    .map((l) => {
      const key = (l.route_key || "").trim();
      if (key === "history" || key === "matches") {
        // Keep DB href only (never invent /dashboard).
        return { ...l, href: (l.href || "").trim(), route_key: key };
      }
      if (key === "ads" || key === "ads_dashboard") {
        return { ...l, href: (l.href || "").trim(), route_key: "ads" };
      }
      // Portal host entry: prefer events_dashboard; legacy dashboard `events` → organizer.
      if (key === "events_dashboard") {
        return {
          ...l,
          href: (l.href || "").trim(),
          route_key: "events_dashboard",
        };
      }
      if (key === "events") {
        const href = (l.href || "").trim();
        // Legacy: dashboard seeded events → /events/dashboard (organizer). Keep as ops.
        if (href.includes("/events/") && !href.includes("view=events")) {
          return { ...l, href, route_key: "events_dashboard" };
        }
        // Public browse Events must not appear on ops rail.
        return { ...l, href: "", route_key: "" };
      }
      if (key === "avatar") {
        return { ...l, href: (l.href || "").trim(), route_key: "profile" };
      }
      return l;
    });

  const byKey = new Map<string, ClientNavLink>();
  for (const l of [...fromNav, ...fromDashboard]) {
    let key = (l.route_key || "").trim();
    if (key === "overview" || key === "history" || key === "matches") key = "dashboard";
    if (key === "ads_dashboard") key = "ads";
    if (key === "avatar") key = "profile";
    // Never collapse organizer into public `events` discovery key.
    if (key === "events") {
      const href = (l.href || "").trim();
      if (href.includes("/events/") && !href.includes("view=events")) {
        key = "events_dashboard";
      } else {
        continue;
      }
    }
    if (!key) continue;
    if (!OPS_ROUTE_KEYS.has(key)) continue;
    const href = (l.href || "").trim();
    const title = (l.title || "").trim();
    if (!href || !title) continue;
    byKey.set(key, { ...l, route_key: key, href, title });
  }

  const overviewTitle = (nav.dashboard_page_title || "").trim();
  const out: ClientNavLink[] = [];
  for (const canon of PORTAL_RAIL_CANONICAL) {
    const key = canon.route_key;
    const fromDb = byKey.get(key);
    const href = (fromDb?.href || "").trim();
    if (!href) continue;
    if (key === "dashboard") {
      // Title from dashboard_page_title; href from DB client_nav only.
      if (!overviewTitle) continue;
      out.push({ title: overviewTitle, href, route_key: "dashboard" });
      continue;
    }
    let title = (fromDb?.title || "").trim();
    if (!title) continue;
    // Hosting ops row: never show Event sport if DB title regresses (soft brand fail-open).
    if (key === "events_dashboard" && /\bevents?\b/i.test(title)) {
      const brand = softHostingBrandName(nav.events_brand_name);
      if (brand) title = brand;
    }
    out.push({ title, href, route_key: key });
  }
  return out.filter((l) => Boolean((l.href || "").trim()) && Boolean((l.title || "").trim()));
}

/** Desktop rail inside the player portal - ops menus only. */
export function pickPortalRailLinks(nav: ClientNavPayload): ClientNavLink[] {
  return pickOpsPlayerNavLinks(nav);
}

/** @deprecated Prefer pickDesktopRailLinks / pickBottomNavLinks / pickHamburgerOverflowLinks. */
export function mergePlayerNavSources(nav: ClientNavPayload): ClientNavLink[] {
  return dedupeByRouteKey([
    ...(nav.bottom_nav?.player ?? []),
    ...(nav.player ?? []),
    ...(nav.mobile ?? []),
  ]);
}

/** @deprecated Prefer pickDesktopRailLinks. */
export function pickPublicPlayerNavLinks(nav: ClientNavPayload): ClientNavLink[] {
  return pickDesktopRailLinks(nav);
}

export function isPlayerNavActive(
  pathname: string,
  href: string,
  view: string | null,
  search?: {
    mode?: string | null;
    gameId?: string | null;
    mine?: string | null;
    create?: string | null;
  },
): boolean {
  const hrefQ = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  const hrefParams = new URLSearchParams(hrefQ);
  const wantMine = hrefParams.get("mine") === "1" || hrefParams.get("mine") === "true";
  const wantCreate = hrefParams.get("create") === "1";
  const mineOn = search?.mine === "1" || search?.mine === "true";
  const createOn = search?.create === "1";

  if (wantMine) {
    if (pathname !== "/") return false;
    return view === "tournaments" && mineOn;
  }
  if (wantCreate && (pathname === "/events/events" || pathname.startsWith("/events/events/"))) {
    return createOn;
  }

  if (href.startsWith("/?view=")) {
    const want = href.slice("/?view=".length).split("&")[0] || "";
    if (pathname !== "/") return false;
    if (view !== want) return false;
    // Bare Tournaments tab is inactive when My cups (mine=1) is selected.
    if (want === "tournaments" && mineOn) return false;
    return true;
  }
  const pathOnly = href.split("?")[0] || href;
  if (pathOnly === "/" && !href.includes("view=")) {
    if (pathname !== "/") return false;
    if (
      view === "tournaments" ||
      view === "match" ||
      view === "leaderboard" ||
      view === "spectate" ||
      view === "status" ||
      view === "events"
    ) {
      return false;
    }
    return true;
  }
  if (pathname === pathOnly) {
    if (wantCreate) return createOn;
    return true;
  }
  if (pathOnly !== "/" && pathname.startsWith(`${pathOnly}/`)) return true;
  return false;
}

/** Guest-visible paths - never hard-bounce to login on 401. */
export function isPublicGuestPath(pathname: string, search = ""): boolean {
  if (pathname === "/" || pathname === "/play" || pathname.startsWith("/play/")) return true;
  if (pathname === "/leaderboard" || pathname.startsWith("/leaderboard/")) return true;
  if (pathname === "/spectate" || pathname.startsWith("/spectate/")) return true;
  if (pathname === "/matchmaking" || pathname.startsWith("/matchmaking/")) return true;
  if (pathname === "/tournaments" || pathname.startsWith("/tournaments/")) return true;
  // Legacy public Events browse → Community (guest until Next/client redirect).
  if (pathname === "/events/public" || pathname.startsWith("/events/public/")) return true;
  // Guest invite/join entry → Community redirect (signed-in Hosting Join tab stays).
  if (pathname === "/events/join" || pathname.startsWith("/events/join/")) return true;
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/refunds") return true;
  // Legacy Events browse (remaps → tournaments Community) stays a public guest surface.
  if (pathname === "/" && /(?:^|[?&])view=events(?:&|$)/.test(search)) return true;
  if (
    pathname === "/" &&
    /(?:^|[?&])view=tournaments(?:&|$)/.test(search) &&
    /(?:^|[?&])source=community(?:&|$)/.test(search)
  ) {
    return true;
  }
  void search;
  return false;
}
