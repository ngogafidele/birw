// Defines Next.js configuration for the inventory application.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [55, 75],
  },
  serverExternalPackages: ["pdfkit"],
  typescript: {
    ignoreBuildErrors: true
  }
  /* config options here */
};

export default nextConfig;
