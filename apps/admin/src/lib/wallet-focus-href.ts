/** Append/replace `?focus=` on a DB portal wallet href (top-up / payout / receipt). */
export function withWalletFocusParam(href: string, focus: "topup" | "payout" | "receipt"): string {
  const raw = (href || "").trim();
  if (!raw.startsWith("/")) return "";
  try {
    const u = new URL(raw, "http://local.invalid");
    u.searchParams.set("focus", focus);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return "";
  }
}
