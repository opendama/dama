import { apiRestUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useMutation } from "@tanstack/react-query";

/** Trim billing download CD parser - prefer RFC 5987 filename*= then quoted/plain filename=. */
function filenameFromContentDisposition(header: string): string {
  const raw = (header || "").trim();
  if (!raw) return "";
  const match = /filename\*=(?:UTF-8''|utf-8'')([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(
    raw,
  );
  const value = (match?.[1] || match?.[2] || match?.[3] || "").trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/^["']|["']$/g, ""));
  } catch {
    return value.replace(/^["']|["']$/g, "");
  }
}

function filenameFromChrome(fmt: string | undefined, id: string): string {
  const tpl = (fmt || "dama-receipt-{id}.pdf").trim();
  const safeId = (id || "receipt").trim() || "receipt";
  const name = tpl.replaceAll("{id}", safeId).replace(/[\\/:*?"<>|]+/g, "-");
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

/** Download first-party payment receipt PDF (Trim useDownloadReceiptPdf parity). */
export function useDownloadPaymentReceiptPdfMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async (args: {
      receiptId: string;
      /** Absolute API path, e.g. /payments/receipts/{id}/pdf */
      href?: string;
      failedMessage?: string;
      filenameFmt?: string;
      console?: boolean;
    }) => {
      const failed = (args.failedMessage || "").trim();
      const id = (args.receiptId || "").trim();
      if (!token || !id) throw new Error(failed);
      const href =
        (args.href || "").trim() ||
        (args.console
          ? `/payments/console/receipts/${encodeURIComponent(id)}/pdf`
          : `/payments/receipts/${encodeURIComponent(id)}/pdf`);
      if (!href.startsWith("/")) throw new Error(failed);
      const res = await fetch(`${apiRestUrl()}${href}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
        },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 401) {
        clearSessionAndBounceToLogin();
        throw new Error(failed);
      }
      if (!res.ok) throw new Error(failed);
      const buf = await res.arrayBuffer();
      if (!buf || buf.byteLength < 5) throw new Error(failed);
      const head = new TextDecoder("ascii").decode(
        new Uint8Array(buf, 0, Math.min(8, buf.byteLength)),
      );
      if (!head.startsWith("%PDF")) throw new Error(failed);
      const filename =
        (res.headers.get("X-Dama-Download-Filename") || "").trim() ||
        filenameFromContentDisposition(res.headers.get("Content-Disposition") || "") ||
        filenameFromChrome(args.filenameFmt, id);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    meta: { skipToast: true },
  });
}
