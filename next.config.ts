import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Task attachments are uploaded through Server Actions (UPLOAD_MAX_BYTES defaults to 10 MB).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
