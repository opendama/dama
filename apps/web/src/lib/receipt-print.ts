/**
 * Print the live payment-receipt article only (browser print / Save-as-PDF).
 *
 * Download PDF is a separate path: Go GET /payments/receipts/{id}/pdf via
 * useDownloadPaymentReceiptPdfMutation (Trim Download ≠ Print).
 *
 * Dark mode: temporarily force light theme on <html> before window.print().
 * Otherwise near-white text paints on white paper and the receipt looks blank.
 *
 * Do not run onAfterPrint while the system print dialog is still open
 * (short timeouts mutate DOM mid-dialog).
 */
export function printReceiptArticle(
  root: HTMLElement,
  documentTitle?: string,
  onAfterPrint?: () => void,
): void {
  const priorTitle = document.title;
  if (documentTitle?.trim()) {
    document.title = documentTitle.trim();
  }

  if (!root.hasAttribute("data-receipt-print")) {
    root.setAttribute("data-receipt-print", "");
  }

  const html = document.documentElement;
  const hadDark = html.classList.contains("dark");
  const priorScheme = html.style.colorScheme;
  const priorDamaTheme = html.getAttribute("data-dama-theme");

  // Force light surface tokens for the print snapshot.
  if (hadDark) {
    html.classList.remove("dark");
  }
  html.style.colorScheme = "light";
  html.setAttribute("data-dama-theme", "light");
  html.setAttribute("data-dama-print-light", "1");

  let done = false;
  let fallbackTimer = 0;
  const cleanup = () => {
    if (done) return;
    done = true;
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = 0;
    }
    document.title = priorTitle;
    window.removeEventListener("afterprint", cleanup);

    html.removeAttribute("data-dama-print-light");
    if (hadDark) {
      html.classList.add("dark");
    }
    html.style.colorScheme = priorScheme;
    if (priorDamaTheme) {
      html.setAttribute("data-dama-theme", priorDamaTheme);
    } else {
      html.removeAttribute("data-dama-theme");
    }

    try {
      onAfterPrint?.();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("afterprint", cleanup);

  // Double rAF: let the light-theme repaint settle before the print snapshot.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
      // Ultimate fallback only (browsers that never emit afterprint).
      fallbackTimer = window.setTimeout(cleanup, 120_000);
    });
  });
}

/**
 * @deprecated Prefer useDownloadPaymentReceiptPdfMutation (Go first-party PDF).
 * Kept as a thin print helper for accidental call sites; does not fetch /pdf.
 */
export function downloadReceiptArticlePdf(
  root: HTMLElement,
  opts: { title?: string; filename?: string; onAfterPrint?: () => void },
): void {
  void opts.filename;
  const printTitle = (opts.title || document.title || "").trim();
  printReceiptArticle(root, printTitle || undefined, opts.onAfterPrint);
}
