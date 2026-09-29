import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow multipart overhead around the app's 2 MB photo limit.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
