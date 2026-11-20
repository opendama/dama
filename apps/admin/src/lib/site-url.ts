import { headers } from "next/headers";

/** Absolute admin origin for metadataBase / icons (fail closed empty). */
export function siteOrigin(): string {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  // Local/dev: PORT from env (same value Next listens on) - never invent a host without it.
  const port = (process.env.PORT || "").trim();
  if (/^\d+$/.test(port)) return `http://127.0.0.1:${port}`;
  return "";
}

/** Configured site URL, else request Host (covers local port auto-fallback). */
export async function resolveMetadataOrigin(): Promise<string> {
  const configured = siteOrigin();
  if (configured) return configured;
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").trim();
    if (!host) return "";
    const proto = (h.get("x-forwarded-proto") || "http").split(",")[0]?.trim() || "http";
    return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}
