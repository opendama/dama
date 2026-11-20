"use client";

import { cn } from "@/lib/utils";
import { Bot, Loader2, type LucideIcon, UserRound } from "lucide-react";

type PlayerSlotProps = {
  name: string;
  turnHint: string | null;
  captures: number;
  capturesLabel: string;
  active: boolean;
  icon: LucideIcon;
  busy: boolean;
  online?: boolean | null;
  playing?: boolean | null;
  pieceSide?: "light" | "dark";
};

function PlayerSlot({
  name,
  turnHint,
  captures,
  capturesLabel,
  active,
  icon: Icon,
  busy,
  online,
  playing,
  pieceSide = "light",
}: PlayerSlotProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors sm:flex-row sm:items-center sm:justify-between",
        active
          ? "border-[var(--dama-text)] bg-[var(--dama-text)] text-[var(--dama-bg)]"
          : "border-[var(--dama-border)] bg-[var(--dama-card)] text-[var(--dama-text)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative shrink-0">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-black/15"
            style={{
              background:
                pieceSide === "light" ? "var(--dama-piece-light)" : "var(--dama-piece-dark)",
              color: pieceSide === "light" ? "var(--dama-piece-dark)" : "var(--dama-piece-light)",
            }}
            aria-hidden
          >
            <Icon className="h-2.5 w-2.5" />
          </span>
          {online != null || playing != null ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2",
                playing
                  ? "bg-[var(--dama-playing)]"
                  : online
                    ? "bg-[var(--dama-online)]"
                    : "bg-[var(--dama-offline)]",
                active ? "ring-[var(--dama-text)]" : "ring-[var(--dama-card)]",
              )}
              aria-hidden
            />
          ) : null}
        </span>
        <p className="flex min-w-0 items-baseline gap-1 text-sm font-semibold">
          <span className="min-w-0 truncate">{name}</span>
          {turnHint ? (
            <span
              className={cn(
                "shrink-0 text-[11px] font-normal sm:text-xs",
                active ? "opacity-90" : "text-[var(--dama-muted)]",
              )}
            >
              ({turnHint.trim().replace(/^\(+/, "").replace(/\)+$/, "").trim()})
            </span>
          ) : null}
        </p>
        {busy ? (
          <Loader2
            className={cn(
              "h-4 w-4 shrink-0 animate-spin sm:ml-auto",
              active ? "opacity-80" : "text-[var(--dama-muted)]",
            )}
            aria-hidden
          />
        ) : null}
      </div>
      <span
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums",
          active
            ? "bg-[var(--dama-bg)]/20 text-[var(--dama-bg)]"
            : "bg-[var(--dama-surface)] text-[var(--dama-muted)]",
        )}
        title={capturesLabel}
      >
        {captures}
      </span>
    </div>
  );
}

export type GameTurnStatusProps = {
  yourName: string;
  opponentName: string;
  yourTurnLabel: string;
  opponentTurnLabel: string;
  replayLabel: string;
  vsSeparator: string;
  /** DB play_chrome captures_* labels (no invent title). */
  yourCapturesLabel: string;
  opponentCapturesLabel: string;
  mode: "ai" | "pvp";
  yourPlayer: 1 | 2 | null;
  turn: number;
  yourCaptures: number;
  opponentCaptures: number;
  isBusy: boolean;
  opponentThinking?: boolean;
  replayIndex: number | null;
  historyLength: number;
  yourOnline?: boolean | null;
  yourPlaying?: boolean | null;
  opponentOnline?: boolean | null;
  opponentPlaying?: boolean | null;
};

/** Seat-relative turn chrome (smart-menu GameTurnStatus). */
export function GameTurnStatus({
  yourName,
  opponentName,
  yourTurnLabel,
  opponentTurnLabel,
  replayLabel,
  vsSeparator,
  yourCapturesLabel,
  opponentCapturesLabel,
  mode,
  yourPlayer,
  turn,
  yourCaptures,
  opponentCaptures,
  isBusy,
  opponentThinking = false,
  replayIndex,
  historyLength,
  yourOnline,
  yourPlaying,
  opponentOnline,
  opponentPlaying,
}: GameTurnStatusProps) {
  const isYourTurn = yourPlayer != null && turn === yourPlayer;
  const isOpponentTurn = yourPlayer != null && turn !== yourPlayer;

  if (replayIndex !== null) {
    const label =
      replayIndex <= 0 ? replayLabel : `${replayLabel} · ${replayIndex}/${historyLength}`;
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-dashed border-[var(--dama-border)] bg-[var(--dama-surface)]/40 px-4 py-3 text-center text-sm text-[var(--dama-muted)]">
          {label}
        </div>
        <div className="flex items-stretch gap-2">
          <PlayerSlot
            name={yourName}
            turnHint={null}
            captures={yourCaptures}
            capturesLabel={yourCapturesLabel}
            active={false}
            icon={UserRound}
            busy={false}
            online={yourOnline}
            playing={yourPlaying}
            pieceSide={yourPlayer === 2 ? "dark" : "light"}
          />
          <PlayerSlot
            name={opponentName}
            turnHint={null}
            captures={opponentCaptures}
            capturesLabel={opponentCapturesLabel}
            active={false}
            icon={mode === "ai" ? Bot : UserRound}
            busy={false}
            online={opponentOnline}
            playing={opponentPlaying}
            pieceSide={yourPlayer === 2 ? "light" : "dark"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="truncate text-center text-xs font-medium text-[var(--dama-muted)]">
        {yourName}
        {vsSeparator}
        {opponentName}
      </p>
      <div className="flex items-stretch gap-2">
        <PlayerSlot
          name={yourName}
          turnHint={isYourTurn ? yourTurnLabel : null}
          captures={yourCaptures}
          capturesLabel={yourCapturesLabel}
          active={isYourTurn}
          icon={UserRound}
          busy={isBusy && isYourTurn}
          online={yourOnline}
          playing={yourPlaying}
          pieceSide={yourPlayer === 2 ? "dark" : "light"}
        />
        <PlayerSlot
          name={opponentName}
          turnHint={isOpponentTurn ? opponentTurnLabel : null}
          captures={opponentCaptures}
          capturesLabel={opponentCapturesLabel}
          active={isOpponentTurn}
          icon={mode === "ai" ? Bot : UserRound}
          busy={opponentThinking && isOpponentTurn}
          online={opponentOnline}
          playing={opponentPlaying}
          pieceSide={yourPlayer === 2 ? "light" : "dark"}
        />
      </div>
    </div>
  );
}
