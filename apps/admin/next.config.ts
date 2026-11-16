import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/ui-web'],
};

export default nextConfig;
