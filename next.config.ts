import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  experimental: {
    serverActions: {
      // Headroom over the 10MB proof-of-payment cap in lib/uploads/image.ts, so
      // oversized files reach our validator instead of dying in the body parser.
      bodySizeLimit: '12mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
