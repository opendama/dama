import { envPathLogin } from "@/lib/app-paths";
import { useAuthStore } from "@/store/auth";

let bouncing = false;

/** Clear zombie JWT and hard-navigate to console login (Trim dashboard 401 hygiene). */
export function clearSessionAndBounceToLogin() {
  useAuthStore.getState().clearSession();
  if (typeof window === "undefined" || bouncing) return;
  const login = envPathLogin();
  if (!login) return;
  bouncing = true;
  const sep = login.includes("?") ? "&" : "?";
  window.location.replace(`${login}${sep}error=unauthorized`);
}
