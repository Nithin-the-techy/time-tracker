import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-3e68a1da-0d84-4a2d-9d13-e2fce3167dd0.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
