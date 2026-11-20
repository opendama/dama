import type { MetadataRoute } from "next";

/** Console is private ops surface: block indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
      },
    ],
  };
}
