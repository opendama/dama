import { siteOrigin } from "@/lib/site-url";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/refunds", "/tournaments", "/play", "/leaderboard"],
        disallow: [
          "/dashboard",
          "/wallet",
          "/transactions",
          "/receipts",
          "/settings",
          "/profile",
          "/ads/",
          "/events/",
          "/auth/",
          "/api/",
          "/matchmaking",
          "/spectate",
          "/players/",
        ],
      },
    ],
    ...(origin
      ? {
          sitemap: `${origin}/sitemap.xml`,
          host: origin.replace(/^https?:\/\//, ""),
        }
      : {}),
  };
}
