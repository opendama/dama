import { apiRestUrl } from "@/lib/env";
import { useMutation } from "@tanstack/react-query";

export function useDataExportMutation(token: string | null | undefined) {
  return useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("");
      const res = await fetch(`${apiRestUrl()}/me/data-export`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Chrome-only at call sites - never put API JSON bodies on Error.message.
        throw new Error("");
      }
      const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
      if (contentType.includes("application/json") && !contentType.includes("spreadsheet")) {
        throw new Error("");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = (match?.[1] || "").trim();
      if (!filename) {
        throw new Error("");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
