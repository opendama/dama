import type { NextConfig } from "next";

const mediaHost = process.env.NEXT_PUBLIC_MEDIA_CDN_HOST?.trim();

const nextConfig: NextConfig = {
  transpilePackages: ["@dama/ui"],
  output: "standalone",
  images: {
    // Hostname from env so the repo does not hardcode a CDN vendor.
    remotePatterns: mediaHost ? [{ protocol: "https", hostname: mediaHost }] : [],
  },
};

export default nextConfig;
