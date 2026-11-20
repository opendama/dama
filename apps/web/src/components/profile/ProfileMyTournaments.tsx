"use client";

import { Button } from "@/components/ui/button";
import { SkipPagination } from "@/components/ui/skip-pagination";
import { useTournamentsPlayerChromeQuery } from "@/hooks/query/useTournamentsPlayerChromeQuery";
import { useTournamentsQuery } from "@/hooks/query/useTournamentsQuery";
import { useUrlSkip } from "@/hooks/useUrlSkip";
import { cupLifecycleStatusLabel, resolveCupCardCta } from "@/lib/cupLifecycle";
import { chromeSeparator, chromeSeparatorPresent } from "@/lib/chrome-separator";
import { parseListPageSize } from "@/lib/parse-list-page-size";
import { useAuthStore } from "@/store/auth";
import { isTournamentsPlayerChromeReady } from "@/types/tournaments-player-chrome";
import Link from "next/link";

/**
 * Profile tournament memory: cups the viewer joined → same results/lobby deep link.
 * Complements match history (game-by-game) with cup-level place/status memory.
 */
export function ProfileMyTournaments() {
  const token = useAuthStore((s) => s.token);
  const chromeQuery = useTournamentsPlayerChromeQuery(Boolean(token));
  const chrome = isTournamentsPlayerChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  const [skip, setSkip] = useUrlSkip("my_cups_skip");
  const pageSize = parseListPageSize(chrome?.list_page_size);
  const listQuery = useTournamentsQuery(
    skip,
    pageSize,
    Boolean(token) && Boolean(chrome) && pageSize > 0,
    "all",
    "",
    token,
    "all",
    true,
  );

  if (!token || !chrome) return null;

  const title = (chrome.my_tournaments_title || "").trim();
  const empty = (chrome.my_tournaments_empty || "").trim();
  const openAction = (chrome.my_tournaments_open_action || "").trim();
  const placeLabel = (chrome.my_tournaments_place_label || "").trim();
  const pointsLabel = (chrome.my_tournaments_points_label || "").trim();
  const streakLabel = (chrome.my_tournaments_streak_label || "").trim();
  const prizeLabel = (chrome.my_tournaments_prize_label || "").trim();
  const amountSep = chromeSeparator(chrome.amount_currency_separator);
  if (
    !title ||
    !empty ||
    !openAction ||
    !placeLabel ||
    !pointsLabel ||
    !streakLabel ||
    !prizeLabel
  ) {
    return null;
  }

  const rows = listQuery.data?.tournaments ?? [];
  const meta = listQuery.data?.meta ?? null;

  return (
    <div className="rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 shadow-[var(--dama-card-shadow)]">
      <h2 className="text-sm font-semibold text-[var(--dama-gold)]">{title}</h2>
      {listQuery.isLoading && rows.length === 0 ? (
        <div
          className="mt-3 h-14 animate-pulse rounded-md bg-[var(--dama-border)]/35"
          aria-hidden
        />
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dama-muted)]">{empty}</p>
      ) : (
        <>
          <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain text-sm">
            {rows.map((t) => {
              const cta = resolveCupCardCta(t, {
                enrolled: true,
                isFree: Boolean(t.is_free),
                labels: {
                  joinAction: (chrome.join_action || "").trim(),
                  enrollAction: (chrome.enroll_action || "").trim(),
                  lobbyAction: (chrome.lobby_action || "").trim(),
                  watchAction: (chrome.watch_action || "").trim(),
                  resultsAction: (chrome.results_action || "").trim(),
                },
              });
              const status = cupLifecycleStatusLabel(t, chrome);
              const metaParts: string[] = [];
              if (status) metaParts.push(status);
              if (typeof t.viewer_placement === "number" && t.viewer_placement > 0) {
                metaParts.push(`${placeLabel} ${t.viewer_placement}`);
              }
              if (typeof t.viewer_arena_points === "number") {
                metaParts.push(`${pointsLabel} ${t.viewer_arena_points}`);
              }
              if (typeof t.viewer_arena_streak === "number" && t.viewer_arena_streak > 0) {
                metaParts.push(`${streakLabel} ${t.viewer_arena_streak}`);
              }
              if (typeof t.viewer_prize_amount === "number" && t.viewer_prize_amount > 0) {
                const cur = (t.viewer_prize_currency || "").trim();
                const amt =
                  cur && chromeSeparatorPresent(amountSep)
                    ? `${t.viewer_prize_amount}${amountSep}${cur}`
                    : String(t.viewer_prize_amount);
                metaParts.push(`${prizeLabel} ${amt}`);
              }
              const sep = chromeSeparator(chrome.meta_separator);
              const href = `/?view=tournaments&source=official&id=${encodeURIComponent(t.id)}`;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--dama-text)]">{t.title}</p>
                    {sep && metaParts.length ? (
                      <p className="text-xs text-[var(--dama-muted)]">{metaParts.join(sep)}</p>
                    ) : null}
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={href}>{(cta.label || "").trim() || openAction}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
          {meta ? (
            <SkipPagination
              className="mt-3"
              meta={meta}
              disabled={listQuery.isFetching}
              onPrev={setSkip}
              onNext={setSkip}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
