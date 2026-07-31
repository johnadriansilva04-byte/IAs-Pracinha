import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['127.0.0.1'],
  // PWA simplificado para Next.js 16 - sem next-pwa
  // Manifest já está em public/manifest.json
};

export default nextConfig;
