import { ApiClientError } from "@/lib/api-client-error";
import { normalizeApiErrorPayload } from "@/lib/api-error-payload";
import { apiRestUrl, apiWsUrl } from "@/lib/env";
import { clearSessionAndBounceToLogin } from "@/lib/session-bounce";
import { useAuthStore } from "@/store/auth";
import axios from "axios";

/** Shared Axios REST client. Domain calls live in hooks/query and hooks/mutation. */
export const restClient = axios.create({
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

restClient.interceptors.request.use((config) => {
  config.baseURL = apiRestUrl();
  return config;
});

restClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number; data?: unknown } }).response?.status
        : undefined;
    const data =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: unknown } }).response?.data
        : undefined;
    const { errorKey } = normalizeApiErrorPayload(data);
    // 401 with persisted JWT: clear session. Soft-fail background probes so
    // presence/fingerprint expiry does not hard-bounce with a scary flash.
    if (status === 401 && useAuthStore.getState().token) {
      const reqUrl =
        err && typeof err === "object" && "config" in err
          ? String((err as { config?: { url?: string } }).config?.url || "")
          : "";
      const softBackground =
        reqUrl.includes("/presence/heartbeat") || reqUrl.includes("/devices/fingerprint");
      if (softBackground) {
        useAuthStore.getState().clearSession();
        // Quiet reject - presence probes must not surface Axios "status code 401" toasts.
        return Promise.reject(new ApiClientError("", { status: 401, errorKey: "session_expired" }));
      }
      clearSessionAndBounceToLogin();
    }
    if (errorKey) {
      // Key only - never put API `error` English/JSON into Error.message
      // (accidental toast.error(err.message) must not surface server copy).
      return Promise.reject(new ApiClientError("", { status, errorKey }));
    }
    // Prefer concise status text over Axios "Request failed with status code N".
    if (typeof status === "number" && status === 401) {
      return Promise.reject(new ApiClientError("", { status: 401, errorKey: "unauthorized" }));
    }
    // Normalize classic Axios "Network Error" (no HTTP response) so UI never
    // surfaces the raw transport string as a toast description.
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code || "")
        : "";
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message || "")
        : "";
    if (!status && (code === "ERR_NETWORK" || msg === "Network Error")) {
      return Promise.reject(new ApiClientError("", { errorKey: "network_unavailable" }));
    }
    // Last resort: never leak Axios response bodies as Error.message.
    if (typeof status === "number") {
      return Promise.reject(new ApiClientError("", { status, errorKey: `http_${status}` }));
    }
    return Promise.reject(new ApiClientError("", { errorKey: "request_failed" }));
  },
);

export function authHeaders(token?: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Build authenticated game WebSocket URL (raw Go WSS, not GraphQL). */
export function resolveWsUrl(gameId: string, token?: string | null): string | null {
  const base = apiWsUrl();
  try {
    const url = new URL(base.endsWith("/game") ? base : `${base.replace(/\/$/, "")}/game`);
    url.searchParams.set("game_id", gameId);
    if (token) url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}
