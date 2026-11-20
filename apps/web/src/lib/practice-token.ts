import { restClient } from "@/lib/api";

const PRACTICE_KEY = "dama-practice-token";

type GuestSession = {
  access_token?: string;
};

/** Ephemeral guest JWT for free VS-AI only (not a signed-in account). */
export async function ensurePracticeToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const existing = sessionStorage.getItem(PRACTICE_KEY)?.trim();
  if (existing) return existing;
  try {
    const { data } = await restClient.post<GuestSession>("/auth/guest", {});
    const token = (data.access_token || "").trim();
    if (!token) return null;
    sessionStorage.setItem(PRACTICE_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export function clearPracticeToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PRACTICE_KEY);
}

export function readPracticeToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PRACTICE_KEY)?.trim() || null;
}
