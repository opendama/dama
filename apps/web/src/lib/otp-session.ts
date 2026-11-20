/** Client OTP verify marker (mirrors SessionSecurity sessionStorage). */

export const OTP_SESSION_EVENT = "dama-otp-session";

export function otpSessionKey(userId: string): string {
  return `dama_otp_ok_${userId}`;
}

export function isOtpSessionVerified(userId: string | null | undefined): boolean {
  if (!userId || typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(otpSessionKey(userId)) === "1";
}

function notifyOtpSessionListeners(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OTP_SESSION_EVENT));
}

export function markOtpSessionVerified(userId: string | null | undefined): void {
  if (!userId || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(otpSessionKey(userId), "1");
  notifyOtpSessionListeners();
}

export function clearOtpSession(userId: string | null | undefined): void {
  if (!userId || typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(otpSessionKey(userId));
  notifyOtpSessionListeners();
}

/** Subscribe for play auto-start / gates that must re-run after OTP verify. */
export function subscribeOtpSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OTP_SESSION_EVENT, onStoreChange);
  return () => window.removeEventListener(OTP_SESSION_EVENT, onStoreChange);
}
