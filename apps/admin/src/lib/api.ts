import { ApiClientError } from "@/lib/api-client-error";
import { normalizeApiErrorPayload } from "@/lib/api-error-payload";
import { apiRestUrl } from "@/lib/env";
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
    const { error, errorKey } = normalizeApiErrorPayload(data);
    if (status === 401 && useAuthStore.getState().token) {
      clearSessionAndBounceToLogin();
    }
    if (errorKey) {
      // Key only in Error.message - keep API `error` on apiError for chrome fail-closed UI.
      return Promise.reject(new ApiClientError("", { status, errorKey, apiError: error }));
    }
    if (typeof status === "number") {
      return Promise.reject(
        new ApiClientError("", { status, errorKey: `http_${status}`, apiError: error }),
      );
    }
    return Promise.reject(new ApiClientError("", { errorKey: "request_failed", apiError: error }));
  },
);

export function authHeaders(token?: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
