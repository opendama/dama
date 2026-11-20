"use client";

/** Telegram-style centered day chip between message groups. */
export function ChatDateSeparator({ label }: { label: string }) {
  const text = label.trim();
  if (!text) return null;
  return (
    <li className="list-none flex justify-center px-3 py-2" aria-hidden={false}>
      <span className="rounded-full bg-[var(--dama-panel)]/90 px-3 py-1 text-[11px] font-semibold text-[var(--dama-muted)] shadow-sm ring-1 ring-[var(--dama-border)]/70">
        {text}
      </span>
    </li>
  );
}
