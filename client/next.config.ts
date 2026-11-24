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
  /*
    Production: proxy /api/* to the Express API so the browser only ever talks to the web app's own origin.
    *.vercel.app is on the Public Suffix List, so app.vercel.app and api.vercel.app are different *sites*:
    the API's auth cookies would be third-party and get dropped (SameSite=Lax) or blocked (Safari, Firefox,
    Brave, Chrome with 3P cookies off). Through this rewrite they're first-party cookies on the web app.
    Set API_PROXY_TARGET (e.g. https://starkfitiq-api.vercel.app) and NEXT_PUBLIC_API_URL=/api on the web app.
    Unset locally, so dev keeps calling http://localhost:4000/api directly.
  */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");
    return target ? [{ source: "/api/:path*", destination: `${target}/api/:path*` }] : [];
  },
};

export default nextConfig;
