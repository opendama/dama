"use client";

import { arenaRemainingMs } from "@/lib/competition-arena";
import { useEffect, useState } from "react";

type Props = {
  arenaEndsAt: string | null | undefined;
  clockLabel: string;
};

function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ArenaClock({ arenaEndsAt, clockLabel }: Props) {
  const label = clockLabel.trim();
  const [remaining, setRemaining] = useState(() => arenaRemainingMs(arenaEndsAt));

  useEffect(() => {
    setRemaining(arenaRemainingMs(arenaEndsAt));
    const id = window.setInterval(() => {
      setRemaining(arenaRemainingMs(arenaEndsAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [arenaEndsAt]);

  if (!label) return null;
  if (remaining <= 0) return null;

  return (
    <p className="text-sm font-medium text-[var(--dama-gold)]">
      {label} <span className="tabular-nums">{formatRemaining(remaining)}</span>
    </p>
  );
}
