import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
