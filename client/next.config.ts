import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second build (e.g. the onboarding demo recorder) use its own folder without clobbering `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Let components import .mp4 files from src/assets; the import resolves to a URL.
  turbopack: {
    rules: {
      "*.mp4": { type: "asset" },
    },
  },
  webpack(config) {
    config.module.rules.push({ test: /\.mp4$/, type: "asset/resource" });
    return config;
  },
};

export default nextConfig;
