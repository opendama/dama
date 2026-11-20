"use client";

import { NeoCourtPiece } from "@/components/game/NeoCourtPiece";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BOARD_PALETTES,
  type BoardPaletteId,
  PIECE_PALETTES,
  type PiecePaletteId,
  useBoardPalette,
  usePiecePalette,
} from "@/lib/board-palette";
import type { PalacePieceRole } from "@/lib/palace-piece";
import { cn } from "@/lib/utils";
import { ChevronDown, Palette } from "lucide-react";

/** Board-visible Neo shapes only: man + king per seat (same silhouette both sides). */
const PIECE_PREVIEW: { role: PalacePieceRole; player: 1 | 2 }[] = [
  { role: "servant", player: 1 },
  { role: "king", player: 1 },
  { role: "servant", player: 2 },
  { role: "king", player: 2 },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerId: string;
  colorsLabel: string;
  boardLabel: string;
  piecesLabel: string;
};

function mixHex(hex: string, toward: string, t: number): string {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m?.[1]) return null;
    const n = Number.parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const a = parse(hex);
  const b = parse(toward);
  if (!a || !b) return hex;
  const k = Math.min(1, Math.max(0, t));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * k);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(mix(a.r, b.r))}${to(mix(a.g, b.g))}${to(mix(a.b, b.b))}`;
}

/**
 * Board + piece palette picker - Neo man/king previews per color pair.
 */
export function BoardColorsPopover({
  open,
  onOpenChange,
  triggerId,
  colorsLabel,
  boardLabel,
  piecesLabel,
}: Props) {
  const [palette, setPalette] = useBoardPalette();
  const [piecePalette, setPiecePalette] = usePiecePalette();
  const summary = `${palette.label} · ${piecePalette.label}`;

  return (
    <div className="space-y-1.5 pt-1">
      <label
        htmlFor={triggerId}
        className="text-xs font-medium text-[var(--dama-muted-foreground)]"
      >
        {colorsLabel}
      </label>
      <Popover open={open} onOpenChange={onOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--dama-border)] bg-[var(--dama-panel)] px-3 text-left text-sm text-[var(--dama-text)] hover:bg-[var(--dama-hover)] data-[state=open]:bg-[var(--dama-hover)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Palette className="h-4 w-4 shrink-0 text-[var(--dama-muted)]" aria-hidden />
              <span className="truncate">{summary}</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-[var(--dama-muted)] transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={16}
          sticky="always"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[200] w-[var(--radix-popover-trigger-width)] max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-3"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--dama-muted-foreground)]">
                {boardLabel}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {BOARD_PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs font-medium",
                      palette.id === p.id
                        ? "border-[var(--dama-brand)] bg-[var(--dama-surface)] text-[var(--dama-text)]"
                        : "border-[var(--dama-border)] text-[var(--dama-muted)] hover:bg-[var(--dama-hover)]",
                    )}
                    onClick={() => setPalette(p.id as BoardPaletteId)}
                  >
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border border-[var(--dama-border)]"
                      style={{
                        background: `linear-gradient(135deg, ${p.boardLight} 50%, ${p.boardDark} 50%)`,
                      }}
                      aria-hidden
                    />
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--dama-muted-foreground)]">
                {piecesLabel}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {PIECE_PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs font-medium",
                      piecePalette.id === p.id
                        ? "border-[var(--dama-brand)] bg-[var(--dama-surface)] text-[var(--dama-text)]"
                        : "border-[var(--dama-border)] text-[var(--dama-muted)] hover:bg-[var(--dama-hover)]",
                    )}
                    onClick={() => setPiecePalette(p.id as PiecePaletteId)}
                  >
                    <span className="flex shrink-0 items-end gap-0.5" aria-hidden>
                      {PIECE_PREVIEW.map(({ role, player }) => {
                        const base =
                          player === 1
                            ? p.pieceLight
                            : p.darkSplit
                              ? `linear-gradient(135deg, ${p.pieceLight} 50%, ${p.pieceDark} 50%)`
                              : p.pieceDark;
                        const shade =
                          player === 1
                            ? mixHex(p.pieceLight, "#64748b", 0.28)
                            : mixHex(p.pieceDark, "#000000", 0.22);
                        return (
                          <span
                            key={`${p.id}-${player}-${role}`}
                            className="relative h-7 w-5"
                            title={role === "king" ? "King" : "Man"}
                          >
                            <NeoCourtPiece role={role} player={player} base={base} shade={shade} />
                          </span>
                        );
                      })}
                    </span>
                    <span className="min-w-0 truncate">
                      {p.label}
                      <span className="mt-0.5 block truncate text-[10px] font-normal opacity-70">
                        {p.lightName} · {p.darkName} · Man · King
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
