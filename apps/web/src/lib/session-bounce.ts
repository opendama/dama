import { envPathLogin } from "@/lib/app-paths";
import { isPublicGuestPath } from "@/lib/player-nav";
import { useAuthStore } from "@/store/auth";

let bouncing = false;

/** Clear zombie JWT; hard-navigate to login only on ops routes (never public Play hub). */
export function clearSessionAndBounceToLogin() {
  useAuthStore.getState().clearSession();
  if (typeof window === "undefined" || bouncing) return;
  const path = window.location.pathname || "/";
  const search = window.location.search || "";
  // Public discovery / AI practice must stay open without an account.
  if (isPublicGuestPath(path, search)) return;
  const login = envPathLogin();
  if (!login) return;
  bouncing = true;
  const sep = login.includes("?") ? "&" : "?";
  window.location.replace(`${login}${sep}error=unauthorized`);
}
