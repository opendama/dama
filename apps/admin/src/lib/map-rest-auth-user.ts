import type { AuthUser } from "@/types/auth";

/** REST `/auth/*` user blobs are snake_case; AuthUser / GraphQL me are camelCase. */
export function mapRestAuthUser(raw: Record<string, unknown> | null | undefined): AuthUser {
  const r = raw ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    id: String(r.id ?? ""),
    username: String(r.username ?? ""),
    role: String(r.role ?? "player"),
    rating: num(r.rating),
    xp: num(r.xp),
    wins: num(r.wins),
    losses: num(r.losses),
    draws: num(r.draws),
    avatarThumbUrl: str(r.avatarThumbUrl) ?? str(r.avatar_thumb_url) ?? null,
    avatarFullUrl: str(r.avatarFullUrl) ?? str(r.avatar_full_url) ?? null,
    region: str(r.region),
    countryCode: str(r.countryCode) ?? str(r.country_code),
  };
}
