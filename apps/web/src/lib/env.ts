/** Public env accessors. No localhost hardcode fallbacks.
 *  Next.js only inlines static `process.env.NEXT_PUBLIC_*` reads on the client -
 *  never use dynamic `process.env[name]`.
 */

function requirePublic(raw: string | undefined, name: string): string {
  if (!raw || !raw.trim()) {
    throw new Error(`${name} is required (set it in .env; no hardcoded URL fallback)`);
  }
  return raw.trim().replace(/\/$/, "");
}

export function apiGraphqlUrl(): string {
  return requirePublic(process.env.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL");
}

export function apiRestUrl(): string {
  return requirePublic(process.env.NEXT_PUBLIC_REST_URL, "NEXT_PUBLIC_REST_URL");
}

export function apiWsUrl(): string {
  return requirePublic(process.env.NEXT_PUBLIC_WS_URL, "NEXT_PUBLIC_WS_URL");
}
