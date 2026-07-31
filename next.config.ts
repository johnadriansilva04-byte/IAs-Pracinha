import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  // Removido turbopack para compatibilidade com Vercel
  allowedDevOrigins: ['127.0.0.1'],
  // Configuração para Vercel
  output: 'standalone',
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Desabilitar geração de ícones para evitar erro no build
  manifest: "/manifest.json",
})(nextConfig);
