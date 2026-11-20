import { isApiClientError } from "@/lib/api-client-error";

/** Fail-closed admin chrome: DB/API string only (never invent client copy). */
export function adminConsoleChromeUnavailable(
  data?: {
    admin_console_chrome_unavailable?: string;
  } | null,
  err?: unknown,
): string {
  const fromData = (data?.admin_console_chrome_unavailable || "").trim();
  if (fromData) return fromData;
  if (isApiClientError(err)) {
    const fromApi = (err.apiError || "").trim();
    if (fromApi) return fromApi;
  }
  // queryFn throws Error(unavailable) when chrome JSON is incomplete - surface it.
  if (err instanceof Error) {
    const fromMsg = (err.message || "").trim();
    if (fromMsg) return fromMsg;
  }
  return "";
}
