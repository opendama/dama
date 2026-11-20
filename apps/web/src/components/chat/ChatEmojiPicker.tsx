"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChatEmojiCatalogQuery } from "@/hooks/query/useChatEmojiCatalogQuery";
import {
  type ChatEmojiCatalog,
  isChatEmojiCatalogReady,
  searchChatEmojis,
} from "@/lib/chat-emoji-catalog";
import { cn } from "@/lib/utils";
import { Search, Smile } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

type ChromeStrings = {
  searchPlaceholder: string;
  searchEmpty: string;
  resultsPrefix: string;
};

type Props = {
  ariaLabel: string;
  chrome: ChromeStrings;
  onPick: (emoji: string) => void;
  disabled?: boolean;
  /** Compact trigger for reaction rows (ignored when `children` is set). */
  triggerClassName?: string;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  /**
   * When true, outside click / Escape dismisses reliably (reaction flow).
   * Composer keeps the default (false) so the page can still scroll.
   */
  modal?: boolean;
  /** Optional preloaded catalog (avoids nested query when parent already has it). */
  catalog?: ChatEmojiCatalog | null;
  /** Custom trigger (e.g. Reply-row “React” control). */
  children?: ReactElement;
};

export function ChatEmojiPicker({
  ariaLabel,
  chrome,
  onPick,
  disabled,
  triggerClassName,
  side = "top",
  align = "start",
  modal = false,
  catalog: catalogProp,
  children,
}: Props) {
  const catalogQuery = useChatEmojiCatalogQuery(!catalogProp && !disabled);
  const catalog = catalogProp
    ? catalogProp
    : isChatEmojiCatalogReady(catalogQuery.data)
      ? catalogQuery.data
      : null;
  const catalogReady = Boolean(catalog);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catId, setCatId] = useState<string>("");

  const activeCat = useMemo(() => {
    const first = catalog?.categories[0];
    if (!first) return null;
    const id = catId || first.id;
    return catalog.categories.find((c) => c.id === id) ?? first;
  }, [catalog, catId]);

  const searchHits = useMemo(
    () => (catalog ? searchChatEmojis(catalog, query) : []),
    [catalog, query],
  );

  const gridEmojis = useMemo(() => {
    if (query.trim()) return searchHits.map((h) => h.glyph);
    return activeCat?.emojis.map((x) => x.glyph) ?? [];
  }, [query, searchHits, activeCat]);

  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-9 w-9 shrink-0 rounded-full px-0", triggerClassName)}
      aria-label={ariaLabel}
      disabled={disabled || !catalogReady}
    >
      <Smile className="h-4 w-4" aria-hidden />
    </Button>
  );

  if (!catalogReady && !children) {
    return defaultTrigger;
  }

  return (
    <Popover
      modal={modal}
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled || !catalogReady}>
        {children ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
        onPointerDownOutside={() => setOpen(false)}
        onEscapeKeyDown={() => setOpen(false)}
        className="z-[240] flex h-[22rem] w-[20rem] flex-col gap-2 border-[var(--dama-border)] bg-[var(--dama-panel)] p-2 shadow-xl"
      >
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dama-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={chrome.searchPlaceholder}
            className="h-9 w-full rounded-lg border border-[var(--dama-border)] bg-[var(--dama-surface)] pl-8 pr-2 text-sm text-[var(--dama-text)] outline-none placeholder:text-[var(--dama-muted)] focus:border-[var(--dama-brand)]"
          />
        </div>

        {!query.trim() && catalog ? (
          <div className="flex shrink-0 gap-0.5 overflow-x-auto pb-0.5">
            {catalog.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base transition-colors",
                  (catId || catalog.categories[0]?.id) === c.id
                    ? "bg-[var(--dama-brand)]/15 ring-1 ring-[var(--dama-brand)]/40"
                    : "hover:bg-[var(--dama-hover)]",
                )}
                onClick={() => setCatId(c.id)}
              >
                <span className="dama-emoji" aria-hidden>
                  {c.icon}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {!query.trim() ? (
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {activeCat?.label}
            </p>
          ) : (
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dama-muted)]">
              {chrome.resultsPrefix} ({gridEmojis.length})
            </p>
          )}
          <div className="grid grid-cols-8 gap-0.5">
            {gridEmojis.map((glyph) => (
              <button
                key={glyph}
                type="button"
                className="dama-emoji flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-[var(--dama-hover)]"
                onClick={() => {
                  onPick(glyph);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {glyph}
              </button>
            ))}
          </div>
          {gridEmojis.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[var(--dama-muted)]">
              {chrome.searchEmpty}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
