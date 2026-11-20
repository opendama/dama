/** Shared paid/settled status display helpers (backend stamps display_status). */

export function receiptDisplayStatusCode(r: {
  display_status?: string;
  status?: string;
}): string {
  const display = (r.display_status || "").trim();
  if (display) return display;
  const raw = (r.status || "").trim();
  if (raw.toLowerCase() === "approved") return "paid";
  return raw;
}

/**
 * Orphan manual receipt rows are projected as topups whose id == receipt_id and
 * whose DB status is approved. Display as paid (never rewrite payout "approved").
 */
export function txnDisplayStatusCode(t: {
  kind?: string;
  id?: string;
  receipt_id?: string;
  status?: string;
}): string {
  const st = (t.status || "").trim();
  const kind = (t.kind || "").trim().toLowerCase();
  const id = (t.id || "").trim();
  const rid = (t.receipt_id || "").trim();
  if (kind === "topup" && rid && id && rid === id && st.toLowerCase() === "approved") {
    return "paid";
  }
  return st;
}

export function isPaidStatusCode(code: string): boolean {
  return (code || "").trim().toLowerCase() === "paid";
}

/** Tailwind classes for paid status text (lists/modals). */
export function paidStatusTextClass(code: string, fallback = "text-[var(--dama-muted)]"): string {
  return isPaidStatusCode(code) ? "text-[var(--dama-success)]" : fallback;
}

/** Tailwind classes for paid status badge (documents/print). */
export function paidStatusBadgeClass(code: string): string {
  if (isPaidStatusCode(code)) {
    return "inline-flex items-center rounded-[4px] bg-[var(--dama-success)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white print:bg-[#27a644] print:text-white";
  }
  return "inline-flex items-center rounded-[4px] bg-[var(--dama-gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--dama-gold-foreground,#ffffff)] print:bg-[#a31d38] print:text-white";
}
