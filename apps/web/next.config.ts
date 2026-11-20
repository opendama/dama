import type { NextConfig } from "next";

const mediaHost = process.env.NEXT_PUBLIC_MEDIA_CDN_HOST?.trim();

const nextConfig: NextConfig = {
  transpilePackages: ["@dama/ui", "three", "@react-three/fiber", "@react-three/drei"],
  output: "standalone",
  images: {
    // Hostname comes from env so the repo does not hardcode a CDN vendor.
    remotePatterns: mediaHost ? [{ protocol: "https", hostname: mediaHost }] : [],
  },
  // Player UX: one Tournament discovery surface (no second Event browse / Official-only page).
  // Query strings (code/id/source) are preserved by Next redirects by default.
  async redirects() {
    return [
      {
        source: "/events/public",
        destination: "/?view=tournaments&source=community",
        permanent: false,
      },
      {
        source: "/events/public/:path*",
        destination: "/?view=tournaments&source=community",
        permanent: false,
      },
      {
        source: "/tournaments",
        destination: "/?view=tournaments",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
