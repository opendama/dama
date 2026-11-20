"use client";

import { OnlineStatusDot, presenceStatusLabel } from "@/components/play-rail/OnlineStatusDot";
import { HostTrustBadge } from "@/components/trust/HostTrustBadge";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import {
  type PlayersSearchRow,
  usePlayersSearchInfinite,
} from "@/hooks/query/usePlayersSearchQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CountryFlag } from "@/lib/country-flag";
import { formatPlayerNameDisplay, parseSearchDebounceMs } from "@/lib/play-rail-display";
import { cn } from "@/lib/utils";
import type { PlayRailChromeReady } from "@/types/play-rail-chrome";
import { Search } from "lucide-react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

export type PlayerSearchSuggestion = {
  id: string;
  username: string;
  rating: number;
  country_code?: string | null;
  avatar_thumb_url?: string | null;
  online?: boolean;
  playing?: boolean;
  host_trust_badge?: string | null;
  host_trust_tier?: string | null;
};

function parseTypeaheadLimit(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("play_rail_chrome.list_page_size invalid");
  }
  return n;
}

function rowToSuggestion(p: PlayersSearchRow): PlayerSearchSuggestion {
  return {
    id: p.id,
    username: p.username,
    rating: p.rating,
    country_code: p.country_code,
    avatar_thumb_url: p.avatar_thumb_url,
    online: p.online,
    playing: p.playing,
    host_trust_badge: p.host_trust_badge ?? null,
    host_trust_tier: p.host_trust_tier ?? null,
  };
}

function matchesUsername(username: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return username.toLowerCase().includes(needle);
}

type Props = {
  chrome: PlayRailChromeReady;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (player: PlayerSearchSuggestion) => void;
  placeholder: string;
  disabled?: boolean;
  /** When set, filter these rows client-side (friends / requests / DMs / viewers). */
  localSuggestions?: PlayerSearchSuggestion[] | null;
  /** Server `GET /players?q=` when localSuggestions is not provided. */
  serverSearch?: boolean;
  enabled?: boolean;
  id?: string;
  inputClassName?: string;
  /** Enter with no highlighted row (challenge free-text send). */
  onEnterWithoutSelection?: () => void;
  autoComplete?: string;
  invalid?: boolean;
};

/**
 * Debounced player typeahead. Server mode pages through every `q` match (Trim skip/limit),
 * relevance-ranked - never first-page-only. Local mode ranks the full membership set (no slice).
 */
export function PlayerSearchTypeahead({
  chrome,
  value,
  onValueChange,
  onSelect,
  placeholder,
  disabled = false,
  localSuggestions = null,
  serverSearch = true,
  enabled = true,
  id,
  inputClassName,
  onEnterWithoutSelection,
  autoComplete = "off",
  invalid = false,
}: Props) {
  const debounceMs = parseSearchDebounceMs(chrome.search_debounce_ms);
  const pageSize = parseTypeaheadLimit(chrome.list_page_size);
  const debounced = useDebouncedValue(value, debounceMs);
  const q = debounced.trim();
  const useLocal = localSuggestions != null;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  const serverEnabled =
    enabled && !disabled && !useLocal && serverSearch && open && q.length > 0 && pageSize > 0;
  const serverInfinite = usePlayersSearchInfinite(q, pageSize, serverEnabled);

  const suggestions = useMemo(() => {
    if (!q) return [] as PlayerSearchSuggestion[];
    if (useLocal) {
      // Full membership / roster - rank exact→prefix→contains; do NOT slice to one page.
      const needle = q.trim().toLowerCase();
      const ranked = (localSuggestions ?? [])
        .filter((p) => matchesUsername(p.username, q))
        .map((p) => {
          const u = p.username.trim().toLowerCase();
          const rank = u === needle ? 0 : u.startsWith(needle) ? 1 : 2;
          return { p, rank };
        })
        .sort((a, b) => a.rank - b.rank || b.p.rating - a.p.rating);
      return ranked.map((x) => x.p);
    }
    const out: PlayerSearchSuggestion[] = [];
    const seen = new Set<string>();
    for (const page of serverInfinite.data?.pages ?? []) {
      for (const row of page.players ?? []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(rowToSuggestion(row));
      }
    }
    return out;
  }, [q, useLocal, localSuggestions, serverInfinite.data?.pages]);

  const loading =
    !useLocal &&
    serverSearch &&
    q.length > 0 &&
    (serverInfinite.isPending || (serverInfinite.isFetching && suggestions.length === 0));
  const loadingMore = !useLocal && serverInfinite.isFetchingNextPage;
  const showPanel =
    open &&
    enabled &&
    !disabled &&
    value.trim().length > 0 &&
    q.length > 0 &&
    (loading ||
      suggestions.length > 0 ||
      (!loading && Boolean(useLocal || serverInfinite.isFetched)));

  // Drain remaining server pages while the panel is open so the dropdown is not first-page-only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pages.length retriggers drain after each fetch
  useEffect(() => {
    if (!showPanel || useLocal) return;
    if (
      !serverInfinite.hasNextPage ||
      serverInfinite.isFetchingNextPage ||
      serverInfinite.isPending
    ) {
      return;
    }
    void serverInfinite.fetchNextPage();
  }, [
    showPanel,
    useLocal,
    serverInfinite.hasNextPage,
    serverInfinite.isFetchingNextPage,
    serverInfinite.isPending,
    serverInfinite.data?.pages.length,
    serverInfinite.fetchNextPage,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight when query/results change
  useEffect(() => {
    setHighlight(0);
  }, [q, suggestions.length]);

  useEffect(() => {
    if (!showPanel || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-typeahead-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, showPanel]);

  // Backup: if auto-drain pauses, scrolling the panel still loads the next page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebind observer when suggestion list grows
  useEffect(() => {
    if (!showPanel || useLocal || !sentinelRef.current) return;
    const node = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (serverInfinite.hasNextPage && !serverInfinite.isFetchingNextPage) {
          void serverInfinite.fetchNextPage();
        }
      },
      { root: listRef.current, rootMargin: "40px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [
    showPanel,
    useLocal,
    suggestions.length,
    serverInfinite.hasNextPage,
    serverInfinite.isFetchingNextPage,
    serverInfinite.fetchNextPage,
  ]);

  const pick = (player: PlayerSearchSuggestion) => {
    onSelect(player);
    setOpen(false);
  };

  /** Keep input focus so the first pointer press activates (blur would cancel click). */
  const retainInputFocus = (e: ReactMouseEvent) => {
    e.preventDefault();
  };

  return (
    <Popover open={showPanel} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dama-muted)]"
            aria-hidden
          />
          <Input
            id={id}
            value={value}
            disabled={disabled}
            autoComplete={autoComplete}
            aria-invalid={invalid || undefined}
            placeholder={placeholder}
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls={showPanel ? `${id ?? "player-typeahead"}-list` : undefined}
            className={cn("h-9 pl-8 text-sm", inputClassName)}
            onChange={(e) => {
              onValueChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
              if (!showPanel) {
                if (e.key === "Enter") onEnterWithoutSelection?.();
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((i) =>
                  suggestions.length === 0 ? 0 : Math.min(i + 1, suggestions.length - 1),
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                const row = suggestions[highlight];
                if (row) {
                  pick(row);
                } else {
                  onEnterWithoutSelection?.();
                }
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Pointer on a suggestion is inside the portal; only dismiss true outsides.
          setOpen(false);
          e.preventDefault();
        }}
      >
        {loading && suggestions.length === 0 ? (
          <div className="space-y-1.5 p-2" aria-busy="true" aria-label={chrome.loading_players}>
            <ShimmerBlock className="h-10 w-full rounded-md" />
            <ShimmerBlock className="h-10 w-full rounded-md" />
            <ShimmerBlock className="h-10 w-full rounded-md" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-[var(--dama-muted)]">
            {chrome.empty_players}
          </p>
        ) : (
          <ul
            ref={listRef}
            id={`${id ?? "player-typeahead"}-list`}
            className="max-h-56 list-none overflow-y-auto"
            onMouseDown={retainInputFocus}
          >
            {suggestions.map((p, i) => {
              const status = presenceStatusLabel(p.online, p.playing, {
                online: chrome.online_label,
                playing: chrome.playing_label,
                offline: chrome.offline_label,
              });
              const active = i === highlight;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-typeahead-index={i}
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      active ? "bg-[var(--dama-hover)]" : "hover:bg-[var(--dama-hover)]",
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={retainInputFocus}
                    onClick={() => pick(p)}
                  >
                    <span className="relative h-8 w-8 shrink-0 rounded-md">
                      <DamaUserAvatar src={p.avatar_thumb_url} className="h-8 w-8 rounded-md" />
                      <OnlineStatusDot online={p.online} playing={p.playing} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">
                          {formatPlayerNameDisplay(
                            p.username,
                            chrome.live_player_name_max_chars,
                            chrome.name_truncate_suffix,
                          )}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--dama-muted)]">
                          {chrome.rating_paren_open}
                          {p.rating}
                          {chrome.rating_paren_close}
                        </span>
                        <CountryFlag
                          code={p.country_code}
                          imageUrlTemplate={chrome.country_flag_image_url_template}
                        />
                      </span>
                      <HostTrustBadge
                        label={p.host_trust_badge}
                        tier={p.host_trust_tier}
                        className="mt-0.5 text-[9px]"
                      />
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
                        {status}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!useLocal ? <li ref={sentinelRef} className="h-1 w-full" aria-hidden /> : null}
            {loadingMore ? (
              <li className="px-2 py-2 text-center text-[10px] text-[var(--dama-muted)]">
                {chrome.loading_more}
              </li>
            ) : null}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
