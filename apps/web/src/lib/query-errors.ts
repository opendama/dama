import { isApiClientError } from "@/lib/api-client-error";
import { isAxiosError, isCancel } from "axios";

/** Request aborted by React Query unmount / key change - never toast. */
export function isQueryRequestCanceled(error: unknown): boolean {
  if (isCancel(error)) return true;
  if (isAxiosError(error) && error.code === "ERR_CANCELED") return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error && /cancel|abort/i.test(error.message)) return true;
  return false;
}

/**
 * Axios transport failure with no HTTP response (API down, CORS hide,
 * offline, connection reset). Normalized to errorKey network_unavailable.
 */
export function isTransportNetworkError(error: unknown): boolean {
  if (isApiClientError(error) && error.errorKey === "network_unavailable") return true;
  if (error instanceof Error && error.message === "network_unavailable") return true;
  if (!isAxiosError(error)) return false;
  if (error.code === "ERR_NETWORK") return true;
  return !error.response && error.message === "Network Error";
}

/**
 * Membership GET (`/friends/`) should only toast on a hard first-load failure.
 * Background refetch blips keep cached data (`isError` true, `isLoadingError` false)
 * - same lesson as DM/game chat thread panels.
 */
export function shouldToastFriendsMembershipFailure(query: {
  isLoadingError: boolean;
  error: unknown;
}): boolean {
  if (!query.isLoadingError) return false;
  if (isQueryRequestCanceled(query.error)) return false;
  return true;
}
