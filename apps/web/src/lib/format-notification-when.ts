/**
 * Relative timestamps for notification list rows (Trim formatDateTimeRelative parity).
 * Uses runtime locale; falls back to short absolute after 7 days.
 */

const RELATIVE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function parseUtc(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let candidate = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(candidate)) {
    candidate = candidate.replace(" ", "T");
  }
  candidate = candidate.replace(/([+-]\d{2})$/, "$1:00");
  candidate = candidate.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatNotificationWhen(raw: string, locale?: string): string {
  const date = parseUtc(raw);
  if (!date) return "";
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absMs = Math.abs(diffMs);

  const loc = (locale || "").trim() || undefined;

  if (absMs > RELATIVE_MAX_MS) {
    try {
      return new Intl.DateTimeFormat(loc, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  }

  const absSec = Math.round(absMs / 1000);
  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (absSec < 60) {
    value = Math.round(diffMs / 1000);
    unit = "second";
  } else if (absSec < 3600) {
    value = Math.round(diffMs / 60_000);
    unit = "minute";
  } else if (absSec < 86_400) {
    value = Math.round(diffMs / 3_600_000);
    unit = "hour";
  } else {
    value = Math.round(diffMs / 86_400_000);
    unit = "day";
  }

  try {
    return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(value, unit);
  } catch {
    return "";
  }
}
