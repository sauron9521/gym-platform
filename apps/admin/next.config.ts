import type { NextConfig } from 'next';

import { getAdminApiOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/ui-web'],
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: getAdminApiOrigin(process.env.GYM_API_INTERNAL_URL) + '/:path*',
      },
    ];
  },
};

export default nextConfig;
