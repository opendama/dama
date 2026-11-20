/** Arena length helpers. Backend stores arena_duration_minutes only. */

export type ArenaDurationUnit = "minutes" | "hours" | "days" | "weeks" | "months";
export type ArenaDurationMode = "length" | "ends_at";

export const ARENA_DURATION_UNITS: ArenaDurationUnit[] = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
];

/** Calendar-month length used for Arena duration (30×24×60). */
export const ARENA_DURATION_MONTH_MINUTES = 30 * 1440;

export function arenaUnitMinutesFactor(unit: ArenaDurationUnit): number {
  switch (unit) {
    case "minutes":
      return 1;
    case "hours":
      return 60;
    case "days":
      return 1440;
    case "weeks":
      return 10080;
    case "months":
      return ARENA_DURATION_MONTH_MINUTES;
  }
}

export function minutesFromAmountUnit(
  amountRaw: string | number,
  unit: ArenaDurationUnit,
): number | null {
  const amount =
    typeof amountRaw === "number" ? amountRaw : Number.parseFloat(String(amountRaw || "").trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minutes = Math.round(amount * arenaUnitMinutesFactor(unit));
  return minutes >= 1 ? minutes : null;
}

/** Prefer the largest whole unit so 10080 → 1 week, 1440 → 1 day, 120 → 2 hours. */
export function splitMinutesToAmountUnit(minutes: number): {
  amount: string;
  unit: ArenaDurationUnit;
} {
  if (!Number.isFinite(minutes) || minutes < 1) {
    return { amount: "", unit: "minutes" };
  }
  const whole = Math.trunc(minutes);
  if (whole % ARENA_DURATION_MONTH_MINUTES === 0) {
    return { amount: String(whole / ARENA_DURATION_MONTH_MINUTES), unit: "months" };
  }
  if (whole % 10080 === 0) return { amount: String(whole / 10080), unit: "weeks" };
  if (whole % 1440 === 0) return { amount: String(whole / 1440), unit: "days" };
  if (whole % 60 === 0) return { amount: String(whole / 60), unit: "hours" };
  return { amount: String(whole), unit: "minutes" };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall value: `YYYY-MM-DDTHH:mm`. */
export function parseLocalDateTimeMs(s: string | null | undefined): number | null {
  const raw = (s || "").trim();
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4] ?? "0");
  const mm = Number(m[5] ?? "0");
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

export function toLocalDateTimeValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Minutes from now until a local end datetime; null if missing/past. */
export function minutesUntilLocalDateTime(
  localDateTime: string,
  nowMs = Date.now(),
): number | null {
  const end = parseLocalDateTimeMs(localDateTime);
  if (end == null) return null;
  const mins = Math.round((end - nowMs) / 60_000);
  return mins >= 1 ? mins : null;
}

export function localDateTimeFromMinutesAhead(minutes: number, nowMs = Date.now()): string {
  const d = new Date(nowMs + Math.max(1, Math.trunc(minutes)) * 60_000);
  return toLocalDateTimeValue(d);
}
