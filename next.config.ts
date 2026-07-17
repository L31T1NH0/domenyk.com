import type { NextConfig } from "next";
import { BLOB_PUBLIC_HOSTNAME } from "./src/lib/blob-host";

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const privateCacheHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "5mb",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: BLOB_PUBLIC_HOSTNAME },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: privateCacheHeaders },
      { source: "/fale-comigo/:path*", headers: privateCacheHeaders },
      { source: "/notificacoes/:path*", headers: privateCacheHeaders },
      { source: "/api/admin/:path*", headers: privateCacheHeaders },
      { source: "/api/account/:path*", headers: privateCacheHeaders },
      { source: "/api/comments/:path*", headers: privateCacheHeaders },
      { source: "/api/messages/:path*", headers: privateCacheHeaders },
      { source: "/api/notifications/:path*", headers: privateCacheHeaders },
      {
        source: "/push-service-worker.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
