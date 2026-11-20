/**
 * Trim / Paddle invoice day: "10th October 2026" (UTC calendar day, no time).
 */
export function formatReceiptDay(raw: string | Date | null | undefined, empty = ""): string {
  if (raw == null || raw === "") return empty;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return empty;
  const day = d.getUTCDate();
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${day}${englishDayOrdinal(day)} ${month} ${year}`;
}

function englishDayOrdinal(d: number): string {
  if (d % 100 >= 11 && d % 100 <= 13) return "th";
  switch (d % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** Human payment-method line (never the raw channel slug). */
export function paymentMethodDisplay(provider: string | undefined | null): string {
  const ch = (provider || "").trim().toLowerCase();
  switch (ch) {
    case "manual_transfer":
    case "manual":
      return "Manual bank transfer";
    case "local_checkout":
    case "chapa":
      return "Local checkout";
    case "international_checkout":
    case "paddle":
      return "Card payment";
    default:
      return "";
  }
}
