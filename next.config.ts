import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "res.cloudinary.com" },
      { hostname: "*.public.blob.vercel-storage.com" },
      { hostname: "images.clerk.dev" },
    ],
  },
};

export default nextConfig;
