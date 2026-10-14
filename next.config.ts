import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '/rewards',
  trailingSlash: true,
};

export default nextConfig;
