import { apiRestUrl } from "@/lib/env";

export function resolvePublicMediaUrl(raw: string | undefined | null): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/api/v1/media/")) {
    const rest = apiRestUrl().replace(/\/$/, "");
    const origin = rest.replace(/\/api\/v1$/i, "");
    return `${origin}${trimmed}`;
  }
  return trimmed;
}
