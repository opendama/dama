/** Telegram-style chat clocks + day separators (locale-aware; labels from DB chrome). */

export type ChatDateChrome = {
  chat_date_today: string;
  chat_date_yesterday: string;
};

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Bubble footer clock - e.g. "2:45 PM" / "14:45" per locale. */
export function formatChatMessageTime(iso: string | undefined | null): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(t));
  } catch {
    const d = new Date(t);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}

/** Day bucket key YYYY-MM-DD in local timezone. */
export function chatDayKey(iso: string | undefined | null): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Centered separator label: Today / Yesterday / full date. */
export function formatChatDateSeparator(
  iso: string | undefined | null,
  chrome: ChatDateChrome,
): string {
  const raw = (iso || "").trim();
  if (!raw) return "";
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return "";
  const msg = new Date(t);
  const today = startOfLocalDay(new Date());
  const msgDay = startOfLocalDay(msg);
  const dayMs = 24 * 60 * 60 * 1000;
  if (msgDay === today) return (chrome.chat_date_today || "").trim();
  if (msgDay === today - dayMs) return (chrome.chat_date_yesterday || "").trim();
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(msg);
  } catch {
    return chatDayKey(raw);
  }
}

export type ChatTimelineItem<T extends { id: string; created_at?: string }> =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; msg: T };

/** Insert date separators when the calendar day changes (Telegram thread). */
export function buildChatTimeline<T extends { id: string; created_at?: string }>(
  messages: T[],
  chrome: ChatDateChrome,
): ChatTimelineItem<T>[] {
  const out: ChatTimelineItem<T>[] = [];
  let prevDay = "";
  for (const msg of messages) {
    const day = chatDayKey(msg.created_at);
    if (day && day !== prevDay) {
      const label = formatChatDateSeparator(msg.created_at, chrome);
      if (label) {
        out.push({ kind: "date", key: `date-${day}`, label });
      }
      prevDay = day;
    }
    out.push({ kind: "message", msg });
  }
  return out;
}
